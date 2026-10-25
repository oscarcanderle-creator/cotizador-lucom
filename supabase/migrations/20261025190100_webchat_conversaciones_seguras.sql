-- Webchat PGL: creación atómica de conversaciones privadas.
-- Esta función se ejecuta exclusivamente mediante service_role.

create or replace function public.chat_crear_conversacion_privada(
  p_remitente uuid,
  p_destinatario uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_menor uuid;
  v_mayor uuid;
  v_conversacion_id bigint;
begin
  if p_remitente is null
     or p_destinatario is null
     or p_remitente = p_destinatario then
    raise exception 'Participantes inválidos';
  end if;

  v_menor := least(p_remitente, p_destinatario);
  v_mayor := greatest(p_remitente, p_destinatario);

  -- Serializar solicitudes para la misma pareja de usuarios.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_menor::text || ':' || v_mayor::text,
      0
    )
  );

  insert into public.chat_conversaciones (
    creada_por,
    usuario_menor_id,
    usuario_mayor_id
  )
  values (
    p_remitente,
    v_menor,
    v_mayor
  )
  on conflict (usuario_menor_id, usuario_mayor_id)
  do nothing
  returning id into v_conversacion_id;

  if v_conversacion_id is null then
    select id into v_conversacion_id
    from public.chat_conversaciones
    where usuario_menor_id = v_menor
      and usuario_mayor_id = v_mayor;
  end if;

  if v_conversacion_id is null then
    raise exception 'No se pudo recuperar la conversación';
  end if;

  insert into public.chat_participantes (
    conversacion_id,
    usuario_id
  )
  values
    (v_conversacion_id, p_remitente),
    (v_conversacion_id, p_destinatario)
  on conflict (conversacion_id, usuario_id)
  do nothing;

  return v_conversacion_id;
end;
$$;

revoke all on function public.chat_crear_conversacion_privada(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.chat_crear_conversacion_privada(uuid, uuid)
  to service_role;
