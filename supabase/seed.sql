-- ============================================================
-- TokoKu · Seed (development)
-- Jalankan setelah semua migrasi. Data produk/klien diambil dari REFERENCE-wireframe.html.
-- ============================================================

-- ---------- Paket langganan ----------
insert into public.plans (code, name, description, price_monthly, price_yearly,
                          max_outlets, max_users, max_products, max_devices, sort_order, features)
values
  ('starter','Starter','Untuk warung & kios satu lokasi',
   99000, 990000, 1, 3, 200, 2, 1,
   '{"offline_pos":true,"reports":"basic","support":"email"}'),
  ('growth','Growth','Untuk toko berkembang dengan beberapa cabang',
   249000, 2490000, 5, 15, 2000, 8, 2,
   '{"offline_pos":true,"reports":"full","multi_outlet":true,"support":"whatsapp"}'),
  ('enterprise','Enterprise','Minimarket & jaringan retail',
   749000, 7490000, null, null, null, null, 3,
   '{"offline_pos":true,"reports":"full","multi_outlet":true,"api":true,"support":"dedicated"}')
on conflict (code) do nothing;

-- ---------- Demo tenant ----------
-- Ganti UUID di bawah dengan id user hasil signup di Supabase Auth, lalu jalankan blok ini.
--
-- select public.provision_organization('Toko Dewi', 'Denpasar', '<AUTH_USER_UUID>', 'growth');
--
-- Setelah organisasi terbentuk, isi katalog contoh:
/*
do $$
declare
  v_org uuid;
  v_outlet uuid;
  v_cat_sembako uuid; v_cat_minuman uuid; v_cat_snack uuid; v_cat_kebutuhan uuid;
  v_pid uuid;
  r record;
begin
  select id into v_org from public.organizations where slug = 'toko-dewi';
  select id into v_outlet from public.outlets where organization_id = v_org and is_primary;

  select id into v_cat_sembako   from public.categories where organization_id = v_org and name = 'Sembako';
  select id into v_cat_minuman   from public.categories where organization_id = v_org and name = 'Minuman';
  select id into v_cat_snack     from public.categories where organization_id = v_org and name = 'Snack';
  select id into v_cat_kebutuhan from public.categories where organization_id = v_org and name = 'Kebutuhan';

  for r in
    select * from (values
      ('SMB-0001','Minyak Goreng Sania 2L',      v_cat_sembako,   18000::bigint, 21000::bigint,  42),
      ('SMB-0002','Beras Rojolele 5kg',          v_cat_sembako,   62000,         68000,           8),
      ('SMB-0003','Indomie Goreng (Dus 40)',     v_cat_sembako,   88000,        104000,          26),
      ('KHR-0004','Sabun Lifebuoy 85g',          v_cat_kebutuhan,  3500,          4500,         120),
      ('MNM-0005','Aqua 600ml (Dus)',            v_cat_minuman,   42000,         50000,          33),
      ('SNK-0006','Chitato Kentang 68g',         v_cat_snack,      8500,         10000,           6),
      ('MNM-0007','Teh Pucuk 350ml',             v_cat_minuman,    3800,          5000,          64),
      ('KHR-0008','Deterjen Rinso 800g',         v_cat_kebutuhan, 14500,         17000,          19)
    ) as t(sku, name, cat, cost, price, stock)
  loop
    insert into public.products (organization_id, category_id, sku, name, cost_price, sell_price)
    values (v_org, r.cat, r.sku, r.name, r.cost, r.price)
    returning id into v_pid;

    update public.product_stocks set quantity = r.stock
     where product_id = v_pid and outlet_id = v_outlet;

    insert into public.stock_movements (organization_id, outlet_id, product_id, type,
                                        quantity_delta, balance_after, note)
    values (v_org, v_outlet, v_pid, 'initial', r.stock, r.stock, 'Seed data');
  end loop;

  -- Perangkat POS pertama
  insert into public.devices (organization_id, outlet_id, code, name)
  values (v_org, v_outlet, 'K1', 'Kasir Depan');
end $$;
*/
