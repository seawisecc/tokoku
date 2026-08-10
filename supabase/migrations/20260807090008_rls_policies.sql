-- ============================================================
-- TokoKu · 0008 · Row Level Security
-- Aturan: SETIAP tabel tenant difilter dengan organization_id.
-- Kasir hanya boleh MENAMBAH transaksi — tidak pernah mengubah atau menghapus.
-- ============================================================

alter table public.profiles               enable row level security;
alter table public.plans                  enable row level security;
alter table public.platform_admins        enable row level security;
alter table public.platform_settings      enable row level security;
alter table public.organizations          enable row level security;
alter table public.outlets                enable row level security;
alter table public.organization_members   enable row level security;
alter table public.member_pins            enable row level security;
alter table public.invitations            enable row level security;
alter table public.devices                enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_stocks         enable row level security;
alter table public.stock_movements        enable row level security;
alter table public.customers              enable row level security;
alter table public.shifts                 enable row level security;
alter table public.transactions           enable row level security;
alter table public.transaction_items      enable row level security;
alter table public.transaction_payments   enable row level security;
alter table public.sync_batches           enable row level security;
alter table public.sync_rejections        enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.impersonation_sessions enable row level security;
alter table public.subscription_events    enable row level security;

-- ---------------- profiles ----------------
create policy profiles_read_self on public.profiles for select using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (                                   -- rekan satu organisasi
    select 1 from public.organization_members m
    where m.user_id = profiles.id
      and m.organization_id in (select public.user_org_ids()))
);
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------- platform ----------------
create policy plans_read_all on public.plans for select using (auth.role() = 'authenticated');
create policy plans_admin_write on public.plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy padmin_read on public.platform_admins for select using (public.is_platform_admin());
create policy padmin_write on public.platform_admins for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy psettings_read on public.platform_settings for select using (auth.role() = 'authenticated');
create policy psettings_write on public.platform_settings for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------- organizations ----------------
create policy org_read on public.organizations for select using (public.can_read_org(id));
create policy org_update on public.organizations for update
  using (public.user_role_in(id) = 'owner' or public.is_platform_admin())
  with check (public.user_role_in(id) = 'owner' or public.is_platform_admin());
-- Pembuatan & penghapusan tenant hanya lewat RPC provision_organization / Super Admin
create policy org_admin_insert on public.organizations for insert
  with check (public.is_platform_admin());
create policy org_admin_delete on public.organizations for delete
  using (public.is_platform_admin());

-- ---------------- outlets ----------------
create policy outlets_read on public.outlets for select using (public.can_read_org(organization_id));
create policy outlets_write on public.outlets for all
  using (public.can_manage(organization_id) or public.is_platform_admin())
  with check (public.can_manage(organization_id) or public.is_platform_admin());

-- ---------------- organization_members ----------------
create policy members_read on public.organization_members for select
  using (public.can_read_org(organization_id));
-- Hanya owner yang boleh mengubah komposisi & role tim
create policy members_write on public.organization_members for all
  using (public.user_role_in(organization_id) = 'owner' or public.is_platform_admin())
  with check (public.user_role_in(organization_id) = 'owner' or public.is_platform_admin());

-- ---------------- member_pins ----------------
-- Hash PIN tidak pernah boleh dibaca client. Verifikasi hanya lewat RPC verify_member_pin().
create policy pins_no_read on public.member_pins for select using (false);
create policy pins_write on public.member_pins for all
  using (public.user_role_in(organization_id) = 'owner')
  with check (public.user_role_in(organization_id) = 'owner');

-- ---------------- invitations ----------------
create policy invites_read on public.invitations for select
  using (public.can_manage(organization_id) or public.is_platform_admin());
create policy invites_write on public.invitations for all
  using (public.user_role_in(organization_id) = 'owner')
  with check (public.user_role_in(organization_id) = 'owner');

-- ---------------- devices ----------------
create policy devices_read on public.devices for select using (public.can_read_org(organization_id));
-- Kasir boleh mendaftarkan perangkatnya sendiri saat pertama membuka POS
create policy devices_insert on public.devices for insert
  with check (organization_id in (select public.user_org_ids()));
create policy devices_update on public.devices for update
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy devices_delete on public.devices for delete
  using (public.can_manage(organization_id));

-- ---------------- categories & products: kasir read-only ----------------
create policy categories_read on public.categories for select using (public.can_read_org(organization_id));
create policy categories_write on public.categories for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

create policy products_read on public.products for select using (public.can_read_org(organization_id));
create policy products_write on public.products for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

-- ---------------- stok ----------------
create policy stocks_read on public.product_stocks for select using (public.can_read_org(organization_id));
-- Penulisan stok hanya lewat RPC (SECURITY DEFINER); tidak ada jalur langsung dari client.
create policy stocks_manage on public.product_stocks for all
  using (public.user_can(organization_id, 'products'))
  with check (public.user_can(organization_id, 'products'));

create policy movements_read on public.stock_movements for select
  using (public.can_read_org(organization_id));
-- Append-only: tidak ada policy UPDATE maupun DELETE, untuk siapa pun.
create policy movements_insert on public.stock_movements for insert
  with check (organization_id in (select public.user_org_ids()));

-- ---------------- customers ----------------
create policy customers_read on public.customers for select using (public.can_read_org(organization_id));
create policy customers_write on public.customers for all
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- ---------------- shifts ----------------
create policy shifts_read on public.shifts for select using (
  public.can_read_org(organization_id)
  and (user_id = auth.uid() or public.can_manage(organization_id) or public.is_platform_admin())
);
create policy shifts_insert on public.shifts for insert
  with check (organization_id in (select public.user_org_ids()) and user_id = auth.uid());
create policy shifts_update on public.shifts for update
  using (organization_id in (select public.user_org_ids())
         and (user_id = auth.uid() or public.can_manage(organization_id)))
  with check (organization_id in (select public.user_org_ids()));

-- ---------------- transactions ----------------
-- Kasir: lihat miliknya sendiri (layar "Riwayat"). Owner/admin: semua.
create policy trx_read on public.transactions for select using (
  public.is_platform_admin()
  or (organization_id in (select public.user_org_ids())
      and (cashier_id = auth.uid() or public.can_manage(organization_id)
           or public.user_can(organization_id, 'reports')))
);
create policy trx_insert on public.transactions for insert with check (
  organization_id in (select public.user_org_ids())
  and public.user_can(organization_id, 'pos')
  and cashier_id = auth.uid()
);
-- Void hanya lewat RPC void_transaction() yang mengecek role dan mengembalikan stok.
create policy trx_update on public.transactions for update
  using (public.can_manage(organization_id)) with check (public.can_manage(organization_id));
-- Tidak ada policy DELETE: transaksi tidak pernah dihapus, hanya di-void.

create policy trx_items_read on public.transaction_items for select using (
  public.is_platform_admin()
  or exists (select 1 from public.transactions t
             where t.id = transaction_items.transaction_id)   -- tunduk pada trx_read
);
create policy trx_items_insert on public.transaction_items for insert with check (
  organization_id in (select public.user_org_ids())
  and public.user_can(organization_id, 'pos')
);

create policy trx_pay_read on public.transaction_payments for select
  using (public.can_read_org(organization_id));
create policy trx_pay_insert on public.transaction_payments for insert with check (
  organization_id in (select public.user_org_ids())
  and public.user_can(organization_id, 'pos')
);

-- ---------------- sync ----------------
create policy sync_batches_read on public.sync_batches for select
  using (public.can_read_org(organization_id));
create policy sync_batches_insert on public.sync_batches for insert
  with check (organization_id in (select public.user_org_ids()));

create policy sync_rej_read on public.sync_rejections for select
  using (public.can_manage(organization_id) or public.is_platform_admin());
create policy sync_rej_update on public.sync_rejections for update
  using (public.can_manage(organization_id)) with check (public.can_manage(organization_id));

-- ---------------- audit & billing ----------------
create policy audit_read on public.audit_logs for select using (
  public.is_platform_admin()
  or (organization_id is not null and public.can_manage(organization_id))
);
-- Penulisan audit hanya lewat trigger SECURITY DEFINER.

create policy imp_read on public.impersonation_sessions for select
  using (public.is_platform_admin() or public.can_manage(organization_id));
create policy imp_write on public.impersonation_sessions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy sub_read on public.subscription_events for select
  using (public.can_read_org(organization_id));
create policy sub_write on public.subscription_events for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
