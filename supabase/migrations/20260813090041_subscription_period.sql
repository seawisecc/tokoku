-- ============================================================================
-- TokoKu · 0041 · Masa berlaku langganan berbayar
--
-- Sampai hari ini toko yang SUDAH BAYAR tidak punya tanggal berakhir di mana
-- pun. `organizations` cuma menyimpan `trial_ends_at`, jadi begitu statusnya
-- jadi 'active' tidak ada satu pun kolom yang menjawab "berlaku sampai kapan".
-- Akibatnya dua-duanya buta: pemilik toko tidak tahu kapan harus memperpanjang,
-- dan pemilik platform tidak punya daftar siapa yang harus ditagih bulan ini.
-- `subscription_events.period_end` sebenarnya ada sejak migrasi 0006, tapi
-- tidak pernah ada yang mengisinya.
--
-- NULL BERARTI TANPA BATAS, dan itu keputusan yang disengaja. Aturannya sama
-- dengan kuota paket dan masa trial: jangan pernah mengunci toko hanya karena
-- kolomnya belum diisi. Semua toko yang sudah ada hari ini punya NULL, jadi
-- migrasi ini tidak mengubah akses siapa pun sampai tanggalnya benar-benar
-- ditulis Super Admin.
--
-- Ditegakkan, bukan sekadar ditampilkan. Angka "berakhir 3 hari lalu" yang
-- tidak mengubah apa pun akan mengajari semua orang mengabaikannya — dan
-- begitu itu terjadi, peringatan yang sungguhan ikut tidak dipercaya.
-- ============================================================================

alter table public.organizations
  add column if not exists subscription_ends_at timestamptz;

comment on column public.organizations.subscription_ends_at is
  'Akhir masa langganan BERBAYAR (status active). NULL = tanpa batas waktu. '
  'Dibaca org_lapsed_at() sama seperti trial_ends_at untuk status trial.';

-- ============================================================================
-- org_lapsed_at: tambahkan cabang untuk langganan berbayar.
--
-- Ditulis ulang utuh karena `create or replace` butuh badan lengkap. Yang
-- berubah hanya satu baris `when`.
-- ============================================================================
create or replace function public.org_lapsed_at(p_org uuid)
returns timestamptz
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when o.status in ('suspended','inactive') then o.status_changed_at
    when o.status = 'trial' and o.trial_ends_at is not null and o.trial_ends_at <= now()
      then o.trial_ends_at
    when o.status = 'active' and o.subscription_ends_at is not null
         and o.subscription_ends_at <= now()
      then o.subscription_ends_at
    else null
  end
  from public.organizations o
  where o.id = p_org
$$;

revoke execute on function public.org_lapsed_at(uuid) from public, anon, authenticated;

-- ============================================================================
-- Kolom komersial: `subscription_ends_at` ikut dikunci.
--
-- Ini yang paling penting di migrasi ini. Tanpa baris tambahan di trigger
-- penjaga, pemilik toko bisa memperpanjang langganannya sendiri dengan satu
-- panggilan REST memakai sesinya sendiri — persis lubang yang ditambal
-- migrasi 0036 untuk `plan_id`/`status`/`trial_ends_at`, dan kolom baru ini
-- persis sejenis dengan ketiganya.
--
-- Badan fungsinya ditulis ulang utuh, bukan ditambal, supaya daftar kolom yang
-- dikunci selalu terbaca di satu tempat. Namanya HARUS `tg_guard_org_commercial`
-- persis seperti di migrasi 0036 — trigger `trg_org_commercial_guard` menunjuk
-- nama itu, dan fungsi bernama lain akan lolos tanpa pernah dipanggil.
-- ============================================================================
create or replace function public.tg_guard_org_commercial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Super Admin memakai role Postgres yang SAMA dengan klien biasa
  -- (`authenticated`), jadi yang membedakan hanya pemeriksaan ini. Jalur
  -- server tanpa sesi (auth.uid() null) adalah provisioning internal.
  if public.is_platform_admin() or auth.uid() is null then
    return new;
  end if;

  if new.plan_id              is distinct from old.plan_id
  or new.status               is distinct from old.status
  or new.trial_ends_at        is distinct from old.trial_ends_at
  or new.subscription_ends_at is distinct from old.subscription_ends_at then
    raise exception
      'Paket dan status langganan hanya bisa diubah admin TokoKu. Hubungi admin lewat halaman Langganan.'
      using errcode = '42501';
  end if;

  /**
   * `deleted_at` ikut dikunci, dan itu bukan sekadar kehati-hatian.
   * Penghapusan tenant memang dibatasi Super Admin lewat policy tersendiri,
   * tapi seluruh aplikasi memakai SOFT delete — mengisi `deleted_at` lewat
   * UPDATE biasa menghilangkan toko dari setiap halaman tanpa melewati policy
   * itu sama sekali.
   */
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'Penghapusan toko hanya bisa dilakukan admin TokoKu.'
      using errcode = '42501';
  end if;

  return new;
end
$$;

comment on function public.tg_guard_org_commercial is
  'Kunci plan_id/status/trial_ends_at/subscription_ends_at/deleted_at dari '
  'siapa pun selain Super Admin. RLS Postgres bekerja per BARIS, bukan per '
  'kolom, jadi org_update yang mengizinkan pemilik toko mengubah barisnya '
  'sendiri otomatis mengizinkan seluruh isinya.';
