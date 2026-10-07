-- CORRECCIÓN 20261010
-- Elimina la ambigüedad PL/pgSQL entre la columna
-- gestion_producto_movil.producto_operacion_id y el campo homónimo
-- declarado por RETURNS TABLE.
-- La regla funcional permanece sin cambios.
--
-- ================================================================
-- MEDIO DE DESPACHO ÚNICO POR OPERACIÓN MULTIPRODUCTO
--
-- Regla:
--   Una operación = un envío = un único medio de despacho
--   para todos sus productos móviles vigentes.
--
-- Productos alcanzados:
--   PORTA
--   LINEA_NUEVA
--
-- Se excluyen únicamente productos cuyo Estado BBOO tenga
-- código CANCELADO.
--
-- La sincronización y su auditoría ocurren dentro de la misma
-- transacción PostgreSQL.
-- ================================================================

CREATE OR REPLACE FUNCTION public.sincronizar_medio_despacho_operacion(
  p_operacion_id text,
  p_producto_operacion_id bigint,
  p_medio_despacho_chip_id bigint
)
RETURNS TABLE (
  producto_operacion_id bigint,
  medio_despacho_anterior bigint,
  medio_despacho_nuevo bigint,
  gestion_creada boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_rol_actor text;
  v_puede_gestionar_ventas boolean;
  v_producto_valido boolean;
BEGIN
  -- La identidad proviene exclusivamente de la sesión autenticada.
  v_usuario_id := auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida.';
  END IF;

  SELECT
    p.rol,
    p.puede_gestionar_ventas
  INTO
    v_rol_actor,
    v_puede_gestionar_ventas
  FROM public.profiles p
  WHERE p.id = v_usuario_id
    AND p.activo = true;

  IF v_rol_actor IS NULL THEN
    RAISE EXCEPTION 'No se pudo validar el perfil del usuario.';
  END IF;

  IF NOT (
    v_rol_actor IN ('ADMIN', 'SUPERVISOR', 'BBOO')
    OR (
      v_rol_actor = 'VENDEDOR'
      AND v_puede_gestionar_ventas = true
    )
  ) THEN
    RAISE EXCEPTION 'El usuario no tiene permisos para modificar el medio de despacho.';
  END IF;

  -- El producto origen debe pertenecer a la operación, estar activo
  -- y ser PORTA o LINEA_NUEVA.
  SELECT EXISTS (
    SELECT 1
    FROM public.operacion_productos op
    WHERE op.id = p_producto_operacion_id
      AND op.operacion_id = p_operacion_id
      AND op.activo = true
      AND upper(trim(op.tipo_producto)) IN ('PORTA', 'LINEA_NUEVA')
  )
  INTO v_producto_valido;

  IF NOT v_producto_valido THEN
    RAISE EXCEPTION
      'El producto % no es un producto móvil activo de la operación %.',
      p_producto_operacion_id,
      p_operacion_id;
  END IF;

  -- Validación explícita del medio. NULL es válido y significa
  -- quitar el medio de despacho de toda la operación.
  IF p_medio_despacho_chip_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.medios_despacho_chip m
       WHERE m.id = p_medio_despacho_chip_id
     )
  THEN
    RAISE EXCEPTION
      'El medio de despacho % no existe.',
      p_medio_despacho_chip_id;
  END IF;

  -- Capturamos los productos objetivo y su situación anterior.
  CREATE TEMP TABLE tmp_medio_despacho_objetivo
  ON COMMIT DROP
  AS
  SELECT
    op.id AS producto_id,
    gm.id AS gestion_id,
    gm.medio_despacho_chip_id AS medio_anterior
  FROM public.operacion_productos op
  LEFT JOIN public.gestion_producto_movil gm
    ON gm.producto_operacion_id = op.id
  LEFT JOIN public.estados_bboo eb
    ON eb.id = gm.estado_bboo_id
  WHERE op.operacion_id = p_operacion_id
    AND op.activo = true
    AND upper(trim(op.tipo_producto)) IN ('PORTA', 'LINEA_NUEVA')
    AND COALESCE(upper(trim(eb.codigo)), '') <> 'CANCELADO';

  -- Crea la gestión mínima cuando todavía no existe y actualiza
  -- las existentes. El UNIQUE(producto_operacion_id) garantiza
  -- una única gestión por producto.
  INSERT INTO public.gestion_producto_movil (
    producto_operacion_id,
    medio_despacho_chip_id,
    updated_at,
    updated_by
  )
  SELECT
    t.producto_id,
    p_medio_despacho_chip_id,
    now(),
    v_usuario_id
  FROM tmp_medio_despacho_objetivo t
  ON CONFLICT ON CONSTRAINT gestion_producto_movil_producto_operacion_id_key
  DO UPDATE SET
    medio_despacho_chip_id = EXCLUDED.medio_despacho_chip_id,
    updated_at = now(),
    updated_by = v_usuario_id;

  -- Auditar únicamente los productos cuyo medio realmente cambió.
  INSERT INTO public.historial_producto (
    producto_operacion_id,
    tipo_accion,
    campo,
    etiqueta,
    valor_anterior,
    valor_nuevo,
    usuario_id,
    rol_actor,
    observacion
  )
  SELECT
    t.producto_id,
    'MODIFICACION',
    'medio_despacho_chip_id',
    'Medio de despacho CHIP',
    CASE
      WHEN t.medio_anterior IS NULL THEN '—'
      ELSE t.medio_anterior::text
    END,
    CASE
      WHEN p_medio_despacho_chip_id IS NULL THEN '—'
      ELSE p_medio_despacho_chip_id::text
    END,
    v_usuario_id,
    v_rol_actor,
    CASE
      WHEN t.producto_id = p_producto_operacion_id
        THEN 'Cambio de medio de despacho de la operación'
      ELSE 'Medio de despacho sincronizado automáticamente por operación'
    END
  FROM tmp_medio_despacho_objetivo t
  WHERE t.medio_anterior IS DISTINCT FROM p_medio_despacho_chip_id;

  RETURN QUERY
  SELECT
    t.producto_id,
    t.medio_anterior,
    p_medio_despacho_chip_id,
    t.gestion_id IS NULL
  FROM tmp_medio_despacho_objetivo t
  WHERE t.medio_anterior IS DISTINCT FROM p_medio_despacho_chip_id
  ORDER BY t.producto_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.sincronizar_medio_despacho_operacion(text, bigint, bigint)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.sincronizar_medio_despacho_operacion(text, bigint, bigint)
TO authenticated;

COMMENT ON FUNCTION public.sincronizar_medio_despacho_operacion(text, bigint, bigint)
IS 'Sincroniza transaccionalmente el medio de despacho de todos los productos móviles vigentes de una operación, excluye CANCELADO y registra la auditoría.';
