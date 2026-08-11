-- ============================================================
-- TokoKu · 0036 · Kolom komersial organizations dikunci
--
-- DITEMUKAN SAAT AUDIT PRA GO-LIVE, DAN INI YANG PALING SERIUS.
--
-- Policy `org_update` (migrasi 0008) mengizinkan pemilik toko meng-UPDATE
-- organizations tanpa batasan KOLOM sama sekali. RLS di Postgres memang bekerja
-- per-baris, bukan per-kolom — jadi "boleh mengubah barisnya" berarti boleh
-- mengubah semua isinya.
--
-- Akibatnya seluruh penegakan langganan bisa dilewati dengan satu panggilan
-- REST memakai sesi pemilik toko sendiri. Sudah dibuktikan pada Warung Rina:
--
--   PATCH /rest/v1/organizations?id=eq.<org>
--   { "status": "active", "plan_id": "<enterprise>", "trial_ends_at": "2099-01-01" }
--   → HTTP 200, 1 baris terpengaruh
--
-- Paket Enterprise gratis, trial 73 tahun, kuota ikut naik — karena
-- `org_quota()` membaca `plan_id` dan `org_lapsed_at()` membaca `status` dan
-- `trial_ends_at` dari baris yang barusan ditulis sendiri oleh kliennya.
-- Anon key ada di setiap bundel browser, jadi tidak ada yang perlu dibobol.
--
-- ------------------------------------------------------------
-- KENAPA TRIGGER, BUKAN COLUMN GRANT
--
-- `grant update (kolom, ...)` sebenarnya cara paling langsung membatasi kolom,
-- dan diperiksa SEBELUM RLS. Tapi Super Admin memakai role Postgres yang sama
-- (`authenticated`) dengan klien biasa — ia dibedakan oleh `is_platform_admin()`
-- di dalam policy, bukan oleh role database. Column grant akan mengunci Super
-- Admin juga, dan panel "ganti paket / atur trial" di /admin/klien mati total.
--
-- Trigger bisa menanyakan SIAPA pemanggilnya, jadi itu yang dipakai.
-- ------------------------------------------------------------

create or replace function public.tg_guard_org_commercial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  /**
   * Super Admin memang tugasnya mengubah ini.
   *
   * `auth.uid() is null` melewatkan service_role — dipakai skrip provisioning
   * dan seed. Itu bukan pelonggaran yang berarti: siapa pun yang memegang
   * service key sudah bisa melakukan apa saja terhadap database ini, dan
   * kuncinya tidak pernah ikut ke browser.
   */
  if public.is_platform_admin() or auth.uid() is null then
    return new;
  end if;

  if new.plan_id       is distinct from old.plan_id
  or new.status        is distinct from old.status
  or new.trial_ends_at is distinct from old.trial_ends_at then
    raise exception
      'Paket dan status langganan hanya bisa diubah admin TokoKu. Hubungi admin lewat halaman Langganan.'
      using errcode = 'TK004';
  end if;

  /**
   * `deleted_at` ikut dikunci, dan itu bukan sekadar kehati-hatian.
   *
   * Menghapus tenant sudah dibatasi Super Admin lewat policy `org_admin_delete`
   * untuk DELETE sungguhan — tapi seluruh aplikasi ini memakai SOFT delete, dan
   * mengisi `deleted_at` lewat UPDATE menghilangkan toko dari setiap halaman
   * tanpa melewati policy itu sama sekali. Tanpa kunci ini, admin toko bisa
   * melenyapkan toko milik pemiliknya sendiri.
   */
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'Penghapusan toko hanya bisa dilakukan admin TokoKu.'
      using errcode = 'TK004';
  end if;

  return new;
end;
$$;

-- Namanya sengaja berawalan `trg_org_c…` supaya berjalan SEBELUM
-- `trg_org_status_changed` (trigger sewaktu yang sama dijalankan urut abjad).
-- Kalau terbalik, `status_changed_at` sudah terlanjur disentuh trigger itu saat
-- perubahan statusnya sendiri ternyata akan ditolak di sini.
drop trigger if exists trg_org_commercial_guard on public.organizations;
create trigger trg_org_commercial_guard
  before update on public.organizations
  for each row execute function public.tg_guard_org_commercial();

comment on function public.tg_guard_org_commercial is
  'Kunci plan_id/status/trial_ends_at/deleted_at dari siapa pun selain Super Admin. '
  'RLS Postgres tidak bisa membatasi per kolom — lihat migrasi 0036.';

-- ------------------------------------------------------------
-- Sekarang kolom komersialnya terkunci, `org_update` boleh dilonggarkan ke
-- owner + admin.
--
-- Sebelumnya owner-only, sementara halaman Pengaturan → Toko dibuka untuk siapa
-- pun berizin modul `settings`. Admin Toko yang menekan Simpan karena itu
-- mendapat "Informasi toko tersimpan." padahal nol baris berubah — UPDATE yang
-- ditolak RLS tidak melempar error, ia menjawab berhasil dengan 0 baris. Sudah
-- dibuktikan dengan akun `agus@tokodewi.id`.
--
-- Dilonggarkan, bukan halamannya yang dikunci: nama, alamat, telepon, dan
-- kebijakan stok adalah hal operasional sehari-hari, dan Admin Toko memang
-- peran yang mengurusnya. Yang benar-benar tidak boleh ia sentuh — paket,
-- status, masa trial, penghapusan — sudah dijaga trigger di atas.
-- ------------------------------------------------------------
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update
  using (public.can_manage(id) or public.is_platform_admin())
  with check (public.can_manage(id) or public.is_platform_admin());
