-- Webchat PGL: confirmación de lectura atómica.
-- Uso exclusivo desde API autenticada mediante service_role.

create or replace function public.chat_confirmar_lectura(
  p_usuario_id uuid,
  p_conversacion_id bigint,
  p_ultimo_mensaje_id bigint
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fecha_mensaje timestamptz;
begin
  -- Comprobar participación.
  if not exists (
    select 1
    from public.chat_participantes
    where conversacion_id = p_conversacion_id
      and usuario_id = p_usuario_id
  ) then
    return false;
  end if;

  -- Comprobar que el mensaje pertenece a la conversación.
  select enviado_en
    into v_fecha_mensaje
  from public.chat_mensajes
  where id = p_ultimo_mensaje_id
    and conversacion_id = p_conversacion_id;

  if v_fecha_mensaje is null then
    return false;
  end if;

  -- Actualizar únicamente si la nueva fecha es posterior.
  update public.chat_participantes
  set ultima_lectura_en = v_fecha_mensaje
  where conversacion_id = p_conversacion_id
    and usuario_id = p_usuario_id
    and (
      ultima_lectura_en is null
      or ultima_lectura_en < v_fecha_mensaje
    );

  return true;
end;
$$;

revoke all on function public.chat_confirmar_lectura(uuid, bigint, bigint)
  from public, anon, authenticated;

grant execute on function public.chat_confirmar_lectura(uuid, bigint, bigint)
  to service_role;
