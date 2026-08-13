-- ============================================================================
-- TokoKu · 0040 · Impor produk dari CSV
--
-- Alasan fitur ini ada, dan kenapa ia bukan kemewahan: toko yang pindah dari
-- pencatatan lain (buku tulis, Excel, aplikasi kasir sebelumnya) sudah punya
-- daftar barangnya. Mengetiknya ulang satu per satu lewat drawer produk untuk
-- 300 barang berarti dua hari kerja sebelum aplikasinya bisa dipakai sama
-- sekali — dan di situlah kebanyakan orang berhenti mencoba.
--
-- SATU RPC, atomik, dengan alasan yang persis sama seperti `bulk_adjust_stock`:
-- daftar barang adalah satu peristiwa. Gagal di baris ke-180 berarti 179 produk
-- masuk dan sisanya tidak, sementara berkas CSV di tangan pemilik toko memuat
-- semuanya dan tidak ada yang tahu harus melanjutkan dari mana. Dibungkus satu
-- transaksi, hasilnya cuma dua: seluruh daftar masuk, atau tidak sama sekali
-- dan berkasnya boleh diperbaiki lalu diulang apa adanya.
--
-- Kuota `max_products` tetap ditegakkan trigger BEFORE INSERT yang sudah ada.
-- Trigger itu ikut melihat baris-baris sebelumnya dari statement yang sama,
-- jadi impor 500 produk ke paket berkuota 100 ditolak di baris ke-101 dan
-- SELURUH impor batal — bukan 100 masuk lalu sisanya hilang diam-diam.
-- ============================================================================

create or replace function public.import_products(
  p_org    uuid,
  p_outlet uuid,
  -- [{ sku, name, category, unit, barcode, sell_price, cost_price,
  --    min_stock, stock, track_stock }, ...]
  p_rows   jsonb,
  -- false = SKU yang sudah ada dilewati, bukan ditimpa.
  p_update_existing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row        jsonb;
  v_no         integer := 0;
  v_sku        text;
  v_name       text;
  v_cat_name   text;
  v_cat        uuid;
  v_barcode    text;
  v_unit       text;
  v_sell       bigint;
  v_cost       bigint;
  v_min        integer;
  v_track      boolean;
  v_stock      integer;
  v_existing   public.products%rowtype;
  v_product    uuid;
  v_created    integer := 0;
  v_updated    integer := 0;
  v_skipped    integer := 0;
  v_cats_new   integer := 0;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Outlet wajib milik organisasi ini. RLS tidak menyaring per outlet, jadi
  -- outlet cabang toko lain yang lolos akan menerima stok awal impor ini.
  if not exists (
    select 1 from public.outlets
     where id = p_outlet and organization_id = p_org and deleted_at is null
  ) then
    raise exception 'Outlet tidak dikenali.' using errcode = 'TK003';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Tidak ada baris yang bisa diimpor.' using errcode = 'TK003';
  end if;

  -- Batas atas satu sesi. Bukan soal kemampuan Postgres melainkan soal
  -- pemulihan: berkas yang jauh lebih besar dari ini hampir selalu berarti
  -- kolomnya salah petak, dan menolak lebih awal jauh lebih baik daripada
  -- menunggu lima menit untuk kemudian membatalkan semuanya.
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Sekali impor maksimal 2.000 baris. Pecah berkasnya dulu.'
      using errcode = 'TK003';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_no  := v_no + 1;
    v_sku := nullif(btrim(coalesce(v_row ->> 'sku', '')), '');
    v_name := nullif(btrim(coalesce(v_row ->> 'name', '')), '');

    -- Nomor barisnya ikut disebut. Pemilik toko memperbaiki CSV-nya di
    -- spreadsheet, dan "ada yang salah" tanpa nomor baris berarti dia harus
    -- menyisir 300 baris sendiri.
    if v_sku is null then
      raise exception 'Baris %: kode barang (SKU) kosong.', v_no using errcode = 'TK003';
    end if;
    if v_name is null then
      raise exception 'Baris %: nama barang kosong.', v_no using errcode = 'TK003';
    end if;

    v_sell := greatest(coalesce((v_row ->> 'sell_price')::bigint, 0), 0);
    v_cost := greatest(coalesce((v_row ->> 'cost_price')::bigint, 0), 0);
    v_min  := greatest(coalesce((v_row ->> 'min_stock')::integer, 10), 0);
    v_unit := coalesce(nullif(btrim(coalesce(v_row ->> 'unit', '')), ''), 'pcs');
    v_barcode := nullif(btrim(coalesce(v_row ->> 'barcode', '')), '');
    v_track := coalesce((v_row ->> 'track_stock')::boolean, true);
    v_stock := (v_row ->> 'stock')::integer;

    -- ---- kategori ----
    -- Dicocokkan tanpa memandang besar-kecil huruf: "Minuman" dan "minuman" di
    -- berkas yang sama hampir pasti dimaksudkan sebagai satu kategori, dan
    -- membuat keduanya membuat daftar kategori toko kotor sejak hari pertama.
    v_cat := null;
    v_cat_name := nullif(btrim(coalesce(v_row ->> 'category', '')), '');
    if v_cat_name is not null then
      select id into v_cat from public.categories
       where organization_id = p_org and deleted_at is null
         and lower(name) = lower(v_cat_name)
       limit 1;

      -- Kategori yang belum ada DIBUAT, tidak dibiarkan kosong. Produk tanpa
      -- kategori tidak bisa disaring di grid kasir, dan memaksa pemilik toko
      -- membuat 12 kategori dengan tangan sebelum boleh mengimpor sama saja
      -- dengan menyuruhnya mengetik ulang.
      if v_cat is null then
        insert into public.categories (organization_id, name, color_key, sort_order)
        values (p_org, v_cat_name,
                -- Warnanya digilir, bukan semuanya abu. Pil kategori di layar
                -- kasir dibedakan justru oleh warnanya; delapan kategori
                -- seragam membuat kasir membaca teksnya satu per satu.
                (array['sembako','minuman','snack','kebutuhan'])[(v_cats_new % 4) + 1],
                coalesce((select max(sort_order) + 1 from public.categories
                           where organization_id = p_org), 0))
        returning id into v_cat;
        v_cats_new := v_cats_new + 1;
      end if;
    end if;

    -- ---- produk ----
    select * into v_existing from public.products
     where organization_id = p_org and deleted_at is null and upper(sku) = upper(v_sku)
     limit 1;

    if found then
      if not p_update_existing then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      update public.products
         set name = v_name,
             category_id = coalesce(v_cat, category_id),
             unit = v_unit,
             barcode = coalesce(v_barcode, barcode),
             sell_price = v_sell,
             cost_price = v_cost,
             min_stock = v_min,
             track_stock = v_track,
             updated_at = now()
       where id = v_existing.id;

      v_product := v_existing.id;
      v_updated := v_updated + 1;
    else
      insert into public.products (
        organization_id, category_id, sku, barcode, name, unit,
        cost_price, sell_price, track_stock, min_stock, is_active, created_by
      ) values (
        p_org, v_cat, v_sku, v_barcode, v_name, v_unit,
        v_cost, v_sell, v_track, v_min, true, auth.uid()
      ) returning id into v_product;

      v_created := v_created + 1;
    end if;

    -- ---- stok awal ----
    -- Kolom stok yang KOSONG berarti "jangan sentuh", bukan "nol". Aturannya
    -- sama persis dengan baris kosong di opname satu sesi: dikirim sebagai 0,
    -- impor ulang untuk memperbaiki harga akan mengosongkan seluruh rak.
    if v_stock is not null and v_track then
      if v_stock < 0 then
        raise exception 'Baris %: stok tidak boleh minus.', v_no using errcode = 'TK003';
      end if;
      perform public.adjust_stock(
        p_org, v_product, p_outlet, v_stock,
        case when v_existing.id is null then 'initial' else 'opname' end,
        'Impor CSV');
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created, 'updated', v_updated,
    'skipped', v_skipped, 'categories_created', v_cats_new);
end;
$$;

revoke execute on function public.import_products(uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_products(uuid, uuid, jsonb, boolean) to authenticated;

comment on function public.import_products(uuid, uuid, jsonb, boolean) is
  'Impor daftar produk dari CSV dalam satu transaksi. Cocokkan per SKU, buat '
  'kategori yang belum ada, dan set stok awal di outlet yang diminta. Kuota '
  'max_products tetap ditegakkan trigger; kalau kena, seluruh impor batal.';
