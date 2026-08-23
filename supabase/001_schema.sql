-- Estudio Bonta — esquema Fase 1
-- Correr completo en Supabase → SQL Editor → New query → Run.
-- Es idempotente donde fue posible (if not exists), así que se puede volver a correr sin romper nada.

create extension if not exists pgcrypto;

-- ============ PERFILES (espejo de auth.users, con rol de la empresa) ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin','coordinador','diseno','produccion','instalacion')),
  sector text not null default '',
  avatar_color text not null default '#146b52',
  active boolean not null default true
);

-- Crea el perfil automáticamente cuando se crea un usuario en auth.users
-- (se completa name/role/sector a mano después de correr esto, ver 004_seed_demo_data.sql).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, 'produccion')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============ CLIENTES ============
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null default '',
  address text not null default '',
  notes text not null default '',
  tier text not null default 'estandar' check (tier in ('estandar','prioritario'))
);

create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default ''
);

-- ============ CATÁLOGOS ============
create table if not exists job_types (
  id text primary key,
  label text not null,
  default_stages text[] not null default '{}'
);

create table if not exists materials (
  id text primary key,
  label text not null
);

-- ============ TRABAJOS ============
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  -- N° de trabajo / orden de Copernico: se carga a mano después, no al crear el
  -- trabajo (por eso no es "not null" — puede haber varios en null a la vez).
  code text unique,
  name text not null,
  client_id uuid not null references clients(id),
  contact_name text not null default '',
  contact_phone text not null default '',
  created_by_user_id uuid references profiles(id),
  responsible_user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  requested_date timestamptz,
  committed_date timestamptz not null,
  finished_at timestamptz,

  job_type_id text not null references job_types(id),
  description text not null default '',
  quantity text not null default '',
  measurements text not null default '',
  material_ids text[] not null default '{}',
  technique text not null default '',
  finish text not null default '',
  color text not null default '',
  observations text not null default '',
  special_requirements text not null default '',

  status text not null default 'NUEVO',
  priority_auto text not null default 'NORMAL',
  priority_manual text,

  requires_installation boolean not null default false,
  client_important boolean not null default false,

  last_activity_at timestamptz not null default now()
);

create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_client on jobs(client_id);
create index if not exists idx_jobs_responsible on jobs(responsible_user_id);

create table if not exists job_assigned_users (
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (job_id, user_id)
);

create table if not exists job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  key text not null,
  label text not null,
  active boolean not null default true,
  status text not null default 'pendiente' check (status in ('pendiente','en_progreso','terminado')),
  assigned_user_id uuid references profiles(id)
);

create table if not exists job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  logical_name text not null,
  kind text not null default ''
);

create table if not exists file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references job_files(id) on delete cascade,
  version int not null,
  file_name text not null,
  size_kb int not null default 0,
  storage_path text,                 -- ruta dentro del bucket "job-files"
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now(),
  approved boolean not null default false
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references profiles(id),
  text text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references profiles(id),
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table if not exists block_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  reason text not null,
  description text not null,
  opened_by uuid not null references profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists quality_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  key text not null,
  label text not null,
  required boolean not null default false,
  checked boolean not null default false
);

create table if not exists installations (
  job_id uuid primary key references jobs(id) on delete cascade,
  address text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  install_date date,
  install_time time,
  notes text not null default '',
  completed boolean not null default false,
  completed_at timestamptz,
  completed_notes text
);

create table if not exists installation_assigned_users (
  job_id uuid not null references installations(job_id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (job_id, user_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, read);
