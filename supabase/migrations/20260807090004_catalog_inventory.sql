-- ============================================================
-- TokoKu · 0004 · Katalog & Inventori
-- Semua tabel di sini pakai soft delete (deleted_at) karena device offline
-- perlu tahu baris mana yang dihapus saat menarik perubahan (delta sync).
-- ============================================================

-- ---------- categories ----------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  color_key        text not null default 'default',  -- memetakan ke .cat-* pada tema Lime Crush
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index on public.categories (organization_id);
create unique index categories_unique_name_idx
  on public.categories (organization_id, lower(name)) where deleted_at is null;

-- ---------- products ----------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  category_id      uuid references public.categories(id) on delete set null,

  sku              text not null,
  barcode          text,
  name             text not null,
  description      text,
  unit             text not null default 'pcs',
  image_url        text,

  cost_price       bigint not null default 0 check (cost_price >= 0),   -- rupiah bulat
  sell_price       bigint not null default 0 check (sell_price >= 0),

  track_stock      boolean not null default true,
  min_stock        integer not null default 10 check (min_stock >= 0),  -- ambang "stok menipis"
  is_active        boolean not null default true,

  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index products_sku_idx
  on public.products (organization_id, upper(sku)) where deleted_at is null;
create unique index products_barcode_idx
  on public.products (organization_id, barcode) where barcode is not null and deleted_at is null;
create index products_org_active_idx
  on public.products (organization_id, is_active, category_id) where deleted_at is null;
-- Delta sync: "beri saya produk yang berubah sejak X"
create index products_org_updated_idx on public.products (organization_id, updated_at desc);
create index products_name_trgm_idx on public.products
  using gin (name extensions.gin_trgm_ops);

-- ---------- product_stocks: stok per outlet ----------
create table public.product_stocks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete cascade,
  quantity         integer not null default 0,   -- SENGAJA tanpa CHECK >= 0, lihat catatan
  reserved         integer not null default 0 check (reserved >= 0),
  updated_at       timestamptz not null default now(),
  unique (product_id, outlet_id)
);

create index on public.product_stocks (organization_id, outlet_id);
create index product_stocks_low_idx on public.product_stocks (organization_id, outlet_id, quantity);

comment on column public.product_stocks.quantity is
  'Boleh negatif. Transaksi offline yang tersinkron terlambat sudah terjadi secara fisik — '
  'menolaknya berarti kehilangan catatan penjualan. Stok minus muncul di laporan '
  'v_stock_discrepancy untuk disesuaikan lewat opname.';

-- ---------- stock_movements: buku besar stok, append-only ----------
create table public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete cascade,
  type             public.stock_move_type not null,
  quantity_delta   integer not null,
  balance_after    integer not null,
  unit_cost        bigint,
  ref_table        text,
  ref_id           uuid,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index stock_movements_product_idx
  on public.stock_movements (organization_id, product_id, created_at desc);
create index stock_movements_ref_idx
  on public.stock_movements (ref_table, ref_id);
