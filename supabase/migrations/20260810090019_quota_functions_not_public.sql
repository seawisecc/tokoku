-- ============================================================
-- TokoKu · 0019 · Tutup kebocoran org_usage / org_quota
--
-- Migrasi 0018 membuat kedua fungsi itu SECURITY DEFINER dan menerima id
-- organisasi APA PUN. PostgREST mengekspos setiap fungsi di schema public
-- sebagai RPC, jadi hasilnya: user biasa satu toko bisa memanggilnya dengan id
-- toko orang lain.
--
-- Terbukti sebelum ditambal — pemilik Warung Barokah memanggil
-- org_usage(<id Toko Dewi>, 'products') dan mendapat jawaban 9, lalu
-- org_quota(...) dan mendapat 2000. Persis jenis kebocoran lintas tenant yang
-- seluruh desain RLS di project ini ada untuk mencegahnya.
--
-- Perbaikannya dua sisi:
--   1. Cabut hak panggil dari anon & authenticated. Trigger tetap bisa
--      memakainya karena enforce_plan_quota() sendiri SECURITY DEFINER —
--      panggilan di dalamnya memakai hak pemilik fungsi, bukan hak pemanggil.
--   2. v_client_quota tidak lagi security_invoker (kalau tetap invoker, ia ikut
--      kehilangan hak panggil dan viewnya mati). Sebagai gantinya penyaringan
--      antar tenant ditulis eksplisit di WHERE — bukan diandalkan ke RLS.
-- ============================================================

revoke execute on function public.org_usage(uuid, text) from public, anon, authenticated;
revoke execute on function public.org_quota(uuid, text) from public, anon, authenticated;

drop view if exists public.v_client_quota;

create view public.v_client_quota as
select
  o.id                                    as organization_id,
  pl.max_outlets,
  pl.max_users,
  pl.max_products,
  pl.max_devices,
  public.org_usage(o.id, 'outlets')       as used_outlets,
  public.org_usage(o.id, 'users')         as used_users,
  public.org_usage(o.id, 'products')      as used_products,
  public.org_usage(o.id, 'devices')       as used_devices
from public.organizations o
left join public.plans pl on pl.id = o.plan_id
where o.deleted_at is null
  -- Penyaringan tenant ditulis di sini karena view ini berjalan sebagai
  -- pemiliknya; RLS organizations TIDAK ikut berlaku. Super Admin melihat
  -- semua, anggota toko hanya tokonya sendiri.
  and (public.is_platform_admin() or o.id in (select public.user_org_ids()));

grant select on public.v_client_quota to authenticated;

comment on view public.v_client_quota is
  'Kuota & pemakaian per organisasi. Berjalan sebagai pemilik view: penyaringan antar tenant ada di WHERE, bukan di RLS.';
