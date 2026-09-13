# Panduan mengisi Formulir Data Susulan Onboarding Midtrans

Formulir: `sales-tooling.midtrans.com/merchant-form/83fff262-7967-476d-b271-cc1a3be77eb3`

---

## 1. Yang diminta formulir, dan jawabannya

### Pertanyaan 1 (wajib)
> "Saya sudah menyesuaikan URL kembali sesuai yang terakhir didaftarkan dengan cara
> klik Pengaturan → Pengaturan Umum → URL → Simpan"

**Jangan pilih "Ya" sebelum benar-benar dikerjakan.** Buka dashboard Midtrans lebih dulu:

1. Masuk ke `dashboard.midtrans.com`
2. Pengaturan → Pengaturan Umum → URL
3. Pastikan isinya `https://tokoku.seawise.id` (tanpa garis miring di belakang, sama persis
   dengan yang didaftarkan saat pengajuan)
4. Tekan Simpan, walaupun isinya sudah benar. Formulir ini memang meminta tombol Simpan ditekan.
5. Baru pilih **Ya** di formulir.

Sekalian periksa di halaman yang sama, karena ini yang akan dites reviewer:

| Kolom | Diisi |
|---|---|
| Payment Notification URL | `https://tokoku.seawise.id/api/pembayaran/midtrans/notifikasi` |
| Finish Redirect URL | `https://tokoku.seawise.id/pengaturan/langganan?status=berhasil` |
| Unfinish Redirect URL | `https://tokoku.seawise.id/pengaturan/langganan?status=tertunda` |
| Error Redirect URL | `https://tokoku.seawise.id/pengaturan/langganan?status=gagal` |

### Pertanyaan 2 (tidak wajib)
> "Jika ingin menggunakan URL baru, isi Form Perubahan Data terlampir, tandatangani, unggah."

**Kosongkan.** Alamatnya tidak berubah, jadi tidak perlu Form Perubahan Data. Formulir ini
baru diperlukan kalau nanti pindah domain atau menambah domain baru, dan formnya harus
diminta dulu ke `support@midtrans.com`.

### Dokumen tambahan (wajib)
> "Mohon bantuannya untuk melampirkan kredensial akun yang dapat kami gunakan untuk
> mengakses platform Anda dan melakukan tes transaksi URL https://tokoku.seawise.id/"

Unggah **`Data-Susulan-Onboarding-TokoKu-Midtrans.pdf`** (dari berkas HTML di folder yang
sama, lihat bagian 3 di bawah).

---

## 2. Yang harus disiapkan sebelum mengisi

### a. Akun peninjauan untuk Midtrans

Jangan berikan akun pribadi, akun Super Admin, atau akun Toko Dewi. Buat akun baru khusus:

1. Daftar toko baru lewat `https://tokoku.seawise.id/daftar-toko`
2. Saran isian:
   - Nama toko: `Toko Contoh Midtrans`
   - Email: alamat yang bisa dipantau, misalnya `midtrans.review@seawise.id`
   - Kata sandi: kuat, tapi mudah diketik ulang oleh reviewer
3. Isi datanya supaya halaman tidak kosong: impor beberapa produk lewat
   Pengaturan → Impor & Backup, lalu catat 2 sampai 3 transaksi di Kasir
4. Dari Super Admin, atur masa langganan akun ini supaya tidak habis di tengah peninjauan
5. Tulis email dan kata sandinya di Bagian 2 dokumen PDF

Setelah peninjauan selesai: ganti kata sandinya dan nonaktifkan tokonya. Ini sudah
dijanjikan di dalam dokumen.

### b. Data yang perlu diisi tangan di dokumen

| Halaman | Yang kosong |
|---|---|
| Sampul | Nama merchant, penanggung jawab, tanggal |
| Bagian 1 | Domain terdaftar atas nama siapa, penyedia hosting |
| Bagian 2 | Email akun, kata sandi, nama toko peninjauan, berlaku sampai |
| Bagian 3 | Lingkungan pengujian, kunci yang dipakai, catatan |
| Bagian 4 | Nama lengkap, jabatan, NIK, badan usaha, alamat, telepon, email, tanggal, tanda tangan |

Nama badan usaha dan alamat **harus sama persis** dengan yang dipakai saat pengajuan awal
di Midtrans. Beda satu kata saja bisa memicu pertanyaan susulan lagi.

---

## 3. Cara membuat PDF-nya

```bash
open Data-Susulan-Onboarding-TokoKu-Midtrans.html
```

Lalu di browser: Cetak → Tujuan "Simpan sebagai PDF" → Ukuran A4 → **centang "Grafik latar
belakang"** (kalau tidak, warna dan tabelnya hilang) → Simpan sebagai
`Data-Susulan-Onboarding-TokoKu-Midtrans.pdf` di folder ini.

Isian yang kosong sengaja dibuat sebagai garis titik-titik supaya bisa ditulis tangan
setelah dicetak, atau diisi lewat aplikasi PDF sebelum ditandatangani.

---

## 4. Urutan pengerjaan yang disarankan

1. Buat akun peninjauan dan isi datanya
2. Rapikan URL di dashboard Midtrans, tekan Simpan
3. Isi dokumen, cetak, tanda tangan di atas materai, pindai jadi PDF
4. Buka formulir, pilih **Ya** pada pertanyaan 1, kosongkan pertanyaan 2
5. Unggah PDF pada Dokumen Tambahan
6. Kirim

---

## 5. Pembayarannya sudah ada, tapi harus dinyalakan dulu

Reviewer Midtrans diminta **melakukan tes transaksi**. Halaman checkout,
tagihan, dan pemberitahuan pembayarannya sudah dibangun (13 Sep) dan sudah diuji
sampai ke database, tapi **kuncinya belum dipasang dan kodenya belum di-deploy**.
Selama itu belum dikerjakan, halaman Langganan masih menampilkan tombol WhatsApp
seperti sebelumnya, dan reviewer tidak akan menemukan apa pun untuk dites.

Kerjakan ini **sebelum** mengirim formulir:

1. Ambil kunci **Sandbox** di dashboard Midtrans → Settings → Access Keys
2. Pasang di Vercel (Production): `MIDTRANS_SERVER_KEY`,
   `MIDTRANS_IS_PRODUCTION=false`, dan `SUPABASE_SERVICE_ROLE_KEY`
3. Daftarkan keempat alamat di dashboard Midtrans → Settings → Configuration
   (daftarnya ada di bagian 1 di atas)
4. Deploy, lalu coba sendiri satu kali: masuk sebagai pemilik toko, buka
   Pengaturan → Langganan, tekan **Bayar Sekarang**, dan pastikan halaman
   pembayaran Midtrans benar-benar terbuka
5. Selesaikan pembayarannya dengan kartu uji Sandbox, lalu pastikan halaman
   Langganan menyebut langganannya aktif

Baru setelah langkah 5 berhasil, kirim formulirnya.

Rinciannya ada di CLAUDE.md, bagian "Yang harus dikerjakan pemilik project".

---

## 6. Kenapa memakai kunci Sandbox di alamat produksi

Kunci Production baru diterbitkan setelah merchant disetujui, sementara
peninjauan ini justru memerlukan tes transaksi yang selesai. Jadi urutannya
memang harus begitu, dan ini hal yang biasa pada onboarding Midtrans.

Supaya tidak ada pengguna sungguhan yang salah mengira sedang membayar, aplikasi
memasang peringatan amber tepat di atas tombol bayar selama mode Sandbox aktif.
Peringatan itu hilang sendiri begitu `MIDTRANS_IS_PRODUCTION` disetel `true`.

Hal ini sudah dijelaskan di Bagian 3 dokumen PDF-nya, jadi tidak perlu
disebutkan lagi di badan formulir.
