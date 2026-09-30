-- Cotizador Lucom
-- Versiona la integracion entre Reporte Fija y Gestion BAF.
-- Fecha: 2026-09-30
--
-- La base de produccion ya contenia estos cambios al crear esta migracion.
-- IF NOT EXISTS permite conservarla como baseline reproducible.

alter table public.gestion_producto_baf
  add column if not exists estado_claro text,
  add column if not exists motivo_cierre text,
  add column if not exists fecha_cierre date;

create unique index if not exists gestion_producto_baf_sds_unique
  on public.gestion_producto_baf (trim(sds))
  where nullif(trim(sds), '') is not null;

create unique index if not exists gestion_producto_baf_ot_unique
  on public.gestion_producto_baf (trim(orden_trabajo))
  where nullif(trim(orden_trabajo), '') is not null;

-- Sincroniza ventas BAF CARGADO con los registros de Reporte Fija.
CREATE OR REPLACE FUNCTION public.sincronizar_baf_desde_reporte_fija(p_registros jsonb, p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_registro jsonb;
  v_sds text;
  v_estado_nuevo text;
  v_motivo_nuevo text;
  v_fecha_nueva date;

  v_actualizados integer := 0;
  v_sin_coincidencia integer := 0;
  v_no_cargados integer := 0;
  v_protegidos integer := 0;
  v_sin_cambios integer := 0;

  v_gestion record;
begin

  if p_registros is null
     or jsonb_typeof(p_registros) <> 'array' then
    raise exception 'Los registros de Reporte Fija deben ser un array JSON.';
  end if;

  for v_registro in
    select value
    from jsonb_array_elements(p_registros)
  loop

    v_sds := nullif(trim(v_registro->>'sds'), '');
    v_estado_nuevo :=
      nullif(upper(trim(v_registro->>'estado_agenda')), '');
    v_motivo_nuevo :=
      nullif(trim(v_registro->>'motivo_cierre'), '');
    v_fecha_nueva :=
      nullif(v_registro->>'fecha_instalacion', '')::date;

    if v_sds is null then
      continue;
    end if;

    /*
     * Puede existir más de una gestión BAF con el mismo SDS.
     * Solo se consideran las que actualmente tengan Estado BAF CARGADO.
     */
    for v_gestion in
      select
        g.id,
        g.estado_claro,
        g.motivo_cierre,
        g.fecha_cierre
      from public.gestion_producto_baf g
      join public.estados_baf e
        on e.id = g.estado_baf_id
      where trim(g.sds) = v_sds
        and upper(trim(e.codigo)) = 'CARGADO'
    loop

      /*
       * FINALIZADA es terminal.
       *
       * Puede refrescarse con otra FINALIZADA, pero nunca puede
       * retroceder a ASIGNADA ni pasar a CANCELADA.
       */
      if upper(trim(coalesce(v_gestion.estado_claro, ''))) = 'FINALIZADA'
         and coalesce(v_estado_nuevo, '') <> 'FINALIZADA'
      then
        v_protegidos := v_protegidos + 1;
        continue;
      end if;

      /*
       * CANCELADA tampoco retrocede a ASIGNADA.
       *
       * Sí permitimos CANCELADA -> FINALIZADA porque una instalación
       * posterior/corrección del reporte debe poder cerrar exitosamente
       * una orden que anteriormente figuró cancelada.
       */
      if upper(trim(coalesce(v_gestion.estado_claro, ''))) = 'CANCELADA'
         and coalesce(v_estado_nuevo, '') = 'ASIGNADA'
      then
        v_protegidos := v_protegidos + 1;
        continue;
      end if;

      /*
       * Si el SDS está presente en el reporte, sus tres campos son
       * autoritativos. Por eso NULL también reemplaza el valor anterior.
       */
      if row(
        v_gestion.estado_claro,
        v_gestion.motivo_cierre,
        v_gestion.fecha_cierre
      )
      is distinct from
      row(
        v_estado_nuevo,
        v_motivo_nuevo,
        v_fecha_nueva
      )
      then

        update public.gestion_producto_baf
        set
          estado_claro = v_estado_nuevo,
          motivo_cierre = v_motivo_nuevo,
          fecha_cierre = v_fecha_nueva,
          updated_at = now(),
          updated_by = p_usuario_id
        where id = v_gestion.id;

        v_actualizados := v_actualizados + 1;

      else

        v_sin_cambios := v_sin_cambios + 1;

      end if;

    end loop;

    /*
     * Contadores informativos.
     * No afectan la sincronización.
     */
    if not exists (
      select 1
      from public.gestion_producto_baf g
      where trim(g.sds) = v_sds
    ) then

      v_sin_coincidencia := v_sin_coincidencia + 1;

    elsif not exists (
      select 1
      from public.gestion_producto_baf g
      join public.estados_baf e
        on e.id = g.estado_baf_id
      where trim(g.sds) = v_sds
        and upper(trim(e.codigo)) = 'CARGADO'
    ) then

      v_no_cargados := v_no_cargados + 1;

    end if;

  end loop;

  return jsonb_build_object(
    'ok', true,
    'actualizados', v_actualizados,
    'sin_cambios', v_sin_cambios,
    'protegidos', v_protegidos,
    'sin_coincidencia', v_sin_coincidencia,
    'no_cargados', v_no_cargados
  );

end;
$function$

-- La importacion de Reporte Fija dispara la sincronizacion BAF.
CREATE OR REPLACE FUNCTION public.importar_reporte_fija(p_usuario_id uuid, p_archivo_original text, p_registros_encontrados integer, p_registros_descartados integer, p_registros jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_importacion_id bigint;
  v_insertados integer := 0;
  v_actualizados integer := 0;
  v_sin_cambios integer := 0;
  v_registro jsonb;
  v_actual public.reporte_fija%rowtype;
  v_ahora timestamptz := now();

  -- Resultado de la sincronización con las ventas BAF.
  v_sync_baf jsonb;
begin

  if p_usuario_id is null then
    raise exception 'Usuario requerido.';
  end if;

  if p_registros is null
     or jsonb_typeof(p_registros) <> 'array' then
    raise exception 'Los registros deben ser un array JSON.';
  end if;

  insert into public.importaciones_claro (
    tipo_reporte,
    archivo_original,
    usuario_id,
    registros_encontrados,
    registros_validos,
    registros_descartados,
    estado
  )
  values (
    'FIJA',
    p_archivo_original,
    p_usuario_id,
    jsonb_array_length(p_registros),
    jsonb_array_length(p_registros),
    p_registros_descartados,
    'PROCESANDO'
  )
  returning id into v_importacion_id;

  for v_registro in
    select value
    from jsonb_array_elements(p_registros)
  loop

    select *
      into v_actual
    from public.reporte_fija
    where sds = nullif(trim(v_registro->>'sds'), '');

    if not found then

      insert into public.reporte_fija (
        mes_carga,
        fecha_carga,
        sds,
        ot,
        calle,
        numero,
        estado_agenda,
        motivo_cierre,
        fecha_instalacion,
        ciudad,
        partido,
        provincia,
        negocio,
        promo,
        plan,
        nombre_oficial,
        entidad_ventas,
        oficina_ventas,
        ent_id_padre,
        fecha_schedule,
        va_flag_edif,
        primera_importacion_id,
        ultima_importacion_id,
        primera_importacion_at,
        ultima_importacion_at,
        created_at,
        updated_at
      )
      values (
        nullif(v_registro->>'mes_carga', ''),
        nullif(v_registro->>'fecha_carga', '')::date,
        nullif(trim(v_registro->>'sds'), ''),
        nullif(v_registro->>'ot', ''),
        nullif(v_registro->>'calle', ''),
        nullif(v_registro->>'numero', ''),
        nullif(v_registro->>'estado_agenda', ''),
        nullif(v_registro->>'motivo_cierre', ''),
        nullif(v_registro->>'fecha_instalacion', '')::date,
        nullif(v_registro->>'ciudad', ''),
        nullif(v_registro->>'partido', ''),
        nullif(v_registro->>'provincia', ''),
        nullif(v_registro->>'negocio', ''),
        nullif(v_registro->>'promo', ''),
        nullif(v_registro->>'plan', ''),
        nullif(v_registro->>'nombre_oficial', ''),
        nullif(v_registro->>'entidad_ventas', ''),
        nullif(v_registro->>'oficina_ventas', ''),
        nullif(v_registro->>'ent_id_padre', ''),
        nullif(v_registro->>'fecha_schedule', '')::date,
        nullif(v_registro->>'va_flag_edif', ''),
        v_importacion_id,
        v_importacion_id,
        v_ahora,
        v_ahora,
        v_ahora,
        v_ahora
      );

      v_insertados := v_insertados + 1;

    elsif
      row(
        v_actual.mes_carga,
        v_actual.fecha_carga,
        v_actual.ot,
        v_actual.calle,
        v_actual.numero,
        v_actual.estado_agenda,
        v_actual.motivo_cierre,
        v_actual.fecha_instalacion,
        v_actual.ciudad,
        v_actual.partido,
        v_actual.provincia,
        v_actual.negocio,
        v_actual.promo,
        v_actual.plan,
        v_actual.nombre_oficial,
        v_actual.entidad_ventas,
        v_actual.oficina_ventas,
        v_actual.ent_id_padre,
        v_actual.fecha_schedule,
        v_actual.va_flag_edif
      )
      is distinct from
      row(
        nullif(v_registro->>'mes_carga', ''),
        nullif(v_registro->>'fecha_carga', '')::date,
        nullif(v_registro->>'ot', ''),
        nullif(v_registro->>'calle', ''),
        nullif(v_registro->>'numero', ''),
        nullif(v_registro->>'estado_agenda', ''),
        nullif(v_registro->>'motivo_cierre', ''),
        nullif(v_registro->>'fecha_instalacion', '')::date,
        nullif(v_registro->>'ciudad', ''),
        nullif(v_registro->>'partido', ''),
        nullif(v_registro->>'provincia', ''),
        nullif(v_registro->>'negocio', ''),
        nullif(v_registro->>'promo', ''),
        nullif(v_registro->>'plan', ''),
        nullif(v_registro->>'nombre_oficial', ''),
        nullif(v_registro->>'entidad_ventas', ''),
        nullif(v_registro->>'oficina_ventas', ''),
        nullif(v_registro->>'ent_id_padre', ''),
        nullif(v_registro->>'fecha_schedule', '')::date,
        nullif(v_registro->>'va_flag_edif', '')
      )
    then

      /*
       * Guardamos historial únicamente cuando cambia información
       * relevante para la evolución operativa de la orden.
       */
      if row(
        v_actual.estado_agenda,
        v_actual.motivo_cierre,
        v_actual.fecha_instalacion,
        v_actual.fecha_schedule
      )
      is distinct from
      row(
        nullif(v_registro->>'estado_agenda', ''),
        nullif(v_registro->>'motivo_cierre', ''),
        nullif(v_registro->>'fecha_instalacion', '')::date,
        nullif(v_registro->>'fecha_schedule', '')::date
      )
      then

        insert into public.reporte_fija_historial (
          reporte_fija_id,
          sds,
          importacion_id,
          estado_agenda_anterior,
          estado_agenda_nuevo,
          motivo_cierre_anterior,
          motivo_cierre_nuevo,
          fecha_instalacion_anterior,
          fecha_instalacion_nueva,
          fecha_schedule_anterior,
          fecha_schedule_nueva,
          fecha_hora,
          created_at
        )
        values (
          v_actual.id,
          v_actual.sds,
          v_importacion_id,
          v_actual.estado_agenda,
          nullif(v_registro->>'estado_agenda', ''),
          v_actual.motivo_cierre,
          nullif(v_registro->>'motivo_cierre', ''),
          v_actual.fecha_instalacion,
          nullif(v_registro->>'fecha_instalacion', '')::date,
          v_actual.fecha_schedule,
          nullif(v_registro->>'fecha_schedule', '')::date,
          v_ahora,
          v_ahora
        );

      end if;

      update public.reporte_fija
      set
        mes_carga = nullif(v_registro->>'mes_carga', ''),
        fecha_carga = nullif(v_registro->>'fecha_carga', '')::date,
        ot = nullif(v_registro->>'ot', ''),
        calle = nullif(v_registro->>'calle', ''),
        numero = nullif(v_registro->>'numero', ''),
        estado_agenda = nullif(v_registro->>'estado_agenda', ''),
        motivo_cierre = nullif(v_registro->>'motivo_cierre', ''),
        fecha_instalacion =
          nullif(v_registro->>'fecha_instalacion', '')::date,
        ciudad = nullif(v_registro->>'ciudad', ''),
        partido = nullif(v_registro->>'partido', ''),
        provincia = nullif(v_registro->>'provincia', ''),
        negocio = nullif(v_registro->>'negocio', ''),
        promo = nullif(v_registro->>'promo', ''),
        plan = nullif(v_registro->>'plan', ''),
        nombre_oficial = nullif(v_registro->>'nombre_oficial', ''),
        entidad_ventas = nullif(v_registro->>'entidad_ventas', ''),
        oficina_ventas = nullif(v_registro->>'oficina_ventas', ''),
        ent_id_padre = nullif(v_registro->>'ent_id_padre', ''),
        fecha_schedule =
          nullif(v_registro->>'fecha_schedule', '')::date,
        va_flag_edif = nullif(v_registro->>'va_flag_edif', ''),
        ultima_importacion_id = v_importacion_id,
        ultima_importacion_at = v_ahora,
        updated_at = v_ahora
      where id = v_actual.id;

      v_actualizados := v_actualizados + 1;

    else

      v_sin_cambios := v_sin_cambios + 1;

    end if;

  end loop;

  /*
   * Cada nueva importación de Reporte Fija dispara la sincronización
   * de las ventas BAF cuyo Estado BAF sea CARGADO.
   *
   * La función auxiliar aplica:
   *   Reporte Fija.SDS              -> gestion_producto_baf.sds
   *   ESTADO_AGENDA                 -> estado_claro
   *   Motivo de Cierre              -> motivo_cierre
   *   Fecha de Instalación          -> fecha_cierre
   *
   * Si esta sincronización falla, también falla la importación completa.
   */
  v_sync_baf :=
    public.sincronizar_baf_desde_reporte_fija(
      p_registros,
      p_usuario_id
    );

  update public.importaciones_claro
  set
    registros_encontrados = p_registros_encontrados,
    registros_validos = jsonb_array_length(p_registros),
    registros_descartados = p_registros_descartados,
    registros_insertados = v_insertados,
    registros_actualizados = v_actualizados,
    registros_sin_cambios = v_sin_cambios,
    estado = 'COMPLETADA'
  where id = v_importacion_id;

  return jsonb_build_object(
    'ok', true,
    'importacion_id', v_importacion_id,
    'encontrados', p_registros_encontrados,
    'validos', jsonb_array_length(p_registros),
    'descartados', p_registros_descartados,
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'sin_cambios', v_sin_cambios,
    'sincronizacion_baf', v_sync_baf
  );

end;
$function$
