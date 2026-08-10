-- ============================================================
-- TokoKu · 0024 · Tandai kemampuan pembelian di paket
--
-- `plans.features` sudah ada sejak awal tapi tidak pernah dibaca di mana pun.
-- Ini pemakaian pertamanya, sekaligus pola untuk fitur berikutnya.
--
-- Pembagiannya mengikuti prinsip yang disepakati: JANGAN kunci hal yang membuat
-- data jadi benar. Semua paket boleh mencatat barang masuk — tanpa itu stok dan
-- HPP warung Starter akan salah terus dan aplikasinya terlihat rusak, bukan
-- terlihat murah. Yang dikunci adalah kemampuan MENGELOLA: pemasok, tempo, dan
-- hutang dagang.
-- ============================================================

update public.plans
   set features = features || '{"purchasing":"basic"}'::jsonb
 where code = 'starter';

update public.plans
   set features = features || '{"purchasing":"full"}'::jsonb
 where code in ('growth', 'enterprise');

-- Paket buatan sendiri tanpa penanda dianggap "full": lebih baik memberi
-- kelebihan daripada mengunci klien yang sudah membayar karena kolomnya lupa
-- diisi.
comment on column public.plans.features is
  'Kemampuan per paket. purchasing: basic = catat barang masuk saja; full = pemasok, tempo, hutang. Tanpa penanda dianggap full.';
