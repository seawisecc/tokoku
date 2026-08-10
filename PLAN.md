# TokoKu — Rencana Teknis

**POS & ERP Retail UMKM · Multi-tenant SaaS · Offline-capable**
TokoKu by Seawise Studio · Next.js + Supabase + Vercel

> Dokumen rencana. Fase 0–6 sudah dibangun dan 16 migrasi sudah diterapkan —
> lihat `SETUP.md` untuk kondisi terkini.

| Dokumen | Isi |
|---|---|
| `PLAN.md` (ini) | ringkasan stack, route, komponen, urutan kerja |
| `docs/OFFLINE-ARCHITECTURE.md` | rancangan offline + online lengkap |
| `supabase/migrations/*.sql` | DDL final: tabel, index, RLS, RPC, trigger, view |
| `REFERENCE-wireframe.html` | sumber kebenaran desain & flow |

---

## 0. Keputusan Stack

| Area | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js 16 App Router, TypeScript | Next 15 punya kerentanan high lewat postcss & sharp |
| DB / Auth | Supabase (Postgres + RLS) | multi-tenant satu DB, RLS sebagai jaring terakhir |
| Styling | Tailwind v4 + CSS variables | token "Lime Crush" dipakai apa adanya |
| Tabel | TanStack Table dibungkus `DataTable` | lanjutan pattern project sebelumnya |
| Form | zod + Server Actions (form terkendali state) | React 19 me-reset form ber-`action`; input tak terkendali kehilangan isinya |
| **Offline** | **Dexie (IndexedDB) + outbox + service worker** | lihat `docs/OFFLINE-ARCHITECTURE.md` |
| State POS | Zustand, persist ke IndexedDB | keranjang selamat walau tab tertutup |
| Font | `next/font` — Sora, Plus Jakarta Sans, JetBrains Mono | identik wireframe |
| Uang | `bigint` rupiah bulat | tanpa float, tanpa sen |
| Deploy | Vercel | — |

**Token warna** dipindah utuh ke `globals.css` tanpa perubahan nilai: lime `#F9F586`,
mint `#A1FFCE`, forest `#0E2419` (dark base sidebar/avatar/`btn-dark`), forest-soft
`#173C2B`, forest-softer `#20493A`, paper `#FAFBF6`, ink `#17231C`, ink-soft `#5B6B60`,
ink-faint `#8B9A90`, line `#E4EAE2`, coral `#E8543E`, plus soft-tint dan radius 24/16/10.

---

## 1. Skema Database

DDL lengkap ada di `supabase/migrations/`. Ringkasannya:

| File (`…0900NN_`) | Isi |
|---|---|
| `01_extensions_and_types` | pgcrypto, citext, pg_trgm + 9 enum |
| `02_profiles_and_platform` | `profiles`, `plans`, `platform_admins`, `platform_settings` |
| `03_tenant` | `organizations`, `outlets`, `organization_members`, `member_pins`, `invitations`, `devices` |
| `04_catalog_inventory` | `categories`, `products`, `product_stocks`, `stock_movements` |
| `05_sales` | `customers`, `shifts`, `transactions`, `transaction_items`, `transaction_payments` |
| `06_sync_audit_billing` | `sync_batches`, `sync_rejections`, `audit_logs`, `impersonation_sessions`, `subscription_events` |
| `07_rls_helpers` | 6 fungsi helper `SECURITY DEFINER` |
| `08_rls_policies` | RLS untuk 24 tabel |
| `09_functions_rpc` | `_apply_transaction`, `create_transaction`, `sync_transactions`, `pull_catalog`, `void_transaction`, shift, `adjust_stock`, PIN, `provision_organization` |
| `10_triggers` | `updated_at`, profil baru, `catalog_version`, stok awal, penjaga owner terakhir, audit |
| `11_views` | `v_client_overview`, `v_product_stock`, `v_daily_sales`, `v_product_sales`, `v_stock_alert`, `v_sync_health` |
| `seed.sql` | 3 paket + katalog demo dari wireframe |

### Keputusan desain yang penting

**`organization_id` di setiap tabel tenant**, termasuk tabel anak seperti
`transaction_items` dan `transaction_payments`. Redundan secara relasional, tapi
membuat setiap policy RLS bisa dievaluasi tanpa JOIN — ini yang menjaga query
tetap cepat setelah data menumpuk.

**Uang `bigint` rupiah bulat**, bukan `numeric` atau float. Rupiah tidak punya sen;
`decimal` hanya menambah biaya tanpa manfaat.

**Snapshot di `transaction_items`** — `product_name`, `sku`, `unit_price`, `unit_cost`
disalin saat transaksi. Harga boleh berubah besok, struk lama harus tetap benar,
dan laporan margin harus memakai HPP saat barang itu terjual.

**`client_created_at` vs `created_at` di `transactions`.** Semua laporan memakai
`client_created_at` (jam di mesin kasir). `created_at` hanya mencatat kapan baris masuk
ke Postgres — untuk transaksi offline bisa terlambat berjam-jam, dan memakainya di
laporan akan menempatkan penjualan di tanggal yang salah.

**Soft delete (`deleted_at`) pada products/categories/customers.** Bukan sekadar
kerapian: perangkat offline perlu tahu baris mana yang dihapus agar cache lokalnya
ikut membuang, dan hard delete tidak muncul di delta sync.

**`product_stocks.quantity` sengaja boleh negatif.** Alasan lengkap di
`docs/OFFLINE-ARCHITECTURE.md` §3 — singkatnya, transaksi offline yang tersinkron
terlambat sudah terjadi secara fisik; menolaknya berarti membuang catatan penjualan
yang nyata demi angka stok yang tetap tidak akurat.

**Nomor transaksi berawalan kode perangkat** (`TRX-20260807-K1-0042`). Menghapus
kebutuhan counter terpusat, sehingga tiap perangkat bisa menomori sendiri saat offline
dan nomor di struk yang sudah dicetak tidak akan pernah berubah.

**Append-only di mana perlu.** `stock_movements` dan `audit_logs` tidak punya policy
UPDATE/DELETE untuk siapa pun. Transaksi tidak pernah dihapus — hanya di-void lewat
RPC yang sekaligus mengembalikan stok.

### RLS

Tiga fungsi jadi tulang punggungnya, semuanya `SECURITY DEFINER STABLE`:
`user_org_ids()`, `user_role_in(org)`, `user_can(org, perm)`, plus
`is_platform_admin()`, `can_manage(org)`, `can_read_org(org)`.

`SECURITY DEFINER` bukan pilihan gaya — tanpanya, policy pada `organization_members`
akan memanggil query ke `organization_members` sendiri dan menyebabkan rekursi tak berujung.

Pembagian hak yang dikodekan di policy:
- **Kasir** hanya boleh `INSERT` transaksi, tidak pernah `UPDATE`/`DELETE`. Membaca
  hanya transaksinya sendiri (layar Riwayat).
- **Produk & kategori** read-only untuk kasir; tulis butuh izin modul `products`.
- **Komposisi tim & role** hanya `owner`.
- **Hash PIN** tidak bisa dibaca siapa pun (`for select using (false)`) — verifikasi
  hanya lewat `verify_member_pin()`.
- **Super Admin** lolos lewat `is_platform_admin()` untuk baca; tulis tetap dibatasi.

**Optimisasi fase 2:** pindahkan `user_org_ids()` ke JWT claim lewat Custom Access Token
Hook Supabase. Bentuk policy tidak berubah, hanya subquery-nya hilang.

**Impersonation "Login sebagai Klien"** tidak memalsukan JWT. Super admin sudah lolos
policy baca; server menyimpan cookie `impersonated_org_id` yang divalidasi middleware
terhadap `platform_admins`, membuka baris `impersonation_sessions` (kedaluwarsa 1 jam),
dan menandai semua tulisan di `audit_logs.acting_as_admin`. UI menampilkan pita
peringatan permanen.

---

## 2. Struktur Route

**Tenant lewat cookie sesi, bukan URL.** URL tetap `/produk`, bukan `/t/toko-dewi/produk`
— hampir semua user UMKM hanya punya satu toko, dan Super Admin sudah punya jalur
`/admin/klien/[id]`. Kalau nanti perlu switcher multi-org, cukup ganti isi cookie;
struktur folder tidak berubah.

```
app/
├── layout.tsx                          # font, token, Providers, registrasi service worker
├── page.tsx                            # redirect by role → /admin | /beranda | /kasir
├── about/page.tsx                      # "TokoKu by Seawise Studio"
│
├── (auth)/
│   ├── masuk · daftar · lupa-password · reset-password
│   └── undangan/[token]/page.tsx
│
├── (platform)/admin/
│   ├── layout.tsx                      # guard is_platform_admin
│   ├── page.tsx                        # Dashboard (hero, 4 stat, bar chart, klien terbaru)
│   ├── klien/
│   │   ├── page.tsx                    # tabel Manajemen Klien ← v_client_overview
│   │   ├── @drawer/(.)[id]/page.tsx    # intercepting route → drawer detail
│   │   └── [id]/page.tsx               # halaman penuh (deep-link / refresh)
│   ├── paket/ · pengaturan/ · audit/
│
├── (toko)/
│   ├── layout.tsx                      # AppShell + guard org aktif + OfflineBanner
│   ├── beranda/page.tsx
│   ├── kasir/page.tsx                  # POS — outbox-first, jalan offline
│   ├── transaksi/page.tsx + [id]/page.tsx
│   ├── riwayat/page.tsx                # kasir: transaksinya sendiri (bisa dari cache lokal)
│   ├── produk/
│   │   ├── page.tsx + @drawer/(.)[id]/page.tsx + [id]/page.tsx
│   │   └── kategori/page.tsx
│   ├── stok/page.tsx + opname/page.tsx
│   ├── laporan/page.tsx + penjualan/ + produk/
│   ├── pelanggan/page.tsx
│   ├── profil/page.tsx
│   └── pengaturan/
│       ├── toko/ · outlet/ · tim/ · printer/ · langganan/
│       └── sinkronisasi/page.tsx       # ← baru: v_sync_health + sync_rejections
│
├── struk/[id]/page.tsx                 # layout cetak 58/80mm, tanpa shell
├── offline/page.tsx                    # fallback service worker
└── api/
    ├── auth/callback/route.ts
    └── impersonate/route.ts
```

**Pemetaan wireframe → route:** `screenAdminDashboard`→`/admin` · `screenAdminKlien`+
`clientDrawer`→`/admin/klien`+`@drawer` · `screenAdminPengaturan`→`/admin/pengaturan` ·
`screenOwnerBeranda`→`/beranda` · `screenTransaksi`→`/transaksi` · `screenKasir`→`/kasir` ·
`screenProduk`+`productDrawer`→`/produk`+`@drawer` · `screenProfil`+`teamDrawer`→`/profil`+
`/pengaturan/tim` · `screenRiwayat`→`/riwayat`.

`role-switch` di topbar wireframe adalah alat demo — **tidak dibawa ke produksi**.
Nav dirender dari role asli user; config `NAV` (termasuk flag `fab` untuk tombol Kasir
di bottom nav) dipindah ke `lib/navigation.ts` dengan struktur objek yang sama.

**Proteksi berlapis 3:** middleware (sesi + org aktif) → layout server component
(`requireRole` / `requirePermission`) → RLS di database.

---

## 3. Komponen Reusable

Meneruskan pattern **DataTable** dan **IconAction** dari project ERP sebelumnya.
*(Asumsi: DataTable = wrapper kolom-deklaratif dengan toolbar + state; IconAction =
tombol ikon baris dengan tooltip + konfirmasi. Kalau API-nya berbeda, kirim file
komponen lamanya — akan saya samakan, bukan sekadar dimiripkan.)*

**Shell — `components/layout/`**
`AppShell` · `Topbar` · `BrandMark` (kotak gradient "T" + `TokoKu` + slot `small` →
**"by Seawise Studio"**; di area klien slot itu dipakai nama toko, sehingga branding
tetap penuh di auth, about, dan footer) · `Sidebar`/`NavItem` (76px ikon → 236px
ikon+label) · `BottomNav`/`BottomNavItem` (varian `fab`) · `PageHeader` ·
`AppFooter` · `ImpersonationBanner` · **`OfflineBanner`**

**Primitif — `components/ui/`**
`Button` (primary/dark/ghost × md/sm/block) · `IconButton` · `Icon` (registry `ICONS`
dari wireframe) · `Card` · `Badge` (8 varian) · `CategoryChip` · `Switch` · `Field` ·
`Input` · `CurrencyInput` (format `Rp 21.000` live) · `NumberInput` · `Select` ·
`SearchInput` · `PillGroup` · `Skeleton` · `Spinner` · `EmptyState` · `InlineNote`
(varian coral `empty-note`) · `Toaster` · `Tooltip`

**Data — `components/data/`**
**`DataTable<T>`** (kolom deklaratif, search, slot filter, sort, pagination,
`onRowClick`, skeleton saat loading, `emptyState`, **fallback kartu di mobile** —
tabel wireframe berkolom banyak, di HP dirender sebagai list card) · `TableToolbar` ·
**`IconAction`** · `FilterPills` · `CellNamePair` · `MoneyText` · `MonoText` ·
`StatCard` · `HeroCard` · `MiniStatRow` · `KeyValueList` · `GrowthBarChart`

> Sebelum mengerjakan `GrowthBarChart` dan halaman Laporan, muat skill `dataviz`
> agar palet chart konsisten dengan token Lime Crush dan lolos kontras.

**Overlay — `components/overlay/`**
`Drawer` (+`Header`/`Body`/`Footer`) · `FormDrawer` (Drawer + RHF + zod + server action
+ state pending) · `Modal` (bottom-sheet di mobile, center ≥640px — persis media query
wireframe) · `ConfirmDialog`

**POS — `components/pos/`**
`ProductGrid` · `ProductCard` · `CartPanel` (sticky ≥900px) · `CartRow` · `QtyStepper` ·
`CartSummary` · `PaymentModal` · `PaymentMethodPicker` · `SuccessModal` ·
`ReceiptPreview` · `ReceiptPrintLayout` (58/80mm) · `BarcodeScannerInput` ·
**`SyncStatusChip`** · **`PinUnlockModal`** · **`PendingQueueSheet`**

**Domain — `components/domain/`**
`TeamMemberRow` · `PermissionToggleList` (4 toggle modul) · `ListLink` · `ProfileHeader` ·
`LowStockList` · `TransactionRow` · `ClientRow` · `TierBadge` · `StatusBadge` ·
`StockBadge` · `PlanCard` · **`DeviceRow`** · **`SyncRejectionRow`**

**Provider & hook**
`SupabaseProvider` · `OrgProvider` (org, outlet, role, permissions) · `CartStore` ·
`ToastProvider` · **`SyncProvider`** (status koneksi, antrean, pemicu sync)
Hook: `useOrg()` · `useCan(perm)` · `useCart()` · `useDataTable()` · `useDebounce()` ·
`useMediaQuery()` · **`useOnlineStatus()`** · **`useOutbox()`**
Guard: `<RoleGate>` · `<PermissionGate>` + padanan server `requireRole()`/`requirePermission()`

**Lapisan offline — `lib/offline/`**
`db.ts` (skema Dexie) · `outbox.ts` (enqueue/flush/retry backoff) · `catalog.ts`
(pull delta + rekonsiliasi cache) · `device.ts` (registrasi + kode device) ·
`trxBuilder.ts` (bentuk payload transaksi, uuidv7, penomoran lokal) ·
`connection.ts` (`navigator.onLine` + ping — `onLine` sering bohong, ping wajib) ·
`printer.ts` (ESC-POS via Web Bluetooth/WebUSB)

**Utilitas — `lib/utils/`**
`formatCurrency` · `formatDate`/`formatTime` (locale id-ID + timezone org) ·
`initials()` · `slugify()` · `cn()`

---

## 4. Urutan Eksekusi

| Fase | Isi | Selesai berarti |
|---|---|---|
| **0** | Scaffold + token Lime Crush + font + primitif UI | halaman gaya bisa dilihat |
| **1** | Jalankan 11 migrasi + seed | DB siap, RLS aktif |
| **2** | Auth + middleware + `AppShell` + navigasi 3 role | login → shell benar per role |
| **3** | Produk & Stok: `DataTable` + `FormDrawer` + CRUD | modul pertama utuh |
| **4** | **POS outbox-first** + `create_transaction` + struk | inti produk jalan |
| **4b** | Engine sync, PWA, banner status, `/pengaturan/sinkronisasi` | cabut internet, kasir tetap jalan |
| **5** | Beranda, Transaksi, Riwayat, Laporan | analitik |
| **6** | Profil, Tim & akses, undangan, pengaturan toko/printer | administrasi toko |
| **7** | Super Admin: dashboard, klien, paket, impersonation, audit | sisi platform |
| **8** | About + footer branding, empty state, deploy Vercel | rilis |

POS dibangun **outbox-first sejak fase 4**, bukan online dulu lalu ditambal — mengubah
POS online menjadi offline-first belakangan berarti menulis ulang seluruh alur pembayaran.

---

## 5. Yang Masih Perlu Keputusan Anda

1. **Diskon & pajak** belum ada di wireframe, tapi kolom + perhitungannya sudah masuk
   skema (`discount_total`, `tax_percent`, `tax_inclusive`). Aktifkan di UI v1 atau
   sembunyikan dulu?
2. **Billing langganan** — manual (Super Admin ubah paket) atau integrasi Midtrans/Xendit?
   Rancangan ini mengasumsikan **manual**; `subscription_events` sudah siap untuk keduanya.
3. **Komponen ERP lama** — kalau ada `DataTable.tsx` / `IconAction.tsx` dari project
   sebelumnya, kirimkan supaya API-nya persis sama.
4. **`role-switch` topbar** — saya asumsikan dibuang di produksi. Kalau mau tetap ada
   sebagai alat demo, saya pasang di balik flag dev.
5. **Printer** — target utama thermal 58mm Bluetooth (paling umum di UMKM). Konfirmasi
   kalau ada merek/model spesifik yang harus didukung, karena dialek ESC-POS berbeda-beda.
