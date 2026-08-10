-- ============================================================
-- TokoKu · 0011 · View pelaporan
-- security_invoker = on → view tunduk pada RLS pemanggilnya, bukan pemiliknya.
-- ============================================================

-- ---------- Tabel "Manajemen Klien" Super Admin, tanpa N+1 ----------
create view public.v_client_overview with (security_invoker = on) as
select
  o.id, o.name, o.slug, o.city, o.status, o.joined_at, o.trial_ends_at,
  p.code as plan_code, p.name as plan_name,
  (select count(*) from public.outlets ou
    where ou.organization_id = o.id and ou.deleted_at is null)          as outlet_count,
  (select count(*) from public.organization_members m
    where m.organization_id = o.id and m.status = 'active')             as user_count,
  (select count(*) from public.products pr
    where pr.organization_id = o.id and pr.deleted_at is null)          as product_count,
  (select coalesce(sum(t.total),0) from public.transactions t
    where t.organization_id = o.id and t.status = 'paid'
      and t.client_created_at >= date_trunc('month', now()))            as revenue_mtd,
  (select max(t.client_created_at) from public.transactions t
    where t.organization_id = o.id)                                     as last_transaction_at
from public.organizations o
left join public.plans p on p.id = o.plan_id
where o.deleted_at is null;

-- ---------- Produk + stok, untuk tabel Produk & grid POS ----------
create view public.v_product_stock with (security_invoker = on) as
select
  p.id, p.organization_id, p.category_id, c.name as category_name, c.color_key,
  p.sku, p.barcode, p.name, p.unit, p.image_url,
  p.cost_price, p.sell_price, p.sell_price - p.cost_price as margin,
  p.track_stock, p.min_stock, p.is_active, p.updated_at,
  s.outlet_id,
  coalesce(s.quantity, 0) as stock,
  (p.track_stock and coalesce(s.quantity,0) <= p.min_stock) as is_low_stock
from public.products p
left join public.categories c on c.id = p.category_id
left join public.product_stocks s on s.product_id = p.id
where p.deleted_at is null;

-- ---------- Rekap penjualan harian: Beranda & Laporan ----------
-- Dikelompokkan berdasarkan client_created_at (waktu di kasir), bukan created_at,
-- supaya penjualan offline masuk ke tanggal yang benar.
create view public.v_daily_sales with (security_invoker = on) as
select
  t.organization_id,
  t.outlet_id,
  (t.client_created_at at time zone o.timezone)::date as sales_date,
  count(*)                                             as transaction_count,
  sum(t.total)                                         as revenue,
  sum(t.cost_total)                                    as cogs,
  sum(t.total - t.cost_total)                          as gross_profit,
  round(avg(t.total))                                  as avg_ticket,
  count(*) filter (where t.payment_method = 'qris')    as qris_count,
  count(*) filter (where t.payment_method = 'cash')    as cash_count,
  sum(t.total) filter (where t.payment_method = 'cash') as cash_revenue,
  count(*) filter (where t.origin = 'offline')         as offline_count
from public.transactions t
join public.organizations o on o.id = t.organization_id
where t.status = 'paid'
group by t.organization_id, t.outlet_id, 3;

-- ---------- Produk terlaris ----------
create view public.v_product_sales with (security_invoker = on) as
select
  ti.organization_id,
  ti.product_id,
  ti.product_name,
  (t.client_created_at at time zone o.timezone)::date as sales_date,
  sum(ti.quantity)                                     as qty_sold,
  sum(ti.line_total)                                   as revenue,
  sum((ti.unit_price - ti.unit_cost) * ti.quantity)    as gross_profit
from public.transaction_items ti
join public.transactions t   on t.id = ti.transaction_id and t.status = 'paid'
join public.organizations o  on o.id = ti.organization_id
group by ti.organization_id, ti.product_id, ti.product_name, 4;

-- ---------- Stok yang perlu perhatian ----------
create view public.v_stock_alert with (security_invoker = on) as
select
  s.organization_id, s.outlet_id, ou.name as outlet_name,
  p.id as product_id, p.name as product_name, p.sku, p.min_stock,
  s.quantity,
  case
    when s.quantity < 0            then 'negative'   -- akibat sync offline terlambat
    when s.quantity = 0            then 'out'
    when s.quantity <= p.min_stock then 'low'
  end as severity
from public.product_stocks s
join public.products p on p.id = s.product_id and p.deleted_at is null
join public.outlets  ou on ou.id = s.outlet_id
where p.track_stock and s.quantity <= p.min_stock;

-- ---------- Kesehatan sinkronisasi (halaman /pengaturan/sinkronisasi) ----------
create view public.v_sync_health with (security_invoker = on) as
select
  d.organization_id, d.id as device_id, d.name as device_name, d.code, d.outlet_id,
  d.last_sync_at, d.last_seen_at, d.pending_count, d.app_version,
  now() - d.last_sync_at as since_last_sync,
  (select count(*) from public.sync_rejections r
    where r.device_id = d.id and r.resolved_at is null
      and r.reason_code <> 'warning')                     as open_rejections,
  (select count(*) from public.transactions t
    where t.device_id = d.id and t.origin = 'offline'
      and t.client_created_at >= now() - interval '7 days') as offline_trx_7d
from public.devices d
where d.is_active;
