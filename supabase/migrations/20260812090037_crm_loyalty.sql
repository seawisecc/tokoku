-- ============================================================
-- TokoKu · 0037 · CRM & poin loyalty
--
-- Sebagian besar fondasinya sudah ada sejak migrasi 0005 dan tidak pernah
-- dipakai aplikasi: tabel `customers` lengkap dengan total_spent, visit_count,
-- dan last_visit_at, kolom `transactions.customer_id`, policy RLS-nya, bahkan
-- `create_transaction` sudah menerima customer_id dan memperbarui statistiknya.
-- Yang ditambahkan di sini hanya poin loyalty dan dua perbaikan.
-- ============================================================

-- ---------- poin ----------
alter table public.customers
  add column if not exists points bigint not null default 0 check (points >= 0);

comment on column public.customers.points is
  'Saldo poin loyalty. Ditambah otomatis saat transaksi lunas, dikembalikan saat dibatalkan.';

alter table public.transactions
  add column if not exists points_earned   bigint not null default 0,
  add column if not exists points_redeemed bigint not null default 0;

comment on column public.transactions.points_earned is
  'Poin yang lahir dari transaksi ini. Disimpan per transaksi supaya pembatalan '
  'bisa mengembalikan angka yang PERSIS, bukan menghitung ulang dengan aturan '
  'yang mungkin sudah berubah sejak transaksinya terjadi.';

-- ---------- aturan poin milik toko ----------
alter table public.organizations
  add column if not exists loyalty_enabled boolean not null default false,
  -- Rupiah belanja untuk mendapat 1 poin.
  add column if not exists loyalty_earn_per bigint not null default 10000
    check (loyalty_earn_per > 0),
  -- Nilai rupiah dari 1 poin saat ditukar.
  add column if not exists loyalty_point_value bigint not null default 100
    check (loyalty_point_value >= 0);

comment on column public.organizations.loyalty_enabled is
  'Poin hanya dihitung kalau ini menyala. Toko yang tidak memakai loyalty tidak '
  'perlu melihat kolom poin di mana pun.';

-- ---------- indeks pencarian pelanggan ----------
-- Kasir mencari pelanggan lewat nama atau nomor HP di tengah antrean, jadi
-- keduanya harus cepat tanpa memuat seluruh daftar ke perangkat.
create index if not exists customers_name_trgm_idx on public.customers
  using gin (name extensions.gin_trgm_ops);
create index if not exists customers_org_visit_idx on public.customers
  (organization_id, last_visit_at desc nulls last);

-- ============================================================
-- create_transaction: hitung poin, terima penukaran
--
-- Ditulis ulang seluruhnya karena `create or replace` butuh badan utuh. Yang
-- berubah hanya blok pelanggan di bagian akhir; sisanya sama persis dengan
-- migrasi 0009.
-- ============================================================
create or replace function public._apply_customer_effects(
  p_org uuid, p_trx_id uuid, p_customer uuid, p_total bigint,
  p_redeem bigint, p_client_at timestamptz)
returns bigint                      -- poin yang benar-benar ditukar
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_enabled  boolean;
  v_earn_per bigint;
  v_saldo    bigint;
  v_tukar    bigint := 0;
  v_dapat    bigint := 0;
begin
  if p_customer is null then return 0; end if;

  select loyalty_enabled, loyalty_earn_per into v_enabled, v_earn_per
    from public.organizations where id = p_org;

  if coalesce(v_enabled, false) then
    select points into v_saldo from public.customers where id = p_customer for update;

    /**
     * Penukaran DIJEPIT ke saldo yang benar-benar ada, tidak ditolak.
     *
     * Transaksi offline bisa sampai server berhari-hari kemudian, dan poinnya
     * mungkin sudah terpakai di kasir lain. Menolak transaksinya berarti
     * membuang penjualan yang uangnya sudah diterima; potongannya pun sudah
     * terlanjur diberikan ke pembeli di depan kasir. Jadi yang dikurangi cuma
     * sebanyak yang ada, dan selisihnya ditanggung toko — kerugian yang jauh
     * lebih kecil daripada kehilangan catatan penjualannya.
     */
    v_tukar := least(greatest(coalesce(p_redeem, 0), 0), coalesce(v_saldo, 0));
    v_dapat := floor(p_total::numeric / v_earn_per)::bigint;
  end if;

  update public.customers
     set total_spent   = total_spent + p_total,
         visit_count   = visit_count + 1,
         last_visit_at = p_client_at,
         points        = points - v_tukar + v_dapat
   where id = p_customer;

  update public.transactions
     set points_earned = v_dapat, points_redeemed = v_tukar
   where id = p_trx_id;

  return v_tukar;
end;
$$;

revoke execute on function public._apply_customer_effects(uuid,uuid,uuid,bigint,bigint,timestamptz)
  from public, anon, authenticated;

comment on function public._apply_customer_effects is
  'Efek satu transaksi lunas terhadap pelanggannya: belanja, kunjungan, poin. '
  'Dipanggil dari dalam create_transaction; tidak boleh dipanggil langsung.';


-- ============================================================
-- `_apply_transaction` dipasang ulang: blok pelanggannya kini memanggil
-- `_apply_customer_effects`. Sisanya sama persis dengan migrasi 0009.
-- ============================================================
create or replace function public._apply_transaction(
  p_org      uuid,
  p_trx      jsonb,
  p_origin   public.trx_origin,
  p_cashier  uuid
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id           uuid   := coalesce((p_trx ->> 'id')::uuid, gen_random_uuid());
  v_code         text   := p_trx ->> 'code';
  v_outlet       uuid   := (p_trx ->> 'outlet_id')::uuid;
  v_client_at    timestamptz := coalesce((p_trx ->> 'client_created_at')::timestamptz, now());
  v_org          public.organizations%rowtype;
  v_item         jsonb;
  v_product      public.products%rowtype;
  v_stock        public.product_stocks%rowtype;
  v_subtotal     bigint := 0;
  v_discount     bigint := coalesce((p_trx ->> 'discount_total')::bigint, 0);
  v_cost_total   bigint := 0;
  v_tax          bigint := 0;
  v_total        bigint;
  v_paid         bigint := coalesce((p_trx ->> 'paid_amount')::bigint, 0);
  v_line         integer := 0;
  v_qty          integer;
  v_price        bigint;
  v_line_disc    bigint;
  v_line_total   bigint;
  v_new_balance  integer;
  v_warnings     jsonb := '[]'::jsonb;
  v_suffix       integer := 0;
begin
  -- 1. Sudah pernah masuk? (retry sync, klik ganda, koneksi putus saat commit)
  if exists (select 1 from public.transactions where id = v_id) then
    return jsonb_build_object('status','duplicate','id',v_id,'code',v_code);
  end if;

  select * into v_org from public.organizations where id = p_org;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_trx -> 'items','[]'::jsonb)) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  -- 2. Nomor transaksi. Dibuat perangkat; kalau bentrok, server memberi akhiran.
  if v_code is null then
    v_code := 'TRX-' || to_char(v_client_at at time zone v_org.timezone, 'YYYYMMDD')
              || '-' || substr(replace(v_id::text,'-',''), 1, 6);
  end if;
  while exists (select 1 from public.transactions t
                where t.organization_id = p_org and t.code = v_code) loop
    v_suffix := v_suffix + 1;
    v_code := regexp_replace(v_code, '-R[0-9]+$', '') || '-R' || v_suffix;
  end loop;

  -- 3. Header dulu (agar transaction_items punya induk)
  insert into public.transactions (
    id, organization_id, outlet_id, device_id, shift_id, code, customer_id, cashier_id,
    subtotal, discount_total, tax_total, total, paid_amount, change_amount, cost_total,
    payment_method, status, note, origin, client_created_at, synced_at
  ) values (
    v_id, p_org, v_outlet, (p_trx ->> 'device_id')::uuid, (p_trx ->> 'shift_id')::uuid,
    v_code, (p_trx ->> 'customer_id')::uuid, p_cashier,
    0, v_discount, 0, 0, v_paid, 0, 0,
    coalesce((p_trx ->> 'payment_method')::public.payment_method, 'cash'),
    'paid', p_trx ->> 'note', p_origin, v_client_at, now()
  );

  -- 4. Item + stok
  for v_item in select * from jsonb_array_elements(p_trx -> 'items') loop
    v_line       := v_line + 1;
    v_qty        := (v_item ->> 'quantity')::integer;
    v_price      := (v_item ->> 'unit_price')::bigint;   -- harga SESUAI STRUK yang dicetak
    v_line_disc  := coalesce((v_item ->> 'discount')::bigint, 0);
    v_line_total := (v_price * v_qty) - v_line_disc;

    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and organization_id = p_org;

    if not found then
      -- Produk sudah dihapus setelah transaksi offline dibuat. Uangnya nyata,
      -- jadi penjualan tetap dicatat dengan snapshot nama dari perangkat.
      v_warnings := v_warnings || jsonb_build_object(
        'code','product_missing', 'product_id', v_item ->> 'product_id',
        'name', v_item ->> 'product_name');
    end if;

    insert into public.transaction_items (
      organization_id, transaction_id, product_id, product_name, sku, unit,
      unit_price, unit_cost, quantity, discount, line_total, line_no
    ) values (
      p_org, v_id, v_product.id,
      coalesce(v_product.name, v_item ->> 'product_name', 'Produk dihapus'),
      coalesce(v_product.sku, v_item ->> 'sku'),
      coalesce(v_product.unit, 'pcs'),
      v_price, coalesce(v_product.cost_price, 0), v_qty, v_line_disc, v_line_total, v_line
    );

    v_subtotal   := v_subtotal + (v_price * v_qty);
    v_discount   := v_discount + v_line_disc;
    v_cost_total := v_cost_total + (coalesce(v_product.cost_price,0) * v_qty);

    -- Stok: kunci baris, lalu kurangi.
    if v_product.id is not null and v_product.track_stock then
      insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
      values (p_org, v_product.id, v_outlet, 0)
      on conflict (product_id, outlet_id) do nothing;

      select * into v_stock from public.product_stocks
        where product_id = v_product.id and outlet_id = v_outlet
        for update;

      v_new_balance := v_stock.quantity - v_qty;

      -- Penjualan online boleh ditolak kalau stok kurang. Penjualan offline
      -- TIDAK PERNAH ditolak: barangnya sudah keluar dari rak jam sekian.
      if v_new_balance < 0
         and p_origin = 'online'
         and not v_org.allow_negative_stock then
        raise exception 'insufficient_stock:%', v_product.name using errcode = 'P0001';
      end if;

      if v_new_balance < 0 then
        v_warnings := v_warnings || jsonb_build_object(
          'code','negative_stock','product_id',v_product.id,
          'name',v_product.name,'balance',v_new_balance);
      end if;

      update public.product_stocks
         set quantity = v_new_balance, updated_at = now()
       where id = v_stock.id;

      insert into public.stock_movements (
        organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
        unit_cost, ref_table, ref_id, created_by, created_at
      ) values (
        p_org, v_outlet, v_product.id, 'sale', -v_qty, v_new_balance,
        v_product.cost_price, 'transactions', v_id, p_cashier, v_client_at
      );
    end if;
  end loop;

  -- 5. Pajak & total
  if v_org.tax_enabled and v_org.tax_percent > 0 then
    if v_org.tax_inclusive then
      v_tax := round((v_subtotal - v_discount) * v_org.tax_percent / (100 + v_org.tax_percent));
    else
      v_tax := round((v_subtotal - v_discount) * v_org.tax_percent / 100);
    end if;
  end if;

  v_total := v_subtotal - v_discount + (case when v_org.tax_inclusive then 0 else v_tax end);

  update public.transactions
     set subtotal = v_subtotal,
         discount_total = v_discount,
         tax_total = v_tax,
         total = v_total,
         cost_total = v_cost_total,
         paid_amount = greatest(v_paid, v_total),
         change_amount = greatest(v_paid - v_total, 0)
   where id = v_id;

  insert into public.transaction_payments (organization_id, transaction_id, method, amount, reference)
  values (p_org, v_id,
          coalesce((p_trx ->> 'payment_method')::public.payment_method,'cash'),
          v_total, p_trx ->> 'payment_reference');

  -- Belanja, kunjungan, dan poin pelanggan. Dipisah ke fungsi sendiri supaya
  -- aturan poinnya punya satu tempat, dan supaya pembatalan bisa membalikkan
  -- angka yang sama persis. Lihat migrasi 0037.
  perform public._apply_customer_effects(
    p_org, v_id, (p_trx ->> 'customer_id')::uuid, v_total,
    coalesce((p_trx ->> 'points_redeemed')::bigint, 0), v_client_at);

  return jsonb_build_object(
    'status','accepted','id',v_id,'code',v_code,'total',v_total,
    'change', greatest(v_paid - v_total, 0), 'warnings', v_warnings);
end;
$$;

revoke execute on function public._apply_transaction from public, anon, authenticated;

-- ============================================================
-- Pembatalan mengembalikan pelanggan ke keadaan sebelum transaksi
--
-- Sebelum ini `void_transaction` mengembalikan STOK tapi tidak menyentuh
-- pelanggannya sama sekali. Akibatnya transaksi yang sudah dibatalkan tetap
-- terhitung sebagai belanja dan kunjungan, dan poin dari penjualan yang uangnya
-- sudah dikembalikan tetap mengendap di saldo pembeli. Pemilik toko yang
-- membuka daftar pelanggan melihat total belanja yang tidak pernah terjadi.
--
-- Dikerjakan trigger, bukan di dalam `void_transaction`: pembatalan bisa datang
-- dari RPC itu maupun dari Super Admin lewat SQL, dan keduanya harus berakibat
-- sama. Angka yang dikembalikan diambil dari BARIS TRANSAKSINYA, bukan dihitung
-- ulang, supaya perubahan aturan poin di kemudian hari tidak merusak pembalikan
-- transaksi lama.
-- ============================================================
create or replace function public.tg_void_reverses_customer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is null then return new; end if;
  if old.status = new.status then return new; end if;

  if new.status = 'void' and old.status = 'paid' then
    update public.customers
       set total_spent = greatest(total_spent - old.total, 0),
           visit_count = greatest(visit_count - 1, 0),
           points      = greatest(points - old.points_earned + old.points_redeemed, 0)
     where id = new.customer_id;

  -- Dibuka kembali (mis. salah batal). Jarang, tapi kalau tidak ditangani,
  -- angkanya tinggal separuh selamanya.
  elsif new.status = 'paid' and old.status = 'void' then
    update public.customers
       set total_spent = total_spent + new.total,
           visit_count = visit_count + 1,
           points      = greatest(points + new.points_earned - new.points_redeemed, 0)
     where id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_void_reverses_customer on public.transactions;
create trigger trg_void_reverses_customer
  after update of status on public.transactions
  for each row execute function public.tg_void_reverses_customer();
