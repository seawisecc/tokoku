-- ============================================================
-- TokoKu · 0034 · Masa coba gratis milik AKUN, bukan milik toko
--
-- Sejak multi-toko dibuka (0031), satu akun boleh memiliki sampai 5 toko dan
-- `provision_organization` memberi SETIAP toko masa coba 14 hari yang baru.
-- Jadi 5 toko = 70 hari gratis, dan pendaftaran toko tidak berbayar maupun
-- butuh persetujuan siapa pun — tidak ada gerbang lain di depannya.
--
-- Yang diperbaiki bukan batas jumlah tokonya (5 tetap 5, lihat 0031), melainkan
-- siapa yang memiliki jendela trialnya.
--
-- ------------------------------------------------------------
-- ATURANNYA: satu akun, satu jendela trial.
--
-- Toko kedua dan seterusnya memakai `trial_ends_at` yang SAMA dengan toko
-- pertama yang dimiliki akun itu. Konsekuensinya:
--
--   buat toko ke-2 di hari ke-3 trial  → toko ke-2 ikut berakhir di hari ke-14
--                                        (sisa 11 hari, bukan 14 hari baru)
--   buat toko ke-2 setelah trial habis → toko ke-2 lahir sudah lewat masa coba
--                                        dan harus diaktifkan admin
--
-- Kenapa berbagi tanggal, bukan menolak trial sama sekali untuk toko kedua:
-- orang yang benar-benar punya dua usaha sering mendaftarkan keduanya di hari
-- yang sama. Menolak mentah-mentah membuat toko keduanya lahir mati padahal ia
-- masih di tengah masa coba yang sah. Berbagi tanggal memberi keduanya sisa
-- waktu yang sama tanpa menambah satu hari gratis pun.
--
-- ------------------------------------------------------------
-- YANG SENGAJA DIBIARKAN:
--
-- Kalau toko pertama punya `trial_ends_at` NULL (Super Admin memberi masa coba
-- tanpa batas), toko berikutnya mendapat trial segar. Itu bukan lubang: hanya
-- Super Admin yang bisa mengosongkan kolom itu, jadi tidak ada yang bisa
-- dicapai user dari luar.
--
-- Diundang jadi anggota toko orang lain tetap tidak berpengaruh sama sekali —
-- yang dihitung hanya toko yang DIMILIKI (role = 'owner'), sama seperti batas
-- 5 toko di 0031.
-- ============================================================

create or replace function public.provision_organization(
  p_name text, p_city text, p_owner uuid, p_plan_code text default 'starter')
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_org uuid; v_outlet uuid; v_plan uuid; v_trial int; v_slug text;
  v_trial_ends timestamptz;
  v_has_org boolean;
begin
  select id into v_plan from public.plans where code = p_plan_code;
  select trial_days into v_trial from public.platform_settings where id;

  /**
   * Jendela trial akun ini diambil dari toko PERTAMA yang ia miliki.
   *
   * `v_has_org` dipisah dari `v_trial_ends` dengan sengaja: keduanya sama-sama
   * bisa NULL tapi artinya berbeda jauh. Tidak punya toko sama sekali berarti
   * "belum pernah mencoba" (beri trial baru); punya toko dengan trial_ends_at
   * kosong berarti "diberi masa coba tanpa batas oleh admin". Digabung jadi
   * satu pemeriksaan `is null`, keduanya diperlakukan sama dan akun yang sudah
   * memakai trialnya akan mendapat 14 hari baru lagi — persis lubang yang
   * sedang ditutup di sini.
   */
  select true, o.trial_ends_at
    into v_has_org, v_trial_ends
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where m.user_id = p_owner
     and m.role = 'owner'
     and m.status = 'active'
     and o.deleted_at is null
   order by o.created_at
   limit 1;

  if not coalesce(v_has_org, false) then
    v_trial_ends := now() + make_interval(days => v_trial);
  end if;

  v_slug := regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g');
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (name, slug, city, plan_id, status, trial_ends_at, created_by)
  values (p_name, v_slug, p_city, v_plan, 'trial', v_trial_ends, p_owner)
  returning id into v_org;

  insert into public.outlets (organization_id, name, code, is_primary)
  values (v_org, p_name, 'MAIN', true)
  returning id into v_outlet;

  insert into public.organization_members (organization_id, user_id, role, default_outlet_id, permissions)
  values (v_org, p_owner, 'owner', v_outlet,
          '{"pos":true,"products":true,"reports":true,"settings":true}'::jsonb);

  insert into public.categories (organization_id, name, color_key, sort_order)
  values (v_org,'Sembako','sembako',1), (v_org,'Minuman','minuman',2),
         (v_org,'Snack','snack',3),     (v_org,'Kebutuhan','kebutuhan',4);

  insert into public.subscription_events (organization_id, plan_id, action, created_by)
  values (v_org, v_plan, 'subscribe', p_owner);

  return v_org;
end;
$$;

revoke execute on function public.provision_organization from public, anon, authenticated;

comment on function public.provision_organization is
  'Buat tenant lengkap dalam satu transaksi. Masa coba gratis milik AKUN: toko '
  'kedua dan seterusnya berbagi trial_ends_at dengan toko pertama pemiliknya.';

-- ------------------------------------------------------------
-- `register_store` ikut mengabarkan keadaan trialnya.
--
-- Tanpa ini, pemilik yang membuat toko kedua setelah masa cobanya habis akan
-- mendarat di beranda toko baru dan langsung disambut spanduk merah "masa coba
-- sudah berakhir" — benar, tapi terbaca seperti toko yang baru saja ia buat
-- sudah rusak sejak lahir. Aplikasi memakai bendera ini untuk mengantarnya ke
-- halaman Langganan, tempat sebabnya dijelaskan dan tombol hubungi admin ada.
-- ------------------------------------------------------------
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
    from public.organization_members
   where user_id = v_uid and status = 'active' and role = 'owner';

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
  'Daftarkan toko baru untuk diri sendiri. Maksimal 5 toko dimiliki per akun; '
  'diundang ke toko orang lain tidak dibatasi. Masa coba gratis dibagi seluruh '
  'toko milik akun yang sama — lihat migrasi 0034.';
