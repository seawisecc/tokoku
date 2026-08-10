-- ============================================================
-- TokoKu · 0017 · register_store
--
-- Pendaftaran toko mandiri dari halaman Daftar.
--
-- `provision_organization` sengaja dicabut dari role `authenticated` — kalau
-- dibuka langsung, siapa pun bisa membuat organisasi atas nama orang lain.
-- Fungsi ini adalah pintu sempitnya: hanya untuk diri sendiri, hanya sekali,
-- dan menolak kalau user sudah punya toko.
-- ============================================================

create or replace function public.register_store(p_name text, p_city text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'store_name_too_short' using errcode = 'P0001';
  end if;

  -- Satu akun, satu toko. Ini batas pendaftaran mandiri, bukan batas produk:
  -- akun bisa diundang ke toko lain kapan saja lewat alur undangan.
  if exists (
    select 1 from public.organization_members
    where user_id = v_uid and status = 'active'
  ) then
    raise exception 'already_has_store' using errcode = 'P0001';
  end if;

  v_org := public.provision_organization(trim(p_name), nullif(trim(p_city), ''), v_uid, 'starter');

  return jsonb_build_object('organization_id', v_org, 'status', 'created');
end;
$$;

grant execute on function public.register_store to authenticated;
