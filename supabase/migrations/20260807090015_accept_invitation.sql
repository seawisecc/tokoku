-- ============================================================
-- TokoKu · 0015 · accept_invitation
--
-- Fungsi ini terdaftar di PLAN.md sejak awal tapi tidak pernah ikut ditulis ke
-- migrasi mana pun. Ketahuan saat menguji undangan tim: tautannya terbuat, tapi
-- tidak ada apa pun yang bisa menukarnya jadi keanggotaan.
--
-- SECURITY DEFINER karena penerima undangan belum jadi anggota organisasi —
-- RLS pada organization_members justru akan menolak dia menambahkan dirinya.
-- Wewenangnya dibatasi ketat oleh token: hanya undangan yang cocok, belum
-- diterima, belum dicabut, dan belum kedaluwarsa yang diproses.
-- ============================================================

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_inv     public.invitations%rowtype;
  v_org     public.organizations%rowtype;
  v_outlet  uuid;
  v_member  uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations where token = p_token;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('status', 'already_accepted');
  end if;
  if v_inv.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into v_org from public.organizations where id = v_inv.organization_id;

  -- Sudah jadi anggota (mis. diundang dua kali): aktifkan kembali dan
  -- perbarui haknya, jangan membuat baris kedua.
  select id into v_member
    from public.organization_members
   where organization_id = v_inv.organization_id and user_id = auth.uid();

  select id into v_outlet
    from public.outlets
   where organization_id = v_inv.organization_id and is_primary and deleted_at is null
   limit 1;

  if v_member is not null then
    update public.organization_members
       set role = v_inv.role,
           permissions = coalesce(v_inv.permissions, permissions),
           status = 'active',
           default_outlet_id = coalesce(default_outlet_id, v_outlet)
     where id = v_member;
  else
    insert into public.organization_members
      (organization_id, user_id, role, permissions, status, default_outlet_id, invited_by)
    values
      (v_inv.organization_id, auth.uid(), v_inv.role,
       coalesce(v_inv.permissions, '{"pos":true}'::jsonb),
       'active', v_outlet, v_inv.invited_by)
    returning id into v_member;
  end if;

  update public.invitations
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_inv.id;

  return jsonb_build_object(
    'status', 'accepted',
    'organization_id', v_inv.organization_id,
    'organization_name', v_org.name,
    'role', v_inv.role);
end;
$$;

grant execute on function public.accept_invitation to authenticated;

-- Penerima undangan perlu membaca barisnya sendiri untuk melihat nama toko
-- sebelum menerima. Policy lama hanya mengizinkan pengurus organisasi.
drop policy if exists invites_read on public.invitations;

create policy invites_read on public.invitations for select
  using (
    public.can_manage(organization_id)
    or public.is_platform_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
