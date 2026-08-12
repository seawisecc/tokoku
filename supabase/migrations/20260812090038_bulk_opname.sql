-- ============================================================================
-- Opname massal: satu sesi hitung fisik untuk banyak produk sekaligus.
--
-- Sebelum ini opname HANYA bisa per produk, lewat drawer di baris tabel Produk.
-- Benar untuk warung 50 barang; untuk 200+ barang sebulan sekali itu 200 kali
-- buka-tutup drawer, dan orang berhenti di tengah lalu angkanya tidak pernah
-- benar-benar dicocokkan.
--
-- SATU RPC, bukan perulangan `adjust_stock` dari aplikasi. Sesi opname adalah
-- satu peristiwa: kalau gagal di tengah, sebagian rak sudah tertulis angka baru
-- dan sebagian belum, sementara kertas hitungan di tangan orangnya menyebut
-- semuanya. Tidak ada yang tahu berhenti di baris mana. Dibungkus satu
-- transaksi, hasilnya cuma dua kemungkinan: semua tercatat, atau tidak sama
-- sekali dan boleh diulang apa adanya.
-- ============================================================================

create or replace function public.bulk_adjust_stock(
  p_org uuid,
  p_outlet uuid,
  p_items jsonb,          -- [{ "product_id": uuid, "qty": int }, ...]
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item    jsonb;
  v_product uuid;
  v_qty     integer;
  v_jumlah  integer := 0;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Outlet wajib milik organisasi ini. RLS tidak menyaring per outlet (lihat
  -- "OUTLET BUKAN BATAS KEAMANAN"), jadi outlet_id cabang toko lain yang lolos
  -- akan tertulis ke stok dan ledger cabang yang salah.
  if not exists (
    select 1 from public.outlets
     where id = p_outlet and organization_id = p_org and deleted_at is null
  ) then
    raise exception 'Outlet tidak dikenali.' using errcode = 'TK003';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tidak ada produk yang dihitung.' using errcode = 'TK003';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product := (v_item->>'product_id')::uuid;
    v_qty     := (v_item->>'qty')::integer;

    if v_qty is null or v_qty < 0 then
      raise exception 'Hasil hitung harus bilangan bulat, minimal 0.' using errcode = 'TK003';
    end if;

    -- Produk wajib milik organisasi yang sama. `adjust_stock` tidak
    -- memeriksanya, dan karena ia SECURITY DEFINER pemeriksaan RLS ikut
    -- dilewati — id produk toko lain akan membuat baris product_stocks
    -- bertuan ganda. Di sini diperiksa sebelum apa pun ditulis.
    if not exists (
      select 1 from public.products
       where id = v_product and organization_id = p_org and deleted_at is null
    ) then
      raise exception 'Ada produk yang tidak dikenali di toko ini.' using errcode = 'TK003';
    end if;

    perform public.adjust_stock(p_org, v_product, p_outlet, v_qty, 'opname', p_note);
    v_jumlah := v_jumlah + 1;
  end loop;

  return jsonb_build_object('updated', v_jumlah);
end;
$$;

comment on function public.bulk_adjust_stock(uuid, uuid, jsonb, text) is
  'Opname satu sesi untuk banyak produk. Atomik: gagal satu berarti tidak ada '
  'yang tertulis, sehingga sesinya boleh diulang apa adanya.';

-- Dipanggil aplikasi dengan sesi user biasa; menyaring sendiri lewat
-- user_can(p_org,'products'), pola yang sama dengan adjust_stock.
revoke all on function public.bulk_adjust_stock(uuid, uuid, jsonb, text) from public;
grant execute on function public.bulk_adjust_stock(uuid, uuid, jsonb, text) to authenticated;
