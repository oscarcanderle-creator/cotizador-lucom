-- Webchat PGL: retención máxima de 30 días.
-- Requiere pg_cron habilitado en Supabase.

-- pg_cron debe estar habilitado previamente en Supabase.
-- Verificar la extensión antes de ejecutar esta migración.

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

-- Ejecutar cada hora.
select cron.schedule(
  'webchat-pgl-retencion',
  '0 * * * *',
  $$
    delete from public.chat_mensajes
    where enviado_en < now() - interval '30 days';
  $$
);
