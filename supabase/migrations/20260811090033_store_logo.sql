-- ============================================================
-- TokoKu · 0033 · Logo toko
--
-- `organizations.logo_url` sudah ada sejak migrasi 0003, dan sakelar
-- "Tampilkan logo" di Struk & Printer sudah tersimpan ke `receipt_settings`
-- sejak saat itu juga. Yang tidak pernah ada: tempat menaruh berkasnya. Jadi
-- dua hal setengah jadi saling menunggu — kolomnya selalu null dan sakelarnya
-- tidak pernah mengubah apa pun yang tercetak.
--
-- Yang ditambahkan di sini cuma penyimpanannya.
-- ============================================================

-- ---------- bucket ----------
-- PUBLIK, dan itu disengaja. Logo toko memang dicetak di struk yang dibawa
-- pulang pembeli dan ditempel di layar kasir — tidak ada yang rahasia di sana.
-- Signed URL akan menambah satu panggilan jaringan di tiap render struk, tepat
-- pada layar yang paling tidak boleh menunggu.
--
-- Batas ukuran dan tipe ditegakkan BUCKET, bukan aplikasi: unggahan tidak harus
-- lewat borang kita, dan gerbang yang cuma ada di sisi klien bukan gerbang.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logo-toko', 'logo-toko', true,
  1048576,                                            -- 1 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- siapa yang boleh menulis ----------
-- Daftar toko yang boleh DIKELOLA user ini. Sengaja fungsi TANPA PARAMETER yang
-- menyaring sendiri lewat auth.uid(): PostgREST mengekspos setiap fungsi di
-- schema public sebagai RPC, dan fungsi SECURITY DEFINER yang menerima
-- organization_id sebagai parameter sudah pernah jadi lubang lintas tenant di
-- project ini (lihat migrasi 0019).
create or replace function public.user_managed_org_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.role in ('owner', 'admin')
$$;

comment on function public.user_managed_org_ids is
  'Organisasi tempat user aktif berperan owner/admin. Tanpa parameter — aman diekspos PostgREST.';

-- Berkasnya disimpan sebagai `<organization_id>/logo`, jadi folder pertama pada
-- path ITULAH penanda pemiliknya. Dibandingkan sebagai TEKS, bukan di-cast ke
-- uuid: path bisa diketik tangan, dan `'bukan-uuid'::uuid` melempar error yang
-- membatalkan seluruh statement alih-alih menolaknya dengan rapi.
drop policy if exists logo_toko_insert on storage.objects;
create policy logo_toko_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logo-toko'
    and split_part(name, '/', 1) in (select o::text from public.user_managed_org_ids() o)
  );

drop policy if exists logo_toko_update on storage.objects;
create policy logo_toko_update on storage.objects for update to authenticated
  using (
    bucket_id = 'logo-toko'
    and split_part(name, '/', 1) in (select o::text from public.user_managed_org_ids() o)
  )
  with check (
    bucket_id = 'logo-toko'
    and split_part(name, '/', 1) in (select o::text from public.user_managed_org_ids() o)
  );

drop policy if exists logo_toko_delete on storage.objects;
create policy logo_toko_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'logo-toko'
    and split_part(name, '/', 1) in (select o::text from public.user_managed_org_ids() o)
  );

-- Baca: bucketnya publik sehingga URL publiknya dilayani tanpa melewati policy
-- ini sama sekali. Policy select tetap dipasang supaya klien yang login juga
-- bisa memeriksa keberadaan berkasnya lewat API biasa.
drop policy if exists logo_toko_read on storage.objects;
create policy logo_toko_read on storage.objects for select
  using (bucket_id = 'logo-toko');
