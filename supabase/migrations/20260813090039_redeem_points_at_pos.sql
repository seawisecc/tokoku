-- ============================================================
-- TokoKu · 0039 · Penukaran poin dihitung SERVER
--
-- Migrasi 0037 sudah menerima `points_redeemed` dan mengurangi saldo poin
-- pembeli, tapi tidak pernah mengubah TOTAL yang harus dibayar: poin berkurang
-- sementara pembeli tetap membayar penuh. Jadi penukarannya belum benar-benar
-- ada — dan itu sebabnya kasir tidak pernah diberi tombolnya.
--
-- Yang ditambahkan di sini: potongan rupiahnya.
--
-- POTONGANNYA DIHITUNG SERVER, BUKAN DITERIMA DARI PERANGKAT. Ini keputusan
-- paling menentukan di migrasi ini. Cara termudah adalah membiarkan kasir
-- mengirim `discount_total` apa adanya — dan `_apply_transaction` memang sudah
-- membacanya sejak 0009, walau sampai hari ini tidak ada satu pun pemanggil
-- yang mengisinya. Begitu jalur itu dipakai, siapa pun yang bisa membuka
-- DevTools di layar kasir bisa mengirim potongan sebesar seluruh belanjaan:
-- stok tetap berkurang, strukanya tetap sah, dan uangnya hilang TANPA
-- meninggalkan selisih kas — karena total yang tercatat ikut mengecil, laci
-- pun tetap "cocok" saat tutup shift. Itu jauh lebih buruk daripada penjualan
-- yang tidak diketik sama sekali, yang setidaknya menyisakan stok yang tekor.
--
-- Karena itu `discount_total` dari perangkat sekarang DIABAIKAN sepenuhnya.
-- Yang diterima cuma "berapa poin yang ditukar", dan nilai rupiahnya dihitung
-- ulang di sini dari `organizations.loyalty_point_value`.
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
  v_customer     uuid   := (p_trx ->> 'customer_id')::uuid;
  v_client_at    timestamptz := coalesce((p_trx ->> 'client_created_at')::timestamptz, now());
  v_org          public.organizations%rowtype;
  v_item         jsonb;
  v_product      public.products%rowtype;
  v_stock        public.product_stocks%rowtype;
  v_subtotal     bigint := 0;
  -- Sengaja 0, BUKAN dibaca dari p_trx. Lihat kepala berkas.
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
  -- ---- penukaran poin ----
  -- Poin yang DIMINTA perangkat.
  v_redeem_req   bigint := greatest(coalesce((p_trx ->> 'points_redeemed')::bigint, 0), 0);
  -- Rupiah potongan MENURUT STRUK yang sudah dipegang pembeli. Null kalau
  -- perangkatnya versi lama. Dipakai sebagai BATAS ATAS, tidak pernah sebagai
  -- sumber angka: lihat alasannya di bawah.
  v_redeem_ask   bigint := (p_trx ->> 'points_value')::bigint;
  v_redeem_pts   bigint := 0;
  v_redeem_val   bigint := 0;
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
    v_code, v_customer, p_cashier,
    0, 0, 0, 0, v_paid, 0, 0,
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

  /**
   * 4b. Potongan penukaran poin.
   *
   * Dihitung SETELAH item, karena batasnya adalah belanjaan itu sendiri:
   * poin tidak boleh membuat total jadi minus, dan toko tidak pernah
   * mengembalikan kelebihannya sebagai uang tunai.
   *
   * `v_redeem_pts` dijepit ke jumlah poin yang MUAT di nota ini, bukan ke saldo
   * pembeli — saldo diurus `_apply_customer_effects`, dan aturannya sengaja
   * berbeda: yang tidak muat di nota memang tidak boleh dipotong sama sekali,
   * sementara saldo yang kurang tetap diberi potongan penuh karena strukanya
   * sudah terlanjur di tangan pembeli.
   *
   * Nilai rupiahnya dijepit lagi ke `points_value` dari perangkat. Bukan untuk
   * mempercayainya, melainkan sebaliknya: transaksi offline bisa sampai server
   * berhari-hari kemudian, dan kalau pemilik toko sempat MENAIKKAN nilai poin
   * di antaranya, hitungan hari ini akan memberi potongan lebih besar daripada
   * yang tercetak di struk. Ambil yang terkecil, jadi angka di kertas tidak
   * pernah dilampaui, dan angka yang dikarang perangkat tidak pernah dituruti.
   */
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

  -- Belanja, kunjungan, dan poin pelanggan. Yang dikirim adalah poin yang
  -- BENAR-BENAR dipotong dari nota (v_redeem_pts), bukan yang diminta
  -- perangkat: kalau nota tidak muat menampung semuanya, sisanya harus tetap
  -- mengendap di saldo pembeli.
  perform public._apply_customer_effects(
    p_org, v_id, v_customer, v_total, v_redeem_pts, v_client_at);

  return jsonb_build_object(
    'status','accepted','id',v_id,'code',v_code,'total',v_total,
    'change', greatest(v_paid - v_total, 0),
    'points_redeemed', v_redeem_pts, 'discount', v_redeem_val,
    'warnings', v_warnings);
end;
$$;

revoke execute on function public._apply_transaction from public, anon, authenticated;

comment on function public._apply_transaction is
  'Inti pencatatan penjualan. Potongan poin dihitung di sini dari '
  'organizations.loyalty_point_value; discount_total kiriman perangkat DIABAIKAN.';

-- Saldo poin sengaja TIDAK diberi RPC sendiri. Kasir sudah boleh membaca
-- `customers` lewat RLS, jadi pemilih pelanggan cukup ikut mengambil kolom
-- `points` pada pencarian yang memang sudah dijalankannya — satu putaran
-- jaringan lebih sedikit di layar yang paling tidak boleh menunggu, dan tidak
-- ada permukaan RPC baru yang harus dijaga.
