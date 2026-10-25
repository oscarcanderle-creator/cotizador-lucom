-- Webchat PGL: retención máxima de 30 días.
-- Requiere pg_cron habilitado en Supabase.

create extension if not exists pg_cron with schema pg_catalog;

-- Eliminar una programación anterior con el mismo nombre.
do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'webchat-pgl-retencion'
  ) then
    perform cron.unschedule('webchat-pgl-retencion');
  end if;
end;
$$;

-- Ejecutar diariamente a las 03:00 UTC.
select cron.schedule(
  'webchat-pgl-retencion',
  '0 3 * * *',
  $$
    delete from public.chat_mensajes
    where enviado_en < now() - interval '30 days';
  $$
);
