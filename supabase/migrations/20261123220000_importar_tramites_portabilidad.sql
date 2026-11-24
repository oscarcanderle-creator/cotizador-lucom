create or replace function public.importar_reporte_tramites_portabilidad(p_datos jsonb,p_usuario_id uuid,p_archivo_original text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  r public.reporte_tramites_portabilidad%rowtype;
  anterior public.reporte_tramites_portabilidad%rowtype;
  nuevos integer := 0;
  cambios integer := 0;
  iguales integer := 0;
begin
  lock table public.reporte_tramites_portabilidad in share row exclusive mode;
  for r in select * from jsonb_populate_recordset(null::public.reporte_tramites_portabilidad,p_datos) loop
    select * into anterior from public.reporte_tramites_portabilidad where tramite = r.tramite;
    if not found then
      insert into public.reporte_tramites_portabilidad (dia_id,estado_id,estado,fecha_inicio,tramite,nim_cabecera,cuenta_id,cantidad,entidad,donante,bloque,can_id,canal_ventas_desc,fecha_agenda,cuit,tipo_portacion,client_id,client_desc,srf_usr_id,usr_name,usr_surname,negocio_origen,sds,archivo_origen,importado_por)
      values (r.dia_id,r.estado_id,r.estado,r.fecha_inicio,r.tramite,r.nim_cabecera,r.cuenta_id,r.cantidad,r.entidad,r.donante,r.bloque,r.can_id,r.canal_ventas_desc,r.fecha_agenda,r.cuit,r.tipo_portacion,r.client_id,r.client_desc,r.srf_usr_id,r.usr_name,r.usr_surname,r.negocio_origen,r.sds,p_archivo_original,p_usuario_id);
      nuevos := nuevos+1;
    elsif row(anterior.dia_id,anterior.estado_id,anterior.estado,anterior.fecha_inicio,anterior.tramite,anterior.nim_cabecera,anterior.cuenta_id,anterior.cantidad,anterior.entidad,anterior.donante,anterior.bloque,anterior.can_id,anterior.canal_ventas_desc,anterior.fecha_agenda,anterior.cuit,anterior.tipo_portacion,anterior.client_id,anterior.client_desc,anterior.srf_usr_id,anterior.usr_name,anterior.usr_surname,anterior.negocio_origen,anterior.sds) is distinct from row(r.dia_id,r.estado_id,r.estado,r.fecha_inicio,r.tramite,r.nim_cabecera,r.cuenta_id,r.cantidad,r.entidad,r.donante,r.bloque,r.can_id,r.canal_ventas_desc,r.fecha_agenda,r.cuit,r.tipo_portacion,r.client_id,r.client_desc,r.srf_usr_id,r.usr_name,r.usr_surname,r.negocio_origen,r.sds) then
      update public.reporte_tramites_portabilidad set dia_id=r.dia_id,estado_id=r.estado_id,estado=r.estado,fecha_inicio=r.fecha_inicio,nim_cabecera=r.nim_cabecera,cuenta_id=r.cuenta_id,cantidad=r.cantidad,entidad=r.entidad,donante=r.donante,bloque=r.bloque,can_id=r.can_id,canal_ventas_desc=r.canal_ventas_desc,fecha_agenda=r.fecha_agenda,cuit=r.cuit,tipo_portacion=r.tipo_portacion,client_id=r.client_id,client_desc=r.client_desc,srf_usr_id=r.srf_usr_id,usr_name=r.usr_name,usr_surname=r.usr_surname,negocio_origen=r.negocio_origen,sds=r.sds,archivo_origen=p_archivo_original,importado_por=p_usuario_id,actualizado_en=now() where tramite=r.tramite;
      cambios := cambios+1;
    else
      iguales := iguales+1;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'encontrados',jsonb_array_length(p_datos),'validos',jsonb_array_length(p_datos),'descartados',0,'insertados',nuevos,'actualizados',cambios,'sin_cambios',iguales);
end;
$$;
revoke all on function public.importar_reporte_tramites_portabilidad(jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.importar_reporte_tramites_portabilidad(jsonb,uuid,text) to service_role;
