-- ============================================================
-- TokoKu · 0021 · Penegakan status langganan & masa trial
--
-- Sebelum ini `status` dan `trial_ends_at` hanya hiasan: toko `suspended`, dan
-- toko yang masa trialnya sudah lewat, tetap bisa dipakai persis seperti toko
-- yang membayar. Berlangganan tidak berarti apa-apa kalau tidak berlangganan
-- pun jalan terus.
--
-- Yang PALING menentukan desain di sini: seluruh transaksi POS masuk lewat
-- `sync_transactions`, online maupun offline. Memblokirnya mentah-mentah akan
-- ikut membuang penjualan yang SUDAH TERJADI secara fisik di warung — persis
-- kesalahan yang sama dengan menolak stok minus (lihat docs/OFFLINE-ARCHITECTURE
-- §3). Maka gerbangnya memakai `client_created_at`, jam mesin kasir:
--
--   transaksi bertanggal SEBELUM langganan berakhir  → tetap diterima
--   transaksi bertanggal SESUDAHNya                  → ditolak satuan
--
-- Penolakan satuan itu aman karena `sync_transactions` sudah membungkus tiap
-- transaksi dalam savepoint + `exception when others`: yang ditolak tercatat di
-- `sync_rejections` lengkap dengan pesannya, sisanya tetap masuk.
-- ============================================================

-- Kapan status terakhir berubah. Dibutuhkan karena untuk `suspended`/`inactive`
-- tidak ada tanggal lain yang bisa dipakai sebagai batas "sejak kapan".
alter table public.organizations
  add column if not exists status_changed_at timestamptz not null default now();

comment on column public.organizations.status_changed_at is
  'Kapan status terakhir berubah. Jadi batas waktu untuk menolak transaksi baru saat langganan berhenti.';

create or replace function public.touch_org_status_changed()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists trg_org_status_changed on public.organizations;
create trigger trg_org_status_changed
  before update on public.organizations
  for each row execute function public.touch_org_status_changed();

-- ---------- kapan akses berakhir ----------
-- NULL = masih aktif. `trial` tanpa `trial_ends_at` dianggap aktif: jangan
-- pernah mengunci toko hanya karena tanggalnya belum pernah diisi.
create or replace function public.org_lapsed_at(p_org uuid)
returns timestamptz
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when o.status in ('suspended','inactive') then o.status_changed_at
    when o.status = 'trial' and o.trial_ends_at is not null and o.trial_ends_at <= now()
      then o.trial_ends_at
    else null
  end
  from public.organizations o
  where o.id = p_org
$$;

create or replace function public.org_is_active(p_org uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.org_lapsed_at(p_org) is null
$$;

-- Keduanya menerima id organisasi apa pun, jadi TIDAK boleh bisa dipanggil
-- sebagai RPC — lihat catatan kebocoran org_usage di migrasi 0019.
revoke execute on function public.org_lapsed_at(uuid) from public, anon, authenticated;
revoke execute on function public.org_is_active(uuid) from public, anon, authenticated;

-- ---------- gerbang untuk penambahan data biasa ----------
create or replace function public.enforce_org_active()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.org_is_active(new.organization_id) then
    return new;
  end if;

  raise exception 'Langganan toko ini sedang tidak aktif, jadi data baru belum bisa ditambah. Hubungi admin TokoKu untuk mengaktifkan kembali.'
    using errcode = 'TK002';
end
$$;

drop trigger if exists trg_active_products on public.products;
create trigger trg_active_products before insert on public.products
  for each row execute function public.enforce_org_active();

drop trigger if exists trg_active_outlets on public.outlets;
create trigger trg_active_outlets before insert on public.outlets
  for each row execute function public.enforce_org_active();

drop trigger if exists trg_active_members on public.organization_members;
create trigger trg_active_members before insert on public.organization_members
  for each row execute function public.enforce_org_active();

drop trigger if exists trg_active_invitations on public.invitations;
create trigger trg_active_invitations before insert on public.invitations
  for each row execute function public.enforce_org_active();

drop trigger if exists trg_active_devices on public.devices;
create trigger trg_active_devices before insert on public.devices
  for each row execute function public.enforce_org_active();

-- ---------- gerbang khusus transaksi ----------
-- Sengaja TIDAK memakai enforce_org_active: penjualan yang tanggalnya sebelum
-- langganan berhenti sudah benar-benar terjadi dan uangnya sudah diterima
-- kasir. Menolaknya berarti membuang catatan penjualan yang nyata.
create or replace function public.enforce_org_active_trx()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_lapsed timestamptz;
begin
  v_lapsed := public.org_lapsed_at(new.organization_id);
  if v_lapsed is null then
    return new;
  end if;

  -- Toleransi jam perangkat yang meleset sedikit. Bukan lubang: transaksi yang
  -- benar-benar baru akan lewat jauh dari ambang ini.
  if new.client_created_at <= v_lapsed + interval '5 minutes' then
    return new;
  end if;

  raise exception 'Langganan toko ini berakhir pada % — transaksi baru tidak bisa disimpan. Transaksi yang dibuat sebelum tanggal itu tetap tersimpan.',
    to_char(v_lapsed at time zone 'Asia/Makassar', 'DD Mon YYYY HH24:MI')
    using errcode = 'TK002';
end
$$;

drop trigger if exists trg_active_transactions on public.transactions;
create trigger trg_active_transactions before insert on public.transactions
  for each row execute function public.enforce_org_active_trx();

comment on function public.enforce_org_active_trx is
  'Menolak transaksi bertanggal setelah langganan berhenti, tapi tetap menerima antrean offline yang tanggalnya lebih tua.';
