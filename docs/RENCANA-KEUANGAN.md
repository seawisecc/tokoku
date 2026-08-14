# Rencana: Pengeluaran Operasional, Laporan Keuangan, dan Pajak

Disusun 14 Agustus 2026. Lingkupnya sudah dipersempit bersama pemilik project:
**pengeluaran operasional → arus kas → laba rugi → sakelar pajak**. Neraca,
jurnal double entry, resep F&B, dan varian produk **tidak** termasuk di sini.

Dokumen ini rencana, bukan catatan hasil. Yang sudah dikerjakan pindah ke
CLAUDE.md seperti modul lain.

---

## 0. Temuan dari kode yang mengubah rencana

Tiga hal ini diperiksa langsung di repo sebelum rencana disusun, dan semuanya
menggeser perkiraan awal.

**Pajak sudah dihitung server, tinggal tidak ada sakelarnya.**
`_apply_transaction` (versi terakhir di migrasi 0042, langkah 5) sudah membaca
`tax_enabled`, `tax_percent`, dan `tax_inclusive` dari `organizations`, sudah
menghitung `tax_total`, dan sudah membedakan mode termasuk/ditambahkan.
`transactions.tax_total` ikut dijaga constraint
`total = subtotal - discount_total + tax_total + rounding`. `Receipt` bahkan
sudah punya baris pajak (`data.tax`), dan halaman detail transaksi sudah
mengirimnya.

Yang benar-benar tidak ada: **layar untuk menyalakannya**, tampilan pajak di
layar kasir sebelum bayar, dan pemisahan pajak di laporan. Jadi Fase 3 jauh
lebih murah daripada dugaan awal, dan risikonya bukan di perhitungan melainkan
di penyebaran setelan ke perangkat.

**`purchase_items.product_id` NOT NULL.** Secara struktur memang tidak mungkin
mencatat sewa, listrik, gaji, atau bensin lewat Pembelian. Ini membenarkan
keputusan memakai tabel terpisah, bukan melonggarkan tabel yang ada.

**`purchases` tidak menyimpan pembelian itu dibayar pakai apa.** Kolom
`payment` hanya `paid` / `credit`. Untuk arus kas, "lunas" saja tidak cukup:
lunas pakai tunai mengurangi uang di laci, lunas pakai transfer tidak. Satu
kolom baru diperlukan.

Satu catatan lagi yang menghemat pekerjaan: `pull_catalog` sudah mengirim
SELURUH baris organizations sebagai `settings`, jadi setelan pajak sebenarnya
sudah sampai ke perangkat. Yang belum ada, cache offline (`lib/offline/`) tidak
menyimpannya sama sekali.

---

## Fase 0. Prasyarat: backup

**Belum dikerjakan dan seharusnya didahulukan.** Sekarang yang hilang kalau
database rusak adalah data penjualan. Setelah fase-fase di bawah jalan, yang
hilang adalah dasar pelaporan pajak klien. Supabase paket gratis tidak punya
point in time recovery.

Ini bukan bagian dari rencana ini, tapi ditulis di sini supaya tidak lolos:
**taruhannya naik setelah modul ini ada.**

---

## Fase 1. Pengeluaran operasional

Migrasi `20260814090043_expenses.sql`.

### Kenapa tabel sendiri, bukan melonggarkan `purchases`

Pembelian menaikkan stok dan menulis ulang HPP. Pengeluaran tidak menyentuh
stok sama sekali. Digabung, sewa toko ikut terhitung sebagai harga pokok dan
laba kotor salah secara permanen. Alasannya sama persis dengan pemisahan
Konsinyasi dari Pembelian: bentuk yang mirip di layar, akibat yang berbeda di
pembukuan.

### Skema

```sql
-- kategori pengeluaran, milik tiap toko
create table public.expense_categories (
  id, organization_id, name, sort_order, is_active,
  created_at, updated_at, deleted_at
);
-- unique (organization_id, lower(name)) where deleted_at is null

create table public.expenses (
  id, organization_id,
  outlet_id      uuid null,        -- NULL = pengeluaran seluruh toko
  category_id    uuid not null,
  expense_date   date not null default current_date,
  amount         bigint not null check (amount > 0),
  payment_method public.payment_method not null default 'cash',
  payee          text,             -- dibayar ke siapa
  note           text,
  created_by, created_at, updated_at,
  deleted_at, delete_reason
);
```

Plus satu kolom di tabel yang sudah ada:

```sql
alter table public.purchases
  add column payment_method public.payment_method not null default 'cash';
```

### Keputusan yang sudah diambil, dan alasannya

**`outlet_id` boleh NULL, dan daftarnya TIDAK disaring outlet aktif.** Sewa
kontrakan cabang jelas milik satu cabang; gaji admin dan langganan internet
tidak. Aturannya diambil dari "Aturan cakupan outlet" di CLAUDE.md: kalau
disembunyikan ada uang yang hilang dari pandangan, jangan disaring. Tiap baris
diberi label nama cabang kalau tokonya memang bercabang, sama seperti
Pembelian dan Konsinyasi.

**Kategori dibuat per toko, dengan delapan bawaan.** Sewa, Listrik & Air, Gaji &
Upah, Transportasi, Kemasan & Perlengkapan, Perawatan, Promosi, Lain-lain.
Bawaannya disemai untuk toko yang sudah ada lewat migrasi, dan untuk toko baru
lewat `provision_organization` (pola yang sama dengan kategori produk). Alasan
yang sama dengan impor CSV: memaksa orang membuat 8 kategori dengan tangan
sebelum boleh mencatat pengeluaran pertama sama saja dengan menyuruhnya
berhenti di langkah pertama.

**Tidak ada kolom lampiran foto nota di migrasi ini.** Layarnya belum
dibangun, dan project ini sudah dua kali punya kolom yang menunggu bertahun
tahun tanpa layar (`logo_url` dan `tax_*`). Kolomnya ditambahkan di migrasi
sendiri saat unggahannya benar-benar dibuat.

**Bisa diubah, penghapusannya SOFT dengan alasan.** Berbeda dengan transaksi
penjualan, pengeluaran tidak punya nomor berurut yang diberikan ke pembeli dan
tidak menggerakkan stok, jadi salah ketik boleh diperbaiki. Tapi baris yang
sudah masuk laporan tidak boleh lenyap tanpa jejak, jadi hapus berarti
`deleted_at` + `delete_reason`, dan barisnya tetap terlihat diredupkan seperti
transaksi batal.

**Hak tulis memakai izin `reports`.** Di aplikasi ini `reports` sudah menjadi
izin "boleh menyentuh uang": pembatalan transaksi dijaga izin yang sama, di UI
maupun di dalam RPC. Kasir biasa tidak akan melihat menunya. Baca tetap
`can_read_org`.

**Ikut ditolak TK002 saat langganan berakhir.** Pengeluaran adalah penambahan
data biasa, bukan penjualan yang sudah terjadi di depan pembeli, jadi ia masuk
kelompok yang sama dengan produk dan outlet. Tidak ada perlakuan khusus seperti
`sync_transactions`.

**Pencatatannya TIDAK dikunci paket.** Yang dikunci lapisan analisanya (Fase 2).
Prinsipnya sudah tertulis di CLAUDE.md: jangan kunci hal yang membuat uang jadi
benar, kunci lapisan analisanya. Toko Starter yang tidak bisa mencatat
pengeluaran akan punya laporan yang salah, bukan laporan yang lebih sedikit.

### Layar

`/laporan/pengeluaran`, tab ketiga di `LaporanTabs`
(Penjualan · Laporan Shift · Pengeluaran). **Bukan** item navigasi baru: bottom
nav ponsel sudah pas 5 slot, aturan yang sama dengan `/laporan/shift`.

Rencana awal menaruhnya di bawah Pembelian, dan itu dibatalkan saat
mengerjakan. Menu Pembelian dijaga izin `products` sementara halaman ini butuh
`reports`, jadi anggota yang memegang laporan tanpa memegang produk tidak punya
jalan sama sekali ke halaman yang secara aturan boleh ia pakai. Itu persis
celah yang dulu terjadi pada Transfer Stok. Di bawah Laporan, izin menu dan
izin halaman tidak pernah bisa berbeda, karena keduanya `reports`.

Isi halaman: hero total periode, rincian per kategori (terbesar dulu), daftar
per tanggal dengan label cabang, drawer tambah/ubah, drawer hapus yang meminta
alasan, dan drawer kelola kategori. Kategori pengeluaran diatur DI HALAMAN INI,
bukan di Pengaturan → Kategori: halaman itu mengurus kategori produk yang
dipakai layar kasir, dan dua jenis kategori berbeda di satu layar lebih
membingungkan daripada satu tombol tambahan di sini.

Periodenya **bulanan** (Bulan Ini · Bulan Lalu · 3 Bulan · 12 Bulan), bukan
"7/30/90 hari" seperti Laporan Penjualan. Pengeluaran memang berirama bulan:
"30 hari terakhir" pada tanggal 5 memuat dua kali sewa dan tidak satu pun
listrik. Laba rugi di Fase 2 juga bulanan, dan dua halaman yang memotong waktu
dengan cara berbeda tidak akan pernah cocok angkanya.

---

## Fase 2. Laporan keuangan tingkat 1 dan 2

Migrasi `20260814090044_finance_views.sql` (view saja, tanpa tabel baru).

### Aturan paling menentukan: ini DUA buku, bukan satu

Ini yang paling gampang salah dan paling mahal kalau salah.

| | Arus Kas | Laba Rugi |
|---|---|---|
| pertanyaannya | uang di tangan bertambah atau berkurang | usahanya untung atau rugi |
| penjualan | hanya yang dibayar tunai | seluruh penjualan sah |
| pembelian | saat uangnya keluar (`purchased_at` kalau lunas, `paid_at` kalau tempo) | tidak muncul, yang muncul HPP barang yang TERJUAL |
| pengeluaran | saat dibayar | pada `expense_date` |
| pajak | ikut uang yang diterima | dikeluarkan dari omzet |

Contoh yang membuat perbedaannya nyata: belanja 20 karton mi instan Rp 2 juta
tunai hari ini. Arus kas hari ini turun Rp 2 juta. Laba rugi hari ini tidak
berubah sama sekali, karena barangnya belum terjual. Kalau keduanya dihitung
dari tabel yang sama tanpa aturan ini, pemilik toko akan melihat "rugi" setiap
kali kulakan, lalu berhenti percaya seluruh laporannya.

### View

`v_cash_flow` (per organisasi, outlet, tanggal, arah, sumber):

- masuk: `transactions` non-void, `payment_method = 'cash'`, tanggal
  `client_created_at` (aturan laporan yang sudah berlaku)
- keluar: `purchases` yang `payment_method = 'cash'` pada tanggal bayarnya,
  `expenses` yang `payment_method = 'cash'` pada `expense_date`
- non-tunai ikut ditampilkan sebagai kolom terpisah supaya "uang masuk lewat
  QRIS" tidak hilang. Yang dibedakan tegas cuma yang menyentuh laci kasir.

`v_profit_loss` (per organisasi, outlet, bulan):

- omzet = `subtotal - discount_total`, dan **dikurangi `tax_total` kalau
  pajaknya mode termasuk**. Pajak yang dipungut bukan pendapatan toko.
- HPP = `cost_total` (sudah di-snapshot per transaksi, tidak perlu dihitung
  ulang dan tidak akan berubah kalau harga beli berubah besok)
- laba kotor = omzet - HPP
- pengeluaran per kategori dari `expenses`
- laba bersih = laba kotor - pengeluaran

Keduanya `security_invoker = on` tanpa fungsi SECURITY DEFINER di dalamnya,
mengikuti `v_shift_summary` dan `v_consignment_summary`. Jangan mengulang
kebocoran lintas tenant migrasi 0019.

Transaksi `void` dibuang di kedua view. Ini harus diperiksa langsung saat uji,
bukan diasumsikan.

### Layar

`/laporan/keuangan`, tab ketiga di `LaporanTabs` (Penjualan · Shift · Keuangan).

Isinya, urut dari atas: pilihan periode (bulan berjalan, bulan lalu, rentang) ·
kartu ringkas (kas masuk, kas keluar, arus kas bersih, laba bersih) · tabel
Laba Rugi bentuk vertikal · rincian pengeluaran per kategori · tabel arus kas
harian · tombol ekspor.

**Dikunci `reports: 'full'` lewat `PlanLock`**, tidak disembunyikan. Alasannya
sudah tertulis di CLAUDE.md: bagian yang lenyap tanpa jejak terbaca sebagai
aplikasi yang belum jadi, dan orangnya tidak pernah terpikir naik paket.

Cakupan outlet mengikuti pola Laporan Penjualan: bawaannya outlet aktif, ada
pilihan per cabang dan "Semua outlet", dan pilihannya ikut terbawa saat
berpindah periode. Pengeluaran ber-`outlet_id` NULL selalu ikut di semua
cakupan, dan itu harus disebut di layar supaya angkanya tidak dikira salah.

---

## Fase 3. Sakelar pajak

Migrasi `20260814090045_tax_settings.sql`.

Perhitungannya sudah ada sejak 0042. Yang dikerjakan di sini pengaturannya,
tampilannya, dan penyebarannya.

### Yang ditambahkan di database

```sql
alter table public.organizations add column tax_label text not null default 'PPN';
alter table public.transactions  add column tax_percent numeric(5,2) not null default 0;
```

**`tax_label`** karena penjual makanan memungut PB1 (pajak restoran daerah),
bukan PPN, dan menuliskan "PPN" di struk rumah makan itu salah nama.

**`tax_percent` di transaksi adalah snapshot**, dan bukan kolom mati: dipakai
struk cetak ulang dan detail transaksi supaya nota lama tetap menyebut tarif
yang benar setelah tarifnya berubah, dan dipakai laporan pajak untuk
mengelompokkan per tarif.

Kolom komersial `organizations` dikunci trigger sejak 0036. `tax_*` **bukan**
kolom komersial: pemilik toko memang berhak mengubahnya, jadi jangan
ditambahkan ke daftar `tg_guard_org_commercial`.

### Jebakan yang sudah kelihatan dari sekarang

**`catalog_version` TIDAK naik saat setelan organisasi berubah.** Triggernya
(migrasi 0010) hanya dipasang di `products` dan `categories`. Setelan pajak
karena itu tidak akan pernah dianggap "cache basi" oleh perangkat. Harus
ditambahkan trigger pada `organizations` yang menaikkannya ketika kolom
kebijakan berubah, kalau tidak kasir tetap memakai tarif lama tanpa ada yang
tahu.

**Cache offline tidak menyimpan `settings` sama sekali.** `pull_catalog` sudah
mengirimnya, `lib/offline/` membuangnya. Untuk mode "ditambahkan" (pajak menaikkan
total), tarif WAJIB ada di perangkat, kalau tidak layar kasir menagih angka yang
berbeda dari yang dicatat server. Jadi setelan pajak ikut disimpan di Dexie,
dengan aturan isolasi tenant yang sama (dibuang saat berganti toko).

**Mode "termasuk" tidak mengubah uang sama sekali**, cuma memecah total yang
sudah ada. Aman, dan ini yang dipakai mayoritas warung. **Mode "ditambahkan"
mengubah yang dibayar pembeli**, dan di situlah semua risikonya. Bawaannya
tetap "termasuk".

**Tarif yang berubah selagi ada transaksi offline.** Server menghitung pakai
tarif hari ini, sementara struk di tangan pembeli memakai tarif kemarin. Untuk
mode termasuk tidak ada uang yang bergeser. Untuk mode ditambahkan, totalnya
bisa berbeda dari uang yang benar-benar diterima. Yang dikerjakan sekarang:
snapshot tarif di transaksi + peringatan tegas di layar pengaturan sebelum
tarif diubah. Yang **tidak** dikerjakan sekarang: tabel riwayat tarif dengan
`effective_from` lalu memilih tarif yang berlaku pada `client_created_at`.
Itu jawaban yang benar-benar rapi, tapi baru sepadan kalau ada klien yang
memang memungut PB1 dan sering offline.

### Layar

- **Pengaturan → Toko**: satu bagian "Pajak" berisi sakelar aktif, nama pajak,
  persentase, dan pilihan Termasuk harga / Ditambahkan. Contoh perhitungan
  ditampilkan langsung di bawahnya dengan angka nyata ("Harga Rp 10.000 →
  pembeli bayar Rp 11.000, pajak Rp 1.000"), karena "inklusif" dan "eksklusif"
  adalah dua kata yang paling sering ditukar orang.
- **Kasir**: baris pajak muncul di ringkasan bayar hanya kalau mode ditambahkan,
  karena mode termasuk tidak mengubah yang harus dibayar. Angkanya dihitung
  dengan rumus yang sama persis dengan `_apply_transaction`, dan kalau berbeda,
  layar menyebut satu angka sementara server menyimpan angka lain. Aturan yang
  sama dengan urutan tiga lapis diskon.
- **Struk**: sudah jalan, tinggal memakai `tax_label`.

---

## Fase 4. Ekspor

**CSV lebih dulu**, memakai `lib/exports.ts` yang sudah ada. Tambahan jenis:
`pengeluaran`, `arus-kas`, `laba-rugi`. Route Handler, BOM UTF-8, semua aturan
di "Impor CSV & backup" berlaku apa adanya.

**PDF lewat halaman cetak.** `/laporan/keuangan/cetak` dengan CSS cetak, lalu
"Simpan sebagai PDF" dari dialog cetak browser. Pola `AutoPrint` dan lapis dasar
CSS cetak sudah ada dan sudah diuji untuk struk. Tanpa dependensi baru, tanpa
Puppeteer, jalan di ponsel maupun desktop.

**XLSX ditunda sampai ada yang meminta.** Perlu dependensi baru yang cukup besar
dan harus ikut diaudit seumur hidup project. CSV terbuka mulus di Excel, dan
selisihnya cuma rapi tidaknya kolom.

**Rekap pajak** ikut di sini kalau Fase 3 sudah menyala: peredaran bruto per
bulan, kumulatif tahun berjalan, dan pajak terpungut per tarif. Itu bentuk yang
langsung bisa dipakai untuk PPh Final UMKM dan untuk setoran PB1. Tarif dan
ambangnya harus dikonfirmasi ke konsultan pajak dan pemda setempat sebelum
ditulis di layar, terutama PB1 yang berbeda tiap kabupaten dan kota.

---

## Yang sengaja TIDAK dikerjakan

Ditulis supaya tidak diam-diam masuk saat mengerjakan.

- **Akun kas dan bank sebagai tabel.** Fase 1 memakai `payment_method` di baris
  pengeluaran, dan itu sudah cukup untuk menjawab "uang di laci berkurang
  berapa". Tabel akun baru sepadan saat ada pemindahan antar akun, setoran
  kasir ke pemilik, dan prive.
- **Jurnal, chart of accounts, neraca.** Menunggu ada klien yang memintanya.
- **Pengeluaran berulang otomatis.** Sewa bulanan diketik ulang tiap bulan
  dulu. Penjadwalan butuh cron dan bisa membuat baris uang lahir tanpa ada yang
  menekan tombol.
- **Lampiran foto nota.**
- **PPN keluaran/masukan, e-Faktur, Coretax.** Itu dunia PKP. Yang kita berikan
  ekspor yang bisa dipakai akuntan.
- **Apa pun yang berhubungan dengan F&B** (resep, satuan konversi, varian, open
  bill). Dibicarakan terpisah.

---

## Pengujian

Mengikuti cara yang dipakai saat menguji diskon tiga lapis, dan alasannya sama:
untuk urusan uang, skrip service-role yang membandingkan tersimpan versus
diharapkan jauh lebih ketat daripada mengklik di layar. **Agen tidak punya sandi
akun siapa pun**, jadi pengujian yang butuh sesi harus dikerjakan pemilik
project.

Yang wajib dibuktikan:

1. Pengeluaran tunai Rp 500.000 → arus kas keluar bertambah persis Rp 500.000,
   laba bersih turun Rp 500.000, laba KOTOR tidak berubah.
2. Pembelian tunai Rp 2.000.000 → arus kas keluar bertambah, laba rugi bulan itu
   **tidak berubah sama sekali**.
3. Pembelian tempo → tidak muncul di arus kas sampai dilunasi, lalu muncul pada
   tanggal pelunasan.
4. Transaksi dibatalkan → hilang dari kedua laporan.
5. Pajak mode termasuk: total tidak berubah sepeser pun dibanding sebelum
   disetel, `tax_total` terisi, dan omzet di laba rugi turun sebesar pajaknya.
6. Pajak mode ditambahkan: angka di layar kasir sama persis dengan `total` yang
   tersimpan server.
7. Pengeluaran ber-`outlet_id` NULL ikut terhitung di semua cakupan outlet.
8. Toko paket Starter: masih bisa mencatat pengeluaran, tapi halaman Laporan
   Keuangan tampil sebagai `PlanLock`.

Setelan Toko Dewi yang dipakai memperagakan aplikasi harus dikembalikan
sesudahnya, dan data uji dibersihkan.

---

## Urutan kerja

| # | pekerjaan | ukuran | status |
|---|---|---|---|
| 1 | migrasi 0043 (expenses, kategori, kolom pembelian, RLS, TK002) | sedang | ✅ 14 Agu |
| 2 | migrasi 0044 (kategori & outlet wajib satu toko) | kecil | ✅ 14 Agu |
| 3 | layar `/laporan/pengeluaran` + drawer + kategori | sedang | ✅ 14 Agu |
| 4 | migrasi 0045 (view arus kas & laba rugi) | sedang | ✅ 14 Agu |
| 5 | halaman `/laporan/keuangan` + PlanLock + cakupan outlet | besar | ✅ 14 Agu |
| 6 | migrasi 0046 + pengaturan pajak + tampilan kasir + `catalog_version` | sedang | |
| 7 | ekspor CSV + halaman cetak PDF + rekap pajak | sedang | |
| 8 | pengujian angka lewat skrip, lalu 390px | sedang | |
| 9 | perbarui CLAUDE.md dan halaman `/fitur` | kecil | |

Migrasi 0044 tidak ada di rencana awal. Ia lahir dari pengujian 0043: FK biasa
menerima kategori milik toko lain, karena foreign key cuma bertanya "barisnya
ada?" dan tidak pernah "barisnya milik siapa?". Ditambal dengan FK komposit
`(organization_id, id)`. Bahayanya kecil (perlu menebak UUID toko lain), tapi
kalau sampai terjadi, laporan Fase 2 akan menjumlahkan pengeluaran ke kategori
milik orang lain tanpa satu pun error.

Fase 1 dan 2 sudah berdiri sendiri sebagai bahan jualan. Fase 3 boleh menyusul
kapan saja tanpa mengubah apa pun yang sudah dibangun.

## Yang perlu diputuskan sebelum mulai

1. Izin `reports` untuk mencatat pengeluaran, atau khusus pemilik dan admin toko.
2. Delapan kategori bawaan di atas cocok, atau ada yang khas usaha di sini.
3. Laporan Keuangan dikunci paket atas, atau dibuka untuk semua paket sebagai
   pembeda dari pesaing.
