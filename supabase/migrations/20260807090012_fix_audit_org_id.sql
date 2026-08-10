-- ============================================================
-- TokoKu · 0012 · Perbaikan tg_audit_row()
--
-- Versi sebelumnya menurunkan organization_id dengan:
--   coalesce(row->>'organization_id', row->>'id')
-- Fallback ke 'id' dimaksudkan khusus untuk tabel organizations, di mana id
-- baris memang id organisasi. Tapi trigger yang sama dipasang di 'plans' —
-- tabel platform tanpa organization_id — sehingga id paket ikut dipakai dan
-- melanggar audit_logs_organization_id_fkey.
--
-- Ditemukan saat seed pertama: insert ke plans gagal dengan 23503.
-- ============================================================

create or replace function public.tg_audit_row()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_changes jsonb;
  v_row     jsonb := to_jsonb(coalesce(new, old));
  v_org     uuid;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('from', to_jsonb(old) -> key, 'to', value))
      into v_changes
      from jsonb_each(to_jsonb(new))
     where to_jsonb(old) -> key is distinct from value
       and key not in ('updated_at','last_active_at','last_seen_at','catalog_version');
    if v_changes is null then return new; end if;
  end if;

  -- organizations: id baris ITU SENDIRI adalah id organisasi.
  -- Tabel tenant lain: pakai kolom organization_id.
  -- Tabel platform (plans, …): NULL — audit_logs.organization_id memang nullable
  -- dan NULL berarti "aksi tingkat platform".
  v_org := case
             when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid
             else (v_row ->> 'organization_id')::uuid
           end;

  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, changes)
  values (
    v_org, auth.uid(), lower(tg_op), tg_table_name,
    (v_row ->> 'id')::uuid,
    coalesce(v_changes, v_row));

  return coalesce(new, old);
end; $$;
