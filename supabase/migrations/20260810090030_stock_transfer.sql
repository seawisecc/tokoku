-- ============================================================
-- TokoKu · 0030 · Transfer stok antar outlet
--
-- Enum `stock_move_type` sudah punya 'transfer_in' dan 'transfer_out' sejak
-- migrasi 0001, tapi tidak ada satu pun yang pernah menulisnya. Sampai
-- multi-outlet ada, memang belum ada yang bisa ditransfer.
--
-- ------------------------------------------------------------
-- SATU RPC, DUA SISI. Ini keputusan yang paling menentukan.
--
-- Transfer menyentuh stok di DUA outlet sekaligus. Dirangkai dari aplikasi
-- sebagai dua panggilan `adjust_stock`, kegagalan di antaranya menghilangkan
-- barang: stok asal sudah turun, stok tujuan belum naik, dan tidak ada apa pun
-- yang mencatat bahwa barangnya sedang di jalan. Selisihnya baru ketahuan saat
-- opname berikutnya — kalau ketahuan.
--
-- Karena itu keduanya dalam satu transaksi database, dan kedua baris ledgernya
-- menunjuk `ref_id` yang sama sehingga pasangannya selalu bisa ditemukan.
-- ------------------------------------------------------------
--
-- TIDAK ADA "barang dalam perjalanan". Di warung, yang memindahkan barang antar
-- cabang adalah pemiliknya sendiri, hari itu juga, naik motor. Status transit
-- berguna kalau pengirim dan penerima orang berbeda dan jedanya berhari-hari;
-- di sini ia hanya menambah satu langkah yang harus diingat orang untuk
-- diselesaikan — dan yang lupa diselesaikan akan menggantung selamanya.
-- Alasannya sama persis dengan tidak adanya langkah "terima barang" di
-- Pembelian (migrasi 0023).
-- ============================================================

create table public.stock_transfers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  from_outlet_id   uuid not null references public.outlets(id) on delete restrict,
  to_outlet_id     uuid not null references public.outlets(id) on delete restrict,
  code             text not null,
  transferred_on   date not null default current_date,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, code),
  constraint stock_transfers_different_outlets check (from_outlet_id <> to_outlet_id)
);
create index on public.stock_transfers (organization_id, transferred_on desc);

create table public.stock_transfer_items (
  id               uuid primary key default gen_random_uuid(),
  -- Aturan project: setiap tabel tenant punya organization_id sendiri, termasuk
  -- tabel anak, supaya policy RLS bisa dievaluasi tanpa JOIN.
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  transfer_id      uuid not null references public.stock_transfers(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  quantity         integer not null check (quantity > 0),
  -- Sisa di masing-masing sisi SETELAH transfer, disnapshot seperti
  -- stock_movements.balance_after: kalau nanti angkanya diperdebatkan, nota ini
  -- bisa dibaca sendiri tanpa merekonstruksi ulang seluruh ledger.
  balance_from     integer not null,
  balance_to       integer not null
);
create index on public.stock_transfer_items (transfer_id);

alter table public.stock_transfers      enable row level security;
alter table public.stock_transfer_items enable row level security;

create policy stock_transfers_read on public.stock_transfers for select
  using (public.can_read_org(organization_id));
create policy stock_transfers_insert on public.stock_transfers for insert
  with check (public.user_can(organization_id, 'products'));

create policy stock_transfer_items_read on public.stock_transfer_items for select
  using (public.can_read_org(organization_id));
create policy stock_transfer_items_insert on public.stock_transfer_items for insert
  with check (public.user_can(organization_id, 'products'));

-- Hanya SELECT dan INSERT: nota transfer adalah catatan perpindahan barang yang
-- sudah terjadi. Sama dengan stock_movements — kalau angkanya keliru,
-- perbaikannya lewat transfer balik atau opname, bukan dengan menghapus jejak.

drop trigger if exists trg_active_transfers on public.stock_transfers;
create trigger trg_active_transfers before insert on public.stock_transfers
  for each row execute function public.enforce_org_active();

/**
 * Pindahkan barang dari satu outlet ke outlet lain.
 *
 * Stok asal turun dan stok tujuan naik dalam SATU transaksi, masing-masing
 * meninggalkan barisnya sendiri di kartu stok ('transfer_out' dan
 * 'transfer_in') yang menunjuk nota yang sama.
 */
create or replace function public.transfer_stock(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_from    uuid;
  v_to      uuid;
  v_code    text;
  v_seq     int;
  v_id      uuid;
  v_item    jsonb;
  v_prod    public.products%rowtype;
  v_qty     int;
  v_avail   int;
  v_bal_f   int;
  v_bal_t   int;
  v_count   int := 0;
  v_total   int := 0;
  v_name_f  text;
  v_name_t  text;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_from := nullif(p_payload ->> 'from_outlet_id', '')::uuid;
  v_to   := nullif(p_payload ->> 'to_outlet_id', '')::uuid;

  if v_from is null or v_to is null then
    raise exception 'Pilih outlet asal dan outlet tujuan.' using errcode = 'TK003';
  end if;
  if v_from = v_to then
    raise exception 'Outlet asal dan tujuan tidak boleh sama.' using errcode = 'TK003';
  end if;

  select name into v_name_f from public.outlets
   where id = v_from and organization_id = p_org and deleted_at is null;
  select name into v_name_t from public.outlets
   where id = v_to   and organization_id = p_org and is_active and deleted_at is null;

  if v_name_f is null then
    raise exception 'Outlet asal tidak ditemukan di toko ini.' using errcode = 'TK003';
  end if;
  -- Tujuan wajib AKTIF; asal tidak. Memindahkan sisa barang KELUAR dari cabang
  -- yang baru ditutup justru salah satu alasan utama fitur ini ada.
  if v_name_t is null then
    raise exception 'Outlet tujuan tidak ditemukan atau sedang tidak aktif.' using errcode = 'TK003';
  end if;

  if coalesce(jsonb_array_length(p_payload -> 'items'), 0) = 0 then
    raise exception 'Transfer harus berisi minimal satu barang.' using errcode = 'TK003';
  end if;

  select coalesce(max(substring(code from '\d+$')::int), 0) + 1 into v_seq
    from public.stock_transfers
   where organization_id = p_org
     and code like 'TF-' || to_char(current_date, 'YYYYMMDD') || '-%';
  v_code := 'TF-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.stock_transfers (
    organization_id, from_outlet_id, to_outlet_id, code, transferred_on, note, created_by)
  values (
    p_org, v_from, v_to, v_code,
    coalesce(nullif(p_payload ->> 'transferred_on', '')::date, current_date),
    nullif(p_payload ->> 'note', ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    select * into v_prod from public.products
     where id = (v_item ->> 'product_id')::uuid and organization_id = p_org;
    if not found then
      raise exception 'Produk tidak ditemukan di toko ini.' using errcode = 'TK003';
    end if;

    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Jumlah yang dipindahkan harus lebih dari nol.' using errcode = 'TK003';
    end if;

    -- Produk tanpa pelacakan stok tidak punya angka untuk dipindahkan.
    -- Diterima diam-diam, notanya mencatat perpindahan yang tidak pernah terjadi.
    if not v_prod.track_stock then
      raise exception 'Produk "%" disetel tanpa pelacakan stok, jadi tidak ada jumlah yang bisa dipindahkan.',
        v_prod.name using errcode = 'TK003';
    end if;

    -- Kunci baris asal SEBELUM membaca sisanya: tanpa ini, dua transfer yang
    -- berjalan bersamaan sama-sama melihat sisa yang sama dan keduanya lolos.
    insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
    values (p_org, v_prod.id, v_from, 0)
    on conflict (product_id, outlet_id) do nothing;

    select quantity into v_avail from public.product_stocks
     where product_id = v_prod.id and outlet_id = v_from for update;

    -- DITOLAK kalau melebihi sisa — berbeda dengan aturan stok minus pada
    -- penjualan. Stok minus di penjualan itu kenyataan yang sudah terjadi dan
    -- menolaknya berarti membuang catatan uang masuk. Transfer adalah isian
    -- manual saat online: kelebihannya salah ketik, dan diterima diam-diam ia
    -- menciptakan barang dari udara di cabang tujuan.
    if v_qty > v_avail then
      raise exception 'Stok "%" di % tinggal % — tidak bisa memindahkan %.',
        v_prod.name, v_name_f, v_avail, v_qty using errcode = 'TK003';
    end if;

    update public.product_stocks
       set quantity = quantity - v_qty, updated_at = now()
     where product_id = v_prod.id and outlet_id = v_from
    returning quantity into v_bal_f;

    insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
    values (p_org, v_prod.id, v_to, v_qty)
    on conflict (product_id, outlet_id)
      do update set quantity = public.product_stocks.quantity + excluded.quantity,
                    updated_at = now()
    returning quantity into v_bal_t;

    insert into public.stock_transfer_items (
      organization_id, transfer_id, product_id, quantity, balance_from, balance_to)
    values (p_org, v_id, v_prod.id, v_qty, v_bal_f, v_bal_t);

    insert into public.stock_movements (
      organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
      unit_cost, ref_table, ref_id, note, created_by)
    values
      (p_org, v_from, v_prod.id, 'transfer_out', -v_qty, v_bal_f,
       v_prod.cost_price, 'stock_transfers', v_id, 'Pindah ke ' || v_name_t, auth.uid()),
      (p_org, v_to,   v_prod.id, 'transfer_in',   v_qty, v_bal_t,
       v_prod.cost_price, 'stock_transfers', v_id, 'Pindah dari ' || v_name_f, auth.uid());

    v_count := v_count + 1;
    v_total := v_total + v_qty;
  end loop;

  return jsonb_build_object(
    'id', v_id, 'code', v_code, 'products', v_count, 'quantity', v_total,
    'from', v_name_f, 'to', v_name_t);
end
$$;

revoke execute on function public.transfer_stock(uuid, jsonb) from public, anon;
grant  execute on function public.transfer_stock(uuid, jsonb) to authenticated;

comment on function public.transfer_stock is
  'Pindahkan stok antar outlet. Stok turun di asal & naik di tujuan dalam satu transaksi, dua baris kartu stok menunjuk nota yang sama.';
