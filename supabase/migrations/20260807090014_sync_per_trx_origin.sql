-- ============================================================
-- TokoKu · 0014 · sync_transactions menghormati origin per transaksi
--
-- Sebelumnya seluruh batch dipaksa origin='offline'. Akibatnya POS harus punya
-- dua jalur: panggil create_transaction saat online, sync_transactions saat
-- offline. Dua jalur berarti jalur offline jarang dijalani saat pengembangan —
-- persis kelas bug yang ingin dihindari.
--
-- Sekarang setiap transaksi membawa origin-nya sendiri, ditentukan perangkat
-- pada saat pembayaran. POS cukup menulis ke outbox lalu mengirim batch,
-- tanpa peduli sedang online atau tidak.
-- ============================================================

create or replace function public.sync_transactions(
  p_org       uuid,
  p_device    uuid,
  p_batch     jsonb,
  p_app_ver   text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_batch_id  uuid;
  v_trx       jsonb;
  v_res       jsonb;
  v_origin    public.trx_origin;
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
      -- Perangkat yang menentukan: transaksi ini dibuat saat online atau tidak.
      v_origin := coalesce((v_trx ->> 'origin')::public.trx_origin, 'offline');
      v_res := public._apply_transaction(p_org, v_trx, v_origin, auth.uid());

      if v_res ->> 'status' = 'duplicate' then
        v_dup := v_dup + 1;
      else
        v_accepted := v_accepted + 1;
      end if;

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
     set last_sync_at = now(), last_seen_at = now(), pending_count = 0,
         app_version = coalesce(p_app_ver, app_version)
   where id = p_device;

  return jsonb_build_object(
    'batch_id', v_batch_id, 'accepted', v_accepted, 'duplicate', v_dup,
    'rejected', v_rejected, 'results', v_results);
end;
$$;

grant execute on function public.sync_transactions to authenticated;
