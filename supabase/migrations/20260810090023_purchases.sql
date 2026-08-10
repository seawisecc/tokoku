-- ============================================================
-- TokoKu · 0023 · Pembelian & pemasok
--
-- Sebelum ini stok HANYA bisa naik lewat opname manual. Warung yang belanja
-- 10 karton harus berpura-pura "menyesuaikan stok", dan HPP tidak pernah ikut
-- terkoreksi — sehingga laba kotor di Laporan cuma seakurat terakhir kali orang
-- mengetik harga pokok dengan tangan.
--
-- Dua keputusan desain yang disepakati, dan alasannya:
--
-- 1. PEMBELIAN LANGSUNG MENAMBAH STOK. Tidak ada langkah "terima barang"
--    terpisah. Pemisahan itu berguna kalau yang memesan dan yang menerima orang
--    berbeda; di warung keduanya orang yang sama dan barangnya sudah di tangan
--    saat dicatat.
--
-- 2. STOK DAN PEMBAYARAN ADALAH DUA SUMBU TERPISAH. Stok naik seketika,
--    sementara status bayar berdiri sendiri (lunas / tempo + jatuh tempo).
--    Digabung jadi satu status, pembayaran sebagian tidak akan punya tempat.
--
-- HPP memakai harga beli TERAKHIR, naik maupun turun. Sengaja bukan "hanya
-- kalau lebih tinggi": harga beli turun itu biasa pada barang yang paling
-- banyak diputar warung (beras, minyak, telur, cabai), dan batas satu arah
-- membuat laba kotor dilaporkan lebih kecil dari kenyataan secara permanen.
-- Aman dilakukan karena HPP sudah di-snapshot saat penjualan terjadi —
-- transactions.cost_total, transaction_items, dan stock_movements.unit_cost —
-- jadi mengubahnya TIDAK menulis ulang laporan masa lalu.
-- ============================================================

create type public.purchase_payment as enum ('paid', 'credit');

-- ---------- pemasok ----------
create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  phone            text,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index on public.suppliers (organization_id) where deleted_at is null;

-- ---------- pembelian ----------
create table public.purchases (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete restrict,
  supplier_id      uuid references public.suppliers(id) on delete set null,
  code             text not null,
  invoice_no       text,                       -- nomor nota dari pemasok
  purchased_at     date not null default current_date,
  total            bigint not null default 0 check (total >= 0),
  payment          public.purchase_payment not null default 'paid',
  due_date         date,                       -- diisi kalau tempo (TOP)
  paid_at          timestamptz,                -- kapan tempo akhirnya dilunasi
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, code)
);
create index on public.purchases (organization_id, purchased_at desc);
-- Dipakai pengingat jatuh tempo di Beranda.
create index purchases_due_idx on public.purchases (organization_id, due_date)
  where payment = 'credit' and paid_at is null;

create table public.purchase_items (
  id               uuid primary key default gen_random_uuid(),
  -- organization_id ikut disimpan walau bisa dijangkau lewat purchase_id:
  -- aturan project ini, supaya policy RLS bisa dievaluasi tanpa JOIN.
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  purchase_id      uuid not null references public.purchases(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  quantity         integer not null check (quantity > 0),
  unit_cost        bigint not null check (unit_cost >= 0),
  subtotal         bigint not null check (subtotal >= 0)
);
create index on public.purchase_items (purchase_id);

-- ---------- RLS ----------
alter table public.suppliers      enable row level security;
alter table public.purchases      enable row level security;
alter table public.purchase_items enable row level security;

create policy suppliers_read on public.suppliers for select
  using (public.can_read_org(organization_id));
create policy suppliers_write on public.suppliers for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

create policy purchases_read on public.purchases for select
  using (public.can_read_org(organization_id));
create policy purchases_write on public.purchases for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

create policy purchase_items_read on public.purchase_items for select
  using (public.can_read_org(organization_id));
create policy purchase_items_write on public.purchase_items for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

-- Kuota & status langganan berlaku juga di sini.
drop trigger if exists trg_active_purchases on public.purchases;
create trigger trg_active_purchases before insert on public.purchases
  for each row execute function public.enforce_org_active();

-- ---------- RPC ----------
/**
 * Catat satu pembelian: simpan nota, naikkan stok, perbarui HPP.
 *
 * Satu RPC supaya ketiganya tidak pernah terpisah. Kalau form aplikasi yang
 * merangkainya, kegagalan di tengah menyisakan nota tanpa stok — atau lebih
 * buruk, stok naik tanpa catatan pembeliannya.
 */
create or replace function public.create_purchase(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_outlet   uuid;
  v_id       uuid;
  v_code     text;
  v_seq      int;
  v_total    bigint := 0;
  v_item     jsonb;
  v_qty      int;
  v_cost     bigint;
  v_prod     public.products%rowtype;
  v_balance  int;
  v_payment  public.purchase_payment;
  v_due      date;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce(jsonb_array_length(p_payload -> 'items'), 0) = 0 then
    raise exception 'Pembelian harus berisi minimal satu barang.' using errcode = 'TK003';
  end if;

  v_outlet := (p_payload ->> 'outlet_id')::uuid;
  v_payment := coalesce((p_payload ->> 'payment')::public.purchase_payment, 'paid');
  v_due := nullif(p_payload ->> 'due_date', '')::date;

  if v_payment = 'credit' and v_due is null then
    raise exception 'Pembelian tempo harus punya tanggal jatuh tempo.' using errcode = 'TK003';
  end if;

  -- Nomor urut per organisasi per hari: PB-20260810-0001
  select coalesce(max(substring(code from '\d+$')::int), 0) + 1 into v_seq
    from public.purchases
   where organization_id = p_org
     and code like 'PB-' || to_char(current_date, 'YYYYMMDD') || '-%';
  v_code := 'PB-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.purchases (
    organization_id, outlet_id, supplier_id, code, invoice_no, purchased_at,
    payment, due_date, note, created_by)
  values (
    p_org, v_outlet, nullif(p_payload ->> 'supplier_id', '')::uuid, v_code,
    nullif(p_payload ->> 'invoice_no', ''),
    coalesce(nullif(p_payload ->> 'purchased_at', '')::date, current_date),
    v_payment, v_due, nullif(p_payload ->> 'note', ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    select * into v_prod from public.products
     where id = (v_item ->> 'product_id')::uuid and organization_id = p_org;
    if not found then
      raise exception 'Produk tidak ditemukan di toko ini.' using errcode = 'TK003';
    end if;

    v_qty  := (v_item ->> 'quantity')::int;
    v_cost := (v_item ->> 'unit_cost')::bigint;
    if v_qty <= 0 then
      raise exception 'Jumlah barang harus lebih dari nol.' using errcode = 'TK003';
    end if;

    insert into public.purchase_items (
      organization_id, purchase_id, product_id, quantity, unit_cost, subtotal)
    values (p_org, v_id, v_prod.id, v_qty, v_cost, v_qty * v_cost);

    v_total := v_total + (v_qty * v_cost);

    -- Stok naik hanya untuk produk yang memang dilacak.
    if v_prod.track_stock then
      insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
      values (p_org, v_prod.id, v_outlet, v_qty)
      on conflict (product_id, outlet_id)
        do update set quantity = public.product_stocks.quantity + excluded.quantity,
                      updated_at = now()
      returning quantity into v_balance;

      insert into public.stock_movements (
        organization_id, outlet_id, product_id, type, quantity_delta,
        balance_after, unit_cost, ref_table, ref_id, note, created_by)
      values (p_org, v_outlet, v_prod.id, 'purchase', v_qty, v_balance, v_cost,
              'purchases', v_id, 'Pembelian ' || v_code, auth.uid());
    end if;

    -- HPP = harga beli terakhir, naik maupun turun. Lihat catatan di kepala file.
    update public.products
       set cost_price = v_cost, updated_at = now()
     where id = v_prod.id;
  end loop;

  update public.purchases set total = v_total where id = v_id;

  return jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total);
end
$$;

revoke execute on function public.create_purchase(uuid, jsonb) from public, anon;
grant execute on function public.create_purchase(uuid, jsonb) to authenticated;

comment on function public.create_purchase is
  'Catat pembelian: nota + stok naik + HPP diperbarui, dalam satu transaksi.';
