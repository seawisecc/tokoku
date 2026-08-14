-- ============================================================
-- TokoKu · 0046 · Pembelian: catatan pelunasan & cara bayar
--
-- Dua kekurangan yang baru terlihat setelah Arus Kas ada, dan keduanya membuat
-- laporan itu berbohong tanpa satu pun error.
--
-- 1. "Tandai lunas" selalu memakai JAM SAAT TOMBOL DITEKAN. Nota yang dibayar
--    Sabtu lalu tapi baru sempat ditandai hari Senin akan tercatat keluar hari
--    Senin, dan `v_cash_flow` memang membaca `paid_at` untuk menempatkan uang
--    keluarnya. Untuk laporan yang gunanya mencocokkan uang dengan tanggal,
--    itu salah di tempat yang paling penting.
--
-- 2. `payment_method` yang ditambahkan migrasi 0043 tidak pernah bisa diisi
--    siapa pun: `create_purchase` tidak menerimanya, jadi SETIAP pembelian
--    tercatat tunai. Transfer ke pemasok muncul di laporan sebagai uang yang
--    keluar dari laci kasir, dan selisihnya tidak akan pernah bisa dijelaskan
--    saat tutup shift.
--
-- Yang SENGAJA tidak dikerjakan di sini: tabel `purchase_payments` untuk
-- pembayaran sebagian. CLAUDE.md memang sudah menyebut bahwa memisahkan stok
-- dari pembayaran dilakukan supaya cicilan punya tempat suatu hari, dan tempat
-- itu memang belum dibuat. Tapi menambahkannya sekarang berarti mengubah arti
-- "lunas" di Beranda, lonceng notifikasi, dan `v_cash_flow` sekaligus, demi
-- kebutuhan yang belum pernah diminta. Yang diminta: tanggal dan catatan.
-- ============================================================

-- Catatan pelunasan. Opsional, dan memang harus opsional: kebanyakan pelunasan
-- tidak punya cerita, dan isian wajib yang tidak punya isi akan diisi titik.
alter table public.purchases add column paid_note text;

comment on column public.purchases.paid_note is
  'Catatan saat nota ditandai lunas, opsional. Contoh: nomor bukti transfer, '
  'atau "dibayar sebagian dulu Rp 500rb, sisanya minggu depan".';

-- ---------- create_purchase menerima cara bayar ----------
-- Hanya satu baris yang berubah dari versi migrasi 0023; sisanya disalin apa
-- adanya. Ditulis ulang seluruhnya karena `create or replace function` memang
-- menuntut badan fungsi yang utuh.
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
  v_method   public.payment_method;
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

  -- Tunai kalau tidak disebut. Itu bawaan yang benar untuk warung, dan sama
  -- dengan default kolomnya sejak 0043.
  v_method := coalesce(nullif(p_payload ->> 'payment_method', '')::public.payment_method, 'cash');

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
    payment, payment_method, due_date, note, created_by)
  values (
    p_org, v_outlet, nullif(p_payload ->> 'supplier_id', '')::uuid, v_code,
    nullif(p_payload ->> 'invoice_no', ''),
    coalesce(nullif(p_payload ->> 'purchased_at', '')::date, current_date),
    v_payment, v_method, v_due, nullif(p_payload ->> 'note', ''), auth.uid())
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
  'Catat pembelian: nota + stok naik + HPP diperbarui, dalam satu transaksi. '
  'Menerima payment_method supaya arus kas tahu uangnya keluar dari laci atau '
  'dari rekening.';
