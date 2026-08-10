-- ============================================================
-- TokoKu · 0005 · Penjualan: customers, shifts, transactions
-- ============================================================

-- ---------- customers ----------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  phone            text,
  email            text,
  address          text,
  note             text,
  total_spent      bigint not null default 0,
  visit_count      integer not null default 0,
  last_visit_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index on public.customers (organization_id);
create unique index customers_phone_idx on public.customers (organization_id, phone)
  where phone is not null and deleted_at is null;

-- ---------- shifts ----------
create table public.shifts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete cascade,
  device_id        uuid references public.devices(id) on delete set null,
  user_id          uuid not null references public.profiles(id) on delete restrict,

  status           public.shift_status not null default 'open',
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,

  opening_cash     bigint not null default 0 check (opening_cash >= 0),
  expected_cash    bigint,      -- opening_cash + total penjualan tunai
  closing_cash     bigint,      -- hasil hitung fisik kasir
  cash_difference  bigint generated always as (closing_cash - expected_cash) stored,
  note             text,
  created_at       timestamptz not null default now()
);

create index on public.shifts (organization_id, outlet_id, opened_at desc);
-- Satu shift terbuka per user per outlet
create unique index shifts_one_open_idx on public.shifts (outlet_id, user_id)
  where status = 'open';

-- ---------- transactions ----------
create table public.transactions (
  -- id DIBUAT DI CLIENT (UUID v7). Ini yang membuat sync idempoten:
  -- kiriman ulang batch yang sama akan bentrok primary key, bukan menggandakan data.
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  outlet_id          uuid not null references public.outlets(id) on delete restrict,
  device_id          uuid references public.devices(id) on delete set null,
  shift_id           uuid references public.shifts(id) on delete set null,

  code               text not null,      -- TRX-20260807-K1-0042
  customer_id        uuid references public.customers(id) on delete set null,
  cashier_id         uuid not null references public.profiles(id) on delete restrict,

  subtotal           bigint not null default 0 check (subtotal >= 0),
  discount_total     bigint not null default 0 check (discount_total >= 0),
  tax_total          bigint not null default 0 check (tax_total >= 0),
  rounding           bigint not null default 0,
  total              bigint not null default 0 check (total >= 0),
  paid_amount        bigint not null default 0 check (paid_amount >= 0),
  change_amount      bigint not null default 0 check (change_amount >= 0),
  cost_total         bigint not null default 0,   -- HPP snapshot, untuk laporan margin
  payment_method     public.payment_method not null default 'cash',

  status             public.trx_status not null default 'paid',
  note               text,

  -- ---- jejak offline ----
  origin             public.trx_origin not null default 'online',
  client_created_at  timestamptz not null default now(),  -- jam di perangkat kasir
  synced_at          timestamptz,                          -- kapan diterima server
  sync_lag           interval generated always as (synced_at - client_created_at) stored,

  voided_by          uuid references public.profiles(id) on delete set null,
  voided_at          timestamptz,
  void_reason        text,

  created_at         timestamptz not null default now(),
  unique (organization_id, code),
  constraint transactions_total_chk check (total = subtotal - discount_total + tax_total + rounding)
);

create index transactions_org_time_idx
  on public.transactions (organization_id, client_created_at desc);
create index transactions_cashier_idx
  on public.transactions (organization_id, cashier_id, client_created_at desc);  -- layar Riwayat kasir
create index transactions_outlet_idx
  on public.transactions (organization_id, outlet_id, client_created_at desc);
create index transactions_shift_idx on public.transactions (shift_id);
create index transactions_offline_idx on public.transactions (organization_id, origin)
  where origin = 'offline';

comment on column public.transactions.client_created_at is
  'Waktu transaksi menurut perangkat kasir — INI yang dipakai semua laporan. '
  'created_at hanyalah waktu baris masuk ke Postgres, yang bisa terlambat berjam-jam '
  'untuk transaksi offline.';

-- ---------- transaction_items ----------
-- Semua kolom produk di-snapshot: harga boleh berubah besok, struk lama harus tetap benar.
create table public.transaction_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  transaction_id    uuid not null references public.transactions(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,

  product_name      text not null,
  sku               text,
  unit              text not null default 'pcs',
  unit_price        bigint not null check (unit_price >= 0),
  unit_cost         bigint not null default 0,
  quantity          integer not null check (quantity > 0),
  discount          bigint not null default 0 check (discount >= 0),
  line_total        bigint not null check (line_total >= 0),
  line_no           integer not null default 1,
  created_at        timestamptz not null default now()
);

create index on public.transaction_items (transaction_id);
create index on public.transaction_items (organization_id, product_id);

-- ---------- transaction_payments: mendukung pembayaran terpisah ----------
-- v1 selalu menulis tepat satu baris. Tabel ini ada sejak awal supaya split payment
-- nanti tidak perlu migrasi struktur transaksi.
create table public.transaction_payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  transaction_id   uuid not null references public.transactions(id) on delete cascade,
  method           public.payment_method not null,
  amount           bigint not null check (amount > 0),
  reference        text,          -- no. referensi QRIS / transfer
  created_at       timestamptz not null default now()
);

create index on public.transaction_payments (transaction_id);
