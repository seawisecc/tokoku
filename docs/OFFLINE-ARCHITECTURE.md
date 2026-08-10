# TokoKu — Arsitektur Offline + Online

Jawaban singkat: **bisa**, dan untuk POS retail UMKM sebenarnya wajib. Tapi kuncinya
**jangan membuat seluruh aplikasi offline** — hanya layar Kasir. Sisanya online saja.

Alasannya sederhana: sinkronisasi dua arah untuk data yang bisa diubah dari mana-mana
(produk, harga, tim, pengaturan) adalah sumber bug tak berujung. Sementara transaksi
penjualan justru kasus paling mudah di dunia sync — **append-only**, tidak pernah diubah
setelah dibuat, dan tidak pernah bentrok dengan transaksi dari kasir lain.

---

## 1. Batas offline

| Modul | Offline? | Alasan |
|---|---|---|
| **Kasir / POS** | ✅ penuh | Ini yang bikin toko rugi kalau internet mati |
| Katalog produk (baca) | ✅ cache | Dibutuhkan POS; hanya baca, server yang berkuasa |
| Riwayat transaksi kasir | ✅ lokal | Yang ada di perangkat itu saja |
| Buka/tutup shift | ✅ | Antre seperti transaksi |
| Cetak struk | ✅ | Cetak ke printer Bluetooth/USB lokal |
| Tambah/ubah produk | ❌ | Butuh SKU unik & validasi server |
| Laporan & Beranda | ❌ | Butuh agregat lintas perangkat |
| Tim, pengaturan, langganan | ❌ | Jarang dipakai, selalu ada sinyal saat dipakai |
| Super Admin | ❌ | — |

Saat offline, menu selain Kasir & Riwayat ditampilkan tapi menampilkan status
"Butuh koneksi" alih-alih menghilang — kasir tidak bingung mengira aplikasi rusak.

---

## 2. Kenapa desain ini nyaris tanpa konflik

Tiga keputusan yang menghilangkan hampir seluruh kelas konflik sync:

**a. Aliran data satu arah per jenis data.**
Katalog: server → perangkat (perangkat tidak pernah menulis).
Penjualan: perangkat → server (server tidak pernah mengubah).
Tidak ada data yang ditulis dua pihak, jadi tidak ada yang perlu di-merge.

**b. ID transaksi dibuat di perangkat (UUID v7).**
Konsekuensinya sync jadi **idempoten gratis**: kirim ulang batch yang sama →
primary key bentrok → server balas `duplicate`, bukan data ganda. Ini penting
karena kegagalan paling umum bukan "request gagal", melainkan "request berhasil
tapi jawabannya tidak sampai".
UUID v7 (bukan v4) dipilih agar berurutan waktu → index B-tree tidak terfragmentasi.

**c. Nomor transaksi diberi awalan kode perangkat.**
`TRX-20260807-K1-0042` — `K1` adalah kode device. Tiap perangkat menomori sendiri
tanpa perlu bertanya ke server, dan hasilnya tetap unik satu toko. Alternatifnya
(counter terpusat) mustahil dipakai offline, dan menomori ulang setelah sync
akan membuat nomor di struk yang sudah dicetak tidak cocok dengan database — hal
yang tidak bisa diterima untuk pembukuan.

---

## 3. Stok: satu-satunya bagian yang benar-benar sulit

Perangkat offline **tidak mungkin tahu** stok sebenarnya — kasir lain mungkin sedang
menjual barang yang sama.

**Keputusan: stok boleh minus, transaksi offline tidak pernah ditolak.**

`product_stocks.quantity` sengaja tanpa `CHECK (quantity >= 0)`. Kalau dua kasir
offline sama-sama menjual 5 pcs padahal stok sistem 8, hasilnya −2.

Menolak transaksi kedua saat sync adalah pilihan yang salah: **barangnya sudah keluar
dari rak dan uangnya sudah diterima jam 11.42.** Yang salah adalah angka stoknya,
bukan penjualannya. Menolak berarti membuang catatan penjualan yang nyata —
pembukuan jadi bohong demi angka stok yang tetap tidak akurat.

Yang dilakukan sistem:
- Penjualan tetap dicatat, stok jadi minus.
- Baris muncul di `v_stock_alert` dengan `severity = 'negative'`.
- Pemilik dapat notifikasi "3 produk perlu penyesuaian stok" → selesaikan lewat opname.

Untuk **transaksi online**, stok kurang tetap ditolak (kecuali `allow_negative_stock`
dinyalakan) — di situ servernya tahu pasti, jadi tidak ada alasan membiarkan minus.

Mitigasi di sisi UI: kartu produk di POS menampilkan stok cache dengan penanda
"terakhir disinkronkan 12 menit lalu" saat offline, supaya kasir tidak menganggap
angkanya mutlak.

---

## 4. Tumpukan teknologi klien

| Kebutuhan | Pilihan | Catatan |
|---|---|---|
| Penyimpanan lokal | **Dexie.js** (IndexedDB) | matang, TypeScript bagus, ~25KB |
| Shell aplikasi offline | **Serwist** (penerus next-pwa) | precache rute `/kasir`, aset, font |
| Deteksi koneksi | `navigator.onLine` + ping ringan ke Supabase | `onLine` sering bohong; wajib ada ping |
| Antrean kirim | tabel `outbox` di IndexedDB | retry exponential backoff |
| State keranjang | Zustand + persist ke IndexedDB | keranjang selamat walau tab tertutup |
| Cetak | Web Bluetooth / WebUSB ESC-POS | jalan offline; fallback dialog cetak browser |

### Tidak pakai PowerSync / ElectricSQL

Keduanya bagus dan resmi mendukung Supabase, tapi untuk kasus ini berlebihan:
permukaan offline kita hanya satu tabel tulis (`transactions`) dan tiga tabel baca.
Menambah sync engine berarti menambah biaya bulanan, satu layanan lagi yang bisa mati,
dan ketergantungan vendor — untuk masalah yang selesai dengan ±400 baris kode.

Pertimbangkan ulang **kalau** nanti butuh offline untuk modul yang bisa diedit
dua arah (mis. stok opname multi-perangkat).

---

## 5. Skema penyimpanan lokal (IndexedDB)

```ts
// db/local.ts
export const local = new Dexie('tokoku') as Dexie & {
  meta:        Table<{ key: string; value: unknown }>
  products:    Table<LocalProduct>      // cache katalog
  categories:  Table<LocalCategory>
  stocks:      Table<LocalStock>        // stok cache + delta lokal
  members:     Table<LocalMember>       // untuk unlock PIN offline
  outbox:      Table<OutboxTransaction> // ANTREAN — sumber kebenaran offline
  receipts:    Table<LocalReceipt>      // struk tercetak, untuk cetak ulang
}

local.version(1).stores({
  meta:       'key',
  products:   'id, sku, barcode, category_id, name',
  categories: 'id, sort_order',
  stocks:     '[product_id+outlet_id], product_id',
  members:    'id, user_id',
  outbox:     'id, status, client_created_at',   // status: pending|sending|synced|rejected
  receipts:   'id, client_created_at',
})
```

`meta` menyimpan: `last_pull_at`, `catalog_version`, `device_id`, `outlet_id`,
`active_shift_id`, `session` (JWT + refresh token terenkripsi).

---

## 6. Alur

### 6.1 Registrasi perangkat (sekali, saat online)
```
Buka /kasir pertama kali
  → cek meta.device_id
  → belum ada: insert ke devices { outlet_id, code: 'K1'|'K2'|…, name }
  → simpan device_id + outlet_id ke meta
  → pull_catalog(since = epoch)
```
Kode device diusulkan otomatis (`K1`, `K2`, …) dan bisa diganti pemilik di
`/pengaturan/outlet`.

### 6.2 Pull katalog (delta)
```
setiap 5 menit saat online, dan setiap kali kembali online:
  pull_catalog(org, outlet, since = meta.last_pull_at)
  → bulkPut ke Dexie, hapus baris ber-deleted_at
  → meta.last_pull_at = response.server_time
```
Perbandingan `catalog_version` dipakai sebagai jalur cepat: kalau versinya sama,
lewati sama sekali.

### 6.3 Transaksi
```
Kasir tekan "Bayar"
  1. Buat objek transaksi LENGKAP di client (id uuidv7, code, items,
     unit_price snapshot, total, client_created_at)
  2. Tulis ke outbox { status: 'pending' }        ← ini yang bikin cepat & aman
  3. Kurangi stok cache lokal
  4. Cetak struk        ← langsung, tanpa menunggu server
  5. Tampilkan modal sukses
  6. Picu sync di latar belakang (tidak memblokir UI)
```

Perhatikan: **alurnya sama persis baik online maupun offline.** Tidak ada dua
cabang kode. Online hanya berarti langkah 6 selesai dalam 200ms, bukan 3 jam
kemudian. Ini menghilangkan seluruh kelas bug "jalan saat online, rusak saat offline",
karena jalur offline-lah yang selalu diuji.

### 6.4 Sync (background)
```
Pemicu: kembali online · timer 30 detik · app kembali ke foreground · manual

  ambil ≤50 baris outbox status='pending'
  tandai 'sending'
  rpc sync_transactions(org, device_id, batch, app_version)
    → accepted  : outbox.status = 'synced' (dipangkas setelah 30 hari)
    → duplicate : outbox.status = 'synced'          ← aman, bukan error
    → rejected  : outbox.status = 'rejected' + tampilkan di UI
  gagal jaringan → kembalikan ke 'pending', backoff 2s → 4s → … maks 5 menit
```

Batas 50 per batch menjaga request tetap kecil di jaringan 3G yang buruk.

### 6.5 Autentikasi saat offline
Masalah: JWT Supabase hidup 1 jam. Toko buka 12 jam. Internet mati jam ke-2.

Rancangan:
- Session (access + refresh token) di-cache di IndexedDB.
- Saat offline, aplikasi **tidak** mencoba refresh dan **tidak** melempar user ke login.
  POS tetap jalan dengan identitas kasir yang di-cache — semua penulisan toh
  masuk outbox lokal, belum menyentuh server.
- Ganti kasir / buka kunci layar saat offline pakai **PIN 6 digit** yang diverifikasi
  terhadap verifier lokal (PBKDF2 + salt per perangkat, dibuat saat login online
  pertama). Hash bcrypt di `member_pins` tidak pernah dikirim ke perangkat.
- Begitu online kembali: refresh token dijalankan. Kalau ditolak (kasir dinonaktifkan),
  outbox **tetap dikirim** memakai sesi pemilik saat login berikutnya — data penjualan
  tidak boleh hilang hanya karena akun kasir dicabut.

---

## 7. Yang harus terlihat di UI

Offline yang senyap membuat orang tidak percaya pada aplikasinya. Yang wajib tampil:

1. **`OfflineBanner`** — pita di bawah topbar: "Mode offline · 7 transaksi menunggu dikirim".
2. **`SyncStatusChip`** di POS — titik hijau/kuning/merah + "tersinkron 2 mnt lalu".
3. **Badge antrean** di ikon profil saat ada outbox pending.
4. **Halaman `/pengaturan/sinkronisasi`** — daftar perangkat (`v_sync_health`), antrean
   per perangkat, dan daftar `sync_rejections` yang belum diselesaikan.
5. **Notifikasi pemilik** kalau ada perangkat tidak sync > 24 jam, atau ada penolakan
   yang belum ditangani.
6. Tombol **"Kirim sekarang"** manual — memberi rasa kendali saat sinyal timbul-tenggelam.

---

## 8. Yang harus diuji

Bagian ini yang biasanya dilewat dan menyebabkan kehilangan data:

- Tutup tab tepat setelah cetak struk, sebelum sync → transaksi harus selamat di outbox.
- Kirim batch, matikan jaringan sebelum response sampai → kirim ulang harus jadi
  `duplicate`, bukan data ganda.
- Dua perangkat menjual produk yang sama saat offline → stok minus, dua transaksi
  keduanya tercatat.
- Produk dihapus di web saat kasir offline lalu menjualnya → transaksi diterima,
  item pakai snapshot nama, muncul peringatan.
- Jam perangkat mundur/maju → `client_created_at` tetap dipakai laporan; tampilkan
  peringatan kalau selisihnya dengan `server_time` > 5 menit saat sync.
- Kuota IndexedDB penuh → blokir transaksi baru dengan pesan jelas, bukan gagal diam-diam.
- 500 transaksi menumpuk selama seharian mati internet → sync bertahap, UI tidak beku.

---

## 9. Dampak ke rencana kerja

Mode offline menambah kira-kira **1 fase kerja** dan menggeser urutan:
POS harus dibangun outbox-first sejak awal, karena mengubah POS online menjadi
offline-first belakangan berarti menulis ulang seluruh alur pembayaran.

| Fase | Perubahan |
|---|---|
| 1 | +`devices`, `sync_batches`, `sync_rejections`, `member_pins` (sudah masuk DDL) |
| 4 | POS langsung outbox-first — bukan online dulu |
| 4b | **Fase baru:** engine sync, Serwist/PWA, banner status, halaman sinkronisasi |
| 6 | +`/pengaturan/sinkronisasi` |
