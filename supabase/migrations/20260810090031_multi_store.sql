-- ============================================================
-- TokoKu · 0031 · Satu akun boleh punya beberapa toko
--
-- `register_store` menolak kalau user sudah jadi anggota toko mana pun. Itu
-- keputusan yang benar saat modul auth baru jadi — tanpa pemilih toko di
-- aplikasi, akun dengan dua organisasi hanya akan melihat yang pertama, dan
-- toko keduanya menjadi data yang tidak bisa dicapai siapa pun.
--
-- Sekarang pemilihnya sudah ada, jadi kuncinya dibuka.
--
-- ------------------------------------------------------------
-- BEDAKAN DARI MULTI-OUTLET. Keduanya sering tertukar:
--
--   Multi-outlet → satu TOKO, banyak CABANG. Satu langganan, satu katalog
--                  produk, satu tim. Yang terpisah cuma stok dan kasirnya.
--   Multi-toko   → satu AKUN, banyak TOKO. Langganan sendiri-sendiri, produk
--                  sendiri, tim sendiri, RLS memisahkannya total.
--
-- Warung yang buka cabang butuh yang pertama. Orang yang punya dua usaha
-- berbeda butuh yang kedua.
-- ------------------------------------------------------------
--
-- BATASNYA TETAP ADA, hanya digeser. Tanpa batas apa pun, satu akun bisa
-- membuat ribuan organisasi dalam semenit — tiap satu membawa outlet, kategori
-- bawaan, dan baris langganan sendiri. Itu bukan pemakaian yang wajar melainkan
-- cara termurah membanjiri database, dan tidak ada gerbang lain di depannya:
-- pendaftaran toko tidak berbayar dan tidak butuh persetujuan siapa pun.
--
-- Batasnya dipilih 5: cukup longgar untuk pemilik beberapa usaha, cukup ketat
-- untuk membuat penyalahgunaan tidak sepadan. Hanya menghitung toko yang
-- DIMILIKI — akun bisa diundang jadi kasir di berapa pun toko orang lain.
-- ============================================================

create or replace function public.register_store(p_name text, p_city text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_owned int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'store_name_too_short' using errcode = 'P0001';
  end if;

  select count(*) into v_owned
    from public.organization_members
   where user_id = v_uid and status = 'active' and role = 'owner';

  if v_owned >= 5 then
    raise exception 'Satu akun bisa memiliki maksimal 5 toko. Hubungi admin TokoKu kalau memang perlu lebih.'
      using errcode = 'TK003';
  end if;

  -- Nama toko yang sama persis, dimiliki orang yang sama, hampir selalu berarti
  -- tombol Daftar tertekan dua kali — bukan dua usaha berbeda yang kebetulan
  -- senama. Ditolak di sini supaya tidak ada dua toko kembar yang isinya
  -- terbelah dan pemiliknya tidak tahu mana yang dipakai.
  if exists (
    select 1
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
     where m.user_id = v_uid and m.status = 'active' and m.role = 'owner'
       and lower(o.name) = lower(trim(p_name))
  ) then
    raise exception 'Anda sudah punya toko bernama "%".', trim(p_name)
      using errcode = 'TK003';
  end if;

  v_org := public.provision_organization(trim(p_name), nullif(trim(p_city), ''), v_uid, 'starter');

  return jsonb_build_object('organization_id', v_org, 'status', 'created');
end;
$$;

grant execute on function public.register_store to authenticated;

comment on function public.register_store is
  'Daftarkan toko baru untuk diri sendiri. Maksimal 5 toko dimiliki per akun; diundang ke toko orang lain tidak dibatasi.';
