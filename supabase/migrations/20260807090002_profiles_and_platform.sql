-- ============================================================
-- TokoKu · 0002 · Profiles & Platform (di luar tenant)
-- ============================================================

-- ---------- profiles: mirror auth.users ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  phone        text,
  avatar_url   text,
  locale       text not null default 'id-ID',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Data publik user. Inisial avatar (RK/AP/NS) dihitung di client dari full_name.';

-- ---------- plans: Starter / Growth / Enterprise ----------
create table public.plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,          -- 'starter' | 'growth' | 'enterprise'
  name           text not null,
  description    text,
  price_monthly  bigint not null default 0 check (price_monthly >= 0),  -- rupiah bulat
  price_yearly   bigint not null default 0 check (price_yearly  >= 0),
  max_outlets    integer,                        -- null = tak terbatas
  max_users      integer,
  max_products   integer,
  max_devices    integer,                        -- perangkat POS offline per outlet
  features       jsonb not null default '{}'::jsonb,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- platform_admins: Super Admin ----------
-- Dipisah dari profiles agar hak platform tidak bisa di-set lewat update profil sendiri.
create table public.platform_admins (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  granted_by  uuid references public.profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  note        text
);

-- ---------- platform_settings: single row ----------
create table public.platform_settings (
  id                boolean primary key default true check (id),
  platform_name     text not null default 'TokoKu',
  brand_tagline     text not null default 'by Seawise Studio',
  support_email     text not null default 'support@tokoku.id',
  support_phone     text,
  default_timezone  text not null default 'Asia/Makassar',
  trial_days        integer not null default 14 check (trial_days >= 0),
  maintenance_mode  boolean not null default false,
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict do nothing;
