-- ============================================================
-- TokoKu · 0043 · Pengeluaran operasional
--
-- Sampai sekarang uang yang KELUAR dari toko hanya punya satu tempat:
-- Pembelian. Dan Pembelian tidak bisa menampung sewa, listrik, gaji, bensin,
-- atau plastik kresek — bukan karena belum dibuatkan layarnya, melainkan
-- karena `purchase_items.product_id` NOT NULL. Secara struktur memang mustahil.
--
-- Akibatnya laporan mana pun di aplikasi ini cuma bisa menjawab "untung kotor
-- berapa", tidak pernah "usahanya untung atau tidak". Pemilik warung yang
-- membaca laba kotor Rp 4 juta lalu menyadari uangnya tidak pernah sebanyak
-- itu akan menyimpulkan aplikasinya yang salah hitung.
--
-- ---- KENAPA TABEL SENDIRI, BUKAN MELONGGARKAN `purchases` ----
--
-- Pembelian menaikkan stok dan menulis ulang HPP. Pengeluaran tidak menyentuh
-- stok sama sekali. Digabung dalam satu tabel, sewa toko ikut terhitung sebagai
-- harga pokok dan laba kotor salah secara permanen — dan salahnya tidak akan
-- pernah kelihatan sebagai error, cuma sebagai angka yang perlahan tidak masuk
-- akal. Alasannya sama persis dengan dipisahkannya Konsinyasi dari Pembelian:
-- bentuknya mirip di layar, akibatnya berbeda di pembukuan.
--
-- ---- YANG SENGAJA TIDAK ADA DI SINI ----
--
-- Tidak ada kolom lampiran foto nota, dan itu keputusan. Layarnya belum
-- dibangun, dan project ini sudah dua kali punya kolom yang menunggu
-- berbulan-bulan tanpa layar: `organizations.logo_url` (menganggur sejak 0003
-- sampai 0033) dan `tax_enabled`/`tax_percent` (sejak 0003, belum ada
-- sakelarnya sampai hari ini). Kolom yang tidak dipakai bukan persiapan; ia
-- cuma janji yang tidak ada yang menagih. Ditambahkan nanti, di migrasi
-- sendiri, saat unggahannya benar-benar dikerjakan.
--
-- Tidak ada juga tabel akun kas/bank. Untuk menjawab "uang di laci berkurang
-- berapa", `payment_method` per baris sudah cukup. Tabel akun baru sepadan saat
-- ada pemindahan antar akun, setoran kasir ke pemilik, dan prive.
-- ============================================================

-- ---------- kategori pengeluaran ----------
-- Milik tiap toko, bukan daftar tetap: bengkel, warung makan, dan toko baju
-- mengeluarkan uang untuk hal yang berbeda.
create table public.expense_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index on public.expense_categories (organization_id) where deleted_at is null;
create unique index expense_categories_unique_name_idx
  on public.expense_categories (organization_id, lower(name)) where deleted_at is null;

-- ---------- pengeluaran ----------
create table public.expenses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,

  -- BOLEH NULL, dan itu bukan kelalaian: sewa kontrakan jelas milik satu
  -- cabang, sementara gaji admin dan langganan internet tidak bisa dipaksakan
  -- ke salah satunya. NULL berarti "seluruh toko", dan barisnya ikut terhitung
  -- di cakupan outlet mana pun.
  outlet_id        uuid references public.outlets(id) on delete set null,

  category_id      uuid not null references public.expense_categories(id) on delete restrict,

  -- Tanggal uangnya keluar menurut yang mencatat, bukan jam baris ini masuk
  -- Postgres. Aturan yang sama dengan `client_created_at` di transactions:
  -- nota listrik bulan lalu yang baru sempat dicatat hari ini tetap milik
  -- bulan lalu.
  expense_date     date not null default current_date,

  amount           bigint not null check (amount > 0),
  payment_method   public.payment_method not null default 'cash',
  payee            text,     -- dibayar ke siapa
  note             text,

  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Penghapusannya SOFT dan beralasan. Berbeda dengan transaksi penjualan,
  -- pengeluaran tidak punya nomor berurut yang diberikan ke pembeli dan tidak
  -- menggerakkan stok, jadi salah ketik memang boleh diperbaiki. Tapi baris
  -- yang sudah pernah masuk laporan tidak boleh lenyap tanpa jejak — itu
  -- bentuk yang paling gampang dipakai merapikan angka setelah ditanya.
  deleted_at       timestamptz,
  delete_reason    text
);

create index expenses_org_date_idx
  on public.expenses (organization_id, expense_date desc) where deleted_at is null;
create index expenses_org_category_idx
  on public.expenses (organization_id, category_id) where deleted_at is null;
create index expenses_org_outlet_idx
  on public.expenses (organization_id, outlet_id) where deleted_at is null;

comment on column public.expenses.outlet_id is
  'NULL berarti pengeluaran seluruh toko (gaji admin, internet), bukan data '
  'yang belum diisi. Baris ber-NULL ikut terhitung di semua cakupan outlet.';

-- ---------- pembelian: dibayar pakai apa ----------
-- `payment` hanya menjawab lunas atau tempo. Untuk arus kas itu tidak cukup:
-- lunas pakai tunai mengurangi uang di laci, lunas pakai transfer tidak, dan
-- keduanya sama-sama tertulis 'paid'.
--
-- Baris yang sudah ada ikut menjadi 'cash'. Itu ASUMSI, dan ditulis di sini
-- supaya tidak dikira fakta: warung memang hampir selalu membayar pemasok
-- dengan tunai, dan alternatifnya (kolom nullable berarti "tidak diketahui")
-- menambah cabang ketiga di setiap query arus kas selamanya, demi data yang
-- lahir sebelum fiturnya ada.
alter table public.purchases
  add column payment_method public.payment_method not null default 'cash';

-- ---------- RLS ----------
alter table public.expense_categories enable row level security;
alter table public.expenses           enable row level security;

-- Izin `reports`, bukan `products` maupun `settings`.
--
-- Di aplikasi ini `reports` sudah menjadi izin "boleh menyentuh uang":
-- pembatalan transaksi dijaga izin yang sama, di UI maupun di dalam RPC-nya.
-- Kasir yang cuma memegang `pos` tidak akan pernah melihat menunya, dan itu
-- memang yang diinginkan — mencatat pengeluaran mengurangi laba yang dilaporkan
-- tanpa menyentuh satu pun angka yang bisa dicek ulang dari stok.
create policy expense_categories_read on public.expense_categories for select
  using (public.can_read_org(organization_id));
create policy expense_categories_write on public.expense_categories for all
  using (public.user_can(organization_id, 'reports'))
  with check (public.user_can(organization_id, 'reports'));

create policy expenses_read on public.expenses for select
  using (public.can_read_org(organization_id));
create policy expenses_write on public.expenses for all
  using (public.user_can(organization_id, 'reports'))
  with check (public.user_can(organization_id, 'reports'));

-- ---------- trigger ----------
create trigger set_updated_at before update on public.expense_categories
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.expenses
  for each row execute function public.tg_set_updated_at();

-- Langganan berakhir: pengeluaran ikut ditolak TK002. Ia penambahan data biasa,
-- bukan penjualan yang sudah terjadi di depan pembeli — jadi tidak ada alasan
-- memperlakukannya seperti `sync_transactions`.
create trigger trg_active_expenses before insert on public.expenses
  for each row execute function public.enforce_org_active();

-- Pengeluaran BOLEH diubah, jadi perubahannya harus terekam. "Siapa yang
-- mengubah nominal sewa dari 2 juta jadi 5 juta" adalah pertanyaan yang pasti
-- muncul suatu hari, dan `audit_logs` sudah menjawabnya untuk produk dan
-- anggota tim sejak migrasi 0010.
create trigger audit_changes after insert or update or delete on public.expenses
  for each row execute function public.tg_audit_row();

-- ---------- kategori bawaan ----------
-- Memaksa orang membuat delapan kategori dengan tangan sebelum boleh mencatat
-- pengeluaran pertamanya sama saja dengan menyuruhnya berhenti di langkah
-- pertama. Alasan yang sama dengan kategori produk bawaan di
-- `provision_organization`, dan dengan kategori yang dibuat otomatis oleh
-- impor CSV.
create or replace function public.tg_seed_expense_categories()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.expense_categories (organization_id, name, sort_order)
  values (new.id,'Sewa',1), (new.id,'Listrik & Air',2), (new.id,'Gaji & Upah',3),
         (new.id,'Transportasi',4), (new.id,'Kemasan & Perlengkapan',5),
         (new.id,'Perawatan',6), (new.id,'Promosi',7), (new.id,'Lain-lain',8);
  return new;
end;
$$;

-- SECURITY DEFINER, dan itu wajib: toko yang dibuat lewat jalur ber-RLS akan
-- menjalankan trigger ini sebagai user biasa, yang pada detik itu belum jadi
-- anggota organisasinya sendiri. Tanpa definer, `expense_categories_write`
-- menolak, dan yang gagal bukan cuma penyemaian melainkan SELURUH pembuatan
-- toko.
--
-- Dipasang sebagai trigger, bukan ditambahkan ke `provision_organization`:
-- fungsi itu sudah ditulis ulang sekali (migrasi 0034) dan akan ditulis ulang
-- lagi. Baris penyemaian yang ikut hilang dalam salah satu penulisan ulang
-- tidak akan ketahuan sampai ada toko baru yang tidak punya satu pun kategori
-- pengeluaran.
create trigger seed_expense_categories after insert on public.organizations
  for each row execute function public.tg_seed_expense_categories();

-- Toko yang sudah ada ikut disemai. `on conflict do nothing` supaya migrasi ini
-- aman diulang.
insert into public.expense_categories (organization_id, name, sort_order)
select o.id, k.name, k.sort_order
  from public.organizations o
 cross join (values
   ('Sewa',1), ('Listrik & Air',2), ('Gaji & Upah',3), ('Transportasi',4),
   ('Kemasan & Perlengkapan',5), ('Perawatan',6), ('Promosi',7), ('Lain-lain',8)
 ) as k(name, sort_order)
 where o.deleted_at is null
on conflict do nothing;
