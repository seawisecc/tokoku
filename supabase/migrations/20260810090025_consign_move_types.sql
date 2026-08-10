-- ============================================================
-- TokoKu · 0025 · Jenis pergerakan stok untuk konsinyasi
--
-- Sendirian di file ini, bukan digabung dengan tabelnya di 0026. Postgres
-- mengizinkan `alter type ... add value` di dalam transaksi, tapi nilainya
-- TIDAK boleh dipakai di transaksi yang sama — dan `db:push` menjalankan tiap
-- file migrasi sebagai satu transaksi. Digabung, migrasinya gagal di baris
-- pertama yang menyebut 'consign_in'.
--
-- Kenapa jenis baru, bukan menumpang 'purchase' dan 'return' yang sudah ada:
--
--   'purchase' berarti barang DIBELI — stok naik dan toko berhutang seketika.
--   Titipan tidak dibeli; hutangnya baru lahir saat barangnya terjual. Disamakan,
--   laporan hutang dagang akan menagih uang yang belum jadi kewajiban.
--
--   'return' sudah berarti "barang kembali dari pembeli", dan itu MENGURANGI
--   angka terjual. Retur titipan bergerak ke arah sebaliknya — barang pulang ke
--   pemasok, bukan kembali dari pembeli. Disamakan, tiap retur titipan akan
--   terbaca sebagai pembatalan penjualan dan bagi hasilnya ikut susut.
-- ============================================================

alter type public.stock_move_type add value if not exists 'consign_in';
alter type public.stock_move_type add value if not exists 'consign_return';
