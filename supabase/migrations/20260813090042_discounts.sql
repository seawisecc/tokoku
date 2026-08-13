-- ============================================================================
-- TokoKu · 0042 · Diskon: promo produk, diskon pelanggan, diskon nota
--
-- ============================================================================
-- MASALAHNYA BUKAN "BAGAIMANA MENGURANGI TOTAL"
--
-- Migrasi 0039 baru saja membuat server MENGABAIKAN `discount_total` kiriman
-- perangkat, dengan alasan yang masih berlaku penuh: diskon yang bisa diketik
-- bebas kasir adalah kehilangan uang yang TIDAK meninggalkan selisih kas.
-- Totalnya ikut mengecil, jadi laci tetap "cocok" saat tutup shift, dan tidak
-- ada satu pun laporan yang menunjukkan ada yang hilang.
--
-- Jadi diskon di sini tidak boleh sekadar membuka kembali kolom itu. Tiga
-- lapisnya dirancang supaya masing-masing punya sumber kebenaran yang BUKAN
-- kiriman kasir:
--
--   A. Harga promo per produk  → pemilik toko yang menetapkan, per produk,
--                                 dengan rentang tanggal
--   B. Diskon nota manual      → boleh, TAPI dijepit persentase yang ditetapkan
--                                 pemilik toko, dan alasannya wajib
--   C. Diskon pelanggan        → dibaca dari baris `customers`, bukan dari
--                                 kiriman perangkat
--
-- B satu-satunya yang menerima angka dari kasir, dan itu pun cuma sebagai
-- PERMINTAAN: server menghitung ulang batasnya sendiri dan menjepitnya.
--
-- ============================================================================
-- KENAPA BAWAANNYA NOL
--
-- `max_manual_discount_percent` default 0, artinya diskon manual MATI sampai
-- pemilik toko menyalakannya sendiri. Aturannya berbeda dari kuota dan masa
-- langganan (di sana kolom kosong berarti "tak terbatas") — dan bedanya
-- disengaja: kuota yang lupa diisi merugikan KLIEN yang sudah bayar, sementara
-- diskon yang lupa dibatasi merugikan klien juga, tapi lewat uang yang keluar
-- diam-diam. Kalau ragu, gagal ke arah yang tidak mengeluarkan uang.
-- ============================================================================

-- ---------- A. harga promo per produk ----------
alter table public.products
  add column if not exists promo_price     bigint check (promo_price >= 0),
  add column if not exists promo_starts_at date,
  add column if not exists promo_ends_at   date;

comment on column public.products.promo_price is
  'Harga promo. NULL = tidak ada promo. Berlaku hanya di dalam rentang '
  'promo_starts_at..promo_ends_at (batas yang NULL berarti terbuka).';

-- ---------- B. batas diskon manual, milik toko ----------
alter table public.organizations
  add column if not exists max_manual_discount_percent smallint not null default 0
    check (max_manual_discount_percent between 0 and 100);

comment on column public.organizations.max_manual_discount_percent is
  '0 = kasir tidak boleh memberi diskon nota sama sekali (bawaan). Di atas 0, '
  'kasir boleh sampai sebesar itu dari subtotal. Ditegakkan di _apply_transaction, '
  'bukan hanya di layar.';

-- ---------- C. diskon pelanggan ----------
alter table public.customers
  add column if not exists discount_percent smallint not null default 0
    check (discount_percent between 0 and 100);

comment on column public.customers.discount_percent is
  'Potongan tetap untuk pelanggan ini, dipakai otomatis saat dipilih di kasir. '
  'Dibaca SERVER dari baris ini, tidak pernah dari kiriman perangkat.';

-- ---------- jejak: kenapa ada diskon di nota ini ----------
alter table public.transactions
  add column if not exists discount_reason   text,
  add column if not exists discount_manual   bigint not null default 0,
  add column if not exists discount_customer bigint not null default 0;

comment on column public.transactions.discount_manual is
  'Bagian diskon yang diberikan kasir dengan tangan. Dipisah dari '
  'discount_customer dan dari potongan poin supaya pemilik toko bisa melihat '
  'siapa memberi diskon berapa — itu satu-satunya gunanya memisahkan.';

-- ============================================================================
-- v_product_stock: promo ikut dikirim, plus harga yang BERLAKU hari ini.
--
-- Kolom baru WAJIB di ujung — `create or replace view` tidak boleh menyisipkan
-- di tengah. Aturan yang sama sudah menggigit di migrasi 0029.
--
-- `current_date` dipakai apa adanya, bukan tanggal menurut zona waktu toko.
-- Selisihnya paling banyak beberapa jam di ujung hari, dan promo warung
-- dihitung per hari — bukan per jam. Kalau suatu saat perlu tepat, tempatnya
-- di sini, bukan di aplikasi.
-- ============================================================================
create or replace view public.v_product_stock with (security_invoker = on) as
select
  p.id, p.organization_id, p.category_id, c.name as category_name, c.color_key,
  p.sku, p.barcode, p.name, p.unit, p.image_url,
  p.cost_price, p.sell_price, p.sell_price - p.cost_price as margin,
  p.track_stock, p.min_stock, p.is_active, p.updated_at,
  o.id as outlet_id,
  coalesce(s.quantity, 0) as stock,
  (p.track_stock and coalesce(s.quantity, 0) <= p.min_stock) as is_low_stock,
  p.promo_price, p.promo_starts_at, p.promo_ends_at,
  -- Harga yang benar-benar dipakai hari ini. Dihitung di sini supaya halaman
  -- Produk, grid Kasir, dan seed katalog offline semuanya membaca satu angka
  -- yang sama.
  case
    when p.promo_price is not null
     and (p.promo_starts_at is null or p.promo_starts_at <= current_date)
     and (p.promo_ends_at   is null or p.promo_ends_at   >= current_date)
    then p.promo_price
    else p.sell_price
  end as effective_price
from public.products p
join public.outlets o
  on o.organization_id = p.organization_id
 and o.deleted_at is null
left join public.categories c on c.id = p.category_id
left join public.product_stocks s
  on s.product_id = p.id
 and s.outlet_id = o.id
where p.deleted_at is null;

comment on view public.v_product_stock is
  'Satu baris per produk PER OUTLET. Stok yang belum pernah ada terbaca 0. '
  'Pemanggil WAJIB menyaring outlet_id — tanpa itu produk muncul berulang per '
  'cabang. `effective_price` sudah memperhitungkan promo yang sedang berjalan.';

-- ============================================================================
-- _apply_transaction: tiga lapis diskon.
--
-- Ditulis ulang utuh karena `create or replace` butuh badan lengkap. Yang
-- berubah: blok 4b diperluas dari "cuma poin" menjadi pelanggan → manual →
-- poin, dengan urutan yang disengaja (lihat komentar di dalamnya).
-- ============================================================================
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
  v_customer     uuid   := (p_trx ->> 'customer_id')::uuid;
  v_client_at    timestamptz := coalesce((p_trx ->> 'client_created_at')::timestamptz, now());
  v_org          public.organizations%rowtype;
  v_item         jsonb;
  v_product      public.products%rowtype;
  v_stock        public.product_stocks%rowtype;
  v_subtotal     bigint := 0;
  -- Sengaja 0, BUKAN dibaca dari p_trx. Lihat kepala migrasi 0039.
  v_discount     bigint := 0;
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
  -- ---- diskon ----
  v_cust_pct     smallint := 0;
  v_disc_cust    bigint := 0;
  v_disc_manual  bigint := 0;
  v_manual_ask   bigint := greatest(coalesce((p_trx ->> 'discount_manual')::bigint, 0), 0);
  v_manual_cap   bigint := 0;
  v_reason       text := nullif(btrim(coalesce(p_trx ->> 'discount_reason', '')), '');
  -- ---- penukaran poin ----
  v_redeem_req   bigint := greatest(coalesce((p_trx ->> 'points_redeemed')::bigint, 0), 0);
  v_redeem_ask   bigint := (p_trx ->> 'points_value')::bigint;
  v_redeem_pts   bigint := 0;
  v_redeem_val   bigint := 0;
begin
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

  if v_code is null then
    v_code := 'TRX-' || to_char(v_client_at at time zone v_org.timezone, 'YYYYMMDD')
              || '-' || substr(replace(v_id::text,'-',''), 1, 6);
  end if;
  while exists (select 1 from public.transactions t
                where t.organization_id = p_org and t.code = v_code) loop
    v_suffix := v_suffix + 1;
    v_code := regexp_replace(v_code, '-R[0-9]+$', '') || '-R' || v_suffix;
  end loop;

  insert into public.transactions (
    id, organization_id, outlet_id, device_id, shift_id, code, customer_id, cashier_id,
    subtotal, discount_total, tax_total, total, paid_amount, change_amount, cost_total,
    payment_method, status, note, origin, client_created_at, synced_at
  ) values (
    v_id, p_org, v_outlet, (p_trx ->> 'device_id')::uuid, (p_trx ->> 'shift_id')::uuid,
    v_code, v_customer, p_cashier,
    0, 0, 0, 0, v_paid, 0, 0,
    coalesce((p_trx ->> 'payment_method')::public.payment_method, 'cash'),
    'paid', p_trx ->> 'note', p_origin, v_client_at, now()
  );

  for v_item in select * from jsonb_array_elements(p_trx -> 'items') loop
    v_line       := v_line + 1;
    v_qty        := (v_item ->> 'quantity')::integer;
    v_price      := (v_item ->> 'unit_price')::bigint;   -- harga SESUAI STRUK yang dicetak
    v_line_disc  := coalesce((v_item ->> 'discount')::bigint, 0);
    v_line_total := (v_price * v_qty) - v_line_disc;

    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and organization_id = p_org;

    if not found then
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

    if v_product.id is not null and v_product.track_stock then
      insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
      values (p_org, v_product.id, v_outlet, 0)
      on conflict (product_id, outlet_id) do nothing;

      select * into v_stock from public.product_stocks
        where product_id = v_product.id and outlet_id = v_outlet
        for update;

      v_new_balance := v_stock.quantity - v_qty;

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

  /**
   * 4b. Tiga lapis diskon, dan URUTANNYA disengaja.
   *
   * Pelanggan dulu, lalu manual, baru poin. Alasannya: yang paling tidak bisa
   * dinegosiasikan didahulukan. Diskon pelanggan adalah hak yang sudah melekat
   * pada orangnya; diskon manual adalah kebijakan kasir saat itu; poin adalah
   * milik pembeli yang bisa disimpan untuk lain kali. Kalau poin dihitung
   * lebih dulu, poin pembeli habis untuk menutup bagian yang sebenarnya sudah
   * jadi haknya lewat diskon pelanggan.
   *
   * Ketiganya dijepit ke subtotal supaya total tidak pernah minus.
   */

  -- (C) diskon pelanggan — SELALU dibaca dari baris customers, tidak pernah
  -- dari kiriman perangkat. Ini yang membuatnya tidak bisa dikarang kasir.
  if v_customer is not null then
    select discount_percent into v_cust_pct
      from public.customers
     where id = v_customer and organization_id = p_org;
    v_cust_pct := coalesce(v_cust_pct, 0);
    if v_cust_pct > 0 then
      v_disc_cust := floor((v_subtotal - v_discount) * v_cust_pct / 100.0)::bigint;
      v_discount := v_discount + v_disc_cust;
    end if;
  end if;

  /**
   * (B) diskon manual. Angkanya datang dari kasir, tapi BATASNYA dihitung
   * ulang di sini dari `max_manual_discount_percent`. Bawaannya 0, jadi toko
   * yang belum menyalakannya menolak seluruh diskon manual tanpa perlu
   * mengubah apa pun — dan penolakannya diam-diam (dijepit ke 0), bukan
   * melempar error, karena transaksi offline yang sudah terjadi tidak boleh
   * dibuang hanya karena kebijakan diskonnya berubah setelah itu.
   */
  if v_manual_ask > 0 and coalesce(v_org.max_manual_discount_percent, 0) > 0 then
    v_manual_cap := floor(v_subtotal * v_org.max_manual_discount_percent / 100.0)::bigint;
    v_disc_manual := least(v_manual_ask, v_manual_cap);
    v_disc_manual := least(v_disc_manual, greatest(v_subtotal - v_discount, 0));
    v_discount := v_discount + v_disc_manual;
  end if;

  -- (poin) aturannya tidak berubah dari 0039; yang berubah hanya sisa yang
  -- masih bisa dipotong, karena dua lapis di atas sudah mengambil bagiannya.
  if v_customer is not null
     and coalesce(v_org.loyalty_enabled, false)
     and coalesce(v_org.loyalty_point_value, 0) > 0
     and v_redeem_req > 0
  then
    v_redeem_pts := greatest(
      least(v_redeem_req,
            floor((v_subtotal - v_discount)::numeric / v_org.loyalty_point_value)::bigint),
      0);
    v_redeem_val := least(
      v_redeem_pts * v_org.loyalty_point_value,
      coalesce(v_redeem_ask, v_redeem_pts * v_org.loyalty_point_value));
    v_redeem_val := greatest(v_redeem_val, 0);
    v_discount   := v_discount + v_redeem_val;
  end if;

  -- Jaring pengaman terakhir. Ketiga lapis di atas sudah menjepit sendiri,
  -- tapi total minus adalah jenis kerusakan yang menjalar ke laporan, laba,
  -- dan pembatalan sekaligus.
  v_discount := least(v_discount, v_subtotal);

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
         discount_manual = v_disc_manual,
         discount_customer = v_disc_cust,
         discount_reason = v_reason,
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

  perform public._apply_customer_effects(
    p_org, v_id, v_customer, v_total, v_redeem_pts, v_client_at);

  return jsonb_build_object(
    'status','accepted','id',v_id,'code',v_code,'total',v_total,
    'change', greatest(v_paid - v_total, 0),
    'points_redeemed', v_redeem_pts,
    'discount', v_discount, 'discount_manual', v_disc_manual,
    'discount_customer', v_disc_cust,
    'warnings', v_warnings);
end;
$$;

revoke execute on function public._apply_transaction from public, anon, authenticated;

comment on function public._apply_transaction is
  'Inti pencatatan penjualan. Seluruh diskon dihitung/dijepit di sini: promo '
  'sudah tercermin di unit_price, diskon pelanggan dibaca dari customers, dan '
  'diskon manual dijepit max_manual_discount_percent. discount_total kiriman '
  'perangkat tetap DIABAIKAN.';
