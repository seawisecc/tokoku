-- ============================================================
-- TokoKu · 0010 · Trigger
-- ============================================================

-- ---------- updated_at otomatis ----------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','plans','organizations','outlets','organization_members',
    'categories','products','customers'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- ---------- profiles dibuat otomatis saat signup ----------
create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- ---------- catalog_version: penanda cache basi untuk perangkat offline ----------
-- Perangkat membandingkan versi lokal vs server; kalau beda, tarik delta katalog.
create or replace function public.tg_bump_catalog_version()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.organizations
     set catalog_version = catalog_version + 1
   where id = coalesce(new.organization_id, old.organization_id);
  return coalesce(new, old);
end; $$;

create trigger bump_catalog_on_product
  after insert or update or delete on public.products
  for each row execute function public.tg_bump_catalog_version();

create trigger bump_catalog_on_category
  after insert or update or delete on public.categories
  for each row execute function public.tg_bump_catalog_version();

-- ---------- stok awal saat produk dibuat ----------
create or replace function public.tg_seed_product_stock()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.product_stocks (organization_id, product_id, outlet_id, quantity)
  select new.organization_id, new.id, o.id, 0
  from public.outlets o
  where o.organization_id = new.organization_id and o.deleted_at is null
  on conflict (product_id, outlet_id) do nothing;
  return new;
end; $$;

create trigger seed_stock_on_product
  after insert on public.products
  for each row execute function public.tg_seed_product_stock();

-- ---------- organisasi wajib punya minimal satu owner ----------
create or replace function public.tg_guard_last_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    if (select count(*) from public.organization_members
        where organization_id = old.organization_id
          and role = 'owner' and status = 'active' and id <> old.id) = 0 then
      raise exception 'last_owner_cannot_be_removed' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end; $$;

create trigger guard_last_owner
  before update or delete on public.organization_members
  for each row execute function public.tg_guard_last_owner();

-- ---------- audit otomatis ----------
create or replace function public.tg_audit_row()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('from', to_jsonb(old) -> key, 'to', value))
      into v_changes
      from jsonb_each(to_jsonb(new))
     where to_jsonb(old) -> key is distinct from value
       and key not in ('updated_at','last_active_at','last_seen_at','catalog_version');
    if v_changes is null then return new; end if;
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, changes)
  values (
    coalesce((to_jsonb(coalesce(new, old)) ->> 'organization_id')::uuid,
             (to_jsonb(coalesce(new, old)) ->> 'id')::uuid),
    auth.uid(), lower(tg_op), tg_table_name,
    (to_jsonb(coalesce(new, old)) ->> 'id')::uuid,
    coalesce(v_changes, to_jsonb(coalesce(new, old))));
  return coalesce(new, old);
end; $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','organization_members','products','outlets','plans'] loop
    execute format(
      'create trigger audit_changes after insert or update or delete on public.%I
       for each row execute function public.tg_audit_row()', t);
  end loop;
end $$;
