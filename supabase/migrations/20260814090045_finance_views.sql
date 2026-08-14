-- ============================================================
-- TokoKu · 0045 · View keuangan: arus kas & laba rugi
--
-- ---- ATURAN PALING MENENTUKAN: INI DUA BUKU, BUKAN SATU ----
--
-- Arus kas menjawab "uang di tangan bertambah atau berkurang". Laba rugi
-- menjawab "usahanya untung atau tidak". Keduanya memakai tabel yang sama dan
-- hampir selalu MENJAWAB ANGKA YANG BERBEDA, dan itu benar.
--
-- Contohnya yang paling sering terjadi di warung: kulakan 20 karton mi seharga
-- Rp 2 juta tunai hari ini. Arus kas hari ini turun Rp 2 juta. Laba rugi hari
-- ini TIDAK BERUBAH SAMA SEKALI, karena barangnya belum terjual — biayanya
-- baru diakui sebagai HPP pada saat mi itu dibeli orang, satu per satu.
--
-- Kalau keduanya dihitung dari tabel yang sama tanpa aturan ini, pemilik toko
-- akan melihat "rugi" setiap kali kulakan besar, lalu berhenti mempercayai
-- seluruh laporannya. Itu kegagalan yang tidak bisa diperbaiki dengan
-- penjelasan sesudahnya.
--
--   arus kas   : ikut UANGNYA, pada tanggal uang itu berpindah
--   laba rugi  : ikut PENJUALANNYA, dengan HPP barang yang benar-benar terjual
--
-- ---- KONVENSI YANG DIIKUTI DARI VIEW LAMA ----
--
-- Tanggal penjualan memakai `(client_created_at at time zone o.timezone)::date`,
-- persis seperti `v_daily_sales`. Kalau berbeda, dua halaman Laporan akan
-- menempatkan transaksi yang sama pada tanggal yang berbeda, dan yang
-- membandingkannya akan menyimpulkan salah satunya rusak.
--
-- `status = 'paid'` juga mengikuti view lama: transaksi batal tidak pernah ikut
-- dihitung, di buku mana pun.
--
-- `security_invoker = on` dan TANPA fungsi SECURITY DEFINER di dalamnya. Itu
-- syarat mutlak di project ini sejak kebocoran lintas tenant migrasi 0019.
-- ============================================================

-- ---------- arus kas ----------
--
-- Bentuknya panjang (satu baris per sumber per arah per hari), bukan lebar.
-- Kolom lebar berarti tiap sumber uang baru menambah kolom, dan `create or
-- replace view` hanya boleh menambah kolom di UJUNG — sebuah aturan yang sudah
-- memaksa `v_product_sales` menaruh `outlet_id` di tempat yang tidak rapi.
--
-- `is_cash` dipisahkan dari sumbernya karena pertanyaannya memang dua: "uang
-- masuk berapa" dan "yang masuk ke LACI berapa". Yang kedua yang dicocokkan
-- saat tutup shift; yang pertama yang dipakai menilai usahanya.
create view public.v_cash_flow with (security_invoker = on) as
-- penjualan: uang masuk pada tanggal transaksinya
select
  t.organization_id,
  t.outlet_id,
  (t.client_created_at at time zone o.timezone)::date as flow_date,
  'penjualan'::text                                   as source,
  'masuk'::text                                       as direction,
  (t.payment_method = 'cash')                         as is_cash,
  sum(t.total)::bigint                                as amount,
  count(*)::bigint                                    as entry_count
from public.transactions t
join public.organizations o on o.id = t.organization_id
where t.status = 'paid'
group by 1, 2, 3, 4, 5, 6

union all

-- pembelian: uang keluar pada tanggal DIBAYARNYA, bukan tanggal barangnya
-- datang. Nota tempo yang belum lunas belum menyentuh kas sama sekali —
-- memasukkannya lebih awal membuat arus kas menunjukkan uang yang sebenarnya
-- masih ada di laci.
select
  p.organization_id,
  p.outlet_id,
  case
    when p.payment = 'paid' then p.purchased_at
    else (p.paid_at at time zone o.timezone)::date
  end,
  'pembelian'::text,
  'keluar'::text,
  (p.payment_method = 'cash'),
  sum(p.total)::bigint,
  count(*)::bigint
from public.purchases p
join public.organizations o on o.id = p.organization_id
where p.payment = 'paid' or p.paid_at is not null
group by 1, 2, 3, 4, 5, 6

union all

-- pengeluaran: tanggalnya diketik yang mencatat, jadi dipakai apa adanya.
-- `outlet_id` boleh NULL di sini, dan NULL berarti "seluruh toko" — pembacanya
-- WAJIB ikut menghitung baris NULL pada cakupan outlet mana pun.
select
  e.organization_id,
  e.outlet_id,
  e.expense_date,
  'pengeluaran'::text,
  'keluar'::text,
  (e.payment_method = 'cash'),
  sum(e.amount)::bigint,
  count(*)::bigint
from public.expenses e
where e.deleted_at is null
group by 1, 2, 3, 4, 5, 6;

comment on view public.v_cash_flow is
  'Arus kas: ikut UANGNYA. Pembelian tempo baru muncul pada tanggal pelunasan. '
  'Baris pengeluaran ber-outlet_id NULL berlaku untuk seluruh toko dan harus '
  'ikut dihitung di cakupan outlet mana pun.';

-- ---------- laba rugi ----------
--
-- OMZETNYA `total - tax_total`, bukan `total` seperti `v_daily_sales`.
--
-- Pajak yang dipungut dari pembeli bukan pendapatan toko: ia titipan yang harus
-- disetor ke negara atau pemda. Menghitungnya sebagai omzet membuat laba
-- terlihat lebih besar daripada yang benar-benar boleh dibawa pulang, dan
-- untuk rumah makan yang memungut PB1 10% selisihnya bukan angka kecil.
--
-- Rumusnya berlaku untuk KEDUA mode pajak, dan itu bukan kebetulan:
--   termasuk harga   → total = subtotal - diskon,        tax_total ada DI DALAMNYA
--   ditambahkan      → total = subtotal - diskon + pajak, tax_total DI LUARNYA
-- `total - tax_total` menghasilkan nilai bersih yang sama di keduanya.
--
-- Konsekuensinya "Omzet" di halaman ini bisa lebih kecil daripada "Omzet" di
-- Laporan Penjualan begitu pajak dinyalakan nanti. Karena itu `tax_collected`
-- ikut ditampilkan sebagai barisnya sendiri: selisihnya harus bisa dijelaskan
-- tanpa membuka SQL. Selama pajak masih mati (bawaan), keduanya sama persis.
create view public.v_profit_loss with (security_invoker = on) as
select
  t.organization_id,
  t.outlet_id,
  date_trunc('month', (t.client_created_at at time zone o.timezone))::date as period_month,
  count(*)::bigint                                       as transaction_count,
  sum(t.total - t.tax_total)::bigint                     as net_revenue,
  sum(t.tax_total)::bigint                               as tax_collected,
  sum(t.cost_total)::bigint                              as cogs,
  sum(t.total - t.tax_total - t.cost_total)::bigint      as gross_profit
from public.transactions t
join public.organizations o on o.id = t.organization_id
where t.status = 'paid'
group by 1, 2, 3;

comment on view public.v_profit_loss is
  'Laba rugi: ikut PENJUALANNYA. Omzet sudah dikurangi pajak terpungut, karena '
  'pajak dari pembeli adalah titipan untuk disetor, bukan pendapatan toko. '
  'Pembelian TIDAK muncul di sini; yang muncul HPP barang yang benar-benar '
  'terjual (cost_total, sudah di-snapshot saat transaksi).';

-- ---------- pengeluaran per bulan per kategori ----------
-- Dipisah dari v_profit_loss, bukan digabung: laba rugi punya satu baris per
-- bulan sementara pengeluaran punya satu baris per kategori per bulan.
-- Digabung, omzet akan terduplikasi sebanyak jumlah kategori dan penjumlahan
-- apa pun di atasnya menjadi salah tanpa terlihat salah.
create view public.v_expense_monthly with (security_invoker = on) as
select
  e.organization_id,
  e.outlet_id,
  date_trunc('month', e.expense_date)::date as period_month,
  e.category_id,
  k.name                                    as category_name,
  sum(e.amount)::bigint                     as amount,
  count(*)::bigint                          as entry_count
from public.expenses e
join public.expense_categories k on k.id = e.category_id
where e.deleted_at is null
group by 1, 2, 3, 4, 5;

grant select on public.v_cash_flow, public.v_profit_loss, public.v_expense_monthly
  to authenticated;
