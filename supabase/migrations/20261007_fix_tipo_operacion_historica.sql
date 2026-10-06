CREATE OR REPLACE FUNCTION public.importar_operacion_historica(
  p_lote_id bigint,
  p_origen text,
  p_fila_origen integer,
  p_datos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_operacion_id text;
  v_cliente_id bigint;
  v_domicilio_id bigint;
  v_producto_operacion_id bigint;
  v_producto public.productos%rowtype;
BEGIN
  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'Lote requerido.';
  END IF;

  IF p_origen NOT IN ('BAF', 'MOVIL') THEN
    RAISE EXCEPTION 'Origen histórico inválido: %', p_origen;
  END IF;

  IF p_fila_origen IS NULL OR p_fila_origen < 2 THEN
    RAISE EXCEPTION 'Fila de origen inválida: %', p_fila_origen;
  END IF;

  IF p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' THEN
    RAISE EXCEPTION 'Los datos históricos deben ser un objeto JSON.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.migracion_historica_lotes
    WHERE id = p_lote_id
  ) THEN
    RAISE EXCEPTION 'El lote histórico % no existe.', p_lote_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.migracion_historica_registros
    WHERE origen = p_origen
      AND fila_origen = p_fila_origen
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'omitido', true,
      'motivo', 'YA_IMPORTADO',
      'origen', p_origen,
      'fila_origen', p_fila_origen
    );
  END IF;

  v_operacion_id :=
    'HIST-' ||
    CASE WHEN p_origen = 'BAF' THEN 'BAF' ELSE 'MOVIL' END ||
    '-' || lpad(p_fila_origen::text, 6, '0');

  IF EXISTS (
    SELECT 1
    FROM public.operaciones
    WHERE id_operacion = v_operacion_id
  ) THEN
    RAISE EXCEPTION
      'Ya existe la operación %, pero no tiene trazabilidad histórica.',
      v_operacion_id;
  END IF;

  SELECT *
    INTO v_producto
  FROM public.productos
  WHERE id = (p_datos->>'producto_id')::bigint;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Producto % inexistente.',
      p_datos->>'producto_id';
  END IF;

  INSERT INTO public.clientes (
    dni,
    nombre,
    apellido,
    fecha_nacimiento,
    email,
    telefono,
    telefono_alternativo,
    tipo_documento
  )
  VALUES (
    COALESCE(
      NULLIF(trim(p_datos->>'dni'), ''),
      'SIN-DATO-' || p_origen || '-' || p_fila_origen
    ),
    COALESCE(NULLIF(trim(p_datos->>'nombre'), ''), 'Sin dato'),
    NULLIF(trim(p_datos->>'apellido'), ''),
    NULLIF(p_datos->>'fecha_nacimiento', '')::date,
    NULLIF(trim(p_datos->>'email'), ''),
    NULLIF(trim(p_datos->>'telefono'), ''),
    NULLIF(trim(p_datos->>'telefono_alternativo'), ''),
    COALESCE(NULLIF(trim(p_datos->>'tipo_documento'), ''), 'DNI')
  )
  RETURNING id INTO v_cliente_id;

  INSERT INTO public.domicilios (
    cliente_id,
    calle_nro,
    entre_calles,
    datos_extras
  )
  VALUES (
    v_cliente_id,
    NULLIF(trim(p_datos->>'domicilio'), ''),
    NULLIF(trim(p_datos->>'entre_calles'), ''),
    NULLIF(trim(p_datos->>'domicilio_observaciones'), '')
  )
  RETURNING id INTO v_domicilio_id;

  INSERT INTO public.operaciones (
    id_operacion,
    tipo,
    cliente_id,
    domicilio_id,
    usuario_id,
    vendedor,
    fecha_hora,
    origen_dato,
    estado_sync,
    sheet_destino,
    fila_sheet,
    error_sync,
    grupo_operacion,
    obs,
    caminante
  )
  VALUES (
    v_operacion_id,

    -- CORRECCION:
    -- conservar exactamente el tipo de producto del payload histórico.
    CASE
      WHEN p_datos->>'tipo_producto' = 'BAF'
        THEN 'BAF'
      ELSE 'PORTA'
    END,

    v_cliente_id,
    v_domicilio_id,
    (p_datos->>'usuario_id')::uuid,
    COALESCE(
      NULLIF(trim(p_datos->>'vendedor'), ''),
      'HISTORICO'
    ),
    (p_datos->>'fecha_hora')::timestamptz,
    NULLIF(trim(p_datos->>'origen_dato'), ''),
    'HISTORICO',
    NULL,
    NULL,
    NULL,
    v_operacion_id,
    NULLIF(p_datos->>'obs', ''),
    NULLIF(p_datos->>'caminante', '')
  );

  INSERT INTO public.operacion_productos (
    operacion_id,
    producto_id,
    tipo_producto,
    responsable_id,
    orden,
    activo,
    producto_snapshot,
    origen_snapshot,
    plan_snapshot,
    precio_lista_snapshot,
    descuento_snapshot,
    precio_cliente_snapshot,
    beneficios_snapshot,
    created_by,
    updated_by
  )
  VALUES (
    v_operacion_id,
    v_producto.id,
    p_datos->>'tipo_producto',
    NULLIF(p_datos->>'responsable_id', '')::uuid,
    1,
    true,
    v_producto.producto,
    v_producto.origen,
    COALESCE(
      NULLIF(trim(p_datos->>'plan_snapshot'), ''),
      v_producto.plan
    ),
    COALESCE(v_producto.precio_lista, 0),
    v_producto.descuento_normal,
    v_producto.precio_cliente,
    v_producto.beneficios,
    NULLIF(p_datos->>'usuario_id', '')::uuid,
    NULLIF(p_datos->>'usuario_id', '')::uuid
  )
  RETURNING id INTO v_producto_operacion_id;

  IF (p_datos->>'tipo_producto') = 'BAF' THEN

    INSERT INTO public.operacion_producto_baf (
      producto_operacion_id,
      tipo_domicilio_id,
      zona_id,
      modalidad_plan,
      tv,
      cantidad_decos,
      horario_contacto
    )
    VALUES (
      v_producto_operacion_id,
      NULLIF(p_datos->>'tipo_domicilio_id', '')::bigint,
      NULLIF(p_datos->>'zona_id', '')::bigint,
      NULLIF(trim(p_datos->>'modalidad_plan'), ''),
      COALESCE((p_datos->>'tv')::boolean, false),
      COALESCE(NULLIF(p_datos->>'cantidad_decos', '')::integer, 0),
      NULLIF(trim(p_datos->>'horario_contacto'), '')
    );

    INSERT INTO public.gestion_producto_baf (
      producto_operacion_id,
      responsable_id,
      fecha_gestion,
      prospector,
      detalle_lead,
      cia_celular,
      sds,
      orden_trabajo,
      linea_fija,
      fecha_instalacion,
      ciclo_cuenta,
      motivo_estado,
      estado_baf_id,
      updated_by
    )
    VALUES (
      v_producto_operacion_id,
      NULLIF(p_datos->>'responsable_id', '')::uuid,
      NULLIF(p_datos->>'fecha_gestion', '')::timestamptz,
      NULLIF(trim(p_datos->>'prospector'), ''),
      NULLIF(trim(p_datos->>'detalle_lead'), ''),
      NULLIF(trim(p_datos->>'cia_celular'), ''),
      NULLIF(trim(p_datos->>'sds'), ''),
      NULLIF(trim(p_datos->>'orden_trabajo'), ''),
      NULLIF(trim(p_datos->>'linea_fija'), ''),
      NULLIF(trim(p_datos->>'fecha_instalacion'), ''),
      NULLIF(trim(p_datos->>'ciclo_cuenta'), ''),
      NULLIF(trim(p_datos->>'motivo_estado'), ''),
      NULLIF(p_datos->>'estado_baf_id', '')::bigint,
      NULLIF(p_datos->>'usuario_id', '')::uuid
    );

  ELSIF (p_datos->>'tipo_producto')
        IN ('PORTA', 'LINEA_NUEVA', 'FWA') THEN

    INSERT INTO public.operacion_producto_movil (
      producto_operacion_id,
      numero_linea,
      nim,
      compania_actual,
      modalidad_actual,
      tipo_sim,
      observaciones,
      es_fwa,
      forma_pago_modem,
      cuotas_modem,
      precio_modem_snapshot,
      linea_titular
    )
    VALUES (
      v_producto_operacion_id,
      NULLIF(trim(p_datos->>'numero_linea'), ''),
      NULLIF(trim(p_datos->>'nim'), ''),
      NULLIF(trim(p_datos->>'compania_actual'), ''),
      NULLIF(trim(p_datos->>'modalidad_actual'), ''),
      NULLIF(trim(p_datos->>'tipo_sim'), ''),
      NULLIF(p_datos->>'observaciones_movil', ''),
      (p_datos->>'tipo_producto') = 'FWA',
      NULLIF(trim(p_datos->>'forma_pago_modem'), ''),
      NULLIF(p_datos->>'cuotas_modem', '')::integer,
      NULLIF(p_datos->>'precio_modem_snapshot', '')::numeric,
      COALESCE((p_datos->>'linea_titular')::boolean, false)
    );

    INSERT INTO public.gestion_producto_movil (
      producto_operacion_id,
      responsable_id,
      bboo_id,
      fecha_carga_stl,
      sim,
      plan_cargado,
      sds,
      spn,
      pin_lnva_nro,
      documentacion_dni,
      medio_despacho_chip_id,
      fecha_porta,
      observaciones_gestion,
      estado_porta_id,
      estado_bboo_id,
      numero_seguimiento,
      updated_by,
      id_envio,
      legajo_enviado,
      fecha_legajo_enviado
    )
    VALUES (
      v_producto_operacion_id,
      NULLIF(p_datos->>'responsable_id', '')::uuid,
      NULLIF(p_datos->>'bboo_id', '')::uuid,
      NULLIF(p_datos->>'fecha_carga_stl', '')::timestamptz,
      NULLIF(trim(p_datos->>'sim'), ''),
      NULLIF(trim(p_datos->>'plan_cargado'), ''),
      NULLIF(trim(p_datos->>'sds'), ''),
      NULLIF(trim(p_datos->>'spn'), ''),
      NULLIF(trim(p_datos->>'pin_lnva_nro'), ''),
      CASE
        WHEN p_datos ? 'documentacion_dni'
          THEN (p_datos->>'documentacion_dni')::boolean
        ELSE NULL
      END,
      NULLIF(p_datos->>'medio_despacho_chip_id', '')::bigint,
      NULLIF(p_datos->>'fecha_porta', '')::timestamptz,
      NULLIF(p_datos->>'observaciones_gestion', ''),
      NULLIF(p_datos->>'estado_porta_id', '')::bigint,
      NULLIF(p_datos->>'estado_bboo_id', '')::integer,
      NULLIF(trim(p_datos->>'numero_seguimiento'), ''),
      NULLIF(p_datos->>'usuario_id', '')::uuid,
      NULLIF(trim(p_datos->>'id_envio'), ''),
      COALESCE((p_datos->>'legajo_enviado')::boolean, false),
      NULLIF(p_datos->>'fecha_legajo_enviado', '')::timestamptz
    );

  ELSE
    RAISE EXCEPTION
      'Tipo de producto histórico no soportado: %',
      p_datos->>'tipo_producto';
  END IF;

  INSERT INTO public.migracion_historica_registros (
    lote_id,
    origen,
    fila_origen,
    operacion_id,
    cliente_id,
    domicilio_id,
    producto_operacion_id,
    documento_original,
    sds_original,
    orden_trabajo_original,
    vendedor_original,
    responsable_original,
    bboo_original,
    estado_original,
    plan_original,
    advertencias,
    datos_origen
  )
  VALUES (
    p_lote_id,
    p_origen,
    p_fila_origen,
    v_operacion_id,
    v_cliente_id,
    v_domicilio_id,
    v_producto_operacion_id,
    p_datos->>'documento_original',
    p_datos->>'sds_original',
    p_datos->>'orden_trabajo_original',
    p_datos->>'vendedor_original',
    p_datos->>'responsable_original',
    p_datos->>'bboo_original',
    p_datos->>'estado_original',
    p_datos->>'plan_original',
    COALESCE(p_datos->'advertencias', '[]'::jsonb),
    COALESCE(p_datos->'datos_origen', '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'omitido', false,
    'operacion_id', v_operacion_id,
    'cliente_id', v_cliente_id,
    'domicilio_id', v_domicilio_id,
    'producto_operacion_id', v_producto_operacion_id
  );
END;
$function$;
