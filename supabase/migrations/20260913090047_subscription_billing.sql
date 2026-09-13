-- ============================================================================
-- TokoKu · 0047 · Tagihan langganan & pembayaran Midtrans
--
-- Sampai hari ini perubahan paket dikerjakan TANGAN lewat Super Admin: klien
-- menekan tombol WhatsApp di halaman Langganan, admin membalas, lalu admin
-- mengetik sendiri paket dan tanggal berakhirnya di /admin/klien. Sanggup untuk
-- sepuluh klien pertama, tidak untuk seratus — dan selama itu tidak ada satu
-- pun baris di database yang menjawab "toko ini sudah membayar berapa, kapan,
-- untuk periode mana".
--
-- Migrasi ini menambahkan tagihan sebagai barang yang berdiri sendiri, dan
-- jalur yang mengaktifkan langganan dari pemberitahuan Midtrans.
--
-- ----------------------------------------------------------------------------
-- KENAPA TABEL SENDIRI, BUKAN MENUMPANG `subscription_events`
--
-- `subscription_events` sudah ada sejak migrasi 0006 dan sekilas muat: ia punya
-- plan_id, amount, period_start, period_end. Tapi artinya berbeda, dan ini
-- bukan soal kerapian.
--
-- `subscription_events` adalah JEJAK hal yang SUDAH terjadi — riwayat yang
-- dibaca pemilik toko dan Super Admin, dan yang barisnya tidak pernah berubah
-- lagi setelah ditulis. Tagihan adalah NIAT yang belum tentu jadi: ia lahir
-- berstatus menunggu, bisa kedaluwarsa, bisa ditolak penerbit kartu, bisa
-- dibayar besok pagi lewat virtual account, dan statusnya berubah beberapa kali
-- sepanjang hidupnya.
--
-- Digabung, riwayat langganan akan penuh baris "Perpanjangan" atas pembayaran
-- yang tidak pernah selesai. Itu persis alasan `expenses` dipisah dari
-- `purchases` di migrasi 0043, dan Konsinyasi dipisah dari Pembelian.
--
-- Hubungannya satu arah: tagihan yang LUNAS menulis satu baris ke
-- `subscription_events`. Yang gagal tidak menulis apa pun ke sana.
--
-- ----------------------------------------------------------------------------
-- NOMINALNYA DIHITUNG SERVER, DAN INI KEPUTUSAN PALING MENENTUKAN
--
-- Aturan yang sama persis dengan `discount_total` di migrasi 0039: angka rupiah
-- yang datang dari peramban tidak pernah dipercaya. Di sini taruhannya bahkan
-- lebih sederhana untuk dijelaskan — siapa pun yang bisa membuka DevTools di
-- halaman Langganan bisa membuat tagihan Enterprise seharga seribu rupiah, lalu
-- membayarnya dengan sah lewat Midtrans. Tanda tangan pemberitahuan Midtrans
-- akan cocok, karena yang ditandatangani adalah nominal yang KITA kirim.
--
-- Jadi RPC di bawah cuma menerima "paket mana" dan "berapa bulan". Rupiahnya
-- diambil dari `plans.price_monthly` pada saat tagihan dibuat, dan disimpan di
-- kolomnya sendiri supaya perubahan harga besok tidak menulis ulang tagihan
-- yang sudah terlanjur dibayar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Status tagihan.
--
-- Sengaja BUKAN salinan mentah status Midtrans. Midtrans mengenal settlement,
-- capture, pending, deny, cancel, expire, refund, partial_refund, authorize —
-- sembilan keadaan yang sebagian hanya berarti untuk satu metode pembayaran.
-- Yang perlu dijawab aplikasi ini cuma: masih ditunggu, sudah jadi uang, atau
-- sudah tidak akan jadi uang. Status mentahnya tetap disimpan apa adanya di
-- `transaction_status` untuk penelusuran.
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.invoice_status as enum
    ('pending','paid','failed','expired','cancelled','refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.subscription_invoices (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  plan_id            uuid not null references public.plans(id),

  -- Nomor pesanan yang dikirim ke Midtrans. UNIK SELAMANYA, bukan unik per
  -- hari: Midtrans menolak order_id yang pernah dipakai merchant yang sama,
  -- termasuk milik tagihan yang dulu kedaluwarsa. Karena itu tagihan yang
  -- gagal TIDAK PERNAH dipakai ulang — yang dibuat selalu nomor baru.
  order_id           text not null unique,

  months             int    not null check (months between 1 and 24),
  -- Harga per bulan pada saat tagihan dibuat. Disimpan supaya kenaikan harga
  -- besok tidak mengubah arti tagihan yang sudah dibayar hari ini.
  unit_price         bigint not null check (unit_price > 0),
  amount             bigint not null check (amount > 0),

  status             public.invoice_status not null default 'pending',

  -- Jejak dari Midtrans. Semuanya null sampai ada kabar pertama.
  snap_token         text,
  snap_redirect_url  text,
  transaction_id     text,
  transaction_status text,
  payment_type       text,
  fraud_status       text,
  raw_notification   jsonb,

  paid_at            timestamptz,
  -- Batas waktu bayar yang diberikan ke Midtrans. Dipakai halaman Langganan
  -- untuk memutuskan apakah tagihan menunggu masih layak dilanjutkan.
  expires_at         timestamptz,

  -- Periode yang DIBELI tagihan ini. Baru terisi saat lunas, karena periodenya
  -- dihitung dari tanggal akhir langganan yang berlaku saat pembayaran
  -- diterima, bukan saat tagihan dibuat. Virtual account bisa dibayar tiga hari
  -- kemudian, dan selama tiga hari itu langganannya mungkin sudah diperpanjang
  -- lewat tagihan lain.
  period_start       date,
  period_end         date,

  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.subscription_invoices is
  'Tagihan langganan aplikasi. Satu baris per percobaan pembayaran. '
  'Nominalnya dihitung server dari plans.price_monthly, tidak pernah dari peramban.';

create index if not exists subscription_invoices_org_idx
  on public.subscription_invoices (organization_id, created_at desc);
-- Dipakai halaman Langganan mencari tagihan yang masih menunggu.
create index if not exists subscription_invoices_pending_idx
  on public.subscription_invoices (organization_id, status)
  where status = 'pending';

drop trigger if exists set_updated_at on public.subscription_invoices;
create trigger set_updated_at before update on public.subscription_invoices
  for each row execute function public.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: boleh DIBACA pemilik toko, tidak boleh DITULIS siapa pun dari luar.
--
-- Tidak ada policy insert/update/delete sama sekali, dan itu disengaja. Seluruh
-- penulisan lewat fungsi SECURITY DEFINER di bawah. Satu policy update yang
-- longgar di sini sama artinya dengan mengizinkan pemilik toko menandai
-- tagihannya sendiri lunas — persis lubang yang ditambal migrasi 0036 untuk
-- kolom komersial `organizations`.
-- ----------------------------------------------------------------------------
alter table public.subscription_invoices enable row level security;

drop policy if exists inv_read on public.subscription_invoices;
create policy inv_read on public.subscription_invoices for select
  using (public.can_read_org(organization_id) or public.is_platform_admin());

-- ============================================================================
-- create_subscription_invoice — membuat tagihan berstatus menunggu.
--
-- Dipanggil dari server action saat pemilik toko menekan Bayar. Yang diterima
-- cuma paket dan jumlah bulan; rupiahnya dihitung di sini.
-- ============================================================================
create or replace function public.create_subscription_invoice(
  p_org    uuid,
  p_plan   uuid,
  p_months int
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_plan    public.plans%rowtype;
  v_seq     int;
  v_order   text;
  v_amount  bigint;
  v_id      uuid;
  v_lama    public.subscription_invoices%rowtype;
begin
  /**
   * `can_manage` (owner + admin), bukan `user_can(p_org,'settings')`.
   *
   * Halaman Langganan sendiri dijaga izin `settings`, dan itu benar untuk
   * MELIHAT: kasir yang memegang pengaturan berhak tahu langganannya sisa
   * berapa. Tapi mengeluarkan uang atas nama toko adalah keputusan pemilik.
   * Kalau nanti dilonggarkan, longgarkan juga gerbang tombolnya di UI —
   * tombol yang terlihat lalu ditolak diam-diam sudah pernah jadi cacat di
   * sini (lihat "Perangkat bisa dihapus").
   */
  if not public.can_manage(p_org) then
    raise exception 'Hanya pemilik atau admin toko yang bisa membuat tagihan langganan.'
      using errcode = '42501';
  end if;

  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'Jumlah bulan harus antara 1 dan 24.' using errcode = 'TK003';
  end if;

  select * into v_plan from public.plans where id = p_plan and is_active;
  if not found then
    raise exception 'Paket yang dipilih tidak tersedia.' using errcode = 'TK003';
  end if;

  if coalesce(v_plan.price_monthly, 0) <= 0 then
    raise exception 'Paket ini belum punya harga. Hubungi admin TokoKu.' using errcode = 'TK003';
  end if;

  v_amount := v_plan.price_monthly::bigint * p_months;

  /**
   * Tagihan menunggu yang SAMA PERSIS dipakai ulang, tidak dibuat baru.
   *
   * Tombol Bayar memang dimatikan selama permintaan berjalan, tapi itu
   * penjagaan di layar — jaringan warung yang lambat membuat orang menekan
   * dua kali sebelum apa pun berubah. Tanpa pemakaian ulang, tiap ketukan
   * melahirkan satu nomor pesanan baru di Midtrans, dan pemilik toko melihat
   * daftar tagihan menunggu yang berlipat tanpa pernah ia buat.
   *
   * Yang dipakai ulang harus sama paket, sama jumlah bulan, sama nominal, dan
   * belum lewat batas waktunya. Beda satu saja, tagihannya memang beda.
   */
  select * into v_lama
    from public.subscription_invoices
   where organization_id = p_org
     and status = 'pending'
     and plan_id = p_plan
     and months = p_months
     and amount = v_amount
     and (expires_at is null or expires_at > now())
   order by created_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'id', v_lama.id,
      'order_id', v_lama.order_id,
      'amount', v_lama.amount,
      'months', v_lama.months,
      'plan_name', v_plan.name,
      'snap_token', v_lama.snap_token,
      'snap_redirect_url', v_lama.snap_redirect_url,
      'reused', true
    );
  end if;

  -- Nomor pesanan per hari, enam digit: TKS-20260913-000128.
  -- Urutannya lintas organisasi, bukan per toko — order_id harus unik di
  -- tingkat merchant Midtrans, dan menyertakan id toko di dalamnya akan
  -- membocorkan jumlah klien kepada siapa pun yang melihat satu nomor pesanan.
  select coalesce(max(substring(order_id from '\d+$')::int), 0) + 1 into v_seq
    from public.subscription_invoices
   where order_id like 'TKS-' || to_char(current_date, 'YYYYMMDD') || '-%';

  v_order := 'TKS-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 6, '0');

  insert into public.subscription_invoices (
    organization_id, plan_id, order_id, months, unit_price, amount, created_by
  ) values (
    p_org, p_plan, v_order, p_months, v_plan.price_monthly::bigint, v_amount, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'order_id', v_order,
    'amount', v_amount,
    'months', p_months,
    'plan_name', v_plan.name,
    'snap_token', null,
    'snap_redirect_url', null,
    'reused', false
  );
end
$$;

-- Fungsi ini menerima `organization_id` sebagai parameter, jadi PostgREST
-- mengeksposnya sebagai RPC yang bisa dipanggil siapa pun yang login. Yang
-- menjaganya adalah `can_manage(p_org)` di baris pertama — aturan yang sama
-- dengan seluruh RPC bertenant di project ini (lihat "Jebakan yang sudah
-- pernah menggigit" soal PostgREST).
revoke execute on function public.create_subscription_invoice(uuid, uuid, int) from anon;
grant  execute on function public.create_subscription_invoice(uuid, uuid, int) to authenticated;

-- ============================================================================
-- attach_invoice_snap — menyimpan token Snap ke tagihan yang sudah dibuat.
--
-- Terpisah dari pembuatan tagihan karena panggilan ke Midtrans terjadi di
-- antaranya, di Node, dan panggilan jaringan itu bisa gagal. Digabung jadi satu
-- fungsi, kegagalan meminta token akan ikut membatalkan tagihannya — lalu
-- percobaan berikutnya melahirkan nomor pesanan baru lagi, dan seterusnya.
-- ============================================================================
create or replace function public.attach_invoice_snap(
  p_order_id text,
  p_token    text,
  p_url      text,
  p_expires  timestamptz
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.subscription_invoices
     set snap_token = p_token,
         snap_redirect_url = p_url,
         expires_at = p_expires
   where order_id = p_order_id
     and status = 'pending'
     and public.can_manage(organization_id);
end
$$;

revoke execute on function public.attach_invoice_snap(text, text, text, timestamptz) from anon;
grant  execute on function public.attach_invoice_snap(text, text, text, timestamptz) to authenticated;

-- ============================================================================
-- apply_subscription_payment — SATU tempat yang boleh mengaktifkan langganan.
--
-- Dipanggil dari dua jalur, dan keduanya perlu:
--   1. Route handler pemberitahuan Midtrans (server ke server). Ini sumber
--      kebenarannya — pengguna bisa menutup peramban tepat setelah membayar.
--   2. Penyelarasan saat halaman Langganan dibuka dengan tagihan yang masih
--      menunggu. Ini jaring pengaman untuk pemberitahuan yang tidak pernah
--      sampai, dan tanpa ia satu webhook yang hilang berarti satu klien yang
--      sudah membayar tetap terkunci sampai ada yang menelepon.
--
-- HAK PANGGILNYA DICABUT DARI `authenticated`. Fungsi ini bisa membuat toko
-- mana pun menjadi aktif; dibiarkan terbuka, ia adalah langganan Enterprise
-- gratis untuk siapa saja yang bisa membaca satu nomor pesanan. Yang boleh
-- memanggilnya hanya `service_role`, dan kunci itu tidak pernah ikut ke
-- peramban. Aturan yang sama dengan `_apply_customer_effects` (migrasi 0037)
-- dan `provision_organization`.
-- ============================================================================
create or replace function public.apply_subscription_payment(
  p_order_id text,
  p_payload  jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_inv      public.subscription_invoices%rowtype;
  v_org      public.organizations%rowtype;
  v_plan     public.plans%rowtype;
  v_lama     public.plans%rowtype;
  v_status   text;
  v_fraud    text;
  v_gross    bigint;
  v_baru     public.invoice_status;
  v_mulai    date;
  v_akhir    date;
  v_aksi     public.subscription_action;
  v_dasar    timestamptz;
  v_tz       text;
begin
  select * into v_inv
    from public.subscription_invoices
   where order_id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invoice_not_found');
  end if;

  v_status := coalesce(p_payload ->> 'transaction_status', '');
  v_fraud  := coalesce(p_payload ->> 'fraud_status', '');

  /**
   * Nominal dari pemberitahuan diperiksa ulang terhadap tagihan.
   *
   * Tanda tangan SHA512 memang sudah diperiksa di route handler, dan
   * `gross_amount` termasuk yang ditandatangani — jadi ini bukan penjagaan
   * terhadap pemalsuan. Yang dijaga adalah keadaan yang jauh lebih mungkin:
   * nomor pesanan tertukar, atau tagihan diubah sesudah tokennya diminta.
   * Kalau nominalnya tidak cocok, yang paling aman adalah TIDAK mengaktifkan
   * apa pun dan meninggalkan jejaknya.
   *
   * Midtrans mengirim gross_amount sebagai teks berdesimal ("99000.00").
   */
  v_gross := floor(coalesce(nullif(p_payload ->> 'gross_amount', ''), '0')::numeric)::bigint;
  if v_gross <> v_inv.amount then
    update public.subscription_invoices
       set raw_notification = p_payload,
           transaction_status = v_status,
           updated_at = now()
     where id = v_inv.id;
    return jsonb_build_object(
      'ok', false, 'reason', 'amount_mismatch',
      'expected', v_inv.amount, 'received', v_gross
    );
  end if;

  -- Terjemahan status Midtrans ke status tagihan.
  v_baru := case
    when v_status = 'settlement' then 'paid'
    when v_status = 'capture' and v_fraud in ('accept','') then 'paid'
    when v_status = 'capture' then 'pending'      -- fraud_status 'challenge': ditahan sampai jelas
    when v_status in ('pending','authorize') then 'pending'
    when v_status = 'deny' then 'failed'
    when v_status = 'cancel' then 'cancelled'
    when v_status = 'expire' then 'expired'
    when v_status in ('refund','partial_refund') then 'refunded'
    else v_inv.status
  end;

  /**
   * IDEMPOTEN: satu nomor pesanan hanya boleh memperpanjang SEKALI.
   *
   * Midtrans mengirim pemberitahuan yang sama lebih dari sekali sebagai hal
   * biasa — ia mengulang sampai menerima jawaban 200, dan jaringan bisa
   * membuat jawaban 200 tidak pernah sampai. Tanpa penjagaan ini, satu
   * pembayaran Rp 99.000 bisa menambah tiga bulan langganan.
   *
   * Dicatat, tidak diabaikan diam-diam: `raw_notification` tetap diperbarui
   * supaya kabar terakhir selalu terbaca saat ada yang ditelusuri.
   */
  if v_inv.status = 'paid' then
    update public.subscription_invoices
       set raw_notification = p_payload,
           transaction_status = v_status,
           fraud_status = nullif(v_fraud, ''),
           updated_at = now()
     where id = v_inv.id;
    return jsonb_build_object('ok', true, 'reason', 'already_applied', 'order_id', p_order_id);
  end if;

  update public.subscription_invoices
     set status = v_baru,
         transaction_status = v_status,
         fraud_status = nullif(v_fraud, ''),
         transaction_id = nullif(p_payload ->> 'transaction_id', ''),
         payment_type = nullif(p_payload ->> 'payment_type', ''),
         raw_notification = p_payload,
         updated_at = now()
   where id = v_inv.id;

  if v_baru <> 'paid' then
    return jsonb_build_object('ok', true, 'status', v_baru, 'order_id', p_order_id);
  end if;

  -- ------------------------------------------------------------------
  -- Lunas. Mulai dari sini langganannya benar-benar berubah.
  -- ------------------------------------------------------------------
  select * into v_org  from public.organizations where id = v_inv.organization_id;
  select * into v_plan from public.plans where id = v_inv.plan_id;
  if v_org.plan_id is not null then
    select * into v_lama from public.plans where id = v_org.plan_id;
  end if;

  /**
   * Periode dihitung dari tanggal akhir yang BERLAKU, bukan dari hari ini.
   *
   * Toko yang memperpanjang seminggu sebelum habis tidak boleh kehilangan
   * tujuh hari yang sudah dibayarnya. Begitu juga toko yang membayar di
   * tengah masa coba: sisa masa cobanya tetap miliknya, dan bulan yang dibeli
   * menumpuk di atasnya. Itu beberapa hari gratis yang murah dibanding satu
   * pemilik toko yang merasa dirugikan karena membayar lebih awal.
   *
   * Kolom mana yang berlaku ditentukan STATUS, persis seperti
   * `org_lapsed_at()` dan `lib/subscription.ts`. Toko yang sudah lewat masa
   * aktifnya jatuh ke `now()` lewat greatest().
   */
  v_dasar := case
    when v_org.status = 'trial'  then coalesce(v_org.trial_ends_at, now())
    when v_org.status = 'active' then coalesce(v_org.subscription_ends_at, now())
    else now()
  end;
  v_dasar := greatest(v_dasar, now());

  /**
   * Tanggalnya dipotong menurut ZONA WAKTU TOKO, bukan zona server.
   *
   * Function berjalan di Singapura dengan jam UTC (lihat "Deploy tidak
   * responsif"), jadi `::date` mentah akan memundurkan sehari untuk setiap
   * pembayaran yang masuk sebelum pukul 08.00 WITA. Aturan yang sama sudah
   * dipakai `v_daily_sales` dan `lib/period.ts`.
   */
  v_tz    := coalesce(nullif(v_org.timezone, ''), 'Asia/Makassar');
  v_mulai := (v_dasar at time zone v_tz)::date;
  v_akhir := ((v_dasar at time zone v_tz) + make_interval(months => v_inv.months))::date;

  /**
   * Tanggal berakhir disimpan sebagai AKHIR HARI, bukan tengah malam.
   *
   * Alasannya sama dengan migrasi 0041: langganan yang "habis 20 Agustus"
   * harus bisa dipakai sepanjang tanggal 20. Tengah malam membuatnya mati
   * saat toko baru buka.
   */
  update public.organizations
     set status = 'active',
         plan_id = v_inv.plan_id,
         subscription_ends_at = (v_akhir + time '23:59:59') at time zone v_tz
   where id = v_org.id;

  update public.subscription_invoices
     set paid_at = now(),
         period_start = v_mulai,
         period_end = v_akhir
   where id = v_inv.id;

  -- Jenis peristiwa untuk riwayat. Dibandingkan dengan paket LAMA, karena
  -- barisnya yang dibaca pemilik toko sebagai "dari apa ke apa".
  v_aksi := case
    when v_org.plan_id is null or v_org.status <> 'active' then 'subscribe'
    when v_org.plan_id = v_inv.plan_id then 'renew'
    when coalesce(v_plan.price_monthly, 0) > coalesce(v_lama.price_monthly, 0) then 'upgrade'
    else 'downgrade'
  end;

  insert into public.subscription_events (
    organization_id, plan_id, from_plan_id, action, amount,
    period_start, period_end, note, created_by
  ) values (
    v_org.id, v_inv.plan_id,
    case when v_org.plan_id = v_inv.plan_id then null else v_org.plan_id end,
    v_aksi, v_inv.amount, v_mulai, v_akhir,
    'Pembayaran ' || p_order_id || ' lewat ' ||
      coalesce(nullif(p_payload ->> 'payment_type', ''), 'Midtrans'),
    v_inv.created_by
  );

  return jsonb_build_object(
    'ok', true, 'status', 'paid', 'order_id', p_order_id,
    'period_start', v_mulai, 'period_end', v_akhir,
    'organization_id', v_org.id
  );
end
$$;

-- Hanya `service_role`. Lihat alasannya di kepala fungsi.
revoke execute on function public.apply_subscription_payment(text, jsonb)
  from public, anon, authenticated;

comment on function public.apply_subscription_payment is
  'SATU tempat yang boleh mengaktifkan langganan dari pembayaran. Idempoten per '
  'order_id. Dicabut dari authenticated — hanya dipanggil service_role dari '
  'route handler pemberitahuan Midtrans dan jalur penyelarasan.';

-- ============================================================================
-- Catatan tentang trigger penjaga kolom komersial (migrasi 0036 & 0041).
--
-- `apply_subscription_payment` menulis `status`, `plan_id`, dan
-- `subscription_ends_at` — ketiganya kolom yang dikunci
-- `tg_guard_org_commercial`. Yang meloloskannya adalah cabang pertama penjaga
-- itu: `auth.uid() is null`, keadaan yang berlaku saat fungsi dipanggil dengan
-- service_role tanpa sesi user.
--
-- Jadi triggernya SENGAJA tidak diubah, dan jangan diubah. Menambahkan
-- pengecualian bernama untuk fungsi ini berarti membuka celah kedua pada
-- penjagaan yang sudah bekerja, dan celah yang dibuat untuk satu pemanggil
-- akan dipakai pemanggil berikutnya yang tidak seteliti ini.
--
-- Konsekuensinya harus ditulis terang: route handler pemberitahuan WAJIB
-- memakai service_role, dan `SUPABASE_SERVICE_ROLE_KEY` karena itu kembali
-- diperlukan di env produksi Vercel. Sebelum ini kuncinya memang tidak dipakai
-- kode mana pun dan sempat dicatat "boleh dihapus" — sekarang tidak lagi.
-- ============================================================================
