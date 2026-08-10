# TokoKu — Cara Menjalankan

## Kondisi saat ini

Yang **sudah** ada:
- Scaffold Next.js 16 + TypeScript + Tailwind v4, tema Lime Crush sudah terpasang
- Koneksi Supabase (klien browser, server, admin) + penyegaran sesi di `proxy.ts`
- **13 migrasi sudah diterapkan** ke project `tokoku` (`kgtjbrpycfdfrpexktbr`,
  Singapore, Postgres 17) — 24 tabel, RLS aktif, 3 paket ter-seed
- Isolasi RLS sudah diuji: 12 tabel tenant dicoba dengan anon key, semua kosong
- **Login + AppShell + navigasi 3 role** (fase 0–2) — sudah diuji lewat browser
- Halaman berdata asli: Beranda, Produk & Stok, Transaksi, Riwayat, Profil,
  Dashboard Super Admin, Manajemen Klien
- **Kasir/POS offline-first** (fase 4) — Dexie + outbox + service worker.
  Sudah diuji: jualan saat Supabase diblokir, sync otomatis saat tersambung
  lagi, kiriman ulang tidak menggandakan data, dan halaman tetap termuat
  saat server aplikasi dimatikan.
- Halaman status penyiapan dipindah ke `/setup`

- **Fase 4 lengkap**: cetak struk 58mm, buka/tutup shift dengan hitung kas,
  halaman `/pengaturan/sinkronisasi`, detail transaksi + cetak ulang

- **Fase 3**: CRUD produk lewat drawer + penyesuaian stok (opname), dengan
  validasi zod, pencarian, filter kategori, dan soft delete

- **Fase 5**: halaman Laporan — omset harian, produk terlaris, komposisi
  pembayaran, rincian harian, dengan pilihan periode 7/30/90 hari
- Pembatalan transaksi lewat UI (stok kembali otomatis)

- **Fase 6**: pengaturan toko, tim & akses dengan undangan, kelola kategori,
  struk & printer (dengan pratinjau langsung), halaman About

- **Halaman auth split-panel** dengan animasi clip-path + pendaftaran toko mandiri

- **Area Super Admin**: kelola paket, detail klien (ubah paket & status),
  dan "Lihat sebagai Klien" (mode hanya-baca, tercatat di audit)

Yang **belum** ada: pengiriman email undangan, multi-outlet di UI,
pendaftaran mandiri masih 1 akun = 1 toko.

> **Konfirmasi email menyala** di project Supabase ini. Setelah daftar, user
> harus mengonfirmasi email lalu masuk — aplikasi mengarahkannya ke
> `/daftar-toko` untuk menyelesaikan pembuatan toko.

> Service worker **hanya aktif di build production** (`npm run build && npm start`).
> Di `npm run dev` sengaja dilewati agar hot reload tidak menyajikan bundel basi.

---

## 1. Jalankan di lokal

```bash
npm install      # sudah dijalankan
npm run dev
```

Buka **http://localhost:3000** — akan diarahkan ke halaman masuk. Login dengan akun
demo di bagian 7. Cek status koneksi Supabase kapan saja di **/setup**.

**Di VS Code:** buka folder `tokoku-erp`, lalu terminal (`Ctrl+``) → `npm run dev` →
Cmd-klik link `http://localhost:3000` yang muncul. Untuk melihat wireframe aslinya,
klik kanan `REFERENCE-wireframe.html` → *Open with Live Server*, atau langsung
`open REFERENCE-wireframe.html` di terminal.

---

## 2. Sambungkan Supabase

### 2a. Buat project
[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
Region **Southeast Asia (Singapore)** — paling dekat ke Indonesia, selisih latensinya
terasa di POS. Simpan database password yang muncul; hanya ditampilkan sekali.

### 2b. Isi kredensial
```bash
cp .env.local.example .env.local
```

Dashboard → **Project Settings → Data API** ambil *Project URL*, lalu
**Project Settings → API Keys** ambil *anon* dan *service_role*. Isikan ke `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

> `service_role` melewati seluruh RLS. Jangan pernah diberi awalan `NEXT_PUBLIC_`
> dan jangan diimpor dari komponen client — `lib/supabase/admin.ts` sudah dijaga
> dengan `import 'server-only'` supaya build gagal kalau itu terjadi.

Jalankan ulang `npm run dev` (variabel lingkungan hanya dibaca saat start), lalu
muat ulang `/`. Statusnya akan berubah jadi *"Terhubung — tapi migrasi belum dijalankan"*.

### 2c. Jalankan migrasi

```bash
supabase login
supabase link --project-ref <project-ref>   # ref ada di URL dashboard
npm run db:push                              # = supabase db push
```

Muat ulang `/`. Kalau hijau dan tiga paket (Starter/Growth/Enterprise) muncul,
koneksinya benar sampai ke lapisan RLS.

> `db push` menjalankan migrasi saja. Untuk memuat `supabase/seed.sql` ke project
> remote, tempel isinya di **SQL Editor** dashboard. `npm run db:reset` memuat seed
> otomatis, tapi itu **menghapus seluruh data** — hanya untuk database lokal.

### 2d. Isi data demo
```bash
node scripts/seed-demo.mjs
```
Membuat tenant Toko Dewi beserta tim, produk, dan transaksi. Lihat bagian 7.

### 2e. Type TypeScript dari skema
```bash
npm run db:types
```
Menghasilkan `lib/supabase/database.types.ts` sehingga setiap query Supabase
ter-typecheck. Jalankan ulang tiap kali skema berubah.

---

## 3. Uji lokal penuh (opsional)

Perlu Docker Desktop — saat ini **belum terpasang** di mesin ini. Setelah dipasang:

```bash
supabase start        # Postgres + Auth + Studio lokal
supabase db reset     # jalankan semua migrasi + seed dari nol
```

Berguna untuk menguji migrasi tanpa menyentuh project cloud. Tidak wajib —
`db push` ke project development terpisah sudah cukup.

---

## 4. Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | server pengembangan |
| `npm run build` | build produksi |
| `npm run typecheck` | cek TypeScript tanpa build |
| `npm run db:push` | kirim migrasi ke project ter-link |
| `npm run db:types` | hasilkan tipe TypeScript dari skema |
| `npm run db:reset` | **hapus** & bangun ulang DB lokal + seed |

---

## 5. Struktur

```
app/
  layout.tsx        font Sora / Plus Jakarta Sans / JetBrains Mono
  globals.css       token Lime Crush (@theme Tailwind v4)
  page.tsx          pengalih ke beranda sesuai peran
  setup/            halaman status koneksi
  (auth)/           masuk + server action signIn/signOut
  (toko)/           beranda, kasir, produk, transaksi, riwayat, profil
  (platform)/admin/ dashboard, klien, pengaturan platform
components/
  layout/           AppShell, Topbar, Sidebar, BottomNav, BrandMark, PageHeader
  ui/icons.tsx      registry ikon dari wireframe
  domain/           TransactionTable, ClientRow, ProductTable, ProductDrawer,
                    StockDrawer, ShiftCard
  overlay/Drawer    panel geser untuk semua form
  data/IconAction   tombol aksi baris (dengan konfirmasi dua langkah)
  pos/              PosClient, ProductGrid, CartPanel, PaymentModal, SuccessModal,
                    SyncStatusChip, ServiceWorkerRegistrar
lib/
  env.ts            pemeriksaan variabel lingkungan
  auth.ts           konteks sesi + requireSession/requirePermission
  navigation.ts     konfigurasi menu per peran
  format.ts         rupiah, jam, tanggal, cn
  offline/          db (Dexie), outbox, catalog, device, connection, trx
  stores/cart.ts    keranjang (Zustand, persist)
  supabase/
    client.ts       komponen client   — anon key, tunduk RLS
    server.ts       server component  — anon key, tunduk RLS
    admin.ts        service_role      — MELEWATI RLS, server-only
    session.ts      penyegaran sesi untuk proxy.ts
proxy.ts            konvensi middleware Next 16
public/sw.js        service worker — app shell offline
scripts/            seed-demo.mjs, grant-platform-admin.mjs
supabase/
  config.toml
  migrations/       14 file, Postgres 17
  seed.sql
```

---

## 6. Catatan versi

Scaffold ini memakai **Next.js 16.3** (bukan 15 seperti tertulis di `PLAN.md` awal) —
`npm audit` menunjukkan 3 kerentanan *high* pada Next 15 lewat postcss & sharp, dan
Next 16 bersih. Konsekuensinya konvensi `middleware.ts` diganti `proxy.ts`; sudah
disesuaikan. `npm audit` sekarang **0 vulnerabilities**.

---

## 7. Akun demo

Seed `scripts/seed-demo.mjs` membuat satu tenant lengkap: **Toko Dewi** (Denpasar,
paket Growth) dengan 4 anggota tim, 8 produk, 1 perangkat POS, dan 5 transaksi hari ini.

| Email | Peran | Melihat |
|---|---|---|
| `rina@tokodewi.id` | Pemilik | Beranda, Transaksi, Kasir, Produk, Profil |
| `agus@tokodewi.id` | Admin Toko | sama, tanpa pengaturan |
| `nanda@tokodewi.id` | Kasir | Kasir, Riwayat, Profil |
| `melati@tokodewi.id` | Kasir | Kasir, Riwayat, Profil |
| `budi@tokodewi.id` | Kasir + izin Laporan | Beranda, Transaksi, Kasir, Laporan, Profil |
| `seawise.cc@gmail.com` | Super Admin | Dashboard, Klien, Pengaturan platform (sandi `admin123`) |
| `siti.warungbarokah@gmail.com` | Pemilik tenant kedua | Warung Barokah, Semarang |

Kata sandi semuanya `TokoKu123!`.

> Ini kredensial **development**. Sebelum production, hapus kelima user ini
> lewat dashboard Authentication.

Jalankan ulang kapan saja — skrip memeriksa dulu sebelum menulis:
```bash
node scripts/seed-demo.mjs
```


---

## 8. Super Admin

Tidak ada UI untuk ini — dengan sengaja. Halaman "jadikan saya super admin" adalah
lubang keamanan, dan hak platform disimpan di tabel terpisah (`platform_admins`)
justru agar tidak bisa di-set lewat update profil sendiri.

1. Buat usernya: Dashboard → **Authentication → Users → Add user**
   (centang *Auto Confirm User*).
2. Beri haknya:
   ```bash
   node scripts/grant-platform-admin.mjs email-anda@domain.com
   node scripts/grant-platform-admin.mjs --list            # lihat daftar
   node scripts/grant-platform-admin.mjs email --revoke    # cabut
   ```
3. Login ulang agar peran barunya terbaca.

Menjalankan skrip ini butuh `SUPABASE_SERVICE_ROLE_KEY` — hanya dipegang orang
yang memang mengelola project.
