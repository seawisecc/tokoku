-- ============================================================
-- TokoKu · 0020 · Hidupkan kembali v_client_quota setelah 0019
--
-- 0019 mencabut hak panggil org_usage/org_quota dari authenticated — benar,
-- karena keduanya menerima id organisasi apa pun. Tapi itu sekaligus mematikan
-- v_client_quota, bahkan untuk Super Admin.
--
-- Sebabnya: VIEW tidak mengganti `current_user`. Ia hanya membuat pemeriksaan
-- hak atas TABEL memakai pemilik view. Hak EXECUTE sebuah fungsi tetap diperiksa
-- terhadap pemanggil, jadi mencabutnya dari authenticated mematikan view apa pun
-- yang memanggilnya — invoker maupun bukan.
--
-- Yang benar-benar mengganti current_user hanyalah SECURITY DEFINER pada
-- FUNGSI. Jadi bungkusnya dipindah ke fungsi: penyaringan antar tenant ada di
-- dalam, tanpa parameter sama sekali sehingga tidak ada id organisasi yang bisa
-- disodorkan pemanggil. Viewnya tinggal membaca fungsi itu.
-- ============================================================

create or replace function public.client_quotas()
returns table (
  organization_id uuid,
  max_outlets     integer,
  max_users       integer,
  max_products    integer,
  max_devices     integer,
  used_outlets    integer,
  used_users      integer,
  used_products   integer,
  used_devices    integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    o.id,
    pl.max_outlets, pl.max_users, pl.max_products, pl.max_devices,
    public.org_usage(o.id, 'outlets'),
    public.org_usage(o.id, 'users'),
    public.org_usage(o.id, 'products'),
    public.org_usage(o.id, 'devices')
  from public.organizations o
  left join public.plans pl on pl.id = o.plan_id
  where o.deleted_at is null
    and (public.is_platform_admin() or o.id in (select public.user_org_ids()))
$$;

revoke execute on function public.client_quotas() from public, anon;
grant execute on function public.client_quotas() to authenticated;

drop view if exists public.v_client_quota;
create view public.v_client_quota as select * from public.client_quotas();
grant select on public.v_client_quota to authenticated;

comment on function public.client_quotas is
  'Kuota & pemakaian organisasi yang boleh dilihat pemanggil. Tanpa parameter: tidak ada id yang bisa disodorkan dari luar.';
