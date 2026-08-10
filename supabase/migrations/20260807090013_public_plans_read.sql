-- ============================================================
-- TokoKu · 0013 · Paket langganan boleh dibaca publik
--
-- Policy sebelumnya: using (auth.role() = 'authenticated')
-- Akibatnya pengunjung yang belum login tidak bisa melihat daftar harga —
-- padahal halaman harga adalah halaman pemasaran yang justru harus publik,
-- dan calon klien belum punya akun saat melihatnya.
--
-- Hanya paket aktif yang dibuka. Paket nonaktif (sedang disiapkan, atau
-- harga khusus yang sudah ditarik) tetap hanya untuk Super Admin.
-- ============================================================

drop policy if exists plans_read_all on public.plans;

create policy plans_read_public on public.plans for select
  to anon, authenticated
  using (is_active or public.is_platform_admin());
