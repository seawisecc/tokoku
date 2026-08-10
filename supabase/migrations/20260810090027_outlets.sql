-- ============================================================
-- TokoKu · 0027 · Multi-outlet di aplikasi
--
-- Skemanya sudah mendukung banyak outlet sejak migrasi 0003: `outlet_id` ada di
-- product_stocks, transactions, stock_movements, shifts, devices, purchases,
-- dan consignments. Yang belum ada adalah cara MEMBUAT outlet kedua dan cara
-- BERPINDAH ke sana — aplikasinya selama ini memakai `default_outlet_id` saja.
--
-- ------------------------------------------------------------
-- OUTLET BUKAN BATAS KEAMANAN. Ini perlu disebut terang-terangan.
--
-- Seluruh policy RLS di project ini disaring per ORGANISASI, bukan per outlet.
-- Anggota toko yang boleh membaca satu outlet secara teknis boleh membaca
-- semuanya. Jadi outlet di sini adalah KONTEKS KERJA — "saya sedang jaga di
-- cabang mana" — bukan pagar hak akses.
--
-- Kalau nanti benar-benar perlu kasir yang hanya boleh menyentuh satu cabang,
-- itu butuh tabel penugasan (member × outlet) DAN policy RLS yang ikut
-- menyaringnya. Membatasinya di UI saja cuma teater: siapa pun bisa mengubah
-- cookie dan tetap dilayani database.
-- ------------------------------------------------------------
--
-- Kuota outlet TIDAK ditegakkan ulang di sini. `max_outlets` sudah dijaga
-- trigger dari migrasi 0018 dan menolak dengan TK001 berisi pesan siap tampil.
-- Menambah gerbang kedua di RPC ini hanya menciptakan dua sumber kebenaran yang
-- bisa berbeda — dan yang di aplikasi selalu yang lebih dulu basi.
-- ============================================================

-- ---------- menjaga toko tidak kehilangan outletnya ----------
/**
 * Sebuah toko harus SELALU punya minimal satu outlet aktif.
 *
 * Tanpa penjagaan ini, pemilik yang menonaktifkan cabang terakhirnya akan
 * mendapati kasir tidak bisa dibuka sama sekali — `session.outletId` menjadi
 * null dan setiap penjualan ditolak. Kesalahannya baru terasa besok pagi saat
 * antrean sudah mengular, dan tidak ada tombol yang jelas untuk memperbaikinya.
 *
 * Outlet utama juga tidak boleh dinonaktifkan: ia yang jadi tujuan jatuh-balik
 * saat cookie outlet tidak valid.
 */
create or replace function public.enforce_outlet_invariants()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_left int;
begin
  -- Hanya peduli saat outlet BERHENTI aktif (dinonaktifkan atau dihapus lunak).
  if new.is_active and new.deleted_at is null then
    return new;
  end if;
  if not old.is_active or old.deleted_at is not null then
    return new;  -- memang sudah tidak aktif sebelumnya
  end if;

  if old.is_primary then
    raise exception 'Outlet utama tidak bisa dinonaktifkan. Jadikan outlet lain sebagai utama dulu.'
      using errcode = 'TK003';
  end if;

  select count(*) into v_left
    from public.outlets
   where organization_id = new.organization_id
     and is_active and deleted_at is null
     and id <> new.id;

  if v_left = 0 then
    raise exception 'Ini satu-satunya outlet yang masih aktif. Toko harus punya minimal satu outlet supaya kasir tetap bisa dibuka.'
      using errcode = 'TK003';
  end if;

  return new;
end
$$;

drop trigger if exists trg_outlet_invariants on public.outlets;
create trigger trg_outlet_invariants before update on public.outlets
  for each row execute function public.enforce_outlet_invariants();

-- ---------- RPC ----------
/**
 * Buat outlet baru.
 *
 * Lewat RPC hanya karena penomoran kodenya perlu dilihat bersama baris lain
 * dalam satu transaksi — sisanya bisa saja lewat tabel biasa. Kuota dan status
 * langganan tetap dijaga trigger yang sudah ada; RPC ini tidak mengulangnya.
 */
create or replace function public.create_outlet(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_code text;
  v_seq  int;
  v_id   uuid;
begin
  if not public.user_can(p_org, 'settings') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_name := nullif(trim(p_payload ->> 'name'), '');
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nama outlet minimal 2 huruf.' using errcode = 'TK003';
  end if;

  v_code := upper(nullif(trim(p_payload ->> 'code'), ''));
  if v_code is null then
    -- OUT-2, OUT-3, … Nomornya dari jumlah outlet yang ADA (termasuk yang sudah
    -- dinonaktifkan) supaya kode tidak pernah dipakai ulang: kode outlet ikut
    -- terbaca orang di laporan, dan kode yang sama untuk dua cabang berbeda
    -- membuat riwayat lama tidak bisa dipercaya.
    select count(*) + 1 into v_seq from public.outlets where organization_id = p_org;
    v_code := 'OUT-' || v_seq;
    while exists (select 1 from public.outlets where organization_id = p_org and code = v_code) loop
      v_seq := v_seq + 1;
      v_code := 'OUT-' || v_seq;
    end loop;
  end if;

  insert into public.outlets (
    organization_id, name, code, address, phone, is_primary, is_active)
  values (
    p_org, v_name, v_code,
    nullif(trim(p_payload ->> 'address'), ''),
    nullif(trim(p_payload ->> 'phone'), ''),
    false, true)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'code', v_code, 'name', v_name);
exception
  when unique_violation then
    raise exception 'Kode outlet "%" sudah dipakai di toko ini.', v_code using errcode = 'TK003';
end
$$;

/**
 * Pindahkan status "outlet utama".
 *
 * Satu statement, bukan dua UPDATE berurutan: indeks unik parsial
 * `outlets_one_primary_idx` menolak dua outlet utama sekaligus, jadi mencabut
 * lalu memasang akan gagal di tengah kalau urutannya terbalik — dan gagal di
 * tengah berarti toko sempat tidak punya outlet utama sama sekali.
 */
create or replace function public.set_primary_outlet(p_org uuid, p_outlet uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.user_can(p_org, 'settings') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.outlets
     where id = p_outlet and organization_id = p_org
       and is_active and deleted_at is null
  ) then
    raise exception 'Outlet tidak ditemukan atau sedang tidak aktif.' using errcode = 'TK003';
  end if;

  update public.outlets
     set is_primary = (id = p_outlet), updated_at = now()
   where organization_id = p_org
     and is_primary <> (id = p_outlet);

  return jsonb_build_object('id', p_outlet);
end
$$;

revoke execute on function public.create_outlet(uuid, jsonb)      from public, anon;
revoke execute on function public.set_primary_outlet(uuid, uuid)  from public, anon;
grant  execute on function public.create_outlet(uuid, jsonb)      to authenticated;
grant  execute on function public.set_primary_outlet(uuid, uuid)  to authenticated;

comment on function public.create_outlet is
  'Buat outlet baru. Kuota max_outlets & status langganan dijaga trigger, bukan di sini.';
comment on function public.enforce_outlet_invariants is
  'Toko harus selalu punya minimal satu outlet aktif, dan outlet utama tidak bisa dinonaktifkan.';
