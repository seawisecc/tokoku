-- ============================================================
-- TokoKu · 0035 · Toko yang sudah dihapus tidak boleh ikut menghitung
--
-- Ditemukan saat menguji migrasi 0034: `register_store` menghitung jatah 5 toko
-- dan memeriksa nama kembar langsung dari `organization_members`, TANPA melihat
-- apakah organisasinya masih hidup.
--
-- Dua akibatnya nyata, dan keduanya baru terasa setelah Super Admin menghapus
-- sebuah toko klien:
--
--   1. Slotnya tidak pernah kembali. Akun yang tokonya dihapus tetap terhitung
--      memiliki 5 toko dan tidak bisa membuat yang baru — dengan pesan "Satu
--      akun bisa memiliki maksimal 5 toko" yang menyebut angka yang tidak cocok
--      dengan apa pun yang ia lihat di pemilih toko.
--
--   2. Namanya ikut terkunci selamanya. Mendaftarkan ulang toko dengan nama yang
--      sama persis ditolak "Anda sudah punya toko bernama X" — padahal toko itu
--      justru sudah tidak ada, dan mendaftar ulang setelah salah hapus adalah
--      alasan paling wajar orang mengetik nama yang sama.
--
-- Seluruh aplikasi menyaring `deleted_at is null` di mana-mana; dua tempat ini
-- terlewat. Soft delete memang dipilih supaya perangkat offline bisa melihat
-- baris yang dihapus (lihat "Aturan yang tidak boleh dilanggar"), bukan supaya
-- barisnya tetap ikut berhitung.
-- ============================================================

create or replace function public.register_store(p_name text, p_city text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_owned      int;
  v_trial_ends timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'store_name_too_short' using errcode = 'P0001';
  end if;

  select count(*) into v_owned
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where m.user_id = v_uid
     and m.status = 'active'
     and m.role = 'owner'
     and o.deleted_at is null;

  if v_owned >= 5 then
    raise exception 'Satu akun bisa memiliki maksimal 5 toko. Hubungi admin TokoKu kalau memang perlu lebih.'
      using errcode = 'TK003';
  end if;

  -- Nama toko yang sama persis, dimiliki orang yang sama, hampir selalu berarti
  -- tombol Daftar tertekan dua kali — bukan dua usaha berbeda yang kebetulan
  -- senama. Pesannya mengutip nama yang SUDAH ADA di database, bukan yang baru
  -- diketik: perbandingannya case-insensitive.
  if exists (
    select 1
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
     where m.user_id = v_uid and m.status = 'active' and m.role = 'owner'
       and o.deleted_at is null
       and lower(o.name) = lower(trim(p_name))
  ) then
    raise exception 'Anda sudah punya toko bernama "%".', trim(p_name)
      using errcode = 'TK003';
  end if;

  v_org := public.provision_organization(trim(p_name), nullif(trim(p_city), ''), v_uid, 'starter');

  select trial_ends_at into v_trial_ends from public.organizations where id = v_org;

  return jsonb_build_object(
    'organization_id', v_org,
    'status', 'created',
    'trial_ends_at', v_trial_ends,
    -- NULL = masa coba tanpa batas, jadi tetap aktif.
    'trial_active', (v_trial_ends is null or v_trial_ends > now())
  );
end;
$$;

grant execute on function public.register_store to authenticated;

comment on function public.register_store is
  'Daftarkan toko baru untuk diri sendiri. Maksimal 5 toko DIMILIKI DAN BELUM '
  'DIHAPUS per akun; diundang ke toko orang lain tidak dibatasi. Masa coba '
  'gratis dibagi seluruh toko milik akun yang sama — lihat migrasi 0034.';
