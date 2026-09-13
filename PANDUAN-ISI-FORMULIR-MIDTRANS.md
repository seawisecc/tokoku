# Panduan mengisi Formulir Data Susulan Onboarding Midtrans

Formulir: `sales-tooling.midtrans.com/merchant-form/83fff262-7967-476d-b271-cc1a3be77eb3`

Terakhir diperbarui **13 September 2026**.

---

## 1. Keadaan sekarang: apa yang sudah beres

| | Status |
|---|---|
| Pembayaran langganan di aplikasi | ✅ menyala di produksi, kunci Sandbox |
| Diuji ujung ke ujung | ✅ satu pembayaran BCA virtual account benar-benar mengaktifkan langganan |
| Alamat website di dashboard **Production** | ✅ dikembalikan ke `https://tokoku.seawise.id` |
| Payment Notification URL (Production & Sandbox) | ✅ terdaftar |
| Finish Redirect URL (Production & Sandbox) | ✅ terdaftar |
| Snap Successful / Failed payment (Production & Sandbox) | ✅ terdaftar |
| Dokumen PDF untuk diunggah | ✅ dibuat, tinggal diisi & ditandatangani |
| **Akun peninjauan untuk Midtrans** | ❌ **belum dibuat** |

**Penyebab formulir ini muncul sudah ketemu dan sudah diperbaiki.** Pada dashboard
Production, kolom alamat website sempat berisi `https://www.seawise.id/en`, bukan
`https://tokoku.seawise.id` yang didaftarkan saat pengajuan. Itulah "perubahan
website selama proses review" yang disebut formulirnya. Sudah dikembalikan dan
disimpan.

---

## 2. Yang tinggal dikerjakan sebelum kirim

### a. Buat akun peninjauan

Jangan pakai akun Toko Dewi atau akun pribadi. Daftar toko baru:

1. Buka `https://tokoku.seawise.id/daftar-toko`
2. Saran isian:
   - Nama toko: `Toko Contoh Midtrans`
   - Email: alamat yang bisa dipantau, misalnya `midtrans.review@seawise.id`
   - Kata sandi: kuat, tapi mudah diketik ulang oleh reviewer
3. Konfirmasi emailnya, lalu masuk sekali supaya tokonya benar-benar terbentuk

Setelah itu jalankan ini supaya halamannya tidak kosong saat ditelusuri reviewer:

```bash
node scripts/seed-review-tenant.mjs "Toko Contoh Midtrans"
```

Skrip itu mengisi kategori, 12 produk dengan barcode, stok, satu pelanggan, dan
beberapa transaksi di hari-hari terakhir, supaya Beranda, Kasir, Produk, dan
Laporan semuanya tampil terisi. Jalankan `--dry` dulu kalau mau melihat rencananya
tanpa menulis apa pun.

### b. Isi dokumennya

Data pribadi diisi lewat skrip, bukan diketik ulang di HTML:

```bash
node scripts/isi-dokumen-midtrans.mjs
```

Skripnya membaca `midtrans-data.local.json` di akar project, lalu menulis
`Data-Susulan-Onboarding-TokoKu-Midtrans-ISI.html` dan langsung mencetaknya jadi
PDF. Ketiga berkas itu **di-gitignore**: repo ini publik, dan isinya NIK, alamat
rumah, serta kata sandi akun peninjauan.

Yang sudah terisi: nama merchant, penanggung jawab, tanggal, pemilik domain,
seluruh daftar alamat, keterangan lingkungan pengujian, dan seluruh Bagian 4
(nama, jabatan, NIK, bentuk usaha, alamat, telepon, email, kota, blok tanda
tangan).

Yang masih kosong tinggal **Bagian 2**, karena akun peninjauannya belum ada:
email, kata sandi, nama toko, dan berlaku sampai kapan. Setelah akunnya dibuat,
isi keempatnya di `midtrans-data.local.json` lalu jalankan skripnya sekali lagi.
Hasilnya tidak perlu ditulis tangan sama sekali kecuali tanda tangan di atas
materai.

Skrip itu memeriksa jumlah halaman dan memperingatkan kalau hasilnya bukan 5
halaman. Lebih dari 5 berarti ada bagian yang meluap, dan itu sudah dua kali
terjadi saat isinya ditambah.

**Bentuk usaha ditulis apa adanya: perorangan, belum berbadan hukum, dengan nama
dagang Seawise Studio.** Kolom yang tadinya bernama "Nama badan usaha" diganti
jadi "Bentuk usaha" supaya tidak terbaca seperti pertanyaan yang dikosongkan.

**Periksa dua hal sebelum tanda tangan:**

1. Baris "Penyedia hosting" di Bagian 1 saya isi "Vercel (aplikasi) dan Supabase
   (basis data), keduanya dengan server di kawasan Asia Tenggara". Itu benar,
   tapi di halaman legal publik nama vendor sengaja tidak disebut. Untuk dokumen
   onboarding privat ini menyebutnya wajar, silakan dicoret kalau tidak berkenan.
2. Baris "Terdaftar atas nama" pada Pemilikan domain diisi nama pribadi. Cocokkan
   dengan data di registrar domain `seawise.id` yang sebenarnya.

---

## 3. Mengisi formulirnya

| Bagian formulir | Jawaban |
|---|---|
| Pertanyaan 1 (wajib) | **Ya** |
| Pertanyaan 2, Form Perubahan Data | **Kosongkan.** Alamatnya tidak berubah |
| Dokumen Tambahan (wajib) | Unggah `Data-Susulan-Onboarding-TokoKu-Midtrans.pdf` |

Hanya satu berkas yang diunggah. `Alur-Transaksi-TokoKu-Midtrans.pdf` sudah dikirim
sebelumnya, tidak perlu diulang. Kunci API tidak pernah masuk ke formulir mana pun.

Kalau PDF-nya perlu dibuat ulang setelah diedit:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PWD/Data-Susulan-Onboarding-TokoKu-Midtrans.pdf" \
  "file://$PWD/Data-Susulan-Onboarding-TokoKu-Midtrans.html"
```

---

## 4. Setelah merchant disetujui

1. Ambil kunci **Production** di dashboard Midtrans → Settings → Access Keys →
   General Credentials
2. Ganti `MIDTRANS_SERVER_KEY` di Vercel, dan setel `MIDTRANS_IS_PRODUCTION=true`
3. Spanduk amber "Mode uji coba" di halaman Langganan hilang sendiri
4. Coba satu pembayaran sungguhan bernilai kecil, lalu batalkan atau biarkan

Keempat alamat di dashboard Production **sudah didaftarkan**, jadi langkah itu
tidak perlu diulang.

**Jangan menebak lingkungan dari bentuk kuncinya.** Kunci Sandbox akun ini tidak
berawalan `SB-`, bentuknya `Mid-server-…` persis seperti kunci Production. Yang
menentukan hanya `MIDTRANS_IS_PRODUCTION`, yang memilih alamat API. Salah setel
berarti kunci dikirim ke endpoint yang salah dan dijawab 401 tanpa penjelasan
yang jelas di layar.
