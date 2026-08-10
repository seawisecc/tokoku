-- ============================================================
-- TokoKu · 0026 · Konsinyasi (titip jual)
--
-- Modul terakhir dari kesepakatan. Pemasok sudah ada sejak 0023; yang kurang
-- adalah barang yang MASUK TANPA DIBELI.
--
-- Bedanya dengan Pembelian, dan kenapa tidak bisa menumpang di sana:
--
--   Pembelian  → barang jadi milik toko saat itu juga. Hutang lahir seketika,
--                sebesar seluruh nota, terjual atau tidak.
--   Konsinyasi → barang tetap milik pemasok. Hutang lahir HANYA sebesar yang
--                terjual. Sisanya pulang lewat retur, tanpa uang berpindah.
--
-- Dipaksakan jadi satu, laporan hutang dagang akan menagih uang atas barang
-- yang masih menumpuk di rak dan mungkin tidak pernah laku.
--
-- ------------------------------------------------------------
-- KEPUTUSAN YANG PALING MENENTUKAN: bagi hasil dihitung KUMULATIF,
-- bukan per rentang tanggal.
--
--   yang harus disetor = seluruh yang terjual sampai detik ini
--                      − seluruh yang sudah pernah disetorkan
--
-- Cara yang lazim — "setorkan penjualan 1–31 Agustus" — tidak aman di aplikasi
-- ini. Transaksi POS bisa dibuat saat perangkat offline dan baru sampai server
-- berhari-hari kemudian. Kalau setoran dipatok rentang tanggal, penjualan yang
-- datang setelah periodenya ditutup tidak akan pernah masuk setoran mana pun:
-- pemasok kehilangan haknya, diam-diam, dan tidak ada yang bisa menemukannya
-- lagi karena periode itu sudah "beres".
--
-- Dengan cara kumulatif, penjualan yang telat sampai otomatis ikut terhitung di
-- setoran berikutnya. Tidak ada yang hilang, hanya tertunda.
--
-- Karena itu pula angka terjual dibaca dari `stock_movements.created_at` (jam
-- baris masuk Postgres), BUKAN `transactions.client_created_at` seperti aturan
-- laporan pada umumnya. Di sini yang ditanya bukan "penjualan tanggal berapa"
-- melainkan "apa yang sudah tercatat dan belum dibayar" — dan untuk itu jam
-- server justru yang benar, sekaligus menutup celah jam perangkat yang mundur
-- pada jalur yang berujung ke uang.
-- ------------------------------------------------------------
--
-- Satu produk hanya boleh punya SATU titipan aktif. Tanpa itu, pertanyaan
-- "yang terjual ini haknya siapa" tidak punya jawaban tunggal — penjualan di
-- POS hanya tahu produk, bukan pemiliknya.
-- ============================================================

-- ---------- titipan ----------
create table public.consignments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete restrict,
  supplier_id      uuid not null references public.suppliers(id) on delete restrict,
  product_id       uuid not null references public.products(id) on delete restrict,
  -- Hak pemasok per satuan TERJUAL. Selisihnya dengan harga jual adalah margin
  -- toko — jadi ini juga yang dipakai sebagai harga pokok produknya.
  consign_price    bigint not null check (consign_price >= 0),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Satu produk = satu pemilik titipan, selama titipannya masih berjalan.
create unique index consignments_one_active_idx
  on public.consignments (organization_id, product_id)
  where ended_at is null;
create index consignments_supplier_idx
  on public.consignments (organization_id, supplier_id) where ended_at is null;

-- ---------- pergerakan titipan: setor & retur ----------
-- Append-only, seperti stock_movements: tidak ada policy UPDATE maupun DELETE.
-- Ini catatan tentang barang milik orang lain — kalau bisa dihapus, perselisihan
-- dengan pemasok tidak punya bukti apa pun untuk dirujuk.
create table public.consignment_movements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  consignment_id   uuid not null references public.consignments(id) on delete cascade,
  direction        text not null check (direction in ('in', 'return')),
  quantity         integer not null check (quantity > 0),
  unit_price       bigint not null check (unit_price >= 0),  -- harga titip saat itu
  occurred_on      date not null default current_date,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index consignment_movements_idx
  on public.consignment_movements (consignment_id, created_at desc);

-- ---------- setoran bagi hasil ----------
create table public.consignment_settlements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  supplier_id      uuid not null references public.suppliers(id) on delete restrict,
  code             text not null,
  settled_on       date not null default current_date,
  total_quantity   integer not null default 0,
  total            bigint not null default 0 check (total >= 0),
  paid_at          timestamptz,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, code)
);
create index consignment_settlements_idx
  on public.consignment_settlements (organization_id, settled_on desc);

create table public.consignment_settlement_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  settlement_id    uuid not null references public.consignment_settlements(id) on delete cascade,
  consignment_id   uuid not null references public.consignments(id) on delete restrict,
  quantity         integer not null check (quantity > 0),
  -- Harga titip di-SNAPSHOT di sini. Kalau harganya berubah nanti, setoran yang
  -- sudah terjadi tetap terbaca dengan angka yang benar-benar disepakati waktu itu.
  unit_price       bigint not null check (unit_price >= 0),
  subtotal         bigint not null check (subtotal >= 0)
);
create index consignment_settlement_items_idx
  on public.consignment_settlement_items (settlement_id);
-- Dipakai menghitung "sudah disetor berapa" per titipan.
create index consignment_settlement_items_consign_idx
  on public.consignment_settlement_items (consignment_id);

-- ---------- RLS ----------
alter table public.consignments                  enable row level security;
alter table public.consignment_movements         enable row level security;
alter table public.consignment_settlements       enable row level security;
alter table public.consignment_settlement_items  enable row level security;

create policy consignments_read on public.consignments for select
  using (public.can_read_org(organization_id));
create policy consignments_write on public.consignments for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

-- Hanya SELECT dan INSERT: buku besar titipan tidak boleh diubah atau dihapus.
create policy consignment_movements_read on public.consignment_movements for select
  using (public.can_read_org(organization_id));
create policy consignment_movements_insert on public.consignment_movements for insert
  with check (public.user_can(organization_id, 'products'));

create policy consignment_settlements_read on public.consignment_settlements for select
  using (public.can_read_org(organization_id));
create policy consignment_settlements_write on public.consignment_settlements for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

create policy consignment_settlement_items_read on public.consignment_settlement_items for select
  using (public.can_read_org(organization_id));
create policy consignment_settlement_items_insert on public.consignment_settlement_items for insert
  with check (public.user_can(organization_id, 'products'));

-- Kuota & status langganan berlaku juga di sini.
drop trigger if exists trg_active_consignments on public.consignments;
create trigger trg_active_consignments before insert on public.consignments
  for each row execute function public.enforce_org_active();

drop trigger if exists trg_active_consign_settlements on public.consignment_settlements;
create trigger trg_active_consign_settlements before insert on public.consignment_settlements
  for each row execute function public.enforce_org_active();

-- ============================================================
-- SATU sumber kebenaran untuk seluruh angka titipan.
--
-- Dipakai halaman Konsinyasi SEKALIGUS oleh RPC yang menghitung setoran —
-- persis alasan yang sama dengan org_usage di 0019: angka yang dilihat pemilik
-- toko harus sama persis dengan angka yang dipakai membayar pemasok.
--
-- `security_invoker = on`, dan sengaja TANPA fungsi SECURITY DEFINER di
-- dalamnya. Baris-barisnya disaring RLS `consignments` seperti biasa.
-- (Fungsi ber-SECURITY DEFINER di dalam view juga akan mati begitu execute-nya
-- dicabut dari `authenticated` — view tidak mengganti current_user, hanya
-- pemeriksaan hak atas TABEL yang memakai pemilik view. Lihat catatan di
-- CLAUDE.md.)
--
-- RPC di bawah membaca view ini dari dalam fungsi SECURITY DEFINER, jadi RLS-nya
-- dievaluasi sebagai pemilik fungsi — aman karena tiap RPC sudah memeriksa
-- `user_can(p_org, 'products')` lebih dulu dan menyaring `organization_id = p_org`
-- secara eksplisit.
-- ============================================================
create or replace view public.v_consignment_summary with (security_invoker = on) as
select
  c.id,
  c.organization_id,
  c.outlet_id,
  c.supplier_id,
  c.product_id,
  s.name                              as supplier_name,
  p.name                              as product_name,
  p.sku,
  p.unit,
  p.sell_price,
  c.consign_price,
  c.started_at,
  c.ended_at,
  qty.qty_in,
  qty.qty_returned,
  qty.qty_sold,
  qty.qty_settled,
  -- Sisa yang masih di rak menurut catatan titipan. Bisa berbeda dari
  -- product_stocks kalau pernah ada opname — itu memang stok fisik toko,
  -- sedangkan ini pertanggungjawaban atas barang milik pemasok.
  (qty.qty_in - qty.qty_returned - qty.qty_sold)          as qty_left,
  (qty.qty_sold - qty.qty_settled)                        as qty_unsettled,
  ((qty.qty_sold - qty.qty_settled) * c.consign_price)    as amount_due
from public.consignments c
join public.suppliers s on s.id = c.supplier_id
join public.products  p on p.id = c.product_id
cross join lateral (
  select
    coalesce((
      select sum(m.quantity) from public.consignment_movements m
       where m.consignment_id = c.id and m.direction = 'in'
    ), 0)::int as qty_in,
    coalesce((
      select sum(m.quantity) from public.consignment_movements m
       where m.consignment_id = c.id and m.direction = 'return'
    ), 0)::int as qty_returned,
    -- 'sale' negatif, 'return' (batal/retur pembeli) positif. Dibalik tandanya,
    -- hasilnya penjualan bersih — transaksi yang dibatalkan otomatis ikut
    -- mengurangi hak pemasok, tanpa perlu penanganan sendiri.
    coalesce((
      select -sum(sm.quantity_delta) from public.stock_movements sm
       where sm.organization_id = c.organization_id
         and sm.product_id      = c.product_id
         and sm.outlet_id       = c.outlet_id
         and sm.type in ('sale', 'return')
         and sm.created_at     >= c.started_at
         and (c.ended_at is null or sm.created_at <= c.ended_at)
    ), 0)::int as qty_sold,
    coalesce((
      select sum(i.quantity) from public.consignment_settlement_items i
       where i.consignment_id = c.id
    ), 0)::int as qty_settled
) qty;

grant select on public.v_consignment_summary to authenticated;

comment on view public.v_consignment_summary is
  'Satu baris per titipan: masuk, terjual, retur, sisa di rak, dan yang belum disetorkan ke pemasok.';

-- ============================================================
-- RPC
-- ============================================================

/**
 * Terima barang titipan.
 *
 * Mendaftarkan titipan kalau produknya belum pernah dititipkan, atau menambah
 * jumlah pada titipan yang sedang berjalan. Stok naik seketika — barangnya sudah
 * di rak dan sudah bisa dijual kasir.
 */
create or replace function public.record_consignment_intake(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_outlet    uuid;
  v_supplier  public.suppliers%rowtype;
  v_prod      public.products%rowtype;
  v_qty       int;
  v_price     bigint;
  v_on        date;
  v_con       public.consignments%rowtype;
  v_owner     text;
  v_unsettled int;
  v_balance   int;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_qty   := coalesce((p_payload ->> 'quantity')::int, 0);
  v_price := coalesce((p_payload ->> 'consign_price')::bigint, -1);
  v_on    := coalesce(nullif(p_payload ->> 'occurred_on', '')::date, current_date);

  if v_qty <= 0 then
    raise exception 'Jumlah barang titipan harus lebih dari nol.' using errcode = 'TK003';
  end if;
  if v_price < 0 then
    raise exception 'Isi harga titip — yaitu bagian pemasok untuk setiap satuan yang terjual.'
      using errcode = 'TK003';
  end if;

  select * into v_supplier from public.suppliers
   where id = nullif(p_payload ->> 'supplier_id', '')::uuid
     and organization_id = p_org and deleted_at is null;
  if not found then
    raise exception 'Pemasok tidak ditemukan di toko ini.' using errcode = 'TK003';
  end if;

  select * into v_prod from public.products
   where id = nullif(p_payload ->> 'product_id', '')::uuid
     and organization_id = p_org and deleted_at is null;
  if not found then
    raise exception 'Produk tidak ditemukan di toko ini.' using errcode = 'TK003';
  end if;

  -- Tanpa pelacakan stok, penjualannya tidak meninggalkan jejak di
  -- stock_movements — dan angka "terjual" adalah satu-satunya dasar bagi hasil.
  -- Diterima diam-diam, pemasok selamanya dibayar nol.
  if not v_prod.track_stock then
    raise exception 'Produk "%" disetel tanpa pelacakan stok, jadi jumlah terjualnya tidak tercatat dan bagi hasil tidak bisa dihitung. Nyalakan dulu pelacakan stok produk ini.',
      v_prod.name using errcode = 'TK003';
  end if;

  v_outlet := nullif(p_payload ->> 'outlet_id', '')::uuid;
  if v_outlet is null then
    select id into v_outlet from public.outlets
     where organization_id = p_org and is_primary limit 1;
  end if;
  if v_outlet is null then
    raise exception 'Toko ini belum punya outlet, jadi barang titipan belum bisa diterima.'
      using errcode = 'TK003';
  end if;

  -- Titipan yang sedang berjalan untuk produk ini. Dikunci supaya dua orang yang
  -- menerima setoran bersamaan tidak membuat dua titipan aktif.
  select * into v_con from public.consignments
   where organization_id = p_org and product_id = v_prod.id and ended_at is null
   for update;

  if found then
    if v_con.supplier_id <> v_supplier.id then
      select name into v_owner from public.suppliers where id = v_con.supplier_id;
      raise exception 'Produk "%" sedang dititipkan oleh %. Selesaikan titipan itu dulu (retur sisanya lalu tutup titipan) sebelum menitipkannya ke pemasok lain.',
        v_prod.name, coalesce(v_owner, 'pemasok lain') using errcode = 'TK003';
    end if;

    if v_con.consign_price <> v_price then
      -- Harga titip menentukan berapa rupiah yang terhutang atas barang yang
      -- SUDAH terjual. Diubah selagi masih ada yang belum disetor, hutang yang
      -- sudah terbentuk ikut berubah nilainya tanpa ada yang menyetujui.
      select qty_unsettled into v_unsettled
        from public.v_consignment_summary where id = v_con.id;

      if coalesce(v_unsettled, 0) > 0 then
        raise exception 'Harga titip "%" tidak bisa diubah selagi masih ada % satuan terjual yang belum disetorkan. Setorkan dulu bagi hasilnya, baru harganya diubah.',
          v_prod.name, v_unsettled using errcode = 'TK003';
      end if;

      update public.consignments set consign_price = v_price where id = v_con.id;
      v_con.consign_price := v_price;
    end if;
  else
    insert into public.consignments (
      organization_id, outlet_id, supplier_id, product_id, consign_price, note, created_by)
    values (p_org, v_outlet, v_supplier.id, v_prod.id, v_price,
            nullif(p_payload ->> 'note', ''), auth.uid())
    returning * into v_con;
  end if;

  insert into public.consignment_movements (
    organization_id, consignment_id, direction, quantity, unit_price, occurred_on, note, created_by)
  values (p_org, v_con.id, 'in', v_qty, v_price, v_on,
          nullif(p_payload ->> 'note', ''), auth.uid());

  insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
  values (p_org, v_prod.id, v_con.outlet_id, v_qty)
  on conflict (product_id, outlet_id)
    do update set quantity = public.product_stocks.quantity + excluded.quantity,
                  updated_at = now()
  returning quantity into v_balance;

  insert into public.stock_movements (
    organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
    unit_cost, ref_table, ref_id, note, created_by)
  values (p_org, v_con.outlet_id, v_prod.id, 'consign_in', v_qty, v_balance, v_price,
          'consignments', v_con.id, 'Titipan dari ' || v_supplier.name, auth.uid());

  -- Harga pokok = harga titip. Untuk barang titipan, biaya toko atas tiap satuan
  -- yang terjual memang persis hak pemasok — jadi laba kotor di Laporan langsung
  -- terbaca benar tanpa perhitungan terpisah.
  update public.products set cost_price = v_price, updated_at = now()
   where id = v_prod.id;

  return jsonb_build_object('id', v_con.id, 'quantity', v_qty, 'price', v_price);
end
$$;

/**
 * Retur barang titipan ke pemasok. Stok turun, tidak ada uang berpindah.
 */
create or replace function public.record_consignment_return(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_con      public.consignments%rowtype;
  v_qty      int;
  v_left     int;
  v_name     text;
  v_supplier text;
  v_balance  int;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_qty := coalesce((p_payload ->> 'quantity')::int, 0);
  if v_qty <= 0 then
    raise exception 'Jumlah retur harus lebih dari nol.' using errcode = 'TK003';
  end if;

  select * into v_con from public.consignments
   where id = nullif(p_payload ->> 'consignment_id', '')::uuid
     and organization_id = p_org
   for update;
  if not found then
    raise exception 'Titipan tidak ditemukan di toko ini.' using errcode = 'TK003';
  end if;
  if v_con.ended_at is not null then
    raise exception 'Titipan ini sudah ditutup, jadi tidak bisa diretur lagi.' using errcode = 'TK003';
  end if;

  select qty_left, product_name, supplier_name
    into v_left, v_name, v_supplier
    from public.v_consignment_summary where id = v_con.id;

  -- Menolak kelebihan retur aman di sini: ini isian manual yang diketik saat
  -- online, bukan antrean offline yang sudah benar-benar terjadi. Kelebihannya
  -- hampir selalu salah ketik, dan diterima diam-diam ia langsung merusak
  -- pertanggungjawaban barang milik orang lain.
  if v_qty > coalesce(v_left, 0) then
    raise exception 'Sisa titipan "%" tinggal % — tidak bisa meretur % satuan.',
      v_name, coalesce(v_left, 0), v_qty using errcode = 'TK003';
  end if;

  insert into public.consignment_movements (
    organization_id, consignment_id, direction, quantity, unit_price, occurred_on, note, created_by)
  values (p_org, v_con.id, 'return', v_qty, v_con.consign_price,
          coalesce(nullif(p_payload ->> 'occurred_on', '')::date, current_date),
          nullif(p_payload ->> 'note', ''), auth.uid());

  update public.product_stocks
     set quantity = quantity - v_qty, updated_at = now()
   where product_id = v_con.product_id and outlet_id = v_con.outlet_id
  returning quantity into v_balance;

  insert into public.stock_movements (
    organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
    unit_cost, ref_table, ref_id, note, created_by)
  values (p_org, v_con.outlet_id, v_con.product_id, 'consign_return', -v_qty,
          coalesce(v_balance, 0), v_con.consign_price,
          'consignments', v_con.id, 'Retur titipan ke ' || v_supplier, auth.uid());

  return jsonb_build_object('id', v_con.id, 'quantity', v_qty);
end
$$;

/**
 * Setorkan bagi hasil ke satu pemasok.
 *
 * Menghitung seluruh titipan aktif milik pemasok itu sekaligus — pemilik warung
 * membayar per pemasok, bukan per produk, jadi memecahnya per produk hanya
 * menghasilkan tumpukan setoran kecil yang tidak pernah cocok dengan uang yang
 * benar-benar diserahkan.
 *
 * Angkanya KUMULATIF (terjual sampai sekarang − yang sudah pernah disetor).
 * Lihat catatan panjang di kepala file: rentang tanggal akan menelan penjualan
 * offline yang baru sampai server setelah periodenya ditutup.
 */
create or replace function public.settle_consignment(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_supplier  public.suppliers%rowtype;
  v_id        uuid;
  v_code      text;
  v_seq       int;
  v_total     bigint := 0;
  v_qty       int := 0;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_supplier from public.suppliers
   where id = nullif(p_payload ->> 'supplier_id', '')::uuid
     and organization_id = p_org and deleted_at is null;
  if not found then
    raise exception 'Pemasok tidak ditemukan di toko ini.' using errcode = 'TK003';
  end if;

  -- Kunci dulu seluruh titipan pemasok ini. Tanpa ini, dua orang yang menekan
  -- "Setor bagi hasil" bersamaan sama-sama membaca sisa yang sama dan pemasok
  -- dibayar dua kali untuk barang yang sama.
  perform 1 from public.consignments
   where organization_id = p_org and supplier_id = v_supplier.id
   for update;

  -- Nomor urut diambil di depan. Aman: kalau nanti ternyata tidak ada yang perlu
  -- disetor, `raise` di bawah membatalkan seluruh transaksi ini — barisnya tidak
  -- pernah benar-benar ada, jadi penomorannya tidak berlubang.
  select coalesce(max(substring(code from '\d+$')::int), 0) + 1 into v_seq
    from public.consignment_settlements
   where organization_id = p_org
     and code like 'BH-' || to_char(current_date, 'YYYYMMDD') || '-%';
  v_code := 'BH-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.consignment_settlements (
    organization_id, supplier_id, code, settled_on, note, created_by)
  values (p_org, v_supplier.id, v_code,
          coalesce(nullif(p_payload ->> 'settled_on', '')::date, current_date),
          nullif(p_payload ->> 'note', ''), auth.uid())
  returning id into v_id;

  -- SATU statement, bukan loop.
  --
  -- `v_consignment_summary` ikut membaca `consignment_settlement_items` untuk
  -- menghitung qty_settled. Kalau barisnya disisipkan satu per satu sambil loop
  -- masih berjalan di atas view yang sama, tiap iterasi berikutnya membaca
  -- angka yang baru saja diubah oleh iterasi sebelumnya — hasilnya bergantung
  -- pada kapan cursor mengambil baris. Di jalur yang menentukan berapa rupiah
  -- dibayar ke pemasok, itu tidak boleh diserahkan pada nasib.
  with picked as (
    select id, consign_price, qty_unsettled
      from public.v_consignment_summary
     where organization_id = p_org and supplier_id = v_supplier.id
       and qty_unsettled > 0
  ), ins as (
    insert into public.consignment_settlement_items (
      organization_id, settlement_id, consignment_id, quantity, unit_price, subtotal)
    select p_org, v_id, id, qty_unsettled, consign_price, qty_unsettled * consign_price
      from picked
    returning quantity, subtotal
  )
  select coalesce(sum(quantity), 0)::int, coalesce(sum(subtotal), 0)::bigint
    into v_qty, v_total from ins;

  if v_qty = 0 then
    raise exception 'Belum ada barang titipan % yang terjual dan belum disetorkan.',
      v_supplier.name using errcode = 'TK003';
  end if;

  update public.consignment_settlements
     set total_quantity = v_qty, total = v_total
   where id = v_id;

  return jsonb_build_object('id', v_id, 'code', v_code, 'quantity', v_qty, 'total', v_total);
end
$$;

/**
 * Tutup titipan — barang pemasok sudah tidak ada lagi di toko ini.
 *
 * Dipagari dua syarat: tidak ada sisa di rak, dan tidak ada hak pemasok yang
 * belum dibayar. Titipan yang ditutup berhenti menghitung penjualan (lihat
 * `ended_at` di view), jadi menutupnya lebih awal akan menghapus tagihan yang
 * masih berjalan dari layar — tanpa uangnya pernah berpindah.
 */
create or replace function public.end_consignment(p_org uuid, p_consignment uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_left      int;
  v_unsettled int;
  v_name      text;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from public.consignments
   where id = p_consignment and organization_id = p_org and ended_at is null
   for update;
  if not found then
    raise exception 'Titipan tidak ditemukan atau sudah ditutup.' using errcode = 'TK003';
  end if;

  select qty_left, qty_unsettled, product_name
    into v_left, v_unsettled, v_name
    from public.v_consignment_summary where id = p_consignment;

  if coalesce(v_left, 0) <> 0 then
    raise exception 'Masih ada % satuan "%" di toko. Retur dulu sisanya ke pemasok sebelum titipan ditutup.',
      v_left, v_name using errcode = 'TK003';
  end if;
  if coalesce(v_unsettled, 0) <> 0 then
    raise exception 'Masih ada % satuan "%" yang terjual dan belum disetorkan. Setorkan bagi hasilnya dulu.',
      v_unsettled, v_name using errcode = 'TK003';
  end if;

  update public.consignments set ended_at = now() where id = p_consignment;
  return jsonb_build_object('id', p_consignment);
end
$$;

-- Semua RPC di atas memeriksa `user_can(p_org, ...)` di baris pertama, jadi
-- p_org yang diisi id toko orang lain tetap ditolak. `execute` dicabut dari
-- `public`/`anon` supaya hanya user yang sudah login bisa memanggilnya.
revoke execute on function public.record_consignment_intake(uuid, jsonb) from public, anon;
revoke execute on function public.record_consignment_return(uuid, jsonb) from public, anon;
revoke execute on function public.settle_consignment(uuid, jsonb)        from public, anon;
revoke execute on function public.end_consignment(uuid, uuid)            from public, anon;

grant execute on function public.record_consignment_intake(uuid, jsonb) to authenticated;
grant execute on function public.record_consignment_return(uuid, jsonb) to authenticated;
grant execute on function public.settle_consignment(uuid, jsonb)        to authenticated;
grant execute on function public.end_consignment(uuid, uuid)            to authenticated;

comment on function public.record_consignment_intake is
  'Terima barang titipan: daftarkan/tambah titipan, stok naik, harga pokok = harga titip.';
comment on function public.settle_consignment is
  'Setorkan bagi hasil satu pemasok. Kumulatif: terjual sampai sekarang dikurangi yang sudah disetor.';
