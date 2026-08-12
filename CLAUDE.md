@AGENTS.md

# TokoKu

POS & ERP retail UMKM. Multi-tenant SaaS — satu platform, banyak toko sebagai tenant.
Branding: **TokoKu by Seawise Studio**.

`REFERENCE-wireframe.html` adalah sumber kebenaran desain & flow. Kalau ragu soal
tampilan, buka file itu dulu.

## Kondisi terkini — mulai baca dari sini

Terakhir dikerjakan **12 Agustus 2026**. Semua yang di bawah ini sudah dibangun
dan migrasinya sudah diterapkan ke Supabase.

**Sudah di-deploy ke Vercel** lewat GitHub (`seawisecc/tokoku`), dan pushing ke
`main` memicu deploy produksi otomatis. Function berjalan di **sin1 (Singapura)**
satu region dengan Supabase — jangan pernah memindahkannya tanpa memindahkan
databasenya juga; lihat "Deploy tidak responsif" di bawah.

**Dua hal yang belum tuntas, baca sebelum mengerjakan apa pun:**
1. **Scan barcode sudah live tapi belum diverifikasi siapa pun.** Lihat bagian
   bertanda ⚠ di bawah.
2. **Sandi Super Admin masih `admin123` di produksi.** Akun itu bisa membaca data
   seluruh toko klien. Harus diganti pemilik project sendiri.

**Sudah jalan:**
- Auth split-panel dengan animasi clip-path · pendaftaran toko mandiri ·
  undangan anggota tim (terima lewat `/undangan/[token]`)
- Lupa & reset kata sandi (`/lupa-sandi` → email → `/auth/konfirmasi` →
  `/atur-sandi`) — lihat "Reset kata sandi" di bawah
- AppShell: kolom gelap penuh, navigasi disaring izin modul, 3 lapis penjagaan
- POS offline-first: Dexie + outbox + service worker + sinkronisasi idempoten,
  cetak struk 58mm, buka/tutup shift
- Produk & stok (drawer CRUD + opname), transaksi + pembatalan, laporan
- Pengaturan: toko, tim & akses, kategori, struk/printer, sinkronisasi
- Super Admin: dashboard, klien, kelola paket, "Lihat sebagai Klien" (hanya baca)
- **Kuota paket ditegakkan di database** (outlet · pengguna · produk · perangkat)
  — lihat "Kuota paket" di bawah
- **Status langganan & masa trial ditegakkan** — lihat "Status langganan" di bawah
- Kontrol langganan di Super Admin: ganti paket, status, atur/perpanjang masa
  trial, riwayat langganan
- Peringatan langganan di sisi toko: spanduk hitung mundur 7 hari sebelum trial
  habis, spanduk merah saat sudah lewat, tombol Bayar terkunci
- Cache offline dipisah per toko — lihat "Isolasi cache offline" di bawah
- Laporan shift (`/laporan/shift`) — kasir, jam jaga, penjualan tunai/non-tunai,
  selisih kas
- Kartu stok (`/produk/[id]`) — riwayat masuk-keluar per produk dengan saldo
  berjalan
- **Logo toko** — unggah di Pengaturan → Toko, tampil di sidebar/topbar dan
  tercetak di struk; lihat "Logo toko" di bawah
- **Hapus perangkat kasir** (`/pengaturan/sinkronisasi`) — ditolak kalau masih
  ada antrean; lihat "Perangkat bisa dihapus" di bawah
- **Langganan sisi toko** (`/pengaturan/langganan`) — paket aktif, sisa trial,
  bar kuota, riwayat, tombol WhatsApp admin; lihat "Langganan sisi toko" di bawah
- **CRM & poin loyalty** (`/pelanggan`) — daftar pelanggan, segmentasi, poin
  otomatis; lihat "CRM, poin loyalty, dan nota WhatsApp" di bawah
- **Nota via WhatsApp** — tombol di detail transaksi, membuka WhatsApp kasir
  sendiri dengan notanya sudah tertulis
- **Scan barcode** (kamera + alat pemindai) — SUDAH DI-DEPLOY TAPI BELUM
  DIVERIFIKASI SIAPA PUN; lihat bagian bertanda ⚠ di bawah
- Pembelian & pemasok (`/pembelian`) — lihat "Pembelian" di bawah
- Konsinyasi (`/pembelian/konsinyasi`) — titip jual, bagi hasil, retur; lihat
  "Konsinyasi" di bawah
- **Multi-outlet** — buat/kelola cabang (`/pengaturan/outlet`), pemilih outlet di
  topbar, seluruh halaman disaring per outlet, laporan bisa digabung semua
  cabang + perbandingan antar cabang, transfer stok (`/produk/transfer`);
  lihat "Multi-outlet" di bawah
- **Multi-toko** — satu akun boleh punya sampai 5 toko terpisah; pemilih toko
  menyatu dengan pemilih outlet di topbar; lihat "Multi-toko" di bawah
- **Cross-check menyeluruh 10 Agu** — 17 rute disapu, 5 cacat ditemukan &
  diperbaiki; lihat "Transaksi batal harus terlihat batal" dan "Aturan cakupan
  outlet" di bawah
- **Mobile 390px sudah ditelusuri langsung** (10 Agu) — beranda, kasir, produk,
  laporan, tim. Empat masalah ditemukan dan diperbaiki; lihat "Mobile" di bawah.

**Belum dikerjakan — urutan yang disarankan:**
1. Email undangan: KODENYA SUDAH JADI, tinggal isi `RESEND_API_KEY` +
   `EMAIL_FROM` di `.env.local`. Butuh akun Resend (gratis 3.000 email/bulan)
   dan domain terverifikasi. Tanpa kunci, aplikasi tetap jalan penuh — lihat
   "Email undangan" di bawah.
2. `features` jsonb sisa: `multi_outlet`, `api`, `support` belum dipakai —
   barangnya memang belum ada. `purchasing` & `reports` sudah ditegakkan, lihat
   "Pembagian paket" di bawah.
3. Billing — pemilik toko sekarang BISA melihat paket, sisa trial, kuota, dan
   riwayat langganannya sendiri di `/pengaturan/langganan`, dan menghubungi
   admin lewat WhatsApp. Yang belum ada cuma payment gateway-nya: perubahan
   paket masih dikerjakan tangan lewat Super Admin.
4. **Penukaran poin di Kasir.** Aturan dan databasenya sudah jalan penuh dan
   teruji (`_apply_customer_effects` menerima `points_redeemed`), tapi belum ada
   antarmukanya: kasir belum bisa memilih pelanggan lalu menukar poin saat
   membayar. Menyentuh alur pembayaran DAN sinkronisasi offline sekaligus, jadi
   jangan diselipkan tanpa pengujian yang layak. Untuk sekarang poin bertambah
   otomatis tapi tidak bisa ditukar dari kasir.
5. **Sandi Super Admin `admin123` masih berlaku di produksi.** Satu akun itu
   bisa membaca data SELURUH toko klien. Harus diganti pemilik project sendiri;
   bukan sesuatu yang boleh dikerjakan agen.

Seluruh modul yang disepakati sudah jadi — Konsinyasi yang terakhir, selesai
10 Agu 2026. Sisa daftar di atas adalah pengembangan lanjutan, bukan ruang
lingkup yang masih terhutang.

**Mobile:** seluruh aplikasi sudah ditelusuri di 390px, termasuk `/admin/*`.
Tabel Super Admin tetap tabel geser di ponsel — disengaja, itu alat desktop.

## Deploy "tidak responsif" — SUDAH DIPERBAIKI (11 Agu)

Laporannya ternyata bukan soal tata letak sama sekali. "Tidak responsif"
berarti **lambat**: tiap pindah halaman atau tekan tombol menunggu 2–10 detik,
di semua perangkat (MacBook Safari & Chrome, iPhone 15 Pro Max, Samsung Note 8).
Tata letaknya memang sudah benar — dugaan lama soal iframe vs perangkat
sungguhan tidak ada hubungannya.

**Penyebabnya geografi, bukan kode.** Function Vercel berjalan di `iad1`
(Washington DC) sementara Supabase ada di `ap-southeast-1` (Singapura) dan
seluruh penggunanya di Indonesia. Jadi tiap render: Indonesia → edge Singapura
→ **function Washington** → **balik ke Singapura untuk tiap query** → Washington
→ Indonesia. Satu pulang-pergi Washington↔Singapura ≈ 220 ms, dan
`getSessionContext()` menembak lima query berurutan sebelum halamannya sendiri
mulai bekerja.

Terukur sebelum: `/beranda` 3,44 s · `/produk` 2,41 s · `/pengaturan/tim` 1,68 s.
Sesudah: **0,20–0,51 s.** Header `x-vercel-id` berubah dari `sin1::iad1` menjadi
`sin1::sin1`.

Tiga yang dikerjakan, berurut dari yang paling menentukan:

1. **Region function `iad1` → `sin1`.** Ini ~90% perbaikannya. Ditulis di
   `vercel.json` (`"regions": ["sin1"]`) DAN di setelan project Vercel, supaya
   deploy yang kebetulan tanpa `vercel.json` tetap mendarat di tempat yang benar.
   **Region function harus selalu satu benua dengan Supabase.** Kalau nanti
   database dipindah, region ini ikut — kalau tidak, gejalanya persis kembali.
2. **`auth.getUser()` → `auth.getClaims()`** di `lib/supabase/session.ts` dan
   `lib/auth.ts`. `getUser()` bertanya ke server Auth setiap kali dipanggil; ia
   dipanggil sekali di proxy dan sekali lagi tiap render halaman, jadi dua
   pulang-pergi jaringan sebelum query pertama. Token project ini
   ditandatangani ES256, jadi `getClaims()` memverifikasinya lokal lewat
   WebCrypto. Penyegaran token tetap jalan — `getClaims()` memanggil
   `getSession()` di dalamnya. Lihat komentar di kedua file untuk batasnya.
3. **`loading.tsx`** di `(toko)`, `(toko)/pengaturan`, dan `(platform)/admin`.
   Ini yang memperbaiki *rasa* tidak responsifnya, bukan angkanya. Seluruh
   halaman toko `force-dynamic`, jadi menekan menu selalu menunggu server —
   dan tanpa batas Suspense, App Router menahan layar pada halaman LAMA sampai
   jawabannya lengkap. Tidak ada satu piksel pun yang berubah saat ditekan,
   jadi tombolnya terbaca mati dan orang menekannya lagi. Jangan hapus.

**Yang sengaja TIDAK dikerjakan:** menggabungkan lima query `getSessionContext()`
jadi satu RPC. Sempat direncanakan, lalu dibatalkan — setelah function duduk di
sebelah database, tiap pulang-pergi tinggal ~2 ms, jadi seluruh perombakan itu
cuma menghemat ~6 ms sambil mengaduk jalur auth. Kalau nanti terasa kurang,
ukur dulu; kemungkinan besar bukan di sana lagi tempatnya.


## Layar lebar

Sampai 10 Agu, `.content` tidak punya batas lebar sama sekali — wireframe pun
tidak, karena ia digambar di lebar sempit. Di monitor 1920px isinya melar
~1680px dan hasilnya terbaca murah: hero jadi bidang hijau kosong raksasa dengan
tulisan kecil di pojok, dan baris transaksi merentang sekitar seribu piksel
antara nomor dan nominalnya sehingga mata harus melompat jauh untuk
memasangkan keduanya.

**Batasnya 1240px.** Cukup lebar untuk tabel enam kolom Laporan Shift, cukup
sempit supaya satu baris teks masih terbaca tanpa menggerakkan kepala. Hanya
menggigit di atas ~1300px; di laptop biasa tidak ada yang berubah.

**Kasir dikecualikan (1560px)** lewat `:has(.pos-layout)`. Grid produknya bukan
teks yang dibaca menyamping melainkan sasaran sentuh yang dicari mata — makin
banyak terlihat sekaligus, makin sedikit kasir menggulir di depan antrean.
Di ≥1400px gridnya jadi 5 kolom.

Tiga pola yang dipakai supaya lebar tambahan diisi ISI, bukan jarak:

- **`.hero` jadi dua kolom di ≥900px** — angka besar di kiri, ringkasannya
  digeser ke ujung kanan pada garis dasar yang sama. Murni CSS grid dengan
  penempatan baris/kolom eksplisit; markup-nya tidak berubah, jadi Beranda dan
  Laporan ikut sekaligus.
- **`.wide-cols` di ≥1100px** — bagian pendek yang setara disandingkan alih-alih
  ditumpuk. Dipakai Beranda (peringatan+tagihan | transaksi terbaru) dan Laporan
  (produk terlaris | metode bayar). Varian `.lead-left` memberi kolom kiri
  sedikit lebih lebar untuk hal yang lebih menuntut tindakan.
- **`.form-narrow` (760px)** — borang tidak boleh selebar tabel. Input teks
  sepanjang 1200px membuat mata kehilangan pasangan label-isiannya, dan tidak
  ada satu pun isian di aplikasi ini yang isinya sepanjang itu.

`.trx-detail` membuat kartu rincian + struk berdampingan di ≥900px; sebelumnya
selalu satu kolom sehingga kartunya melar penuh dan struk jatuh jauh di bawah,
padahal keduanya dibaca berdampingan saat mencocokkan nota.

Diuji di 390 · 800 · 1000 · 1100 · 1280 · 1600px — tidak ada geser horizontal di
lebar mana pun, dan peralihan satu↔dua kolom terjadi tepat di ambangnya.

## Mobile

Alat resize browser melaporkan "berhasil" tapi `innerWidth` tidak berubah — ini
sudah dua sesi. Yang bekerja: muat aplikasi di dalam iframe 390×844 pada halaman
yang sama (same-origin, jadi isinya masih bisa diperiksa lewat `contentDocument`).
Iframe punya viewport sendiri, jadi media query benar-benar dievaluasi di 390px.

Sudah ditelusuri di 390px: beranda, kasir, produk, laporan, transaksi, riwayat,
transaksi/[id], profil, kelima halaman pengaturan, dan drawer form.

Yang diperbaiki:
- **Bottom nav** dibatasi 5 slot lewat `splitBottomNav()`; sisanya masuk lembar
  "Lainnya". Pemilik toko punya 7 menu — dipaksakan semua, "Profil" terpotong
  tepi kanan. Slot ke-5 ikut menyala kalau halaman aktif ada di dalam lembar.
- **`CartBar`** — keranjang jatuh ke bawah daftar produk di layar sempit, jadi
  kasir harus menggulir melewati seluruh katalog untuk menekan Bayar.
- **`.trx-table`** berhenti jadi tabel di < 640px dan menjadi tumpukan. Sebagai
  tabel, empat kolomnya butuh ~360px di layar 358px: nomor transaksi pecah tiga
  baris dan kolom Total terdorong ke luar layar — daftar transaksi kehilangan
  satu-satunya angka yang dicari orang. Tabelnya sendiri dipertahankan supaya
  header kolom dan semantik tabel tetap utuh di layar lebar.
- **Bayangan tepi `.table-scroll`** — tabel yang tetap perlu digeser (produk,
  sinkronisasi) memang bisa digeser, tapi scrollbar overlay tidak terlihat
  sampai disentuh, sehingga tombol aksi baris di kolom paling kanan tidak
  pernah ditemukan.
- **`.team-row`** dibuat membungkus di < 640px; badge peran panjang menyisakan
  ~135px untuk nama sehingga daftar izin pecah satu kata per baris.
- **`.mini-stat-row`** dibuat membungkus jadi dua kolom. Tiga kolom uang
  menyisakan ~68px isi per kartu sementara "Rp 118.000" butuh ~95px — angka
  pecah dua baris tepat di layar tutup shift. Mengecilkan font tidak menolong;
  nominal jutaan tetap tidak muat.
- **`.drawer-foot`** diberi `env(safe-area-inset-bottom)`; drawer menempel
  `bottom: 0` sehingga tombol Simpan/Batal jatuh di bawah home indicator iPhone.

Belum dikerjakan dan mungkin tidak perlu: tabel produk & sinkronisasi masih
tabel geser di ponsel. Bayangan tepi cuma petunjuk. Kalau nanti terasa kurang,
langkah berikutnya menumpuk barisnya seperti `.trx-table` — polanya sudah ada,
tinggal diterapkan per tabel.

## Logo toko

Kolom `organizations.logo_url` sudah ada sejak migrasi 0003 dan sakelar
"Tampilkan logo" sudah tersimpan ke `receipt_settings` sejak saat itu juga —
yang tidak pernah ada cuma tempat menaruh berkasnya. Jadi selama berbulan-bulan
ada dua hal setengah jadi yang saling menunggu: kolomnya selalu null dan
sakelarnya tidak pernah mengubah apa pun yang tercetak. Migrasi 0033 menambah
penyimpanannya saja.

**Bucket `logo-toko` PUBLIK, dan itu disengaja.** Logo memang dicetak di struk
yang dibawa pulang pembeli — tidak ada yang rahasia. Signed URL akan menambah
satu panggilan jaringan di tiap render struk, tepat pada layar yang paling tidak
boleh menunggu.

**Batas ukuran & tipe ditegakkan BUCKET** (1 MB · PNG/JPG/WebP), bukan aplikasi:
unggahan tidak harus lewat borang kita. Server action memeriksanya lagi supaya
pesannya bisa dibaca pemilik warung, dan `LogoUploader` memeriksanya sekali lagi
di perangkat supaya berkas 4 MB tidak dikirim dulu lewat jaringan warung baru
ditolak.

**Path TETAP `<organization_id>/logo`, ditimpa tiap ganti.** Menamai berkas
dengan stempel waktu meninggalkan satu berkas yatim di storage setiap kali
pemilik toko mencoba logo baru — tidak ada yang membersihkannya. Konsekuensinya
URL-nya juga tetap, jadi browser akan menampilkan logo LAMA dari cache; itu
sebabnya `?v=<timestamp>` ditempel di `logo_url`.

Folder pertama pada path itulah penanda pemiliknya, dan policy storage
membandingkannya sebagai **teks** — path bisa diketik tangan, dan
`'bukan-uuid'::uuid` melempar error yang membatalkan seluruh statement alih-alih
menolaknya rapi. Hak tulisnya lewat `user_managed_org_ids()`: fungsi TANPA
parameter yang menyaring sendiri dari `auth.uid()`, mengikuti aturan di
"Jebakan yang sudah pernah menggigit" soal PostgREST.

Menghapus logo ikut membuang berkasnya, bukan cuma mengosongkan tautan —
bucketnya publik, jadi "dihapus" harus berarti dihapus.

## Perangkat bisa dihapus

`max_devices` adalah kuota berbayar, dan perangkat MENDAFTARKAN DIRINYA SENDIRI
tiap kali layar Kasir dibuka di outlet yang belum pernah dipakai. Sampai 11 Agu
tidak ada tombol hapus di mana pun — jadi angkanya cuma bisa naik, dan toko yang
kuotanya penuh tidak bisa mendaftarkan kasir baru sama sekali walaupun HP lama
sudah dijual atau rusak. Policy `devices_delete` sendiri sudah ada sejak
migrasi 0008; yang hilang cuma tombolnya.

**Ditolak kalau masih ada antrean**, bukan diperingatkan. `pending_count > 0`
berarti ada penjualan yang sudah terjadi dan uangnya sudah diterima kasir;
perangkatnya dihapus, antrean di HP itu jadi yatim dan penjualannya hilang dari
pembukuan tanpa ada yang menyadarinya. `open_rejections > 0` juga ditolak —
menghapus perangkatnya menghilangkan asal-usul transaksi yang justru sedang
diperiksa.

Tombolnya dimatikan di UI JUGA, bukan hanya ditolak server: penolakan yang baru
muncul setelah konfirmasi dua langkah terbaca seperti tombol rusak. Alasannya
sama dengan tombol Bayar yang dikunci sebelum keranjang disusun.

Transaksi lamanya aman — semua FK ke `devices` memakai `on delete set null`, dan
kode perangkat sudah tercetak di dalam nomor transaksi (TRX-…-K1-0042), jadi
asal-usulnya tetap terbaca walaupun tautannya putus.

**`.select()` pada DELETE-nya bukan hiasan:** DELETE yang ditolak RLS
mengembalikan "berhasil" dengan nol baris, bukan error. `devices_delete`
mensyaratkan owner/admin sementara gerbang aplikasinya cuma izin `settings`,
jadi kasir ber-izin settings akan melihat "dihapus" lalu barisnya tetap ada.

## Ambang stok: per produk, dan setelan toko akhirnya dipakai

Pertanyaan yang sering muncul: apakah stok minimal berlaku umum? **Tidak — sudah
per produk sejak awal.** `products.min_stock` yang dipakai `v_stock_alert` dan
`is_low_stock`, dan bisa diubah di drawer produk ("Ambang Stok Menipis").

Yang justru bermasalah setelan umumnya. `organizations.low_stock_threshold` di
Pengaturan → Toko berlabel "(bawaan)" dan keterangannya menjanjikan "Dipakai
untuk produk baru" — tapi sampai 11 Agu **tidak dibaca oleh apa pun**:
`emptyProduct()` mematok `10` di kode. Pemilik toko mengubah angkanya dan tidak
terjadi apa-apa.

Sekarang angkanya mengalir: `/produk` membacanya → `ProductTable defaultMinStock`
→ `emptyProduct(sku, defaultMinStock)`. Produk yang SUDAH ada tidak disentuh —
mengubah setelan toko tidak boleh diam-diam menimpa ambang yang sudah disetel
hati-hati per produk.

## Navigasi: menu yang href-nya menunjuk anaknya

`NavItem.section` ada untuk satu kasus: menu Pengaturan ber-`href`
`/pengaturan/toko` karena `/pengaturan` sendiri bukan halaman. Tanpa `section`,
berpindah ke tab Kategori membuat `isActivePath('/pengaturan/kategori',
'/pengaturan/toko')` bernilai false dan menunya PADAM di sidebar maupun bottom
nav — orang kehilangan jejak sedang berada di bagian mana.

`isNavItemActive()` dipakai sidebar DAN bottom nav; jangan dipisah, kalau tidak
menu yang sama menyala di satu tempat dan padam di tempat lain pada halaman yang
sama persis.

Tab pengaturannya sendiri memakai `.tabs`/`.tab`, bukan deretan `.btn.btn-sm`:
`flex: 1 1 0` menyamakan lebarnya saat muat, `min-width: max-content`
mengembalikan lebar asli saat sempit sehingga tidak ada label terpotong — di
situ barisnya jadi bisa digeser, dan tab aktif di-scroll ke dalam layar
(INSTAN — `behavior: 'smooth'` sudah pernah diabaikan diam-diam di project ini).

**Sudah diuji langsung** (11 Agu, `npm start` + browser): sidebar menyala di
seluruh tab pengaturan · unggah logo tersimpan dan langsung tampil di sidebar
serta pratinjau struk · sakelar "Tampilkan logo" akhirnya mengubah pratinjau
seketika (dulu `ToggleRow` tak mengabari induknya — sekarang ada `onToggle`) ·
K7 dihapus dan hilang dari tabel · K6 dengan 3 antrean palsu tombolnya mati
dengan alasan tertulis · produk baru mengambil ambang 7 dari setelan toko ·
390px lewat iframe bersih tanpa geser horizontal.

## Langganan sisi toko

`/pengaturan/langganan`. Sebelum ini pemilik toko TIDAK PUNYA tempat sama sekali
untuk melihat langganannya: satu-satunya petunjuk adalah `SubscriptionBanner`,
dan itu `return null` selama keadaannya normal. Jadi ia baru tahu ada masa trial
ketika tinggal 7 hari — persis momen paling buruk untuk menawarkan naik paket.

**Tanpa migrasi, dan itu bukan kebetulan.** `v_client_quota` (migrasi 0020) sudah
menyaring sendiri dengan `o.id in (select public.user_org_ids())`, dan
`subscription_events` sudah punya policy `sub_read using can_read_org(...)`.
Angka kuota yang dilihat pemilik toko karena itu PERSIS sama dengan yang dilihat
Super Admin — sumbernya satu, sesuai aturan yang sama dengan `org_usage`.

**`structuralAsInfo` di QuotaBars.** Paket Starter memberi 1 outlet dan setiap
toko punya 1 outlet sejak menit pertama, jadi tanpa flag ini halaman langganan
SETIAP klien Starter menampilkan "Outlet 1/1 · Sudah penuh" berwarna coral
selamanya, sejak hari mereka mendaftar. Warna merah yang tidak pernah bisa
dihilangkan berhenti dibaca sebagai peringatan. Dengan flag ini batas struktural
tampil sebagai keterangan tenang ("Paket ini memberi 1. Naik paket untuk
menambah."). Flagnya MATI di panel Super Admin — di sana admin sedang memeriksa
satu klien dan perlu angkanya apa adanya. Alasannya sama dengan `isStructural()`.

**Tombol WhatsApp** (`components/domain/WhatsAppButton.tsx`) memakai nomor dalam
bentuk internasional tanpa plus (`6281237597759`) — `wa.me` membaca `081…`
sebagai nomor Amerika berawalan 0 dan berujung di halaman "nomor tidak valid".
Yang DITAMPILKAN tetap bentuk lokal. Pesannya sudah terisi nama toko, paket, dan
status: pemilik warung yang mengetik sendiri hampir selalu mengirim "halo" saja,
lalu admin harus balik bertanya toko mana — dua putaran sebelum ada yang bisa
dikerjakan.

Ikon `whatsapp` adalah satu-satunya ikon di registry yang BUKAN dari wireframe.
Digambar ulang bergaya sama (stroke 1.7, viewBox 24), bukan logo resmi — tidak
ada aset bermerek yang ikut masuk repo.

## Logout harus membuang cookie kita sendiri

`supabase.auth.signOut()` hanya membuang cookie SESI. Tiga cookie milik TokoKu
(`tokoku_impersonasi`, `tokoku_toko`, `tokoku_outlet`) selamat dari logout kalau
tidak dihapus eksplisit — dan sampai 11 Agu memang tidak.

Akibatnya nyata dan sempat direproduksi: Super Admin yang sedang "Lihat sebagai
Klien" lalu menekan Keluar, lalu masuk lagi, **mendarat langsung di toko klien
itu** alih-alih di dashboardnya. Terbaca seperti logout yang gagal, dan tidak ada
apa pun di layar yang menjelaskan kenapa.

Ada akibat kedua yang lebih senyap: `impersonation_sessions` adalah jejak audit,
dan barisnya hanya ditutup oleh `stopImpersonation()`. Logout melewati jalur itu
sepenuhnya, jadi barisnya tertinggal dengan `ended_at` kosong SELAMANYA —
riwayat akses di halaman klien menyatakan Super Admin masih berada di dalam toko
itu. Sekarang `signOut()` menutupnya lebih dulu; harus SEBELUM `signOut()`,
karena RLS-nya butuh sesi yang masih hidup.

Cookie toko & outlet tidak berbahaya (keduanya divalidasi ulang terhadap
keanggotaan nyata), tapi di perangkat bersama ia membuat user berikutnya mendarat
di konteks milik orang sebelumnya. Ikut dibuang lewat `clearContextCookies()`,
yang juga dipakai jalur reset kata sandi.

## Irama vertikal halaman

`.section-title` dulu bermargin `22px 0 10px`, dan hasilnya tiap judul bagian
menempel ke kartu di atasnya — judul terbaca seperti ekor blok sebelumnya, bukan
kepala blok berikutnya. Sekarang `32px 0 14px`: jarak DI ATAS judul lebih besar
daripada di bawahnya, sehingga judul jelas milik isi yang menyusulnya.

`.wide-cols` memikul jarak atasnya sendiri (`margin-top: 32px`), karena
`.wide-cols > div > .section-title:first-child` sengaja dinolkan supaya judul
kedua kolom sejajar. Tanpa itu dua kolom di Beranda menempel persis di bawah
kartu statistik — 14px, dan itulah yang dilaporkan "mepet".

## Scan barcode

**Sudah dites pemilik project dengan HP sungguhan (12 Agu) dan bekerja.** Agen
yang membuatnya tidak pernah berhasil menjalankannya sendiri — cache POS di
mesin uji rusak setelah storage dihapus berulang — jadi bukti bekerjanya datang
dari perangkat nyata, bukan dari pengujian otomatis.

Ada di DUA tempat, dan keduanya perlu:
- **Kasir**, tombol kamera di sebelah kotak cari: memanggil produk ke keranjang.
- **Drawer produk**, di sebelah isian Barcode: mengisi barcodenya saat mendaftar
  barang. Mengetik 13 angka dari kemasan sambil melihat bolak-balik adalah cara
  paling gampang salah satu digit, dan barcode yang meleset satu digit tidak
  akan pernah ketemu saat dipindai di kasir — gagal yang baru ketahuan
  berminggu-minggu kemudian.

**Cacat lama yang ikut ditemukan:** kotak cari POS selama ini TIDAK mencari
barcode sama sekali, hanya `name` dan `sku`, padahal placeholder-nya sudah
menjanjikan "scan barcode". Jadi alat pemindai pun tidak pernah menemukan apa
pun. Sekarang barcode ikut disaring.

**Saat mengetik, hanya BARCODE yang dicocokkan, bukan SKU.** SKU pendek dan
mudah diketik penuh ("MNM-0005"); ikut dicocokkan pada tiap ketikan, kasir yang
mengetik SKU untuk MENCARI barang malah menambahkannya ke keranjang. Barcode
aman: panjang, angka semua, praktis tidak mungkin selesai diketik kecuali memang
sedang dipindai. SKU tetap dicocokkan saat Enter ditekan.

`BarcodeScanner` memakai ponyfill `barcode-detector` karena `BarcodeDetector`
bawaan browser tidak ada di Safari iOS, dan kasir di sini memakai iPhone maupun
Android. Diimpor DINAMIS supaya WASM-nya tidak ikut terunduh kasir yang tidak
pernah membuka pemindai. Ada jeda 1,5 detik per kode: kamera membaca 30 frame
per detik dan tanpa jeda satu kali arahkan menambah puluhan barang yang sama.

## CRM, poin loyalty, dan nota WhatsApp

**Fondasinya sudah ada sejak migrasi 0005 dan tidak pernah dipakai:** tabel
`customers` lengkap dengan `total_spent`/`visit_count`/`last_visit_at`, kolom
`transactions.customer_id`, policy RLS-nya, bahkan `create_transaction` sudah
menerima `customer_id` dan memperbarui statistiknya. Migrasi 0037 hanya
menambahkan poin dan menutup dua celah.

**Poin: `_apply_customer_effects` adalah SATU tempat aturannya.** Dipanggil dari
`_apply_transaction`, jadi berlaku sama untuk transaksi online maupun yang baru
tersinkron dari perangkat offline.

**Penukaran DIJEPIT ke saldo yang ada, tidak ditolak.** Transaksi offline bisa
sampai server berhari-hari kemudian dan poinnya mungkin sudah terpakai di kasir
lain. Menolaknya berarti membuang penjualan yang uangnya sudah diterima, dan
potongannya pun sudah terlanjur diberikan ke pembeli di depan kasir. Jadi yang
dikurangi cuma sebanyak yang ada; selisihnya ditanggung toko. Alasannya sama
persis dengan `product_stocks.quantity` yang boleh negatif.

**`points_earned` disimpan PER TRANSAKSI**, bukan dihitung ulang saat dibutuhkan.
Aturan poin bisa berubah; pembatalan transaksi lama harus mengembalikan angka
yang persis, bukan angka menurut aturan hari ini.

**Pembatalan dikerjakan TRIGGER, bukan di dalam `void_transaction`.** Pembatalan
bisa datang dari RPC itu maupun dari Super Admin lewat SQL, dan keduanya harus
berakibat sama. Sebelum ini pembatalan tidak menyentuh pelanggan sama sekali,
jadi penjualan yang sudah dibatalkan tetap terhitung sebagai belanja dan poinnya
mengendap di saldo pembeli.

**Pelanggan TIDAK disaring per outlet**, beda dengan hampir semua halaman lain.
Orang yang sama berbelanja di cabang mana pun dan poinnya satu. Disaring per
cabang, kasir di Renon tidak menemukan pelanggan yang tadi pagi didaftarkan di
cabang utama lalu membuatnya lagi, dan saldo poinnya terpecah dua.

**Nomor HP dinormalkan ke bentuk `62…`** (`lib/phone.ts`). Tanpa itu `0812…`,
`+62812…`, dan `62812…` jadi tiga pelanggan berbeda dengan poin terpecah tiga.
Yang DITAMPILKAN tetap bentuk lokal lewat `hpLokal()`.

**Segmentasi sengaja tiga saja** (belum pernah belanja / sering datang / lama tak
datang), dengan batas bulat. Pemilik warung tidak menghitung recency-frequency;
segmen yang lebih halus tidak mengubah tindakan apa pun yang bisa ia ambil.

**Nota dikirim lewat DUA jalur, dan keduanya ada karena saling menutup
kelemahan.**

*Gambar (utama).* Struk digambar ulang ke canvas jadi PNG lalu dibagikan lewat
share sheet perangkat. Itu **satu-satunya cara melampirkan berkas ke WhatsApp
dari web**: tautan `wa.me` hanya bisa mengisi teks, tidak bisa melampirkan apa
pun — batasan WhatsApp, bukan aplikasi kita. Tidak perlu nomor sama sekali;
kasir memilih kontaknya di dalam WhatsApp. Dipilih PNG dan bukan PDF karena
gambar tampil LANGSUNG di dalam chat, sementara PDF muncul sebagai lampiran yang
harus ditekan dulu.

*Teks (cadangan).* Perlu nomor, tapi jalan di perangkat mana pun termasuk
desktop, dan isinya bisa dicari pembeli di riwayat chat berbulan-bulan kemudian.

`lib/receipt-image.ts` menggambar sendiri ke canvas, bukan memotret DOM dengan
html2canvas: yang dibutuhkan cuma teks monospace di atas latar putih, dan satu
dependensi 200 KB untuk itu tidak sepadan di aplikasi yang dipakai lewat
jaringan warung. Lebarnya 384 piksel karena itu jumlah titik satu baris printer
thermal 58mm. **Tingginya ditaksir berlebih lalu DIPOTONG** sesuai isi
sebenarnya — menghitung tepat di depan berarti aturan tinggi ditulis dua kali,
dan begitu ada baris baru ditambahkan tanpa memperbarui hitungannya, struknya
terpotong diam-diam.

`bagikanGambar()` mengembalikan `'shared' | 'downloaded' | 'cancelled'` supaya
pemanggil bisa mengatakan apa yang sebenarnya terjadi. Menutup share sheet
melempar `AbortError`; itu bukan kegagalan dan tidak boleh dilaporkan sebagai
error ke kasir.

Tombolnya ada di detail transaksi DAN di layar sukses kasir. Yang kedua justru
yang paling berguna: pembelinya masih berdiri di depan dan nomornya bisa
ditanyakan langsung. Nota transaksi BATAL tidak bisa dikirim — alasannya sama
dengan penanda batal di struk cetak.

**Sudah diuji langsung ke database** (12 Agu): poin 50 − 20 tukar + 15 dapat =
45, pembatalan mengembalikan poin/belanja/kunjungan ke keadaan semula, dan
permintaan tukar 9999 poin dijepit ke saldo 50 tanpa menolak transaksinya.
Di browser: pelanggan ditambah dengan nomor `0812-3456-7890` yang ternormalkan
ke `6281234567890` dan tampil kembali sebagai `081…`, dan tautan WhatsApp
terbentuk lengkap dengan rincian item, total, serta metode bayarnya.

## Kolom komersial organizations dikunci

**Temuan paling serius dari audit pra go-live 11 Agu.** Policy `org_update`
(migrasi 0008) mengizinkan pemilik toko meng-UPDATE `organizations` tanpa
batasan KOLOM sama sekali — RLS Postgres bekerja per BARIS, bukan per kolom,
jadi "boleh mengubah barisnya" berarti boleh mengubah semua isinya.

Seluruh penegakan langganan karena itu bisa dilewati dengan satu panggilan REST
memakai sesi pemilik toko sendiri. Sudah dibuktikan pada Warung Rina:

    PATCH /rest/v1/organizations?id=eq.<org>
    { "status": "active", "plan_id": "<enterprise>", "trial_ends_at": "2099-01-01" }
    → HTTP 200, 1 baris terpengaruh

Paket Enterprise gratis, trial 73 tahun, dan kuota ikut naik karena `org_quota()`
membaca `plan_id` sementara `org_lapsed_at()` membaca `status` dan
`trial_ends_at` dari baris yang barusan ditulis sendiri oleh kliennya. Anon key
ada di setiap bundel browser, jadi tidak ada yang perlu dibobol.

**Ditambal TRIGGER, bukan column grant.** `grant update (kolom, …)` sebenarnya
cara paling langsung dan diperiksa sebelum RLS — tapi Super Admin memakai role
Postgres yang SAMA (`authenticated`) dengan klien biasa; ia dibedakan oleh
`is_platform_admin()` di dalam policy, bukan oleh role database. Column grant
akan mengunci Super Admin juga dan mematikan panel ganti paket di `/admin/klien`.
Trigger bisa menanyakan siapa pemanggilnya.

Yang dikunci: `plan_id`, `status`, `trial_ends_at`, dan `deleted_at`. Yang
terakhir bukan sekadar kehati-hatian: penghapusan tenant memang dibatasi Super
Admin lewat `org_admin_delete`, tapi seluruh aplikasi memakai SOFT delete, dan
mengisi `deleted_at` lewat UPDATE melenyapkan toko dari setiap halaman tanpa
melewati policy itu sama sekali.

Karena kolom komersialnya aman, `org_update` dilonggarkan dari owner-only ke
`can_manage()` (owner + admin). Itu sekaligus memperbaiki Admin Toko yang selama
ini menekan Simpan di Pengaturan → Toko dan melihat "Informasi toko tersimpan."
padahal nol baris berubah.

## Masa coba gratis milik AKUN, bukan toko

Sejak multi-toko dibuka, satu akun boleh memiliki 5 toko dan tiap toko diberi
masa coba 14 hari yang baru: 5 toko = 70 hari gratis, tanpa gerbang apa pun di
depannya karena pendaftaran toko tidak berbayar.

Migrasi 0034: toko kedua dan seterusnya memakai `trial_ends_at` yang SAMA dengan
toko pertama yang dimiliki akun itu. Buat toko ke-2 di hari ke-3 trial, ia ikut
berakhir di hari ke-14. Buat setelah trial habis, ia lahir sudah lewat masa coba
dan diantar ke `/pengaturan/langganan` — bukan ke beranda dengan spanduk merah,
yang terbaca seperti toko yang rusak sejak lahir.

Berbagi tanggal, bukan menolak trial sama sekali: orang yang benar-benar punya
dua usaha sering mendaftarkan keduanya di hari yang sama, dan menolak mentah-
mentah membuat toko keduanya lahir mati padahal ia masih di tengah masa coba
yang sah.

Migrasi 0035, ditemukan saat menguji 0034: `register_store` menghitung jatah 5
toko dan memeriksa nama kembar tanpa melihat `deleted_at`. Toko yang dihapus
Super Admin karena itu tetap memakan slot DAN mengunci namanya selamanya.

## Kuota paket

Empat batas ditegakkan: `max_outlets` · `max_users` · `max_products` ·
`max_devices`. NULL berarti tak terbatas; organisasi tanpa paket juga tak
terbatas — jangan pernah mengunci toko hanya karena `plan_id` belum diisi.

Penegakannya di database (trigger BEFORE INSERT), bukan di aplikasi. Dua sebab
konkret: INSERT yang ditolak RLS mengembalikan "berhasil" dengan 0 baris
sehingga gerbang di aplikasi mudah bocor tanpa jejak, dan perangkat POS
mendaftarkan dirinya lewat RPC saat sinkronisasi — gerbang yang hanya ada di
form akan dilewati begitu saja.

Penolakan memakai SQLSTATE **TK001** dengan pesan berbahasa Indonesia yang sudah
siap ditampilkan apa adanya. Semua jalur pemanggilnya sudah meneruskan pesan itu
ke user.

`org_usage()` adalah SATU sumber kebenaran untuk "terpakai berapa" — dipakai
trigger sekaligus panel kuota Super Admin. Jangan menghitung ulang di tempat
lain; angka yang dilihat admin harus sama dengan angka yang dipakai menolak.

Dua seluk-beluk yang sudah diuji dan jangan diubah tanpa alasan:
- **'users' vs 'members'.** `users` = anggota aktif + undangan yang masih
  menunggu (kalau tidak, kuota bisa dilewati dengan mengundang 50 orang
  sekaligus). Tapi saat undangan DITERIMA, barisnya masih tercatat sebagai
  undangan menunggu — jadi trigger pada `organization_members` memakai
  `members` saja, kalau tidak orang yang sama terhitung dua kali dan penerimaan
  yang masih muat malah ditolak.
- **Hanya pada INSERT.** Toko yang turun paket tidak kehilangan data apa pun; ia
  hanya tidak bisa menambah sampai kembali di bawah batas.
- **Batas 1 bukan alarm** (`isStructural()` di QuotaBars). Starter memberi 1
  outlet dan setiap toko punya 1 outlet sejak menit pertama, jadi "Outlet 1/1
  penuh" berlaku permanen untuk SEMUA klien Starter. Sempat terpasang begitu dan
  dashboard langsung penuh peringatan palsu — warna merahnya jadi tidak berarti
  saat peringatan sungguhan muncul. Tetap ditampilkan di panel detail (di sana
  admin sedang memeriksa satu klien), hanya tidak diperlakukan sebagai alarm.

Insert massal tetap terjaga: trigger BEFORE ROW ikut melihat baris-baris
sebelumnya dari statement yang sama. Sudah diuji — batas 3 meloloskan tepat 3
dalam satu statement lalu menolak yang ke-4.

## Status langganan

`org_lapsed_at()` menentukan kapan akses berakhir: `status_changed_at` untuk
`suspended`/`inactive`, `trial_ends_at` untuk trial yang lewat, NULL kalau masih
aktif. Trial tanpa tanggal dianggap aktif — jangan mengunci toko hanya karena
tanggalnya belum diisi.

Penambahan data biasa (produk, outlet, anggota, undangan, perangkat) ditolak
dengan **TK002**.

**Transaksi diperlakukan berbeda, dan ini yang paling menentukan.** Seluruh
transaksi POS masuk lewat `sync_transactions`, online maupun offline — jadi
memblokirnya mentah-mentah ikut membuang penjualan yang sudah benar-benar
terjadi di warung. Gerbangnya memakai `client_created_at`:

    bertanggal SEBELUM langganan berakhir  → tetap diterima
    bertanggal SESUDAHnya                  → ditolak satuan

Penolakan satuan aman karena `sync_transactions` membungkus tiap transaksi dalam
savepoint + `exception when others`: yang ditolak masuk `sync_rejections` lengkap
dengan pesannya, sisanya tetap tersimpan.

Ada toleransi 5 menit dari saat penangguhan supaya kasir bisa menyelesaikan
pembeli yang sedang di depannya.

**Batasnya jujur:** ini gerbang komersial, bukan batas keamanan. `client_created_at`
datang dari jam perangkat, jadi jam yang mundur bisa menembusnya. Kolom yang sama
memang sudah dipercaya untuk laporan (lihat aturan di atas), dan memundurkan jam
juga merusak laporan toko itu sendiri. Kalau nanti perlu lebih ketat, tempatnya
di `sync_transactions`, bukan di trigger ini.

### Sisi toko

`lib/subscription.ts` menghitung ulang keadaan langganan di aplikasi. Aturannya
HARUS persis sama dengan `org_lapsed_at()` di database — kalau berbeda, toko
melihat "aman" lalu ditolak saat menekan Bayar, di depan pembeli. Sengaja tidak
memanggil `org_is_active()`: fungsi itu tidak boleh dipanggil dari luar.

Tombol Bayar dikunci SEBELUM keranjang disusun, bukan dibiarkan gagal saat
ditekan — kasir tidak boleh terlanjur memindai belasan barang dulu. Lapis
keduanya tetap ada di `handlePay()`.

## Isolasi cache offline

IndexedDB dan localStorage melekat pada **browser**, bukan pada toko. Sebelum
diperbaiki, satu browser yang pernah membuka dua toko menampilkan katalog
keduanya bercampur di POS: kategori dobel, produk toko lain ikut muncul di grid
dan bisa masuk keranjang. Server tetap menolaknya, tapi bagi pemilik toko itu
terbaca sebagai kebocoran data. Kena saat Super Admin memakai "Lihat sebagai
Klien", saat satu perangkat dipakai staf dua toko, dan saat orang pindah toko.

Tiga lapis, sengaja tidak saling bergantung:

1. **Stempel tenant** (`organization_id`) pada `products`/`categories`/`stocks`
   di Dexie v3, dan SEMUA pembacaan disaring dengannya. Stempelnya diambil dari
   argumen, bukan dari payload `pull_catalog` — payload itu baris mentah yang
   bentuknya bisa berubah, dan saringan antar toko tidak boleh bergantung
   padanya. Baris lama tanpa stempel otomatis tidak lolos saringan.
2. **`ensureTenant()`** mengosongkan cache saat toko berganti, termasuk meta
   `device` / `last_pull_at` / `last_sync_at` yang isinya milik satu toko.
3. **`bindOrg()`** di store keranjang. Sengaja TIDAK menumpang deteksi
   `ensureTenant`: pernah begitu, dan gagal — `active_org` sudah terlanjur
   tercatat, jadi tidak pernah terdeteksi "berganti" dan keranjang toko lain
   tetap terbawa lengkap dengan totalnya.

`outbox` TIDAK PERNAH ikut dibuang: isinya penjualan yang sudah terjadi dan
uangnya sudah diterima kasir. Tiap barisnya membawa `organization_id` sendiri,
dan `flush()` menyaring dengannya — tanpa saringan itu antrean toko A terkirim
atas nama toko B, ditolak server, lalu ditandai 'rejected' di perangkat.

## Laporan shift

`v_shift_summary` (migrasi 0022) — satu baris per shift: kasir, perangkat,
jumlah transaksi, penjualan tunai/non-tunai, dan selisih kas. `security_invoker`
biasa, tanpa fungsi SECURITY DEFINER, supaya tidak mengulang jebakan kebocoran
lintas tenant di migrasi 0019.

Halamannya `/laporan/shift`, ditautkan dari `/laporan` — sengaja BUKAN item nav
baru: bottom nav mobile sudah pas 5 slot, menambah satu lagi akan mendorong menu
lain masuk lembar "Lainnya".

Dua keputusan tampilan yang disengaja:
- **Shift berjalan tidak dihitung selisihnya.** Kasnya memang belum dihitung;
  memasukkannya sebagai "0" akan menyamarkan selisih yang nyata.
- **Selisih nol tidak diberi warna.** Hanya yang tidak cocok yang berwarna
  coral. Mewarnai keadaan normal membuat mata berhenti membedakan mana yang
  perlu ditindaklanjuti.

## Kartu stok

`/produk/[id]`, dicapai lewat nama produk di tabel Produk — sengaja bukan tombol
aksi baru: baris itu sudah padat tiga tombol, dan di layar sempit tombol
keempat akan terdorong ke luar.

`stock_movements` **append-only**: tidak ada policy UPDATE maupun DELETE untuk
siapa pun, termasuk pemilik toko. Itu disebutkan terang-terangan di halamannya —
kalau ada angka keliru, perbaikannya lewat opname supaya koreksinya ikut
tercatat, bukan dengan menghapus jejak.

`sync_correction` diberi kalimat sendiri, tidak disamakan dengan "Koreksi":
ia muncul karena transaksi offline baru sampai server belakangan, dan pemilik
toko yang melihat stoknya berubah tanpa ada penjualan hari itu berhak tahu
penyebabnya.

Catatan data demo: seed menulis baris "Stok awal" SETELAH beberapa transaksi,
jadi saldo berjalannya terlihat melompat di data contoh. Bukan bug — ledger
memang menampilkan urutan penulisan apa adanya.

## Pembelian

Dua keputusan yang disepakati, jangan diubah tanpa alasan baru:

**Pembelian langsung menambah stok.** Tidak ada langkah "terima barang"
terpisah — pemisahan itu berguna kalau yang memesan dan yang menerima orang
berbeda; di warung keduanya orang yang sama dan barangnya sudah di tangan.

**Stok dan pembayaran dua sumbu terpisah.** Stok naik seketika; status bayar
berdiri sendiri (`paid` / `credit` + `due_date`). Digabung jadi satu status,
pembayaran sebagian tidak punya tempat.

**HPP = harga beli terakhir, naik MAUPUN turun.** Usulan awal "hanya kalau lebih
tinggi" ditolak: harga beli turun itu biasa pada barang yang paling banyak
diputar warung (beras, minyak, telur, cabai), dan batas satu arah membuat laba
kotor dilaporkan lebih kecil dari kenyataan secara permanen — errornya menumpuk
dan tidak pernah terkoreksi balik. Aman karena HPP sudah di-snapshot saat
penjualan terjadi (`transactions.cost_total`, `transaction_items`,
`stock_movements.unit_cost`), jadi mengubahnya TIDAK menulis ulang laporan masa
lalu. Kalau nanti perlu jaga-jaga salah ketik, obatnya konfirmasi saat selisih
ekstrem — bukan distorsi permanen.

Pengingat jatuh tempo muncul di Beranda (14 hari ke depan, telat lebih dulu)
dan di halaman Pembelian. Hitungannya pakai selisih HARI KALENDER, bukan selisih
jam — memakai selisih waktu membuat nota yang jatuh tempo lusa tertulis "3 hari
lagi" karena orang menghitung tanggal, bukan durasi.

Semuanya lewat RPC `create_purchase`: nota + stok naik + HPP diperbarui dalam
satu transaksi. Jangan dirangkai dari aplikasi — kegagalan di tengah menyisakan
stok naik tanpa notanya.

**Sudah diuji simpan sungguhan** (10 Agu, masuk sebagai `rina@tokodewi.id` —
mode "Lihat sebagai Klien" tidak bisa dipakai, `user_can()` menolak Super Admin
karena bukan anggota toko). Chitato Kentang 68g dibeli 24 pcs @ Rp 8.000:
stok 2 → 26, HPP 8.500 → **8.000** (turun, membuktikan aturan dua arah), dan
baris "Barang masuk · Pembelian PB-20260810-0001" muncul di kartu stok.

**Pembagian paket** memakai `purchasing`: `basic` = catat barang masuk saja,
`full` = pemasok, tempo, hutang, konsinyasi. Dibaca lewat `getPlanFeatures()` —
jangan menyentuh `plans.features` langsung dari halaman. Lihat "Pembagian paket".

## Konsinyasi

Titip jual. `/pembelian/konsinyasi` — sengaja di bawah Pembelian, BUKAN item nav
baru: bottom nav ponsel sudah pas 5 slot. Polanya sama dengan `/laporan/shift`.

Bedanya dengan Pembelian, dan kenapa tidak digabung: pembelian membuat barang
jadi milik toko dan hutang lahir seketika sebesar seluruh nota. Titipan tetap
milik pemasok; hutang lahir HANYA sebesar yang terjual, sisanya pulang lewat
retur tanpa uang berpindah. Digabung, laporan hutang dagang menagih uang atas
barang yang masih menumpuk di rak.

**Bagi hasil KUMULATIF, bukan per rentang tanggal.** Ini keputusan paling
menentukan di modul ini:

    yang harus disetor = seluruh terjual sampai detik ini − seluruh yang sudah disetor

Cara lazim "setorkan penjualan 1–31 Agustus" tidak aman di sini: transaksi POS
bisa dibuat offline dan baru sampai server berhari-hari kemudian. Dipatok rentang
tanggal, penjualan yang datang setelah periodenya ditutup tidak akan pernah masuk
setoran mana pun — pemasok kehilangan haknya diam-diam. Kumulatif membuatnya
otomatis ikut di setoran berikutnya.

Karena itu pula angka terjual dibaca dari `stock_movements.created_at` (jam
server), **bukan** `client_created_at` seperti aturan laporan pada umumnya. Yang
ditanya bukan "penjualan tanggal berapa" melainkan "apa yang sudah tercatat dan
belum dibayar" — dan itu sekaligus menutup celah jam perangkat yang mundur pada
jalur yang berujung ke uang.

`v_consignment_summary` adalah SATU sumber kebenaran: dipakai halaman sekaligus
oleh RPC yang menghitung setoran. Alasannya sama dengan `org_usage` — angka yang
dilihat pemilik toko harus sama persis dengan angka yang dipakai membayar.
`security_invoker`, tanpa fungsi SECURITY DEFINER di dalamnya; RPC membacanya
dari dalam fungsi definer setelah `user_can(p_org,'products')` lolos.

Yang sudah diuji dan jangan diubah tanpa alasan:
- **Jenis stok sendiri** (`consign_in` / `consign_return`, migrasi 0025 terpisah —
  `alter type ... add value` tidak boleh dipakai di transaksi yang sama).
  Menumpang `purchase` membuat hutang lahir terlalu dini; menumpang `return`
  membuat tiap retur titipan terbaca sebagai pembatalan penjualan dan bagi
  hasilnya susut.
- **Satu produk = satu titipan aktif** (unique index parsial). Tanpa itu
  "yang terjual ini haknya siapa" tidak punya jawaban tunggal.
- **HPP = harga titip.** Biaya toko atas tiap satuan titipan yang terjual memang
  persis hak pemasok, jadi laba kotor di Laporan langsung benar.
- **Produk tanpa `track_stock` ditolak.** Penjualannya tidak meninggalkan jejak
  di `stock_movements`, dan itu satu-satunya dasar bagi hasil — diterima
  diam-diam, pemasok selamanya dibayar nol.
- **Harga titip tidak bisa diubah selagi ada yang belum disetor.** Mengubahnya
  ikut mengubah nilai hutang yang sudah terbentuk, tanpa ada yang menyetujui.
- **Setoran ditulis SATU statement (CTE), bukan loop.** View-nya ikut membaca
  `consignment_settlement_items`; menyisipkan sambil loop membuat tiap iterasi
  membaca angka yang baru diubah iterasi sebelumnya.
- **Retur berlebih ditolak** — beda dengan aturan stok minus. Ini isian manual
  saat online, bukan antrean offline yang sudah benar-benar terjadi.

**Batasnya, dan ini nyata:** kasir hanya mencatat PRODUK, bukan pemilik tiap
satuannya. Kalau toko masih punya stok sendiri atas produk yang sama, setiap
penjualan tetap dihitung sebagai hak pemasok. Tidak dilarang — kadang memang stok
lama tinggal sedikit — tapi drawer memperingatkannya sebelum disimpan dan
menyarankan produk terpisah untuk barang titipan.

**Sudah diuji ujung ke ujung** (10 Agu, sebagai `rina@tokodewi.id`): terima 20 pcs
@ Rp 3.500 → stok 54→74 dan HPP 3.800→3.500 · jual 5 di kasir → belum disetor
Rp 17.500 · setor BH-20260810-0001 → hutang Rp 0 · retur 99 ditolak, retur 15
diterima → sisa 0 · tutup titipan. Kartu stok menampilkan "Titipan masuk" dan
"Retur titipan". 390px sudah ditelusuri lewat iframe, tanpa geser horizontal.

Ikut gerbang paket `purchasing = 'full'` (halaman redirect ke `/pembelian` kalau
bukan): konsinyasi tidak bisa berdiri tanpa pemasok.

## Multi-outlet

Skema sudah mendukung banyak outlet sejak migrasi 0003. Yang ditambahkan 0027–0028
adalah cara MEMBUAT outlet kedua dan cara BERPINDAH ke sana.

**OUTLET BUKAN BATAS KEAMANAN.** Seluruh policy RLS disaring per ORGANISASI,
bukan per outlet — anggota yang boleh membaca satu cabang secara teknis boleh
membaca semuanya. Outlet di sini adalah KONTEKS KERJA ("saya sedang jaga di
cabang mana"), bukan pagar hak akses. Kalau nanti perlu kasir yang hanya boleh
menyentuh satu cabang, itu butuh tabel penugasan (member × outlet) DAN policy RLS
yang ikut menyaringnya; membatasinya di UI saja cuma teater.

**`session.outletId` adalah outlet AKTIF**, bukan lagi `default_outlet_id`.
Itu satu-satunya sambungan — POS, stok, laporan, pembelian, konsinyasi, dan
printer semuanya sudah membacanya, jadi berpindah cukup mengganti cookie
`tokoku_outlet`. Cookie SELALU divalidasi ulang terhadap daftar outlet organisasi
(`pickOutlet()` di `lib/auth.ts`): cookie bisa diketik tangan, dan `outlet_id`
toko lain yang lolos akan tertulis ke transaksi baru — RLS tidak menyaring per
outlet, jadi INSERT-nya lolos dan penjualan mendarat di cabang yang salah.
Cookie basi tidak dianggap error; ia jatuh mulus ke `default_outlet_id` lalu ke
outlet utama.

**`v_product_stock` sekarang satu baris per produk PER OUTLET** (migrasi 0028).
Bentuk lamanya `products LEFT JOIN product_stocks ON product_id` tanpa menyebut
outlet — kebetulan benar selama cuma ada satu outlet. Begitu cabang kedua dibuat,
produk yang belum punya stok di sana tidak punya baris sama sekali, sehingga
`where outlet_id = <cabang baru>` membuang semuanya: halaman Produk dan grid
Kasir tampil KOSONG, tanpa error. **Setiap query ke view ini WAJIB menyaring
`outlet_id`** — tanpa itu produk muncul berulang per cabang dan `maybeSingle()`
gagal.

Empat hal yang harus dibuang saat berpindah outlet, dan sudah ditangani:
- **`stocks` di Dexie** — angkanya milik satu outlet.
- **meta `last_pull_at`** — `pull_catalog` mengirim stok hanya untuk outlet yang
  diminta. Dibawa pindah, sinkronisasi pertama di cabang baru menjawab "tidak ada
  perubahan" dan semua produk tampil stok 0 padahal raknya penuh.
- **meta `device`** — perangkat terdaftar per outlet dan kodenya ikut ke nomor
  transaksi. Ditambah lagi: memo `getOrRegisterDevice()` dikunci per outlet,
  karena promise yang sudah tersimpan di tingkat modul tidak ikut terbuang saat
  metanya dihapus.
- **keranjang** (`bindOrg(org, outlet)`) — keranjang yang disusun di cabang A
  lalu dibayar setelah pindah ke B mengurangi stok B atas barang dari rak A.
  Server menerimanya tanpa keluhan; selisihnya baru ketahuan saat opname.

Produk & kategori TIDAK dibuang saat pindah cabang — keduanya milik organisasi,
dan menariknya ulang di jaringan warung yang buruk tidak mengamankan apa pun.

**Kuota:** `max_outlets` di database adalah SATU sumber kebenarannya.
`plans.features->>'multi_outlet'` sengaja TIDAK dipakai — ia bisa berkata "boleh"
sementara kuotanya berkata "penuh". Outlet yang dinonaktifkan tetap memakan
jatahnya (`org_usage` menghitung baris yang belum di-soft-delete, tanpa memandang
`is_active`), jadi mengaktifkannya kembali bukan lubang kuota.

Trigger `enforce_outlet_invariants` menolak menonaktifkan outlet utama maupun
outlet aktif terakhir: tanpa itu `session.outletId` jadi null dan kasir tidak bisa
dibuka sama sekali — baru terasa besok pagi saat antrean sudah mengular.

**Topbar di 390px:** brand + pemilih outlet + tiga tombol tidak muat bersamaan.
Yang dilepas adalah TEKS brand (`.topbar.has-outlet-switch .brand-name`), dan
HANYA saat outletnya lebih dari satu — toko satu outlet topbarnya persis seperti
sebelum ini ada. Nama tokonya tidak hilang; `page-eyebrow` masih menyebutnya.

**Sudah diuji ujung ke ujung** (10 Agu): kuota penuh di Starter (tombol mati) ·
buat "Cabang Renon" dengan kode otomatis OUT-2 · pemilih muncul di topbar ·
pindah cabang → Produk menampilkan 9 produk stok 0 (bukan kosong) · POS di cabang
baru mendaftarkan perangkat K1 sendiri dan stoknya 0, bukan sisa cabang lama ·
pembelian 12 Aqua di Renon TIDAK mengubah stok MAIN (28 tetap 28) · 390px tanpa
geser horizontal.

### Semua halaman disaring per outlet

Bukan kerapian — tiap saringan di bawah ini menutup salah paham yang nyata.
Aturannya: **kalau angkanya milik satu cabang, saringnya wajib.**

| halaman | kenapa |
|---|---|
| Beranda (`v_daily_sales`) | dulu `maybeSingle()` — dua cabang jualan di hari yang sama membuat halaman pertama yang dibuka pemilik toko tiap pagi **gagal dimuat** |
| Beranda (`v_stock_alert`) | cabang yang baru dibuka (stok nol untuk semua produk) membanjiri beranda cabang lama dengan peringatan restock palsu |
| Beranda (transaksi terbaru) | daftar tanpa kolom cabang |
| Transaksi & Riwayat | sama — nomor transaksi membawa kode perangkat, tapi tidak ada yang bisa membaca cabang dari situ |
| Kartu stok (`stock_movements`) | kolom "Sisa" adalah saldo BERJALAN; dicampur, angkanya melompat 6 → 33 → 11 seolah stoknya kacau padahal tiap cabang runut sendiri |
| Laporan Shift | "kasir siapa yang jaga" dan "uang di laci cocok atau tidak" kehilangan tempatnya kalau digabung lintas cabang |

**Laporan menjumlahkan per tanggal, bukan mengambil satu baris per tanggal.**
`v_daily_sales` dikelompokkan per (organisasi, outlet, tanggal). Dulu barisnya
dimasukkan ke `Map` berkunci tanggal — dengan dua cabang, baris kedua MENIMPA
yang pertama, sehingga grafik dan tabel Rincian Harian menampilkan omset satu
cabang sementara ringkasan di atasnya (reduce atas semua baris) menjumlahkan
keduanya. Dua angka berbeda untuk hal yang sama, di layar yang sama.

`v_product_sales` diberi `outlet_id` di migrasi 0029 — sebelumnya ia satu-satunya
bagian Laporan yang tidak bisa disaring per cabang, jadi "Produk Terlaris" diam
sementara seluruh angka lain berubah. Kolomnya ditaruh di URUTAN TERAKHIR:
`create or replace view` hanya boleh menambah kolom di ujung.

**Cakupan Laporan** bawaannya mengikuti outlet aktif, dengan pilihan eksplisit
per cabang + "Semua outlet". Pilihan itu ikut terbawa saat berpindah periode
(`scopeParam`), kalau tidak berpindah rentang diam-diam mengembalikannya ke
outlet aktif.

### Transfer stok

`transfer_stock` (migrasi 0030) — **satu RPC, dua sisi**. Dirangkai dari aplikasi
sebagai dua `adjust_stock`, kegagalan di antaranya menghilangkan barang: stok
asal sudah turun, tujuan belum naik, dan tidak ada yang mencatat bahwa barangnya
sedang di jalan. Kedua baris ledgernya menunjuk `ref_id` yang sama.

**Tidak ada status "dalam perjalanan".** Yang memindahkan barang antar cabang
warung adalah pemiliknya sendiri, hari itu juga, naik motor. Alasannya sama
persis dengan tidak adanya langkah "terima barang" di Pembelian.

**Kelebihan ditolak** — berbeda dengan aturan stok minus pada penjualan. Stok
minus di penjualan itu kenyataan yang sudah terjadi; menolaknya membuang catatan
uang masuk. Transfer adalah isian manual saat online: kelebihannya salah ketik,
dan diterima diam-diam ia menciptakan barang dari udara di cabang tujuan.

Outlet **asal** boleh tidak aktif (memindahkan sisa barang keluar dari cabang
yang baru ditutup justru salah satu alasan fitur ini ada); **tujuan** wajib aktif.
Asal selalu outlet yang sedang dibuka — angkanya sudah dirender server untuk
outlet itu, dan mengambil ulang stok cabang lain di tengah pengisian borang
berarti satu putaran jaringan lagi.

**Sudah diuji** (10 Agu): jual 1 Aqua QRIS di Renon · Laporan MAIN Rp 95.000 +
Renon Rp 50.000 = **Semua Rp 145.000** pada baris tanggal yang sama (laba 19.500
+ 8.000 = 27.500) · transfer 99 ditolak sebelum simpan, 5 diterima → Renon 11→6,
MAIN 28→33 · kartu stok Renon runut 12 → 11 → 6.

### Perbandingan antar cabang

Muncul di Laporan **hanya saat cakupannya "Semua outlet"** — batang peringkat
(`RankedBars`, warna seri tunggal yang sudah tervalidasi, tidak ada palet baru)
disusul tabel angkanya. Batang menjawab "mana yang lebih besar" dalam sekejap;
tabel menjawab "berapa persisnya" tanpa menebak dari panjang batang.

`outlet_id` ikut diambil di query harian yang sama, jadi barisnya dipakai dua
kali — dijumlahkan per tanggal untuk grafik, per cabang untuk perbandingan.
Satu query, bukan dua.

**Cabang yang belum berjualan tetap ditampilkan dengan nol.** Dibuang dari
daftar, cabang yang sedang sepi jadi tidak terlihat — padahal nol adalah jawaban
yang paling perlu dilihat.

### Riwayat transfer

`/produk/transfer` — di bawah **Produk**, bukan Pengaturan, dan itu memperbaiki
celah izin yang sempat ada: `transferStock` butuh `products` (memindahkan barang
adalah operasi stok), tapi satu-satunya tombolnya ada di halaman Outlet yang
butuh `settings`. Admin toko yang mengurus stok tanpa memegang pengaturan tidak
punya jalan sama sekali ke fitur yang secara aturan boleh ia pakai. Tombol di
halaman Outlet tetap ada — pemilik yang sedang berpikir soal cabang mencarinya
di sana. Dua pintu, satu tindakan.

Riwayatnya menampilkan **seluruh perpindahan toko**, TIDAK disaring outlet aktif
— beda dengan halaman lain. Sebuah transfer punya dua sisi dan keduanya
sama-sama nyata; disaring, nota yang sama hilang dari layar begitu orang
berpindah ke cabang lawannya. Isi notanya disebut apa adanya ("Aqua 600ml 5 pcs"),
karena "5 satuan" saja tidak bisa dicocokkan dengan barang yang benar-benar
berpindah saat ada perselisihan.

**Sudah diuji** (10 Agu): Per Cabang menampilkan 950.000 (95%, 16 trx) +
50.000 (5%, 1 trx) = 1.000.000 dan laba 148.000 + 8.000 = 156.000, cocok dengan
ringkasan di atasnya · riwayat transfer menampilkan TF-20260810-0001 lengkap
dengan isinya · drawer terbuka dari kedua pintu dengan stok cabang yang benar ·
390px bersih, tabel perbandingan menumpuk dengan label "Transaksi"/"Laba".

## Transaksi batal harus terlihat batal

Ditemukan saat cross-check 10 Agu, dan ini cacat paling lama berdiri di project:
`status` tidak pernah diambil maupun ditampilkan di daftar Transaksi & Riwayat.
Transaksi yang sudah DIBATALKAN tampil persis seperti yang sah — nominal penuh,
badge metode bayar seperti biasa, tanpa penanda apa pun. Pemilik toko yang
menyusuri daftar itu menghitung uang yang tidak pernah masuk.

Sekarang barisnya diredupkan, badge metode diganti "Dibatalkan", dan nominalnya
dicoret. **Dicoret, bukan disembunyikan** — barisnya tetap harus ada supaya nomor
transaksinya tidak terlihat hilang dari urutan.

**Struknya juga.** `Receipt` sempat mencetak transaksi void persis seperti struk
sah: pembeli memegang bukti pembayaran atas transaksi yang uangnya sudah
dikembalikan, dan tidak ada apa pun di kertas itu yang membantah. Sekarang ada
`voided` yang mencetak `*** TRANSAKSI DIBATALKAN ***` di **paling atas**, sebelum
nama toko — struk thermal sering disobek sebelum habis, jadi penanda di bawah
tidak menolong.

## Aturan cakupan outlet — kapan menyaring, kapan TIDAK

Cross-check 10 Agu menemukan beberapa halaman yang masih mencampur cabang.
Pertanyaannya ternyata bukan "sudah disaring belum" melainkan **apa yang lebih
berbahaya: tercampur, atau tersembunyi.**

**DISARING per outlet** — kalau tercampur membuat angkanya salah dibaca:

| halaman | kalau tidak disaring |
|---|---|
| Beranda, Transaksi, Riwayat, Kartu stok, Laporan Shift | lihat tabel di "Multi-outlet" |
| **Sinkronisasi** (perangkat + riwayat kirim) | kode perangkat hanya unik DI DALAM outlet, jadi toko dua cabang menampilkan dua baris "Kasir K1" tanpa kolom pembeda — dan di sinilah perangkat dihapus. Salah pilih = mencabut kasir cabang yang sedang berjualan |

**TIDAK disaring, dan ini disengaja** — kalau tersembunyi ada uang yang hilang
dari pandangan:

| halaman | alasan |
|---|---|
| **Penolakan sinkronisasi** | tiap penolakan adalah penjualan yang gagal masuk. Disaring, pemilik di cabang A tidak akan pernah tahu ada transaksi cabang B yang gagal — dan tidak ada apa pun di layar yang memberi tahu ada yang disembunyikan |
| **Pembelian** | nota tempo adalah HUTANG TOKO, dibayar dari kas yang sama. Disaring, tagihan cabang lain hilang dari daftar DAN dari spanduk "belum lunas" |
| **Konsinyasi** | alasannya paling keras: `settle_consignment` menghitung bagi hasil lintas outlet. Disaring, angka "belum disetor" di layar tidak akan sama dengan rupiah yang benar-benar dibayarkan saat tombol Setor ditekan |
| **Riwayat transfer** | sebuah transfer punya dua sisi, keduanya nyata |

Yang tiga terakhir diberi **label nama cabang** per baris (hanya kalau tokonya
memang bercabang) — yang dibutuhkan konteks, bukan saringan.

## Multi-toko

**JANGAN TERTUKAR DENGAN MULTI-OUTLET.** Ini pertanyaan pertama yang muncul:

| | multi-outlet | multi-toko |
|---|---|---|
| yang bertambah | **cabang** dalam satu toko | **toko** dalam satu akun |
| langganan | satu, dipakai bersama | sendiri-sendiri |
| produk & tim | satu katalog, satu tim | terpisah penuh |
| yang terpisah | stok, kasir, struk | semuanya — RLS memisahkan total |
| untuk siapa | warung yang buka cabang | orang yang punya dua usaha berbeda |

`register_store` dulu menolak kalau user sudah punya toko. Itu benar saat modul
auth baru jadi: tanpa pemilih toko, akun dengan dua organisasi hanya melihat yang
pertama dan toko keduanya jadi data yang tidak bisa dicapai siapa pun.

**Batasnya digeser, bukan dihapus: maksimal 5 toko DIMILIKI per akun.** Tanpa
batas apa pun, satu akun bisa membuat ribuan organisasi dalam semenit — tiap satu
membawa outlet, kategori bawaan, dan baris langganan sendiri. Pendaftaran toko
tidak berbayar dan tidak butuh persetujuan siapa pun, jadi tidak ada gerbang lain
di depannya. Diundang jadi anggota toko orang lain tidak dibatasi.

Nama toko kembar milik pemilik yang sama juga ditolak — hampir selalu berarti
tombol Daftar tertekan dua kali, bukan dua usaha yang kebetulan senama. Pesannya
mengutip nama yang **sudah ada di database**, bukan yang baru diketik (migrasi
0032): perbandingannya case-insensitive, jadi mengetik "toko dewi" dan dijawab
'sudah punya toko bernama "toko dewi"' membuat orang bingung mengenali tokonya
sendiri.

`getSessionContext()` mengambil SEMUA keanggotaan aktif (dulu `.limit(1)`).
Toko aktif dari cookie `tokoku_toko`, divalidasi ulang terhadap keanggotaan
NYATA. Taruhannya lebih besar daripada cookie outlet: cookie toko yang dipercaya
mentah-mentah membuat seluruh halaman dirender dengan `organization_id` yang
bukan milik user — RLS memang mengembalikan kosong dan setiap tulis ditolak, tapi
hasilnya aplikasi yang tampak rusak tanpa sebab, bukan penolakan yang bisa dibaca.

**Berpindah toko membuang cookie outlet.** Isinya outlet milik toko lama.
`pickOutlet()` memang sudah menolak outlet asing, jadi ini bukan soal keamanan —
melainkan supaya toko tujuan mendarat di outlet utamanya sendiri alih-alih
bergantung pada urutan jatuh-balik yang tidak kelihatan dari luar.

**Toko baru langsung dijadikan aktif** setelah dibuat. Tanpa itu, pemilik yang
baru mengisi nama toko mendarat di toko lamanya dan menyangka pembuatannya gagal.

`/daftar-toko` melayani dua keadaan: akun baru yang belum punya toko (konfirmasi
email menyala, jadi `signUp` tidak mengembalikan sesi) dan akun yang menambah
toko. Dulu keadaan kedua dialihkan ke beranda — pengalihan itu justru menutup
satu-satunya pintu untuk menambah.

**Satu pemilih untuk dua tingkat.** Topbar 390px sudah pas-pasan dengan satu
pemilih; menambah pemilih kedua mendorong tombol keluar ke luar layar — persis
kesalahan yang sudah diperbaiki sekali di sini. Menunya bersusun: Toko →
Outlet → "Daftarkan toko baru". Tombolnya menyebut yang paling spesifik (nama
outlet kalau bercabang, nama toko kalau tidak).

### Perangkat dikunci per outlet — jangan diubah

`deviceKey(outletId)` di `lib/offline/db.ts`. Perangkat POS terdaftar per outlet
(`devices.outlet_id`), dan sempat disimpan di satu kunci `device` yang dibuang
tiap kali outlet berganti. Akibatnya **kembali ke cabang yang sudah pernah dibuka
mendaftarkan perangkat BARU**, bukan memakai yang lama — kodenya naik terus
(K1…K7 hanya dari beberapa kali berpindah saat menguji) dan tiap satu memakan
jatah `max_devices`. Kuota Growth (8) habis dalam satu sesi pengujian; kasir yang
berpindah cabang dua kali sehari akan menghabiskannya dalam sepekan.

Saat berpindah TOKO, semua kunci `device:*` ikut dibuang lewat hapus berawalan —
daftar kunci tetap di `TENANT_META` tidak cukup karena kuncinya dinamis.

**Sudah diuji ujung ke ujung** (10 Agu): nama kembar ditolak dengan nama yang
benar · "Warung Rina" dibuat dan langsung jadi toko aktif (0 produk, 1 anggota) ·
menu dua tingkat menampilkan Toko + Outlet · kembali ke Toko Dewi memulihkan
9 produk & 5 anggota dan mendarat di outlet utama · Renon K2 → MAIN K5 → Renon
**K2 lagi** (tidak ada perangkat baru) · pindah ke Warung Rina mengosongkan cache
produk/stok dan kunci perangkat toko lama, sementara **outbox 7 baris tetap
utuh** · 390px bersih.

## Email undangan

`lib/email.ts` mengirim lewat `fetch` langsung ke Resend, bukan SDK-nya — yang
dipakai cuma satu POST JSON, dan satu dependensi lagi berarti satu paket lagi
yang harus ikut diaudit seumur hidup project.

**OPSIONAL SECARA SENGAJA.** Tanpa `RESEND_API_KEY` + `EMAIL_FROM`, `sendEmail`
mengembalikan `skipped` dan aplikasinya jatuh ke jalur salin-tautan-manual yang
memang sudah ada. Aplikasi harus tetap utuh di mesin pengembang dan di
instalasi yang tidak memasang penyedia email.

**Kegagalan kirim TIDAK PERNAH membatalkan undangan.** Barisnya sudah ada di
database begitu insert lolos. Kalau gagal kirim dijadikan error, pemilik toko
melihat "gagal" padahal undangannya nyata — lalu mencoba lagi dan ditolak
"undangan masih menunggu diterima". Buntu, dan penyebabnya tak kelihatan. Jadi
`inviteMember` mengembalikan `delivery: 'sent' | 'skipped' | 'failed'` TERPISAH
dari `ok`.

**Tautannya selalu ditampilkan, termasuk saat email berhasil terkirim.** Bukan
sekadar cadangan: banyak pemilik warung memang lebih suka mengirimnya lewat
WhatsApp, dan email undangan gampang tersangkut di spam tanpa ada yang tahu.

Status HTTP penyedia diterjemahkan jadi kalimat yang bisa ditindaklanjuti
(401/403 → kunci ditolak, 422 → pengirim belum diverifikasi, 429 → kuota penuh);
sisanya diteruskan apa adanya supaya tidak ada kegagalan yang hilang. Ada
timeout 10 detik — server action tidak boleh menggantung karena penyedianya
lambat.

Template emailnya memakai gaya inline dan warna brand ditulis apa adanya —
satu-satunya tempat di project ini yang boleh begitu. Gmail web membuang
`<style>` di head dan tidak mengenal CSS variable. Tautan juga ditulis sebagai
teks di bawah tombol: sebagian klien email menampilkan tombol berwarna sebagai
kotak kosong, dan undangan yang tidak bisa diklik sama saja dengan tidak
terkirim.

**Catatan operasional:** pasang penyedia yang sama sebagai Custom SMTP di
Supabase (Authentication → Emails). Email bawaan Supabase untuk konfirmasi
pendaftaran dan reset sandi dibatasi beberapa email per jam — tidak untuk
produksi. Satu akun, dua kegunaan.

**Yang sudah diuji** (10 Agu): jalur `skipped` (tanpa kunci), jalur `failed`
(kunci palsu → 401 → pesan "Kunci API email ditolak penyedia"), dan wujud
emailnya dirender ke browser. **Belum diuji: pengiriman sungguhan** — perlu
akun Resend + domain terverifikasi.

## Pembagian paket

`lib/plan.ts` adalah SATU tempat membaca `plans.features`. Aturannya sempat
disalin di tiap halaman yang butuh, dan aturan yang disalin akan bergeser: cukup
satu halaman lupa memakai default yang benar, klien yang sudah membayar
kehilangan fitur tanpa ada yang menyadarinya.

**Kolom kosong = kemampuan PENUH.** Paket dibuat tangan lewat Super Admin, jadi
penanda yang lupa diisi itu wajar. Organisasi tanpa `plan_id` juga penuh —
aturan yang sama dengan kuota: jangan pernah mengunci toko karena kolomnya belum
terisi.

**Prinsip pembagiannya: jangan kunci hal yang membuat toko berjalan benar, kunci
lapisan ANALISANYA.** Kalau yang dikunci membuat stok, HPP, atau uang jadi
salah, aplikasinya terbaca rusak — bukan terbaca murah.

| kunci | `basic` | `full` |
|---|---|---|
| `purchasing` | catat barang masuk (stok & HPP tetap benar) | pemasok, tempo, hutang, **konsinyasi** |
| `reports` | omset, transaksi, rata-rata, grafik harian, rincian per tanggal, 7 & 30 hari | + laba kotor & margin, produk terlaris, metode bayar, 90 hari |
| `crm` | catat pelanggan, daftar pelanggan, **nota via WhatsApp** | + poin loyalty, total belanja & kunjungan per pelanggan, segmentasi |

Dua keputusan yang disengaja di halaman Laporan:
- **Laporan Shift TIDAK dikunci.** Selisih kas itu pengamanan uang, bukan
  analisa — menguncinya membuat uang hilang tanpa ketahuan, persis kategori yang
  dilindungi prinsip di atas.
- **Periode di luar paket jatuh ke 7 hari, bukan halaman error.** Tautan lama,
  bookmark, dan URL yang diketik tangan tidak boleh berujung di layar rusak.

`PlanLock` **menggantikan** isi yang dikunci, tidak menghilangkannya. Bagian yang
lenyap tanpa jejak terbaca sebagai aplikasi belum jadi: pemilik toko tidak tahu
ada sesuatu di sana, jadi tidak pernah terpikir naik paket — dan kalau pernah
melihatnya di demo, ia mengira fiturnya rusak. Judulnya sengaja tidak diulang;
`section-title` di atasnya sudah menyebut nama bagiannya.

Diuji dengan menurunkan Toko Dewi ke Starter lewat Super Admin lalu
mengembalikannya ke Growth (10 Agu). Turun paket tidak menghapus data apa pun —
kuota tinggal menampilkan "sudah penuh" sampai kembali di bawah batas.

## Reset kata sandi

Alurnya: `/lupa-sandi` → Supabase kirim email → `/auth/konfirmasi` (Route
Handler) → `/atur-sandi` → sandi tersimpan → sesi ditutup → `/masuk` dengan
notice.

Sesi pemulihan sengaja ditutup setelah sandi diganti: sekalian membuktikan sandi
barunya bekerja, dan tidak meninggalkan sesi hidup di perangkat yang mungkin
bukan milik user.

`/auth/konfirmasi` menerima dua bentuk tautan, karena template email Supabase
bisa memakai salah satunya: `?code=` (alur PKCE, bawaan `@supabase/ssr`) dan
`?token_hash=&type=` (template yang memakai `{{ .TokenHash }}`).

Untuk menguji tanpa membuka kotak masuk — email seed memakai domain yang tidak
ada — jalankan `node scripts/recovery-link.mjs <email>` lalu buka tautannya.

**Yang belum diuji:** perjalanan email sungguhan (jalur `?code=`) dan penyimpanan
sandi barunya. Yang sudah diuji langsung: jalur `token_hash` sampai form muncul
dengan akun yang benar, tautan sekali-pakai yang ditolak, tautan rusak tanpa
sesi, dan pengiriman dari `/lupa-sandi`.

**Catatan operasional:** konfirmasi email **menyala** di project Supabase ini.
Setelah daftar, user harus konfirmasi lalu masuk; aplikasi mengarahkannya ke
`/daftar-toko` untuk menyelesaikan pembuatan toko.

## Perintah

```bash
npm run dev          # server pengembangan (service worker SENGAJA mati di sini)
npm run build        # build produksi + typecheck
npm start            # server produksi — perlu ini untuk menguji offline
npm run db:push      # kirim migrasi ke Supabase
npm run db:types     # regenerasi lib/supabase/database.types.ts — WAJIB setelah ubah skema
node scripts/seed-demo.mjs              # data demo (aman diulang)
node scripts/grant-platform-admin.mjs <email>   # jadikan Super Admin
node scripts/recovery-link.mjs <email>          # tautan reset sandi, TANPA kirim email
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 + CSS variables · Supabase (Postgres + RLS)
· Dexie/IndexedDB untuk POS offline · Zustand untuk keranjang · zod untuk validasi · Vercel.

`@supabase/ssr` **0.12.4** (dinaikkan dari 0.7.0 pada 12 Agu; `supabase-js` dan
`auth-js` sudah 2.112.2 sejak lama, jadi lapisan SSR-nya tertinggal jauh). Tidak
ada perubahan API pada yang dipakai project ini. `barcode-detector` dipakai
sebagai ponyfill kamera dan diimpor dinamis.

Next **16**, bukan 15: Next 15 punya 3 kerentanan *high* lewat postcss & sharp.
Konsekuensinya `middleware.ts` diganti konvensi `proxy.ts`.

## Aturan yang tidak boleh dilanggar

**Setiap tabel tenant punya `organization_id`** — termasuk tabel anak seperti
`transaction_items`. Redundan secara relasional, tapi membuat policy RLS bisa
dievaluasi tanpa JOIN.

**Uang selalu `bigint` rupiah bulat.** Tidak ada float, tidak ada sen.

**Laporan memakai `transactions.client_created_at`, bukan `created_at`.**
Yang pertama adalah jam di mesin kasir; yang kedua jam baris masuk Postgres — untuk
transaksi offline bisa terlambat berjam-jam dan menempatkan penjualan di tanggal salah.

**Soft delete (`deleted_at`) untuk products/categories/customers.** Perangkat offline
perlu melihat baris yang dihapus untuk membuang salinan lokalnya; hard delete tidak
muncul di delta sync.

**`product_stocks.quantity` boleh negatif.** Transaksi offline yang tersinkron terlambat
sudah terjadi secara fisik. Menolaknya berarti membuang catatan penjualan yang nyata.
Lihat `docs/OFFLINE-ARCHITECTURE.md` §3.

**Helper RLS wajib `SECURITY DEFINER`.** Tanpa itu policy pada `organization_members`
memanggil dirinya sendiri dan rekursi.

**Jangan pernah pakai `createAdminClient()` untuk melayani request user biasa.**
Itu melewati seluruh RLS. Hanya untuk provisioning lintas tenant.

## Jebakan yang sudah pernah menggigit

Semuanya sudah pernah terjadi di project ini — jangan diulang.

**React 19 me-reset `<form>` setelah `action` selesai.** Input ber-`defaultValue`
kehilangan isinya setiap kali validasi gagal, jadi user harus mengetik ulang semuanya.
**Semua form di sini terkendali state.**

**`useState` hanya menjalankan initializer sekali.** Drawer yang di-mount saat masih
tertutup (data `null`) akan selamanya menampilkan form kosong. Selalu render drawer
secara kondisional dengan `key`:
```tsx
{editing && <ProductDrawer key={editing.id ?? 'baru'} value={editing} … />}
```

**Jangan pernah gagal diam-diam di jalur uang.** Pernah ada `if (!device) return` yang
membuat tombol bayar tersangkut di "Menyimpan…" selamanya tanpa pesan dan tanpa jejak
server. Setiap kegagalan harus terlihat kasir.

**Setiap field validasi butuh slot pesan.** Kalau tidak, kegagalan hanya tampak sebagai
border merah. `ProductDrawer` punya jaring pengaman: error tanpa slot inline otomatis
tampil sebagai peringatan umum.

**Ping koneksi wajib membawa header `apikey`.** Tanpa itu semua endpoint Supabase balas
401 dan aplikasi mengira dirinya offline padahal jaringannya sehat.

**Efek yang mendaftarkan sesuatu harus di-memo di tingkat modul.** React StrictMode
memanggilnya dua kali; `getOrRegisterDevice()` pernah membuat dua perangkat sekaligus.

**Cache lokal tidak boleh menyimpan kolom turunan.** `pull_catalog` mengirim baris tabel
mentah, jadi `category_name`/`color_key` akan tertimpa jadi undefined. Gabungkan saat
baca di `localCatalog()`.

**Nomor transaksi disemai dari server.** Penghitung yang hanya hidup di IndexedDB akan
balik ke 1 kalau storage dibersihkan, bentrok, lalu ditulis ulang server jadi `-R1` —
merusak kecocokan struk cetak dengan pembukuan. Lihat `lib/offline/sequence.ts`.

**Gradient brand mudah hilang tanpa jejak.** `background: var(--grad)` lalu
`background-image: …` akan menimpa gradient-nya. `.hero` sempat tampil putih polos
berbintik karena ini — dan tidak ada yang menyadarinya sampai pola yang sama muncul
di panel auth. Selalu taruh `var(--grad)` sebagai lapisan TERAKHIR di dalam
`background-image`.

**Error yang dilempar dari Server Action tidak sampai ke komponen.** Ia menjadi
error tak tertangani, bukan hasil yang bisa ditampilkan. Aksi harus MENGEMBALIKAN
error bertipe — lihat pola `requireWrite()` yang memberi `{ session, blocked }`.

**UPDATE yang ditolak RLS mengembalikan "berhasil" dengan 0 baris.** Bukan error.
Karena itu mode Super Admin lihat-saja diblokir di lapisan aplikasi juga, bukan
hanya diandalkan ke RLS.

**`typedRoutes` aktif.** Href harus bertipe `Route`. Kalau build mengeluh soal route
tidak dikenal, kemungkinan halamannya memang belum dibuat.

**PostgREST mengekspos SETIAP fungsi di schema public sebagai RPC.** Fungsi
`SECURITY DEFINER` yang menerima `organization_id` sebagai parameter karena itu
menjadi lubang lintas tenant: siapa pun yang login bisa memanggilnya dengan id
toko orang lain. Sudah terjadi — `org_usage(<id Toko Dewi>,'products')` dipanggil
dari akun Warung Barokah dan menjawab 9. Cabut `execute` dari `anon` &
`authenticated`, dan kalau hasilnya perlu dibaca aplikasi, bungkus dalam fungsi
TANPA parameter yang menyaring sendiri berdasarkan `auth.uid()`.

**VIEW tidak mengganti `current_user`.** Ia hanya membuat pemeriksaan hak atas
TABEL memakai pemilik view. Hak EXECUTE sebuah fungsi tetap diperiksa terhadap
pemanggil — jadi mencabut execute dari `authenticated` mematikan view apa pun
yang memanggil fungsi itu, `security_invoker` maupun bukan. Yang benar-benar
mengganti current_user hanya `SECURITY DEFINER` pada FUNGSI.

**Cookie yang ditulis dari Server Component dibuang diam-diam.** Lihat `catch`
kosong di `lib/supabase/server.ts` — di sana memang tidak ada cara menulisnya.
Akibatnya `exchangeCodeForSession`/`verifyOtp` TIDAK BOLEH dipanggil dari page:
pertukarannya seolah berhasil, tapi sesinya tidak pernah tersimpan dan user
mendarat di halaman berikutnya tanpa hak apa pun. Harus lewat Route Handler —
itulah sebabnya `app/auth/konfirmasi/route.ts` ada.

**Store Zustand ber-`persist` merusak hidrasi.** Keranjang dipulihkan dari
localStorage sebelum render pertama, jadi klien menampilkan "Rp 117.000" sementara
HTML server berisi "Rp 0". React membuang seluruh pohon halaman kasir lalu
membangunnya ulang — kedipan penuh tepat saat kasir melayani antrean. Perbaikannya
`skipHydration: true` di store, dan `useCart.persist.rehydrate()` di `useEffect`
PosClient. Store ber-persist lain harus mengikuti pola ini.

**Gulir halus bisa diabaikan tanpa jejak.** `scrollIntoView({ behavior: 'smooth' })`
maupun `scroll-behavior: smooth` di CSS sama-sama tidak menggulir sama sekali —
tanpa error — sehingga tombolnya terasa mati. Gulir instan selalu bekerja. Di jalur
uang, pakai yang instan.

**`document.querySelector('form button[type="submit"]')` menekan tombol
KELUAR.** Tombol logout di topbar adalah `<form action={signOut}>` dan berada
lebih dulu di DOM daripada form mana pun di isi halaman. Selector itu memakan
satu sesi penuh: gejalanya "menekan Simpan membuat user logout dan sesinya
hancur", direproduksi berkali-kali di lokal MAUPUN produksi, sempat dilaporkan
sebagai bug penghalang go-live, dan dikejar sampai membongkar `_removeSession`
di dalam bundel auth-js — yang justru membuktikan pemanggilnya `_signOut`, alias
memang logout yang berhasil. Saat menguji sebuah form, ambil tombolnya dari
DALAM form itu: `el.closest('form').querySelector('button[type="submit"]')`.

**Menghapus IndexedDB mentah-mentah merusak cache POS.** `indexedDB.deleteDatabase`
lalu `indexedDB.open` biasa membuat database v1 kosong yang berebut dengan skema
Dexie, dan grid kasir jadi kosong tanpa error apa pun. Selain itu tiap kali cache
dibuang, POS mendaftarkan PERANGKAT BARU — kuota `max_devices` Toko Dewi sempat
penuh 8/8 hanya karena pengujian. Kalau perlu mereset, pakai jalur aplikasinya
(`ensureTenant`) atau hapus lewat DevTools, dan periksa kuota perangkat sesudahnya.

**Setelah mengubah skema, jalankan `npm run db:types`.** Tanpa itu RPC baru akan ditolak
typecheck.

## Warna chart bukan warna brand

Lime `#F9F586` dan mint `#A1FFCE` terlalu terang untuk jadi tanda data. Forest-soft
`#173C2B` gagal validasi (di luar pita lightness, chroma 0,053 — terbaca abu-abu).

Yang sudah divalidasi dan dipakai (`.viz` di `globals.css`):
- seri tunggal `#146B3A`
- pasangan `#146B3A` + `#2a78d6` — CVD ΔE 23,0 · normal ΔE 24,2 · kontras lolos

Sebelum menambah chart, muat skill `dataviz` dan jalankan validator palet.

## Peta file

```
app/
  (auth)/          masuk (panel split beranimasi), daftar-toko, lupa-sandi,
                   atur-sandi, undangan/[token], actions
  auth/konfirmasi  route handler pendaratan tautan email (WAJIB route, bukan page)
  (toko)/          beranda, kasir, transaksi/[id], riwayat, laporan/{,shift},
                   produk/{,[id],transfer}, pembelian/{,konsinyasi},
                   pelanggan,
                   pengaturan/{toko,outlet,tim,kategori,printer,sinkronisasi,
                               langganan},
                   profil
  (platform)/admin klien/[id], paket, pengaturan platform
  about/  setup/   halaman publik & status koneksi
components/
  layout/          AppShell, Sidebar (memuat brand), Topbar, BottomNav,
                   OutletSwitcher (toko + outlet), ImpersonationBanner
  ui/icons.tsx     registry ikon dari wireframe
  pos/             PosClient + turunannya, CartBar (bar bayar mobile), Receipt (58mm),
                   BarcodeScanner (kamera, ponyfill barcode-detector)
  charts/          DailyRevenueChart, RankedBars, PaymentSplit
  overlay/Drawer   panel geser untuk semua form
  data/IconAction  tombol aksi baris, konfirmasi dua langkah
  domain/          AuthPanel, ForgotPasswordForm, NewPasswordForm, QuotaBars,
                   LogoUploader, DeviceTable, SettingsNav, WhatsAppButton,
                   CustomerManager, SendReceiptButton,
                   ProductTable/Drawer, StockDrawer, TeamManager,
                   CategoryManager, PlanManager, ClientDetail, ShiftCard,
                   PurchaseList/Drawer, ConsignmentList (+ drawer titipan,
                   retur, setor bagi hasil), PlanLock (pengganti isi terkunci),
                   OutletManager, TransferDrawer + TransferManager
lib/
  auth.ts          konteks sesi + requireSession/requirePermission/requireWrite
  email.ts         pengirim email (Resend lewat fetch) — OPSIONAL, gagal ≠ batal
  navigation.ts    SATU daftar menu, disaring izin modul
  offline/         db (Dexie v3, stempel tenant + outlet, deviceKey per outlet),
                   outbox, catalog, device, sequence, connection
  phone.ts         normalkan nomor HP ke 62… + hpLokal() untuk menampilkannya
  plan.ts          SATU pembaca plans.features — kolom kosong = kemampuan penuh
  subscription.ts  keadaan langganan sisi toko — harus sama dengan org_lapsed_at()
  supabase/        client (RLS) · server (RLS) · admin (LEWAT RLS, server-only)
scripts/           seed-demo.mjs, grant-platform-admin.mjs, recovery-link.mjs
proxy.ts           konvensi middleware Next 16
public/sw.js       service worker — app shell offline
supabase/migrations/  37 file, Postgres 17
```

## RPC yang penting

`create_transaction` / `sync_transactions` (POS, idempoten lewat id dari perangkat) ·
`pull_catalog` (delta sync) · `void_transaction` · `open_shift`/`close_shift` ·
`adjust_stock` · `accept_invitation` + `invitation_preview` · `register_store` ·
`provision_organization` (dicabut dari `authenticated`, hanya lewat `register_store`) ·
`create_purchase` · `record_consignment_intake` / `record_consignment_return` /
`settle_consignment` / `end_consignment` · `create_outlet` / `set_primary_outlet` /
`transfer_stock`.

`_apply_customer_effects` (dicabut dari `authenticated`, hanya dipanggil dari
dalam `_apply_transaction`) memegang seluruh aturan poin loyalty.

## Navigasi & izin

Semua peran di dalam toko berbagi **satu daftar menu** (`TOKO_ITEMS`), disaring oleh
izin modul (`pos`/`products`/`reports`/`settings`). Jangan buat daftar terpisah per
peran — dulu begitu, dan akibatnya pemilik bisa memberi kasir izin Laporan tanpa
menunya pernah muncul.

Penjagaan berlapis tiga: `proxy.ts` (sesi) → layout server (`requirePermission`) → RLS.

## Data demo

Dua tenant, dipakai untuk membuktikan isolasi antar toko:
- **Toko Dewi** (Denpasar, Growth, aktif) — 9 produk, ~14 transaksi, 5 anggota,
  **2 outlet**: MAIN (stok terisi) dan OUT-2 "Cabang Renon" (dibuat 10 Agu untuk
  menguji multi-outlet; berisi 6 Aqua — sisa dari 12 yang dibeli, 1 terjual,
  5 ditransfer balik ke MAIN)
- **Warung Rina** (Ubud, Starter, trial) — toko KEDUA milik `rina@tokodewi.id`,
  dibuat 10 Agu untuk menguji multi-toko. Kosong.
- **Warung Barokah** (Semarang, Starter, trial) — kosong, hasil pendaftaran mandiri

Sandi akun toko semuanya `TokoKu123!`; Super Admin memakai `admin123`.
Semuanya kredensial development — **ganti sebelum production.** Sandi Super Admin
paling mendesak: satu akun itu bisa membaca data SELURUH toko klien.

Akunnya diubah 10 Agu dari `admin@tokoku.id`. Yang diperbarui hanya email &
sandi pada baris auth yang sudah ada, bukan akun baru — `user_id` tetap, jadi
riwayat akses Super Admin dan jejak perubahan langganan tidak terputus.

| Akun | Peran |
|---|---|
| `rina@tokodewi.id` | Pemilik Toko Dewi |
| `agus@tokodewi.id` | Admin Toko |
| `nanda@` / `melati@tokodewi.id` | Kasir |
| `budi@tokodewi.id` | Kasir + izin Laporan |
| `siti.warungbarokah@gmail.com` | Pemilik Warung Barokah |
| `seawise.cc@gmail.com` | **Super Admin** — sandi `admin123`, BUKAN `TokoKu123!`. Masuk lewat `/masuk`, diarahkan ke `/admin` |

Tiga produk sudah diberi barcode EAN-13 asli untuk menguji pemindai: **Aqua
600ml `8886008101053`**, Teh Pucuk `8992745700015`, Chitato `8992775311011`.
Produk lain masih tanpa barcode.

Perangkat POS Toko Dewi: K1–K6 di outlet MAIN dan K1–K2 di Cabang Renon. Sisa
pengujian, dan sekarang benar-benar bisa dihapus lewat
`/pengaturan/sinkronisasi` kalau mengganggu —
kecuali yang punya transaksi (K1, K2, K3, K4 di MAIN; K1 di Renon).

## Gaya

Bahasa Indonesia untuk seluruh teks antarmuka dan komentar kode. Pesan error ditulis
untuk pemilik warung, bukan untuk programmer — sebutkan apa yang harus dilakukan.

**JANGAN memakai em dash (—) di teks yang dilihat pengguna.** Permintaan eksplisit
pemilik project: tulisan ber-em-dash terbaca seperti dihasilkan AI. Aturannya:

- judul tab memakai `|` — `Produk & Stok | TokoKu`
- penanda sel kosong memakai `-`, bukan `—`
- di dalam kalimat: **titik** kalau potongan sesudahnya berdiri sebagai kalimat
  ("Catat barang masuk. Stok bertambah…"), **koma** kalau menyambung ("Opsional,
  untuk pemindai"), **titik dua** kalau memperkenalkan rincian ("usaha retail
  kecil: warung, kios…")

Komentar kode, komentar migrasi SQL, dan CLAUDE.md **boleh** memakai em dash dan
sengaja tidak disentuh saat pembersihan 12 Agu: tidak pernah dilihat pemilik
warung, dan menulis ulang ~330 komentar berisiko merusak penjelasan yang justru
berguna.
