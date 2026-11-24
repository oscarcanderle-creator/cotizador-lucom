-- Fuente: Reporte Claro "Tramites de Portabilidad".
-- Un registro por número de trámite, independientemente de NIM y SDS.
-- Los datos originales se conservan para futuros cruces y sincronización de estados.
create table if not exists public.reporte_tramites_portabilidad (
  id bigint generated always as identity primary key,
  tramite text not null unique,
  dia_id integer,
  estado_id integer,
  estado text,
  fecha_inicio timestamp without time zone,
  nim_cabecera text,
  cuenta_id text,
  cantidad integer not null default 1 check (cantidad >= 1),
  entidad text,
  donante text,
  bloque text,
  can_id text,
  canal_ventas_desc text,
  fecha_agenda timestamp without time zone,
  cuit text,
  tipo_portacion text,
  client_id text,
  client_desc text,
  srf_usr_id text,
  usr_name text,
  usr_surname text,
  negocio_origen text,
  sds text,
  archivo_origen text,
  importado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists reporte_tramites_portabilidad_estado_idx
  on public.reporte_tramites_portabilidad (estado);
create index if not exists reporte_tramites_portabilidad_entidad_idx
  on public.reporte_tramites_portabilidad (entidad);
create index if not exists reporte_tramites_portabilidad_sds_idx
  on public.reporte_tramites_portabilidad (sds);
create index if not exists reporte_tramites_portabilidad_nim_idx
  on public.reporte_tramites_portabilidad (nim_cabecera);
create index if not exists reporte_tramites_portabilidad_inicio_idx
  on public.reporte_tramites_portabilidad (fecha_inicio);

-- Sin políticas de lectura/escritura para usuarios finales.
-- La importación futura utilizará una API autenticada y cliente de servicio.
alter table public.reporte_tramites_portabilidad enable row level security;

comment on table public.reporte_tramites_portabilidad is
  'Trámites de portabilidad Claro; Cantidad representa líneas, no filas. Trámite es único, NIM puede repetirse.';
comment on column public.reporte_tramites_portabilidad.fecha_inicio is
  'Fecha de carga del trámite; NO es la fecha efectiva de portación.';
comment on column public.reporte_tramites_portabilidad.fecha_agenda is
  'Fecha agendada; no asumir que es fecha de portación efectiva.';
