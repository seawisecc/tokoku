# Template email Supabase (bahasa Indonesia)

Email bawaan Supabase berbahasa Inggris: *"Reset your password"*, *"Confirm your
signup"*. Itu satu-satunya permukaan TokoKu yang masih asing bagi pemilik warung
— dan ia muncul justru di momen paling rawan, saat orang tidak bisa masuk ke
aplikasinya sendiri.

**Template ini tidak tinggal di repo.** Supabase menyimpannya di dashboard, jadi
harus ditempel dengan tangan sekali. Berkas ini yang jadi salinannya, supaya
kalau suatu saat project Supabase dibuat ulang, tidak ada yang perlu ditulis
ulang dari nol.

## Cara memasang

Dashboard Supabase → project `tokoku` → **Authentication → Emails → Templates**.
Ada beberapa jenis; yang dipakai TokoKu cuma dua di bawah ini. Untuk masing-
masing, ganti **Subject** dan **Message body**, lalu Save.

> **Jangan ubah `{{ .ConfirmationURL }}`.** Itu variabel yang diisi Supabase
> saat mengirim. Salah ketik satu huruf dan tautannya tidak akan pernah bekerja,
> tanpa error apa pun di mana pun.

---

## 1. Confirm signup

Dikirim saat orang mendaftar, dan saat penerima undangan membuat akun baru.

**Subject**

```
Konfirmasi email Anda di TokoKu
```

**Message body**

```html
<div style="margin:0;padding:24px 12px;background:#fafbf6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#17231c">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4eae2;border-radius:16px;overflow:hidden">
    <div style="padding:20px 24px;background:#0e2419;color:#a1ffce;font-size:15px;font-weight:700">
      TokoKu
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.5">
        Terima kasih sudah mendaftar di <strong>TokoKu</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b6b60">
        Tekan tombol di bawah untuk memastikan alamat email ini benar milik Anda.
        Setelah itu Anda bisa langsung masuk.
      </p>
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;padding:12px 22px;background:#0e2419;color:#a1ffce;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Konfirmasi Email
      </a>
      <p style="margin:20px 0 6px;font-size:12.5px;color:#8b9a90">
        Kalau tombolnya tidak bisa ditekan, salin tautan ini ke browser:
      </p>
      <p style="margin:0;font-size:12px;color:#5b6b60;word-break:break-all">{{ .ConfirmationURL }}</p>
      <hr style="border:none;border-top:1px solid #e4eae2;margin:22px 0" />
      <p style="margin:0;font-size:12.5px;color:#8b9a90;line-height:1.6">
        Kalau Anda tidak merasa mendaftar di TokoKu, abaikan saja email ini.
        Tanpa dibuka, akunnya tidak akan aktif.
      </p>
    </div>
  </div>
  <p style="max-width:520px;margin:14px auto 0;font-size:11.5px;color:#8b9a90;text-align:center">
    TokoKu: POS &amp; ERP retail UMKM &middot; by Seawise Studio
  </p>
</div>
```

---

## 2. Reset password

Dikirim dari halaman **Lupa Kata Sandi**.

**Subject**

```
Atur ulang kata sandi TokoKu Anda
```

**Message body**

```html
<div style="margin:0;padding:24px 12px;background:#fafbf6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#17231c">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4eae2;border-radius:16px;overflow:hidden">
    <div style="padding:20px 24px;background:#0e2419;color:#a1ffce;font-size:15px;font-weight:700">
      TokoKu
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.5">
        Ada permintaan untuk mengatur ulang kata sandi akun ini.
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b6b60">
        Tekan tombol di bawah untuk membuat kata sandi baru. Kata sandi lama Anda
        tetap berlaku sampai yang baru disimpan.
      </p>
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;padding:12px 22px;background:#0e2419;color:#a1ffce;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Buat Kata Sandi Baru
      </a>
      <p style="margin:20px 0 6px;font-size:12.5px;color:#8b9a90">
        Kalau tombolnya tidak bisa ditekan, salin tautan ini ke browser:
      </p>
      <p style="margin:0;font-size:12px;color:#5b6b60;word-break:break-all">{{ .ConfirmationURL }}</p>
      <hr style="border:none;border-top:1px solid #e4eae2;margin:22px 0" />
      <p style="margin:0;font-size:12.5px;color:#8b9a90;line-height:1.6">
        Tautan ini berlaku 1 jam dan hanya bisa dipakai sekali. Kalau bukan Anda yang
        meminta, abaikan saja email ini — kata sandi Anda tidak akan berubah.
      </p>
    </div>
  </div>
  <p style="max-width:520px;margin:14px auto 0;font-size:11.5px;color:#8b9a90;text-align:center">
    TokoKu: POS &amp; ERP retail UMKM &middot; by Seawise Studio
  </p>
</div>
```

---

## Kenapa gayanya inline semua

Alasan yang sama dengan template undangan di `lib/email.ts`: Gmail web membuang
`<style>` di dalam `<head>` dan tidak mengenal CSS variable. Warna brand karena
itu ditulis apa adanya (`#0e2419`, `#a1ffce`) — ini satu-satunya tempat di
project ini yang boleh begitu.

Tautannya juga selalu ditulis sebagai teks di bawah tombol: sebagian klien email
menampilkan tombol berwarna sebagai kotak kosong, dan tautan yang tidak bisa
diklik sama saja dengan email yang tidak terkirim.

## Setelah menempel, uji

1. Buka `/lupa-sandi` di produksi, masukkan email Anda sendiri.
2. Emailnya harus datang **dari `send.seawise.id`** dan berbahasa Indonesia.
3. Tautannya harus mengarah ke `https://tokoku.seawise.id/auth/konfirmasi?...`
   — bukan `localhost`. Kalau masih localhost, yang salah bukan template ini
   melainkan **Authentication → URL Configuration**; lihat catatan di CLAUDE.md
   bagian "Reset kata sandi".
