-- ============================================================
-- TokoKu · 0044 · Pengeluaran: kategori & outlet wajib satu toko
--
-- Ditemukan saat menguji 0043, bukan saat menulisnya: pengeluaran milik Toko A
-- bisa menunjuk kategori milik Toko B, dan FK biasa menerimanya tanpa keluhan.
-- Foreign key hanya bertanya "barisnya ada?", tidak pernah "barisnya milik
-- siapa?".
--
-- Bahayanya kecil dan itu memang harus dikatakan apa adanya: penyerangnya perlu
-- MENEBAK UUID milik toko lain, dan UUID itu tidak pernah dikirim ke layar
-- siapa pun di luar tokonya sendiri. RLS pada `expenses` juga tetap menjaga
-- barisnya sendiri. Jadi ini bukan lubang yang bisa dipakai membaca data orang
-- lain.
--
-- Ditambal karena alasan yang berbeda: kalau sampai terjadi, laporan keuangan
-- di Fase 2 akan menjumlahkan pengeluaran ke kategori yang namanya milik toko
-- lain, dan tidak ada satu pun error yang muncul. Data yang salah diam-diam
-- lebih mahal daripada data yang ditolak berisik. Aturan yang sama sudah
-- dipakai `bulk_adjust_stock`, yang memeriksa produk MAUPUN outlet milik
-- organisasi yang sama justru karena RLS-nya dilewati SECURITY DEFINER.
--
-- Dipakai FK KOMPOSIT, bukan trigger. Trigger bisa lupa dipasang di tabel
-- berikutnya dan harus ikut dibaca setiap kali orang mencari tahu aturan apa
-- yang berlaku; FK komposit menempel pada definisi tabelnya sendiri dan
-- ditegakkan tanpa satu baris kode pun.
-- ============================================================

-- Sasaran FK komposit harus unik. `id` sudah primary key, jadi pasangan
-- (organization_id, id) otomatis unik juga — indeksnya murni supaya Postgres
-- punya sesuatu untuk ditunjuk.
alter table public.expense_categories
  add constraint expense_categories_org_id_key unique (organization_id, id);

alter table public.outlets
  add constraint outlets_org_id_key unique (organization_id, id);

-- FK lama dibuang lewat katalog, bukan lewat nama yang ditebak. Nama bawaan
-- Postgres memang `expenses_category_id_fkey`, tapi `drop constraint if exists`
-- dengan nama yang meleset akan LOLOS tanpa membuang apa pun — dan yang
-- tertinggal adalah dua aturan yang salah satunya lebih longgar.
do $$
declare
  v_name text;
  v_col  text;
begin
  foreach v_col in array array['category_id','outlet_id'] loop
    for v_name in
      select c.conname
        from pg_constraint c
       where c.conrelid = 'public.expenses'::regclass
         and c.contype = 'f'
         and c.conkey = array[(select a.attnum from pg_attribute a
                                where a.attrelid = 'public.expenses'::regclass
                                  and a.attname = v_col)]
    loop
      execute format('alter table public.expenses drop constraint %I', v_name);
    end loop;
  end loop;
end $$;

alter table public.expenses
  add constraint expenses_category_same_org
    foreign key (organization_id, category_id)
    references public.expense_categories (organization_id, id)
    on delete restrict;

-- MATCH SIMPLE (bawaan): kalau salah satu kolomnya NULL, FK tidak diperiksa.
-- Itu justru yang dibutuhkan di sini — `outlet_id` NULL berarti "seluruh toko"
-- dan memang tidak menunjuk outlet mana pun.
--
-- `set null (outlet_id)` menyebut KOLOMNYA, dan itu wajib: tanpa daftar kolom,
-- Postgres mengosongkan SEMUA kolom FK-nya termasuk `organization_id` yang NOT
-- NULL, sehingga menghapus outlet akan gagal alih-alih melepas tautannya.
alter table public.expenses
  add constraint expenses_outlet_same_org
    foreign key (organization_id, outlet_id)
    references public.outlets (organization_id, id)
    on delete set null (outlet_id);
