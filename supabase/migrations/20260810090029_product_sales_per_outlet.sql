-- ============================================================
-- TokoKu · 0029 · v_product_sales: ikut menyebut outlet
--
-- `v_daily_sales`, `v_stock_alert`, dan `v_shift_summary` sudah membawa
-- `outlet_id` sejak awal. `v_product_sales` tidak — ia dikelompokkan hanya per
-- (organisasi, produk, tanggal).
--
-- Selama toko cuma punya satu outlet itu tidak terasa. Dengan dua cabang,
-- "Produk Terlaris" menjadi satu-satunya bagian Laporan yang TIDAK bisa
-- disaring per cabang: seluruh angka lain berubah saat outlet dipilih,
-- sementara daftar produk terlarisnya diam. Pemilik toko membaca kedua angka
-- itu berdampingan dan menganggap keduanya bicara tentang cabang yang sama.
--
-- Salah diam-diam seperti itu lebih berbahaya daripada angka yang jelas-jelas
-- kosong — tidak ada yang memicu kecurigaan.
--
-- `transaction_items` sudah menyimpan `organization_id` sendiri (aturan project:
-- setiap tabel tenant punya kolomnya, termasuk tabel anak), tapi TIDAK menyimpan
-- outlet. Outletnya diambil dari transaksinya lewat join yang memang sudah ada.
-- ============================================================

-- `outlet_id` sengaja ditaruh di URUTAN TERAKHIR, bukan di sebelah
-- organization_id seperti view lain. `create or replace view` hanya boleh
-- MENAMBAH kolom di ujung; menyisipkannya di tengah ditolak Postgres dengan
-- "cannot change name of view column". Menghapus lalu membuat ulang view-nya
-- akan ikut menjatuhkan grant `authenticated` — jadi urutan yang kurang rapi
-- ini dipilih dengan sadar.
create or replace view public.v_product_sales with (security_invoker = on) as
select
  ti.organization_id,
  ti.product_id,
  ti.product_name,
  (t.client_created_at at time zone o.timezone)::date as sales_date,
  sum(ti.quantity)                                     as qty_sold,
  sum(ti.line_total)                                   as revenue,
  sum((ti.unit_price - ti.unit_cost) * ti.quantity)    as gross_profit,
  t.outlet_id
from public.transaction_items ti
join public.transactions t   on t.id = ti.transaction_id and t.status = 'paid'
join public.organizations o  on o.id = ti.organization_id
group by ti.organization_id, t.outlet_id, ti.product_id, ti.product_name, 4;

comment on view public.v_product_sales is
  'Penjualan per produk per hari PER OUTLET. Tanpa menyaring outlet_id, angkanya gabungan semua cabang.';
