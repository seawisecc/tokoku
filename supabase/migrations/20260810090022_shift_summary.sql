-- ============================================================
-- TokoKu · 0022 · Ringkasan shift
--
-- Shift sudah berjalan penuh sejak awal (buka/tutup, hitung kas, selisih laci)
-- tapi tidak pernah punya laporan. Padahal justru inilah yang paling sering
-- ditanyakan pemilik warung: "kemarin kasir siapa, jualannya berapa, uangnya
-- cocok atau tidak."
--
-- `security_invoker = on`: barisnya disaring RLS shifts seperti biasa. Tidak ada
-- fungsi SECURITY DEFINER di sini — sengaja, supaya tidak mengulang jebakan
-- kebocoran lintas tenant di migrasi 0019.
-- ============================================================

create or replace view public.v_shift_summary with (security_invoker = on) as
select
  s.id,
  s.organization_id,
  s.outlet_id,
  s.user_id,
  pr.full_name                       as cashier_name,
  dv.code                            as device_code,
  s.status,
  s.opened_at,
  s.closed_at,
  s.opening_cash,
  s.expected_cash,
  s.closing_cash,
  s.cash_difference,
  s.note,
  (select count(*) from public.transactions t
    where t.shift_id = s.id and t.status = 'paid')                    as trx_count,
  (select coalesce(sum(t.total), 0) from public.transactions t
    where t.shift_id = s.id and t.status = 'paid')                    as sales_total,
  (select coalesce(sum(t.total), 0) from public.transactions t
    where t.shift_id = s.id and t.status = 'paid'
      and t.payment_method = 'cash')                                  as cash_total,
  (select coalesce(sum(t.total), 0) from public.transactions t
    where t.shift_id = s.id and t.status = 'paid'
      and t.payment_method <> 'cash')                                 as noncash_total,
  (select count(*) from public.transactions t
    where t.shift_id = s.id and t.status = 'void')                    as void_count
from public.shifts s
left join public.profiles pr on pr.id = s.user_id
left join public.devices  dv on dv.id = s.device_id;

grant select on public.v_shift_summary to authenticated;

comment on view public.v_shift_summary is
  'Satu baris per shift: kasir, perangkat, jumlah transaksi, penjualan tunai/non-tunai, dan selisih kas.';
