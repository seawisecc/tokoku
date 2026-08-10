-- ============================================================
-- TokoKu · 0032 · Pesan nama toko kembar menyebut nama yang SUDAH ADA
--
-- Versi 0031 mengutip nama yang baru saja diketik. Perbandingannya
-- case-insensitive, jadi mengetik "toko dewi" menghasilkan
-- 'Anda sudah punya toko bernama "toko dewi"' — padahal toko yang menghalangi
-- bernama "Toko Dewi". Pemilik toko membaca kutipan itu sebagai nama yang
-- benar-benar tersimpan dan bingung kenapa ia tidak mengenalinya.
--
-- Yang dikutip harus nama yang ADA di database, bukan masukan user.
-- ============================================================

create or replace function public.register_store(p_name text, p_city text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_owned int;
  v_dupe  text;
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

  select o.name into v_dupe
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where m.user_id = v_uid and m.status = 'active' and m.role = 'owner'
     and lower(o.name) = lower(trim(p_name))
   limit 1;

  if v_dupe is not null then
    raise exception 'Anda sudah punya toko bernama "%". Beri nama yang berbeda supaya keduanya tidak tertukar.', v_dupe
      using errcode = 'TK003';
  end if;

  v_org := public.provision_organization(trim(p_name), nullif(trim(p_city), ''), v_uid, 'starter');

  return jsonb_build_object('organization_id', v_org, 'status', 'created');
end;
$$;

grant execute on function public.register_store to authenticated;
