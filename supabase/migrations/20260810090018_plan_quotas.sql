-- ============================================================
-- TokoKu · 0018 · Penegakan kuota paket
--
-- Sebelum ini, kolom max_outlets/max_users/max_products/max_devices di tabel
-- plans hanya dibaca oleh editor paket di Super Admin — tidak ada satu pun
-- tempat yang benar-benar membatasi apa pun. Toko paket Starter bisa membuat
-- 10.000 produk dan mendaftarkan 20 perangkat tanpa dihalangi.
--
-- Penegakannya ditaruh di database, BUKAN di lapisan aplikasi, karena dua hal
-- yang sudah pernah menggigit project ini:
--   1. UPDATE/INSERT yang ditolak RLS mengembalikan "berhasil" dengan 0 baris,
--      bukan error — jadi pengecekan di aplikasi mudah bocor tanpa jejak.
--   2. Perangkat POS mendaftarkan dirinya lewat RPC saat sinkronisasi, bukan
--      lewat form. Gerbang yang hanya ada di form akan dilewati begitu saja.
-- ============================================================

-- ---------- batas paket sebuah organisasi ----------
-- NULL berarti tak terbatas. Organisasi tanpa paket juga NULL: jangan pernah
-- mengunci toko hanya karena plan_id-nya belum diisi.
create or replace function public.org_quota(p_org uuid, p_key text)
returns integer
language sql stable security definer set search_path = public, pg_temp
as $$
  select case p_key
    when 'outlets'  then pl.max_outlets
    when 'users'    then pl.max_users
    when 'products' then pl.max_products
    when 'devices'  then pl.max_devices
  end
  from public.organizations o
  join public.plans pl on pl.id = o.plan_id
  where o.id = p_org
$$;

-- ---------- pemakaian saat ini ----------
-- SATU sumber kebenaran, dipakai trigger di bawah DAN panel kuota di Super
-- Admin. Kalau keduanya menghitung sendiri-sendiri, angka yang dilihat admin
-- cepat atau lambat akan berbeda dari angka yang dipakai menolak.
--
-- 'users' menghitung anggota aktif DITAMBAH undangan yang masih menunggu:
-- undangan yang belum diterima tetap memakan jatah, kalau tidak kuota bisa
-- dilewati dengan mengundang 50 orang sekaligus lalu menerima semuanya.
--
-- 'members' hanya menghitung anggota aktif. Ini yang dipakai saat undangan
-- DITERIMA: pada saat itu barisnya masih tercatat sebagai undangan menunggu,
-- jadi memakai 'users' akan menghitung orang yang sama dua kali dan menolak
-- penerimaan yang sebenarnya masih muat.
create or replace function public.org_usage(p_org uuid, p_key text)
returns integer
language sql stable security definer set search_path = public, pg_temp
as $$
  select (case p_key
    when 'outlets' then
      (select count(*) from public.outlets
        where organization_id = p_org and deleted_at is null)
    when 'members' then
      (select count(*) from public.organization_members
        where organization_id = p_org and status = 'active')
    when 'users' then
      (select count(*) from public.organization_members
        where organization_id = p_org and status = 'active')
      + (select count(*) from public.invitations
          where organization_id = p_org
            and accepted_at is null and revoked_at is null and expires_at > now())
    when 'products' then
      (select count(*) from public.products
        where organization_id = p_org and deleted_at is null)
    when 'devices' then
      (select count(*) from public.devices
        where organization_id = p_org and is_active)
  end)::integer
$$;

-- ---------- gerbang kuota ----------
-- TG_ARGV[0] kunci batas · TG_ARGV[1] kunci pemakaian · TG_ARGV[2] kata benda
-- untuk pesan · TG_ARGV[3] saran tindakan.
--
-- SQLSTATE TK001 dipakai supaya aplikasi bisa mengenali penolakan kuota tanpa
-- mencocokkan teks. Pesannya sendiri sudah ditulis untuk pemilik warung, jadi
-- aman ditampilkan apa adanya.
create or replace function public.enforce_plan_quota()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_used  integer;
begin
  v_limit := public.org_quota(new.organization_id, TG_ARGV[0]);
  if v_limit is null then
    return new;
  end if;

  v_used := public.org_usage(new.organization_id, TG_ARGV[1]);

  if v_used >= v_limit then
    raise exception 'Paket toko ini hanya mengizinkan % %. %',
      v_limit, TG_ARGV[2], TG_ARGV[3]
      using errcode = 'TK001';
  end if;

  return new;
end
$$;

-- ---------- pemasangan ----------
-- Sengaja hanya pada INSERT. Toko yang turun paket dan sudah terlanjur
-- melewati batas TIDAK kehilangan data apa pun — ia hanya tidak bisa menambah
-- lagi sampai kembali di bawah batas. Menghapus data orang karena downgrade
-- adalah cara tercepat kehilangan kepercayaan.

drop trigger if exists trg_quota_products on public.products;
create trigger trg_quota_products
  before insert on public.products
  for each row execute function public.enforce_plan_quota(
    'products', 'products', 'produk',
    'Hapus produk yang sudah tidak dijual, atau naikkan paket toko.');

drop trigger if exists trg_quota_outlets on public.outlets;
create trigger trg_quota_outlets
  before insert on public.outlets
  for each row execute function public.enforce_plan_quota(
    'outlets', 'outlets', 'outlet',
    'Naikkan paket toko untuk menambah cabang.');

drop trigger if exists trg_quota_members on public.organization_members;
create trigger trg_quota_members
  before insert on public.organization_members
  for each row execute function public.enforce_plan_quota(
    'users', 'members', 'pengguna',
    'Nonaktifkan anggota yang sudah tidak bekerja, atau naikkan paket toko.');

drop trigger if exists trg_quota_invitations on public.invitations;
create trigger trg_quota_invitations
  before insert on public.invitations
  for each row execute function public.enforce_plan_quota(
    'users', 'users', 'pengguna',
    'Undangan yang belum diterima ikut terhitung. Batalkan undangan yang tidak jadi, atau naikkan paket toko.');

drop trigger if exists trg_quota_devices on public.devices;
create trigger trg_quota_devices
  before insert on public.devices
  for each row execute function public.enforce_plan_quota(
    'devices', 'devices', 'perangkat kasir',
    'Hapus perangkat lama di Pengaturan → Sinkronisasi, atau naikkan paket toko.');

-- ---------- ringkasan kuota untuk Super Admin ----------
-- security_invoker: barisnya tetap disaring RLS organizations, jadi pemilik
-- toko hanya melihat tokonya sendiri sementara Super Admin melihat semuanya.
-- Angkanya sendiri datang dari org_usage() yang SECURITY DEFINER, jadi tetap
-- lengkap dan tidak bocor lintas tenant.
create or replace view public.v_client_quota with (security_invoker = on) as
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
where o.deleted_at is null;

grant select on public.v_client_quota to authenticated;

comment on function public.org_usage is
  'Pemakaian kuota sebuah organisasi. Satu sumber kebenaran untuk trigger kuota dan panel Super Admin.';
comment on function public.enforce_plan_quota is
  'Trigger BEFORE INSERT penegak kuota paket. Menolak dengan SQLSTATE TK001.';
