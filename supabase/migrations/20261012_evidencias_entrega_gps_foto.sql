-- NUEVA migración. Ejecutar antes de desplegar los archivos TSX/TS.
-- Los registros manuales excepcionales se definirán en una migración posterior.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias-entrega', 'evidencias-entrega', false, 8388608,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.evidencias_entrega (
  id bigint generated always as identity primary key,
  intento_id bigint not null unique references public.lote_despacho_gestiones(id),
  resultado text not null check (resultado in ('ENTREGADO','NO_ENTREGADO')),
  modalidad text check (modalidad in ('TITULAR','TERCERO','BUZON','BAJO_PUERTA','CASILLA_GAS','COMERCIO')),
  referencia text,
  observacion text,
  latitud double precision not null check (latitud between -90 and 90),
  longitud double precision not null check (longitud between -180 and 180),
  precision_metros double precision not null check (precision_metros > 0 and precision_metros <= 100000),
  fecha_gps_dispositivo timestamptz not null,
  foto_path text,
  capturado_por uuid not null references auth.users(id),
  registrado_en_servidor timestamptz not null default now(),
  constraint evidencia_entregado_completa check (
    resultado <> 'ENTREGADO' or (modalidad is not null and foto_path is not null)
  ),
  constraint evidencia_tercero_referencia check (
    modalidad not in ('TERCERO','COMERCIO') or nullif(btrim(referencia), '') is not null
  )
);

create index if not exists evidencias_entrega_usuario_idx on public.evidencias_entrega(capturado_por);
alter table public.evidencias_entrega enable row level security;
revoke all on public.evidencias_entrega from anon, authenticated;
revoke all on sequence public.evidencias_entrega_id_seq from anon, authenticated;
-- El servidor escribe y lee mediante service-role tras verificar la asignación.
-- El bucket es privado; no se crean políticas de lectura públicas.

create or replace function public.exigir_evidencia_resultado_entrega()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.evidencias_entrega%rowtype;
begin
  if new.resultado is distinct from old.resultado and new.resultado::text in ('ENTREGADO','NO_ENTREGADO') then
    select * into e from public.evidencias_entrega where intento_id = new.id;
    if not found or e.resultado <> new.resultado::text then
      raise exception 'No se puede registrar el resultado sin evidencia GPS asociada.';
    end if;
    if e.capturado_por is distinct from auth.uid() then
      raise exception 'La evidencia debe corresponder al usuario que registra el resultado.';
    end if;
    if new.resultado::text = 'ENTREGADO' and (e.foto_path is null or e.modalidad is null) then
      raise exception 'La entrega requiere fotografía y modalidad.';
    end if;
  end if;
  return new;
end;
$$;

-- No sustituimos registrar_resultado_entrega: conservamos su lógica y auditoría.
drop trigger if exists exigir_evidencia_resultado_entrega_trg on public.lote_despacho_gestiones;
create trigger exigir_evidencia_resultado_entrega_trg
before update of resultado on public.lote_despacho_gestiones
for each row execute function public.exigir_evidencia_resultado_entrega();

comment on table public.evidencias_entrega is 'Evidencia GPS y fotográfica de cada intento. La ubicación es declarada por el dispositivo y no es prueba absoluta de presencia.';
