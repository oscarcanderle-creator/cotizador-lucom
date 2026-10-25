-- Webchat PGL - Etapa 1: conversaciones privadas y mensajes.
-- No ejecutar en produccion hasta revisar las rutas API que validaran permisos.
-- Solo el servidor con service_role puede acceder a estas tablas.

create table if not exists public.chat_conversaciones (
  id bigint generated always as identity primary key,
  creada_por uuid not null references auth.users(id),
  usuario_menor_id uuid not null references auth.users(id),
  usuario_mayor_id uuid not null references auth.users(id),
  constraint chat_conversacion_pareja_unica
    unique (usuario_menor_id, usuario_mayor_id),
  constraint chat_conversacion_usuarios_distintos
    check (usuario_menor_id < usuario_mayor_id),
  creada_en timestamptz not null default now(),
  ultimo_mensaje_en timestamptz
);

create table if not exists public.chat_participantes (
  conversacion_id bigint not null references public.chat_conversaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id),
  incorporado_en timestamptz not null default now(),
  ultima_lectura_en timestamptz,
  primary key (conversacion_id, usuario_id)
);

create index if not exists chat_participantes_usuario_idx
  on public.chat_participantes(usuario_id, conversacion_id);

create table if not exists public.chat_mensajes (
  id bigint generated always as identity primary key,
  conversacion_id bigint not null references public.chat_conversaciones(id) on delete cascade,
  remitente_id uuid not null references auth.users(id),
  contenido text not null check (char_length(btrim(contenido)) between 1 and 4000),
  enviado_en timestamptz not null default now(),
  constraint chat_mensajes_remitente_participante_fk
    foreign key (conversacion_id, remitente_id)
    references public.chat_participantes(conversacion_id, usuario_id)
);

create index if not exists chat_mensajes_conversacion_fecha_idx
  on public.chat_mensajes(conversacion_id, enviado_en desc, id desc);

create index if not exists chat_mensajes_retencion_idx
  on public.chat_mensajes(enviado_en);

-- Defense in depth: ninguna lectura/escritura directa desde navegador.
alter table public.chat_conversaciones enable row level security;
alter table public.chat_participantes enable row level security;
alter table public.chat_mensajes enable row level security;

revoke all on public.chat_conversaciones from public, anon, authenticated;
revoke all on public.chat_participantes from public, anon, authenticated;
revoke all on public.chat_mensajes from public, anon, authenticated;

revoke all on sequence public.chat_conversaciones_id_seq from public, anon, authenticated;
revoke all on sequence public.chat_mensajes_id_seq from public, anon, authenticated;

grant select, insert, update, delete on public.chat_conversaciones to service_role;
grant select, insert, update, delete on public.chat_participantes to service_role;
grant select, insert, update, delete on public.chat_mensajes to service_role;
grant usage, select on sequence public.chat_conversaciones_id_seq to service_role;
grant usage, select on sequence public.chat_mensajes_id_seq to service_role;

comment on table public.chat_conversaciones is
  'Conversaciones internas PGL; acceso exclusivo mediante API autenticada con permisos por rol.';
comment on table public.chat_participantes is
  'Participantes de conversaciones y marca de ultima lectura.';
comment on table public.chat_mensajes is
  'Mensajes de texto PGL. La limpieza automatica de mas de 30 dias se configura en una migracion posterior.';
