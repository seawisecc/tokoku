-- ============================================================
-- TokoKu · 0007 · Helper untuk RLS
-- Semua SECURITY DEFINER + STABLE. SECURITY DEFINER wajib di sini: tanpa itu,
-- policy pada organization_members akan memanggil query ke organization_members
-- sendiri dan menyebabkan rekursi tak berujung.
-- ============================================================

-- Daftar organisasi milik user yang sedang login
create or replace function public.user_org_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
$$;

-- Role user di satu organisasi (null bila bukan anggota)
create or replace function public.user_role_in(p_org uuid)
returns public.member_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.role
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.organization_id = p_org
    and m.status = 'active'
$$;

-- Cek satu izin modul: 'pos' | 'products' | 'reports' | 'settings'
-- Owner selalu lolos.
create or replace function public.user_can(p_org uuid, p_perm text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select m.role = 'owner' or coalesce((m.permissions ->> p_perm)::boolean, false)
     from public.organization_members m
     where m.user_id = auth.uid()
       and m.organization_id = p_org
       and m.status = 'active'),
    false)
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
$$;

-- Gerbang tulis standar: anggota aktif ber-role owner/admin
create or replace function public.can_manage(p_org uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.user_role_in(p_org) in ('owner','admin')
$$;

-- Organisasi ini boleh dibaca user ini? (dipakai berulang di policy)
create or replace function public.can_read_org(p_org uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select p_org in (select public.user_org_ids()) or public.is_platform_admin()
$$;

grant execute on function
  public.user_org_ids, public.user_role_in, public.user_can,
  public.is_platform_admin, public.can_manage, public.can_read_org
to authenticated;
