-- Webchat PGL: conteo eficiente de mensajes no leídos.
-- Uso exclusivo desde el servidor mediante service_role.

create or replace function public.chat_contar_no_leidos(
  p_usuario_id uuid
)
returns table (
  conversacion_id bigint,
  no_leidos bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.conversacion_id,
    count(m.id)::bigint as no_leidos
  from public.chat_participantes p
  left join public.chat_mensajes m
    on m.conversacion_id = p.conversacion_id
    and m.remitente_id <> p.usuario_id
    and m.enviado_en >= now() - interval '30 days'
    and (
      p.ultima_lectura_en is null
      or m.enviado_en > p.ultima_lectura_en
    )
  where p.usuario_id = p_usuario_id
  group by p.conversacion_id;
$$;

revoke all on function public.chat_contar_no_leidos(uuid)
  from public, anon, authenticated;

grant execute on function public.chat_contar_no_leidos(uuid)
  to service_role;
