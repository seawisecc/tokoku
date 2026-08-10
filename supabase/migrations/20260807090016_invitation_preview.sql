-- ============================================================
-- TokoKu · 0016 · invitation_preview
--
-- Halaman undangan perlu menampilkan nama toko SEBELUM undangan diterima,
-- tapi penerima belum jadi anggota — policy pada organizations menolak dia
-- membacanya, sehingga halamannya berbunyi "Bergabung dengan " tanpa nama.
-- Meminta orang menerima undangan tanpa tahu toko apa jelas tidak benar.
--
-- Diselesaikan dengan fungsi sempit, bukan dengan melonggarkan RLS
-- organizations: yang dibuka hanya nama & kota, hanya untuk pemegang token
-- undangan yang masih berlaku.
-- ============================================================

create or replace function public.invitation_preview(p_token text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', case
      when i.id is null              then 'invalid'
      when i.revoked_at is not null  then 'revoked'
      when i.accepted_at is not null then 'already_accepted'
      when i.expires_at < now()      then 'expired'
      else 'valid'
    end,
    'email', i.email,
    'role', i.role,
    'organization_name', o.name,
    'organization_city', o.city,
    'expires_at', i.expires_at)
  from public.invitations i
  left join public.organizations o on o.id = i.organization_id
  where i.token = p_token
$$;

grant execute on function public.invitation_preview to authenticated, anon;
