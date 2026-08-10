-- ============================================================
-- TokoKu · 0006 · Sync, Audit, Langganan
-- ============================================================

-- ---------- sync_batches: satu baris per kiriman dari device ----------
create table public.sync_batches (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  outlet_id         uuid references public.outlets(id) on delete set null,
  device_id         uuid references public.devices(id) on delete set null,
  submitted_by      uuid references public.profiles(id) on delete set null,

  item_count        integer not null default 0,
  accepted_count    integer not null default 0,
  duplicate_count   integer not null default 0,   -- sudah pernah masuk → aman diabaikan
  rejected_count    integer not null default 0,

  oldest_client_at  timestamptz,                  -- transaksi tertua dalam batch
  app_version       text,
  received_at       timestamptz not null default now(),
  duration_ms       integer
);

create index on public.sync_batches (organization_id, received_at desc);
create index on public.sync_batches (device_id, received_at desc);

-- ---------- sync_rejections: antrean masalah yang butuh mata manusia ----------
create table public.sync_rejections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  batch_id         uuid references public.sync_batches(id) on delete cascade,
  device_id        uuid references public.devices(id) on delete set null,
  client_trx_id    uuid,
  client_trx_code  text,
  reason_code      text not null,   -- 'product_missing' | 'outlet_inactive' | 'invalid_total' | ...
  reason           text,
  payload          jsonb not null,  -- transaksi utuh, agar bisa diperbaiki & di-replay
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index on public.sync_rejections (organization_id, resolved_at nulls first);

comment on table public.sync_rejections is
  'Transaksi offline yang tidak bisa diterapkan apa adanya (mis. produknya sudah dihapus). '
  'Tidak pernah dibuang diam-diam — muncul di halaman /pengaturan/sinkronisasi untuk ditinjau.';

-- ---------- audit_logs ----------
create table public.audit_logs (
  id               bigserial primary key,
  organization_id  uuid references public.organizations(id) on delete cascade,  -- null = aksi platform
  actor_id         uuid references public.profiles(id) on delete set null,
  acting_as_admin  boolean not null default false,   -- true bila lewat impersonation
  action           text not null,                    -- 'create' | 'update' | 'delete' | 'void' | 'login_as'
  entity           text not null,
  entity_id        uuid,
  changes          jsonb,
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index on public.audit_logs (organization_id, created_at desc);
create index on public.audit_logs (entity, entity_id);

-- ---------- impersonation_sessions: jejak "Login sebagai Klien" ----------
create table public.impersonation_sessions (
  id               uuid primary key default gen_random_uuid(),
  admin_user_id    uuid not null references public.profiles(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  reason           text,
  ip               inet,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  expires_at       timestamptz not null default (now() + interval '1 hour')
);

create index on public.impersonation_sessions (admin_user_id, started_at desc);
create index on public.impersonation_sessions (organization_id, started_at desc);

-- ---------- subscription_events: riwayat "Ubah Paket" ----------
create table public.subscription_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  plan_id          uuid references public.plans(id) on delete set null,
  from_plan_id     uuid references public.plans(id) on delete set null,
  action           public.subscription_action not null,
  amount           bigint not null default 0,
  period_start     date,
  period_end       date,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index on public.subscription_events (organization_id, created_at desc);
