-- ============================================================
-- TokoKu · 0009 · Fungsi & RPC
-- Semua penulisan yang menyentuh stok berjalan lewat sini agar atomik.
-- ============================================================

-- ------------------------------------------------------------
-- _apply_transaction: inti pencatatan penjualan.
-- Dipakai oleh jalur online (create_transaction) DAN jalur sync offline
-- (sync_transactions) sehingga tidak ada dua versi logika yang bisa berbeda.
--
-- Idempoten: id transaksi dibuat di perangkat. Kalau id-nya sudah ada,
-- fungsi ini mengembalikan status 'duplicate' tanpa menyentuh stok.
-- ------------------------------------------------------------
create or replace function public._apply_transaction(
  p_org      uuid,
  p_trx      jsonb,
  p_origin   public.trx_origin,
  p_cashier  uuid
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id           uuid   := coalesce((p_trx ->> 'id')::uuid, gen_random_uuid());
  v_code         text   := p_trx ->> 'code';
  v_outlet       uuid   := (p_trx ->> 'outlet_id')::uuid;
  v_client_at    timestamptz := coalesce((p_trx ->> 'client_created_at')::timestamptz, now());
  v_org          public.organizations%rowtype;
  v_item         jsonb;
  v_product      public.products%rowtype;
  v_stock        public.product_stocks%rowtype;
  v_subtotal     bigint := 0;
  v_discount     bigint := coalesce((p_trx ->> 'discount_total')::bigint, 0);
  v_cost_total   bigint := 0;
  v_tax          bigint := 0;
  v_total        bigint;
  v_paid         bigint := coalesce((p_trx ->> 'paid_amount')::bigint, 0);
  v_line         integer := 0;
  v_qty          integer;
  v_price        bigint;
  v_line_disc    bigint;
  v_line_total   bigint;
  v_new_balance  integer;
  v_warnings     jsonb := '[]'::jsonb;
  v_suffix       integer := 0;
begin
  -- 1. Sudah pernah masuk? (retry sync, klik ganda, koneksi putus saat commit)
  if exists (select 1 from public.transactions where id = v_id) then
    return jsonb_build_object('status','duplicate','id',v_id,'code',v_code);
  end if;

  select * into v_org from public.organizations where id = p_org;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_trx -> 'items','[]'::jsonb)) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  -- 2. Nomor transaksi. Dibuat perangkat; kalau bentrok, server memberi akhiran.
  if v_code is null then
    v_code := 'TRX-' || to_char(v_client_at at time zone v_org.timezone, 'YYYYMMDD')
              || '-' || substr(replace(v_id::text,'-',''), 1, 6);
  end if;
  while exists (select 1 from public.transactions t
                where t.organization_id = p_org and t.code = v_code) loop
    v_suffix := v_suffix + 1;
    v_code := regexp_replace(v_code, '-R[0-9]+$', '') || '-R' || v_suffix;
  end loop;

  -- 3. Header dulu (agar transaction_items punya induk)
  insert into public.transactions (
    id, organization_id, outlet_id, device_id, shift_id, code, customer_id, cashier_id,
    subtotal, discount_total, tax_total, total, paid_amount, change_amount, cost_total,
    payment_method, status, note, origin, client_created_at, synced_at
  ) values (
    v_id, p_org, v_outlet, (p_trx ->> 'device_id')::uuid, (p_trx ->> 'shift_id')::uuid,
    v_code, (p_trx ->> 'customer_id')::uuid, p_cashier,
    0, v_discount, 0, 0, v_paid, 0, 0,
    coalesce((p_trx ->> 'payment_method')::public.payment_method, 'cash'),
    'paid', p_trx ->> 'note', p_origin, v_client_at, now()
  );

  -- 4. Item + stok
  for v_item in select * from jsonb_array_elements(p_trx -> 'items') loop
    v_line       := v_line + 1;
    v_qty        := (v_item ->> 'quantity')::integer;
    v_price      := (v_item ->> 'unit_price')::bigint;   -- harga SESUAI STRUK yang dicetak
    v_line_disc  := coalesce((v_item ->> 'discount')::bigint, 0);
    v_line_total := (v_price * v_qty) - v_line_disc;

    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and organization_id = p_org;

    if not found then
      -- Produk sudah dihapus setelah transaksi offline dibuat. Uangnya nyata,
      -- jadi penjualan tetap dicatat dengan snapshot nama dari perangkat.
      v_warnings := v_warnings || jsonb_build_object(
        'code','product_missing', 'product_id', v_item ->> 'product_id',
        'name', v_item ->> 'product_name');
    end if;

    insert into public.transaction_items (
      organization_id, transaction_id, product_id, product_name, sku, unit,
      unit_price, unit_cost, quantity, discount, line_total, line_no
    ) values (
      p_org, v_id, v_product.id,
      coalesce(v_product.name, v_item ->> 'product_name', 'Produk dihapus'),
      coalesce(v_product.sku, v_item ->> 'sku'),
      coalesce(v_product.unit, 'pcs'),
      v_price, coalesce(v_product.cost_price, 0), v_qty, v_line_disc, v_line_total, v_line
    );

    v_subtotal   := v_subtotal + (v_price * v_qty);
    v_discount   := v_discount + v_line_disc;
    v_cost_total := v_cost_total + (coalesce(v_product.cost_price,0) * v_qty);

    -- Stok: kunci baris, lalu kurangi.
    if v_product.id is not null and v_product.track_stock then
      insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
      values (p_org, v_product.id, v_outlet, 0)
      on conflict (product_id, outlet_id) do nothing;

      select * into v_stock from public.product_stocks
        where product_id = v_product.id and outlet_id = v_outlet
        for update;

      v_new_balance := v_stock.quantity - v_qty;

      -- Penjualan online boleh ditolak kalau stok kurang. Penjualan offline
      -- TIDAK PERNAH ditolak: barangnya sudah keluar dari rak jam sekian.
      if v_new_balance < 0
         and p_origin = 'online'
         and not v_org.allow_negative_stock then
        raise exception 'insufficient_stock:%', v_product.name using errcode = 'P0001';
      end if;

      if v_new_balance < 0 then
        v_warnings := v_warnings || jsonb_build_object(
          'code','negative_stock','product_id',v_product.id,
          'name',v_product.name,'balance',v_new_balance);
      end if;

      update public.product_stocks
         set quantity = v_new_balance, updated_at = now()
       where id = v_stock.id;

      insert into public.stock_movements (
        organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
        unit_cost, ref_table, ref_id, created_by, created_at
      ) values (
        p_org, v_outlet, v_product.id, 'sale', -v_qty, v_new_balance,
        v_product.cost_price, 'transactions', v_id, p_cashier, v_client_at
      );
    end if;
  end loop;

  -- 5. Pajak & total
  if v_org.tax_enabled and v_org.tax_percent > 0 then
    if v_org.tax_inclusive then
      v_tax := round((v_subtotal - v_discount) * v_org.tax_percent / (100 + v_org.tax_percent));
    else
      v_tax := round((v_subtotal - v_discount) * v_org.tax_percent / 100);
    end if;
  end if;

  v_total := v_subtotal - v_discount + (case when v_org.tax_inclusive then 0 else v_tax end);

  update public.transactions
     set subtotal = v_subtotal,
         discount_total = v_discount,
         tax_total = v_tax,
         total = v_total,
         cost_total = v_cost_total,
         paid_amount = greatest(v_paid, v_total),
         change_amount = greatest(v_paid - v_total, 0)
   where id = v_id;

  insert into public.transaction_payments (organization_id, transaction_id, method, amount, reference)
  values (p_org, v_id,
          coalesce((p_trx ->> 'payment_method')::public.payment_method,'cash'),
          v_total, p_trx ->> 'payment_reference');

  if (p_trx ->> 'customer_id') is not null then
    update public.customers
       set total_spent = total_spent + v_total,
           visit_count = visit_count + 1,
           last_visit_at = v_client_at
     where id = (p_trx ->> 'customer_id')::uuid;
  end if;

  return jsonb_build_object(
    'status','accepted','id',v_id,'code',v_code,'total',v_total,
    'change', greatest(v_paid - v_total, 0), 'warnings', v_warnings);
end;
$$;

-- ------------------------------------------------------------
-- create_transaction: jalur online (kasir sedang terhubung)
-- ------------------------------------------------------------
create or replace function public.create_transaction(p_org uuid, p_trx jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.user_can(p_org, 'pos') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public._apply_transaction(p_org, p_trx, 'online', auth.uid());
end;
$$;

-- ------------------------------------------------------------
-- sync_transactions: unggah antrean offline satu batch.
-- Setiap transaksi diproses di savepoint sendiri — satu yang gagal
-- tidak menjatuhkan sisanya.
-- ------------------------------------------------------------
create or replace function public.sync_transactions(
  p_org       uuid,
  p_device    uuid,
  p_batch     jsonb,           -- array transaksi
  p_app_ver   text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_batch_id  uuid;
  v_trx       jsonb;
  v_res       jsonb;
  v_results   jsonb := '[]'::jsonb;
  v_accepted  int := 0;
  v_dup       int := 0;
  v_rejected  int := 0;
  v_t0        timestamptz := clock_timestamp();
begin
  if not public.user_can(p_org, 'pos') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.sync_batches (
    organization_id, outlet_id, device_id, submitted_by, item_count,
    oldest_client_at, app_version)
  select p_org,
         (select outlet_id from public.devices where id = p_device),
         p_device, auth.uid(), jsonb_array_length(p_batch),
         (select min((e ->> 'client_created_at')::timestamptz)
            from jsonb_array_elements(p_batch) e),
         p_app_ver
  returning id into v_batch_id;

  for v_trx in select * from jsonb_array_elements(p_batch) loop
    begin
      v_res := public._apply_transaction(p_org, v_trx, 'offline', auth.uid());

      if v_res ->> 'status' = 'duplicate' then
        v_dup := v_dup + 1;
      else
        v_accepted := v_accepted + 1;
      end if;

      -- Peringatan (stok minus, produk terhapus) dicatat tapi transaksinya diterima
      if jsonb_array_length(coalesce(v_res -> 'warnings','[]'::jsonb)) > 0 then
        insert into public.sync_rejections (
          organization_id, batch_id, device_id, client_trx_id, client_trx_code,
          reason_code, reason, payload, resolved_at)
        values (p_org, v_batch_id, p_device, (v_trx ->> 'id')::uuid, v_res ->> 'code',
                'warning', 'Transaksi diterima dengan catatan',
                jsonb_build_object('warnings', v_res -> 'warnings'), null);
      end if;

      v_results := v_results || v_res;

    exception when others then
      v_rejected := v_rejected + 1;
      insert into public.sync_rejections (
        organization_id, batch_id, device_id, client_trx_id, client_trx_code,
        reason_code, reason, payload)
      values (p_org, v_batch_id, p_device, (v_trx ->> 'id')::uuid, v_trx ->> 'code',
              coalesce(split_part(sqlerrm, ':', 1), 'unknown'), sqlerrm, v_trx);
      v_results := v_results || jsonb_build_object(
        'status','rejected','id', v_trx ->> 'id', 'reason', sqlerrm);
    end;
  end loop;

  update public.sync_batches
     set accepted_count = v_accepted, duplicate_count = v_dup, rejected_count = v_rejected,
         duration_ms = (extract(epoch from (clock_timestamp() - v_t0)) * 1000)::int
   where id = v_batch_id;

  update public.devices
     set last_sync_at = now(), last_seen_at = now(), app_version = coalesce(p_app_ver, app_version)
   where id = p_device;

  return jsonb_build_object(
    'batch_id', v_batch_id, 'accepted', v_accepted, 'duplicate', v_dup,
    'rejected', v_rejected, 'results', v_results);
end;
$$;

-- ------------------------------------------------------------
-- pull_catalog: delta sync ke perangkat.
-- Mengirim hanya baris yang berubah sejak p_since, termasuk yang dihapus
-- (deleted_at) supaya cache lokal ikut membuang barisnya.
-- ------------------------------------------------------------
create or replace function public.pull_catalog(
  p_org    uuid,
  p_outlet uuid,
  p_since  timestamptz default 'epoch'
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'server_time', now(),
    'catalog_version', (select catalog_version from public.organizations where id = p_org),
    'settings', (select to_jsonb(o) - 'created_by'
                   from public.organizations o where o.id = p_org),
    'outlet', (select to_jsonb(x) from public.outlets x where x.id = p_outlet),
    'categories', coalesce((select jsonb_agg(to_jsonb(c))
                   from public.categories c
                   where c.organization_id = p_org and c.updated_at > p_since), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(p))
                   from public.products p
                   where p.organization_id = p_org and p.updated_at > p_since), '[]'::jsonb),
    'stocks', coalesce((select jsonb_agg(to_jsonb(s))
                   from public.product_stocks s
                   where s.organization_id = p_org and s.outlet_id = p_outlet
                     and s.updated_at > p_since), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
                     'id', m.id, 'user_id', m.user_id, 'name', pr.full_name,
                     'role', m.role, 'permissions', m.permissions))
                   from public.organization_members m
                   join public.profiles pr on pr.id = m.user_id
                   where m.organization_id = p_org and m.status = 'active'), '[]'::jsonb)
  )
  where public.can_read_org(p_org);
$$;

-- ------------------------------------------------------------
-- void_transaction: batalkan transaksi & kembalikan stok
-- ------------------------------------------------------------
create or replace function public.void_transaction(p_trx_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_trx  public.transactions%rowtype;
  v_item public.transaction_items%rowtype;
  v_bal  integer;
begin
  select * into v_trx from public.transactions where id = p_trx_id;
  if not found then raise exception 'transaction_not_found' using errcode = 'P0002'; end if;
  if not public.can_manage(v_trx.organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_trx.status = 'void' then
    return jsonb_build_object('status','already_void','id',p_trx_id);
  end if;

  for v_item in select * from public.transaction_items where transaction_id = p_trx_id loop
    if v_item.product_id is not null then
      update public.product_stocks
         set quantity = quantity + v_item.quantity, updated_at = now()
       where product_id = v_item.product_id and outlet_id = v_trx.outlet_id
      returning quantity into v_bal;

      if found then
        insert into public.stock_movements (
          organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
          ref_table, ref_id, note, created_by)
        values (v_trx.organization_id, v_trx.outlet_id, v_item.product_id, 'return',
                v_item.quantity, v_bal, 'transactions', p_trx_id, p_reason, auth.uid());
      end if;
    end if;
  end loop;

  update public.transactions
     set status = 'void', voided_by = auth.uid(), voided_at = now(), void_reason = p_reason
   where id = p_trx_id;

  return jsonb_build_object('status','voided','id',p_trx_id);
end;
$$;

-- ------------------------------------------------------------
-- Shift
-- ------------------------------------------------------------
create or replace function public.open_shift(
  p_org uuid, p_outlet uuid, p_device uuid, p_opening_cash bigint default 0)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not public.user_can(p_org, 'pos') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_id from public.shifts
   where outlet_id = p_outlet and user_id = auth.uid() and status = 'open';
  if found then return v_id; end if;

  insert into public.shifts (organization_id, outlet_id, device_id, user_id, opening_cash)
  values (p_org, p_outlet, p_device, auth.uid(), p_opening_cash)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.close_shift(p_shift uuid, p_closing_cash bigint, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_s public.shifts%rowtype; v_cash bigint;
begin
  select * into v_s from public.shifts where id = p_shift;
  if not found then raise exception 'shift_not_found' using errcode = 'P0002'; end if;
  if v_s.user_id <> auth.uid() and not public.can_manage(v_s.organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(sum(total),0) into v_cash
    from public.transactions
   where shift_id = p_shift and status = 'paid' and payment_method = 'cash';

  update public.shifts
     set status = 'closed', closed_at = now(),
         expected_cash = v_s.opening_cash + v_cash,
         closing_cash = p_closing_cash, note = p_note
   where id = p_shift;

  return jsonb_build_object('shift_id', p_shift,
    'expected_cash', v_s.opening_cash + v_cash, 'closing_cash', p_closing_cash,
    'difference', p_closing_cash - (v_s.opening_cash + v_cash));
end;
$$;

-- ------------------------------------------------------------
-- Stok manual / opname
-- ------------------------------------------------------------
create or replace function public.adjust_stock(
  p_org uuid, p_product uuid, p_outlet uuid, p_new_qty integer,
  p_type public.stock_move_type default 'adjustment', p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_old integer; v_delta integer;
begin
  if not public.user_can(p_org, 'products') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
  values (p_org, p_product, p_outlet, 0)
  on conflict (product_id, outlet_id) do nothing;

  select quantity into v_old from public.product_stocks
   where product_id = p_product and outlet_id = p_outlet for update;

  v_delta := p_new_qty - v_old;

  update public.product_stocks set quantity = p_new_qty, updated_at = now()
   where product_id = p_product and outlet_id = p_outlet;

  insert into public.stock_movements (
    organization_id, outlet_id, product_id, type, quantity_delta, balance_after,
    note, created_by)
  values (p_org, p_outlet, p_product, p_type, v_delta, p_new_qty, p_note, auth.uid());

  return jsonb_build_object('product_id',p_product,'from',v_old,'to',p_new_qty,'delta',v_delta);
end;
$$;

-- ------------------------------------------------------------
-- PIN kasir (unlock POS saat ganti shift / perangkat offline yang baru online)
-- ------------------------------------------------------------
create or replace function public.set_member_pin(p_member uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public, pg_temp, extensions
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.organization_members where id = p_member;
  if v_org is null or public.user_role_in(v_org) <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'pin_must_be_6_digits' using errcode = 'P0001';
  end if;

  insert into public.member_pins (member_id, organization_id, pin_hash, updated_at)
  values (p_member, v_org, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), now())
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function public.verify_member_pin(p_member uuid, p_pin text)
returns boolean
language sql security definer set search_path = public, pg_temp, extensions
as $$
  select exists (
    select 1 from public.member_pins mp
    where mp.member_id = p_member
      and mp.pin_hash = extensions.crypt(p_pin, mp.pin_hash)
      and public.can_read_org(mp.organization_id))
$$;

-- ------------------------------------------------------------
-- provision_organization: buat tenant lengkap dalam satu transaksi
-- ------------------------------------------------------------
create or replace function public.provision_organization(
  p_name text, p_city text, p_owner uuid, p_plan_code text default 'starter')
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_org uuid; v_outlet uuid; v_plan uuid; v_trial int; v_slug text;
begin
  select id into v_plan from public.plans where code = p_plan_code;
  select trial_days into v_trial from public.platform_settings where id;

  v_slug := regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g');
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (name, slug, city, plan_id, status, trial_ends_at, created_by)
  values (p_name, v_slug, p_city, v_plan, 'trial', now() + make_interval(days => v_trial), p_owner)
  returning id into v_org;

  insert into public.outlets (organization_id, name, code, is_primary)
  values (v_org, p_name, 'MAIN', true)
  returning id into v_outlet;

  insert into public.organization_members (organization_id, user_id, role, default_outlet_id, permissions)
  values (v_org, p_owner, 'owner', v_outlet,
          '{"pos":true,"products":true,"reports":true,"settings":true}'::jsonb);

  insert into public.categories (organization_id, name, color_key, sort_order)
  values (v_org,'Sembako','sembako',1), (v_org,'Minuman','minuman',2),
         (v_org,'Snack','snack',3),     (v_org,'Kebutuhan','kebutuhan',4);

  insert into public.subscription_events (organization_id, plan_id, action, created_by)
  values (v_org, v_plan, 'subscribe', p_owner);

  return v_org;
end;
$$;

grant execute on function
  public.create_transaction, public.sync_transactions, public.pull_catalog,
  public.void_transaction, public.open_shift, public.close_shift,
  public.adjust_stock, public.set_member_pin, public.verify_member_pin
to authenticated;

revoke execute on function public._apply_transaction from public, authenticated;
revoke execute on function public.provision_organization from public, authenticated;
