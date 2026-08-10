-- ============================================================
-- TokoKu · 0001 · Extensions & Enum Types
-- ============================================================

create extension if not exists "pgcrypto"   with schema extensions;
create extension if not exists "citext"     with schema extensions;
create extension if not exists "pg_trgm"    with schema extensions;  -- pencarian nama produk / klien

-- ---------- Platform & tenant ----------
create type public.org_status as enum ('trial','active','suspended','inactive');

create type public.member_role as enum ('owner','admin','cashier');

create type public.member_status as enum ('invited','active','disabled');

-- ---------- Inventori ----------
create type public.stock_move_type as enum (
  'initial',          -- stok awal saat produk dibuat
  'purchase',         -- barang masuk dari supplier
  'sale',             -- keluar karena transaksi
  'return',           -- masuk kembali karena void/retur
  'adjustment',       -- koreksi manual
  'opname',           -- hasil stock opname
  'transfer_in',
  'transfer_out',
  'sync_correction'   -- koreksi akibat transaksi offline yang masuk terlambat
);

-- ---------- Penjualan ----------
create type public.payment_method as enum ('cash','qris','transfer','card','other');

create type public.trx_status as enum ('paid','void','refunded');

-- Dari mana transaksi dibuat. Menentukan kelonggaran validasi stok saat sync.
create type public.trx_origin as enum ('online','offline');

create type public.shift_status as enum ('open','closed');

-- ---------- Langganan ----------
create type public.subscription_action as enum
  ('subscribe','upgrade','downgrade','renew','cancel','reactivate');
