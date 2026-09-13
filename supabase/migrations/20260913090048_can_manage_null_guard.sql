-- ============================================================================
-- TokoKu · 0048 · `can_manage()` tidak boleh menjawab NULL
--
-- DITEMUKAN SAAT MENGUJI MIGRASI 0047, bukan saat menulisnya — persis seperti
-- FK lintas tenant di migrasi 0044. Pengujiannya sederhana: panggil
-- `create_subscription_invoice` sebagai pemanggil yang BUKAN anggota toko itu,
-- dan harapkan penolakan. Yang terjadi justru tagihannya dibuat.
--
-- ----------------------------------------------------------------------------
-- SEBABNYA SATU KATA YANG TIDAK ADA
--
--   user_role_in(p_org)  →  select m.role from organization_members
--                           where m.user_id = auth.uid() ...
--
-- Untuk pemanggil yang bukan anggota, subquery itu tidak mengembalikan baris,
-- jadi hasilnya NULL. Lalu:
--
--   can_manage(p_org)  →  null in ('owner','admin')  →  NULL
--
-- NULL, bukan false. Di dalam POLICY itu tidak berbahaya: Postgres
-- memperlakukan `using (NULL)` sebagai tidak lolos, jadi seluruh RLS yang
-- memakai `can_manage` selama ini memang sudah benar.
--
-- Di dalam PL/pgSQL ia terbalik:
--
--   if not public.can_manage(p_org) then raise exception 'forbidden'; end if;
--
-- `not NULL` bernilai NULL, dan `if NULL then` TIDAK PERNAH masuk ke cabangnya.
-- Jadi gerbangnya dilewati tanpa suara — dan fungsi-fungsi ini semuanya
-- SECURITY DEFINER, yang berarti RLS di dalamnya juga tidak lagi menahan.
--
-- Yang paling ganjil: anggota toko yang izinnya KURANG justru tertahan dengan
-- benar (kasir menjawab 'cashier', jadi hasilnya false), sementara orang yang
-- sama sekali BUKAN anggota lolos. Gerbang yang menahan orang dalam dan
-- meloloskan orang luar adalah bentuk kegagalan yang paling sulit terlihat dari
-- membaca kodenya.
--
-- ----------------------------------------------------------------------------
-- SEBERAPA BESAR AKIBATNYA
--
-- Tiga fungsi lama ikut kena, semuanya dari migrasi 0009:
--
--   void_transaction  — membatalkan transaksi toko lain, stok ikut dikembalikan
--                       dan poin pelanggan ditarik lewat trigger
--   close_shift       — menutup shift kasir toko lain
--   set_member_pin    — mengganti PIN kasir anggota toko lain
--
-- Ketiganya butuh UUID barang yang dituju, dan UUID itu tidak pernah dikirim ke
-- layar toko lain — jadi ini bukan pintu yang terbuka, melainkan kunci yang
-- ternyata tidak terpasang di pintu yang tidak punya gagang. Tetap ditambal:
-- "sulit ditebak" bukan lapisan keamanan, dan pemanggil BERIKUTNYA mungkin
-- menerima id yang memang boleh diketahui orang luar.
--
-- ----------------------------------------------------------------------------
-- DITAMBAL DI HELPER, BUKAN DI TIAP PEMANGGIL
--
-- Menambal empat pemanggil berarti pemanggil kelima akan mengulanginya. Yang
-- diperbaiki fungsinya sendiri, sekali, dan seluruh pemanggil yang sudah ada
-- maupun yang belum ditulis ikut aman.
--
-- Perubahan ini TIDAK mengubah perilaku satu policy pun: NULL dan false
-- sama-sama berarti tidak lolos di dalam `using` dan `with check`, dan tidak
-- ada satu policy pun di project ini yang membalik `can_manage` dengan `not`.
-- ============================================================================

create or replace function public.can_manage(p_org uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(public.user_role_in(p_org) in ('owner','admin'), false)
$$;

comment on function public.can_manage is
  'Gerbang tulis standar: anggota aktif ber-role owner/admin. SELALU menjawab '
  'true atau false, tidak pernah NULL — pemanggil yang bukan anggota menjawab '
  'false, bukan NULL. Lihat migrasi 0048: `if not <null>` tidak pernah masuk ke '
  'cabangnya, jadi helper yang boleh NULL membuat setiap gerbang PL/pgSQL yang '
  'memakainya lolos diam-diam.';

-- ============================================================================
-- `set_member_pin` memakai `user_role_in` LANGSUNG, jadi tidak ikut tertolong
-- perbaikan di atas.
--
-- `user_role_in` sengaja TIDAK ikut di-coalesce: ia mengembalikan enum peran,
-- dan NULL di sana punya arti yang benar dan berguna ("bukan anggota"). Yang
-- salah adalah membandingkannya dengan `<>` lalu memakai hasilnya sebagai
-- syarat — `NULL <> 'owner'` bernilai NULL, bukan true.
--
-- Badan fungsinya ditulis ulang utuh karena `create or replace` memang butuh
-- badan lengkap. Yang berubah hanya baris gerbangnya.
-- ============================================================================
create or replace function public.set_member_pin(p_member uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public, pg_temp, extensions
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.organization_members where id = p_member;

  -- `is distinct from` menjawab true untuk NULL, beda dengan `<>` yang menjawab
  -- NULL. Itu satu-satunya perubahan di fungsi ini.
  if v_org is null or public.user_role_in(v_org) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'pin_must_be_6_digits' using errcode = 'P0001';
  end if;

  insert into public.member_pins (member_id, organization_id, pin_hash, updated_at)
  values (p_member, v_org, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), now())
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;
