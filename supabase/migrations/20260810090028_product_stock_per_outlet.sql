-- ============================================================
-- TokoKu · 0028 · v_product_stock: satu baris per produk PER OUTLET
--
-- Bug laten yang baru terlihat begitu outlet kedua benar-benar ada.
--
-- Bentuk lamanya `products LEFT JOIN product_stocks ON product_id` — tanpa
-- menyebut outlet sama sekali. Selama toko cuma punya satu outlet itu kebetulan
-- benar: tiap produk selalu punya tepat satu baris stok. Begitu outlet kedua
-- dibuat, produk yang belum pernah punya stok di sana TIDAK punya baris sama
-- sekali, sehingga `where outlet_id = <outlet baru>` membuang semuanya —
-- halaman Produk dan grid Kasir tampil KOSONG di cabang yang baru dibuka.
--
-- Kosongnya diam-diam, dan itu bagian terburuknya: tidak ada error, tidak ada
-- baris nol. Pemilik toko membuka cabang barunya dan mendapati katalognya
-- hilang.
--
-- Perbaikannya: outlet ikut jadi sumbu view. `products CROSS JOIN outlets`
-- membuat setiap produk selalu punya baris di setiap outlet, dan stok yang
-- belum ada terbaca 0 lewat coalesce — persis keadaan sebenarnya di rak.
--
-- KONSEKUENSI YANG HARUS DIPATUHI PEMANGGIL: view ini sekarang mengembalikan
-- satu baris per produk PER OUTLET. Setiap query ke sini WAJIB menyaring
-- `outlet_id`; tanpa itu, toko dua cabang menampilkan tiap produk dua kali dan
-- `maybeSingle()` akan gagal. Keempat pemanggil yang ada sudah disesuaikan.
--
-- Outlet yang dinonaktifkan tetap ikut (hanya `deleted_at` yang disaring):
-- riwayat cabang yang ditutup masih harus bisa dibuka.
-- ============================================================

create or replace view public.v_product_stock with (security_invoker = on) as
select
  p.id, p.organization_id, p.category_id, c.name as category_name, c.color_key,
  p.sku, p.barcode, p.name, p.unit, p.image_url,
  p.cost_price, p.sell_price, p.sell_price - p.cost_price as margin,
  p.track_stock, p.min_stock, p.is_active, p.updated_at,
  o.id as outlet_id,
  coalesce(s.quantity, 0) as stock,
  (p.track_stock and coalesce(s.quantity, 0) <= p.min_stock) as is_low_stock
from public.products p
join public.outlets o
  on o.organization_id = p.organization_id
 and o.deleted_at is null
left join public.categories c on c.id = p.category_id
left join public.product_stocks s
  on s.product_id = p.id
 and s.outlet_id = o.id
where p.deleted_at is null;

comment on view public.v_product_stock is
  'Satu baris per produk PER OUTLET. Stok yang belum pernah ada terbaca 0. '
  'Pemanggil WAJIB menyaring outlet_id — tanpa itu produk muncul berulang per cabang.';
