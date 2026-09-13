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

Buka `Data-Susulan-Onboarding-TokoKu-Midtrans.pdf` (sudah dibuat, 5 halaman).
Yang masih kosong tinggal ini:

| Halaman | Isian |
|---|---|
| Sampul | Penanggung jawab |
| Bagian 1 | Domain `seawise.id` terdaftar atas nama siapa |
| Bagian 2 | Email akun peninjauan, kata sandinya, nama tokonya, berlaku sampai kapan |
| Bagian 5 | Nama lengkap, jabatan, NIK, nama badan usaha, alamat usaha, telepon, email, tanggal, tanda tangan di atas materai Rp 10.000 |

Sisanya sudah terisi otomatis, termasuk nama merchant, tanggal dokumen, seluruh
daftar alamat, dan keterangan lingkungan pengujian.

**Nama badan usaha dan alamat harus sama persis** dengan yang dipakai saat
pengajuan awal di Midtrans. Beda satu kata bisa memicu pertanyaan susulan lagi.

**Periksa baris "Penyedia hosting" di Bagian 1.** Saya isikan "Vercel (aplikasi)
dan Supabase (basis data), keduanya dengan server di kawasan Asia Tenggara".
Itu benar, tapi di halaman legal publik nama vendor sengaja tidak disebut atas
keputusan pemilik project. Untuk dokumen onboarding yang privat ini menyebutnya
wajar dan diharapkan, tapi silakan dicoret kalau tidak berkenan.

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
