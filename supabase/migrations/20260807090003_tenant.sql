-- ============================================================
-- TokoKu · 0003 · Tenant: organizations, outlets, members, devices
-- ============================================================

-- ---------- organizations: satu baris = satu klien/toko ----------
create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  legal_name            text,
  city                  text,
  province              text,
  address               text,
  phone                 text,
  email                 text,
  logo_url              text,
  timezone              text not null default 'Asia/Makassar',
  currency              text not null default 'IDR',

  plan_id               uuid references public.plans(id) on delete set null,
  status                public.org_status not null default 'trial',
  trial_ends_at         timestamptz,
  joined_at             date not null default current_date,

  -- Kebijakan operasional (dibaca POS, ikut ter-cache di device)
  allow_negative_stock  boolean not null default false,
  low_stock_threshold   integer not null default 10 check (low_stock_threshold >= 0),
  tax_enabled           boolean not null default false,
  tax_percent           numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  tax_inclusive         boolean not null default true,
  offline_mode_enabled  boolean not null default true,

  -- Dinaikkan tiap katalog berubah; device pakai ini untuk deteksi cache basi.
  catalog_version       bigint not null default 1,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index on public.organizations (status);
create index on public.organizations (plan_id);
create index organizations_name_trgm_idx on public.organizations
  using gin (name extensions.gin_trgm_ops);

-- ---------- outlets: cabang ----------
create table public.outlets (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  code              text not null,
  address           text,
  phone             text,
  is_primary        boolean not null default false,
  is_active         boolean not null default true,

  -- Layar "Pengaturan Printer" (struk thermal 58mm)
  receipt_settings  jsonb not null default jsonb_build_object(
                      'paper','58mm','show_logo',true,'auto_print',true,
                      'header','','footer','Terima kasih telah berbelanja'),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (organization_id, code)
);

create index on public.outlets (organization_id);
-- Tepat satu outlet utama per organisasi
create unique index outlets_one_primary_idx on public.outlets (organization_id)
  where is_primary and deleted_at is null;

-- ---------- organization_members: user ↔ tenant + hak akses ----------
create table public.organization_members (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  role               public.member_role not null default 'cashier',
  status             public.member_status not null default 'active',

  -- Persis 4 toggle di drawer "Tambah Anggota Tim"
  permissions        jsonb not null default jsonb_build_object(
                       'pos',true,'products',false,'reports',false,'settings',false),

  default_outlet_id  uuid references public.outlets(id) on delete set null,
  job_title          text,
  invited_by         uuid references public.profiles(id) on delete set null,
  joined_at          timestamptz not null default now(),
  last_active_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index on public.organization_members (user_id) where status = 'active';
create index on public.organization_members (organization_id, role);

-- Setiap organisasi wajib punya minimal satu owner (ditegakkan trigger di 0010).

-- ---------- member_pins: unlock kasir saat perangkat offline ----------
create table public.member_pins (
  member_id        uuid primary key references public.organization_members(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  pin_hash         text not null,             -- extensions.crypt(pin, gen_salt('bf', 10))
  updated_at       timestamptz not null default now()
);

comment on table public.member_pins is
  'PIN 6 digit untuk membuka POS saat offline / ganti kasir. Hash tidak pernah dikirim ke device; '
  'device menyimpan verifier turunannya sendiri saat login online pertama.';

-- ---------- invitations ----------
create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  email            text not null,
  phone            text,
  role             public.member_role not null default 'cashier',
  permissions      jsonb not null default '{}'::jsonb,
  token            text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by       uuid references public.profiles(id) on delete set null,
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz,
  accepted_by      uuid references public.profiles(id) on delete set null,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index on public.invitations (organization_id);
create unique index invitations_pending_idx on public.invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

-- ---------- devices: perangkat POS terdaftar ----------
-- Fondasi mode offline: kode transaksi diberi awalan kode device sehingga setiap
-- perangkat bisa menomori transaksi sendiri tanpa koordinasi ke server.
create table public.devices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete cascade,
  code             text not null check (code ~ '^[A-Z0-9]{1,4}$'),
  name             text not null,
  user_agent       text,
  app_version      text,
  last_seen_at     timestamptz,
  last_sync_at     timestamptz,
  last_pull_at     timestamptz,
  pending_count    integer not null default 0,   -- laporan device: antrean belum tersinkron
  is_active        boolean not null default true,
  registered_by    uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (outlet_id, code)
);

create index on public.devices (organization_id);

comment on column public.devices.code is
  'Segmen unik pada nomor transaksi: TRX-20260807-K1-0042. Menjamin nomor unik lintas '
  'perangkat offline tanpa perlu sequence terpusat.';
