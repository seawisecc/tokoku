import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuotaBars, type Quota } from '@/components/domain/QuotaBars'
import { SubscriptionCheckout, type CheckoutPlan } from '@/components/domain/SubscriptionCheckout'
import { WhatsAppButton } from '@/components/domain/WhatsAppButton'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { cn, rupiah, tanggal } from '@/lib/format'
import { midtransConfigured, midtransMode } from '@/lib/midtrans'
import { createClient } from '@/lib/supabase/server'
import { subscriptionState } from '@/lib/subscription'
import { syncPendingInvoice } from '@/lib/subscription-sync'

export const metadata: Metadata = { title: 'Langganan | TokoKu' }
export const dynamic = 'force-dynamic'

/** Kalimat manusia untuk tiap jenis peristiwa langganan. */
const AKSI: Record<string, string> = {
  subscribe: 'Mulai berlangganan',
  upgrade: 'Naik paket',
  downgrade: 'Turun paket',
  renew: 'Perpanjangan',
  cancel: 'Langganan dihentikan',
  reactivate: 'Diaktifkan kembali',
}

const STATUS: Record<string, { label: string; badge: string }> = {
  active: { label: 'Aktif', badge: 'badge-active' },
  trial: { label: 'Masa coba gratis', badge: 'badge-trial' },
  suspended: { label: 'Ditangguhkan', badge: 'badge-low' },
  inactive: { label: 'Nonaktif', badge: 'badge-inactive' },
}

/** Keadaan tagihan, ditulis untuk pemilik warung bukan untuk programmer. */
const TAGIHAN: Record<string, { label: string; kelas: string }> = {
  pending: { label: 'Menunggu pembayaran', kelas: 'badge-trial' },
  paid: { label: 'Lunas', kelas: 'badge-active' },
  failed: { label: 'Gagal', kelas: 'badge-low' },
  expired: { label: 'Kedaluwarsa', kelas: 'badge-inactive' },
  cancelled: { label: 'Dibatalkan', kelas: 'badge-inactive' },
  refunded: { label: 'Dikembalikan', kelas: 'badge-inactive' },
}

/** Selisih HARI KALENDER — orang menghitung tanggal, bukan durasi jam. */
function sisaHari(iso: string): number {
  const akhir = new Date(new Date(iso).toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  const kini = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  return Math.round((akhir - kini) / 864e5)
}

export default async function LanggananPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await requirePermission('settings')
  const supabase = await createClient()
  const orgId = session.org!.id
  const { status: hasilBayar } = await searchParams

  /**
   * Penyelarasan tagihan yang masih menunggu, SEBELUM halaman dirender.
   *
   * Dibaca lewat klien ber-RLS dulu, jadi nomor pesanan yang diselaraskan pasti
   * milik toko ini. Baru setelah itu `syncPendingInvoice` bertanya ke Midtrans.
   * Urutan ini yang membuat jalur service-role di dalamnya tetap sempit.
   *
   * Dikerjakan di sini, bukan di klien, karena hasilnya harus sudah tercermin
   * pada render pertama: orang yang baru kembali dari halaman pembayaran
   * membuka halaman ini untuk melihat "sudah aktif atau belum", dan halaman
   * yang menjawab "belum" lalu berubah sendiri beberapa detik kemudian
   * mengajari orang untuk tidak mempercayai layarnya.
   */
  if (midtransConfigured()) {
    const { data: menunggu } = await supabase
      .from('subscription_invoices')
      .select('order_id')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (menunggu?.order_id) await syncPendingInvoice(menunggu.order_id)
  }

  const [{ data: org }, { data: quota }, { data: events }, { data: invoices }, { data: plans }] =
    await Promise.all([
      supabase
        .from('organizations')
        .select(
          'name, status, trial_ends_at, subscription_ends_at, plan_id, plans:plan_id(name, code, price_monthly)',
        )
        .eq('id', orgId)
        .maybeSingle(),
      // `v_client_quota` menyaring sendiri berdasarkan keanggotaan pemanggil
      // (lihat migrasi 0020), jadi pemilik toko boleh membacanya tanpa tambahan
      // apa pun — dan angkanya PERSIS sama dengan yang dilihat Super Admin.
      supabase.from('v_client_quota').select('*').eq('organization_id', orgId).maybeSingle(),
      supabase
        .from('subscription_events')
        .select('id, action, amount, created_at, plan:plan_id(name), from_plan:from_plan_id(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('subscription_invoices')
        .select(
          'id, order_id, status, amount, months, payment_type, created_at, paid_at, expires_at, period_end, plans:plan_id(name)',
        )
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('plans')
        .select('id, name, code, price_monthly')
        .eq('is_active', true)
        .gt('price_monthly', 0)
        .order('price_monthly'),
    ])

  const plan = org?.plans as unknown as {
    name: string
    code: string
    price_monthly: number | null
  } | null

  const status = STATUS[org?.status ?? 'trial'] ?? STATUS.trial
  const state = subscriptionState(session.org)

  /**
   * Tanggal berakhirnya masa aktif — trial MAUPUN berbayar.
   *
   * Statusnya yang menentukan kolom mana yang berlaku, persis seperti
   * `org_lapsed_at()` dan `lib/subscription.ts`.
   */
  const aktifSampai =
    org?.status === 'trial'
      ? (org.trial_ends_at ?? null)
      : org?.status === 'active'
        ? (org.subscription_ends_at ?? null)
        : null
  const berbayar = org?.status === 'active'
  const sisa = aktifSampai ? sisaHari(aktifSampai) : null

  const kuota: Quota | null = quota
    ? {
        maxOutlets: quota.max_outlets,
        maxUsers: quota.max_users,
        maxProducts: quota.max_products,
        maxDevices: quota.max_devices,
        usedOutlets: quota.used_outlets ?? 0,
        usedUsers: quota.used_users ?? 0,
        usedProducts: quota.used_products ?? 0,
        usedDevices: quota.used_devices ?? 0,
      }
    : null

  const daftarPaket: CheckoutPlan[] = (plans ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    priceMonthly: Number(p.price_monthly ?? 0),
  }))

  /**
   * Membayar adalah keputusan pemilik, bukan siapa pun yang memegang izin
   * `settings`. Gerbangnya harus sama persis dengan `can_manage()` di dalam
   * `create_subscription_invoice` — kalau berbeda, tombolnya terlihat lalu
   * ditolak, dan penolakan yang datang setelah ditekan terbaca seperti tombol
   * rusak.
   */
  const bolehBayar = session.role === 'owner' || session.role === 'admin'

  const menunggu = (invoices ?? []).find(
    (i) => i.status === 'pending' && (!i.expires_at || new Date(i.expires_at) > new Date()),
  )

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Langganan"
        subtitle="Paket, masa aktif, pembayaran, dan pemakaian kuota toko ini."
      />

      {/* ── Kabar dari halaman pembayaran ─────────────────────────────────
          Yang ditampilkan mengikuti STATUS TERSIMPAN, bukan alamat halaman.
          Alamat bisa diketik tangan, dan pembayaran yang belum diteruskan
          Midtrans tidak boleh terbaca sebagai berhasil hanya karena pengguna
          mendarat di alamat yang benar. */}
      {hasilBayar && (
        <div
          className={cn(
            'empty-note',
            berbayar && hasilBayar === 'berhasil' ? 'is-ok' : hasilBayar === 'gagal' ? '' : 'is-warn',
          )}
          style={{ marginBottom: 18 }}
        >
          <Icon
            name={berbayar && hasilBayar === 'berhasil' ? 'check' : 'alert'}
            size={16}
            style={{ marginTop: 1 }}
          />
          <div style={{ flex: 1 }}>
            {hasilBayar === 'berhasil' && berbayar ? (
              <>
                Pembayaran diterima. Langganan sudah aktif
                {aktifSampai ? <> sampai <b>{tanggal(aktifSampai)}</b></> : null}. Bukti
                pembayarannya dikirim ke email yang Anda pakai saat membayar.
              </>
            ) : hasilBayar === 'berhasil' ? (
              <>
                Pembayaran sedang diproses. Untuk virtual account, aktivasi terjadi begitu
                pembayaran diteruskan bank, dan Anda tidak perlu menunggu di halaman ini.
              </>
            ) : hasilBayar === 'gagal' ? (
              <>
                Pembayaran tidak jadi diproses. Tidak ada uang yang terpotong. Anda bisa
                mencoba lagi dengan metode lain.
              </>
            ) : (
              <>
                Pembayaran belum selesai. Tagihannya masih terbuka dan bisa dilanjutkan dari
                halaman ini.
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Paket aktif ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="sub-top">
          <div>
            <div className="sub-plan-label">Paket aktif</div>
            <div className="sub-plan-name">{plan?.name ?? 'Belum berpaket'}</div>
            <div className="sub-plan-price">
              {plan?.price_monthly
                ? `${rupiah(plan.price_monthly)} / bulan`
                : 'Belum ada tagihan untuk toko ini.'}
            </div>
          </div>
          <span className={cn('badge', status.badge)}>{status.label}</span>
        </div>

        {/* Sisa masa aktif disebut dengan angka DAN tanggal. Angkanya yang
            menempel di kepala ("tinggal 5 hari"), tanggalnya yang dipakai
            merencanakan pembayaran. */}
        {sisa !== null && (
          <div
            className={cn(
              'empty-note',
              state.kind === 'lapsed' ? '' : state.kind === 'ending' ? 'is-warn' : 'is-ok',
            )}
            style={{ marginTop: 16 }}
          >
            <Icon
              name={state.kind === 'ok' ? 'check' : 'alert'}
              size={16}
              style={{ marginTop: 1 }}
            />
            <div style={{ flex: 1 }}>
              {sisa > 0 ? (
                <>
                  {berbayar ? 'Langganan' : 'Masa coba gratis'} aktif{' '}
                  <b>
                    {sisa} hari lagi, sampai {tanggal(aktifSampai!)}
                  </b>
                  . {berbayar ? 'Perpanjang' : 'Berlangganan'} sebelum tanggal itu supaya kasir
                  tidak berhenti mencatat penjualan.
                </>
              ) : sisa === 0 ? (
                <>
                  {berbayar ? 'Langganan' : 'Masa coba gratis'} berakhir <b>hari ini</b>.
                  Bayar hari ini juga supaya kasir tidak berhenti besok pagi.
                </>
              ) : (
                <>
                  {berbayar ? 'Langganan' : 'Masa coba gratis'} sudah berakhir{' '}
                  <b>{tanggal(aktifSampai!)}</b>. Kasir tidak bisa mencatat penjualan baru dan
                  data baru tidak bisa ditambah. Semua data lama tetap aman dan bisa dilihat.
                </>
              )}
            </div>
          </div>
        )}

        {/* Berbayar tapi tanpa tanggal akhir. Bukan kesalahan — NULL memang
            berarti tanpa batas (lihat migrasi 0041). */}
        {berbayar && !aktifSampai && (
          <div className="empty-note is-ok" style={{ marginTop: 16 }}>
            <Icon name="check" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Langganan aktif tanpa batas waktu. Belum ada tanggal perpanjangan yang ditetapkan
              admin TokoKu untuk toko ini.
            </div>
          </div>
        )}

        {(org?.status === 'suspended' || org?.status === 'inactive') && (
          <div className="empty-note" style={{ marginTop: 16 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Langganan toko ini sedang tidak aktif. Kasir tidak bisa mencatat penjualan baru.
              Semua data lama tetap aman. Hubungi admin TokoKu untuk mengaktifkan kembali.
            </div>
          </div>
        )}
      </div>

      {/* ── Checkout ──────────────────────────────────────────────────────── */}
      <SubscriptionCheckout
        plans={daftarPaket}
        currentPlanId={org?.plan_id ?? null}
        canPay={bolehBayar}
        pendingOrderId={menunggu?.order_id ?? null}
        enabled={midtransConfigured()}
        sandbox={midtransMode() === 'sandbox'}
      />

      {/* ── Kuota ─────────────────────────────────────────────────────────── */}
      <div className="section-title">Pemakaian Kuota</div>
      <div className="card">
        {kuota ? (
          <>
            <QuotaBars quota={kuota} structuralAsInfo />
            <div className="field-hint" style={{ marginTop: 14 }}>
              Batas ini ditegakkan di database, jadi berlaku juga untuk perangkat kasir yang
              mendaftar sendiri saat sinkronisasi. Naik paket kalau salah satunya sudah penuh.
            </div>
          </>
        ) : (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Toko ini belum terikat paket, jadi belum ada batas apa pun.
          </div>
        )}
      </div>

      {/* ── Riwayat tagihan ───────────────────────────────────────────────── */}
      {(invoices ?? []).length > 0 && (
        <>
          <div className="section-title">Riwayat Tagihan</div>
          <div className="table-card">
            <div className="table-scroll">
              {/* `.inv-table` berhenti jadi tabel di bawah 640px dan menumpuk.
                  Sebagai tabel, empat kolomnya butuh 464px pada wadah 341px dan
                  yang terdorong keluar layar justru NOMINALNYA — angka yang
                  dicari orang saat mencocokkan tagihan dengan mutasi rekening.
                  Pola yang sama dengan .trx-table dan .shift-table. */}
              <table className="inv-table">
                <tbody>
                  {(invoices ?? []).map((i) => {
                    const p = i.plans as unknown as { name: string } | null
                    const t = TAGIHAN[i.status] ?? TAGIHAN.pending
                    return (
                      <tr key={i.id}>
                        <td className="iv-code">
                          <div className="cell-name inv-code">{i.order_id}</div>
                          <div className="cell-sub">
                            {p?.name ?? '-'} · {i.months} bulan
                            {i.payment_type ? ` · ${i.payment_type}` : ''}
                          </div>
                        </td>
                        <td className="iv-status" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span className={cn('badge', t.kelas)}>{t.label}</span>
                        </td>
                        <td
                          className="iv-amount"
                          style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {rupiah(Number(i.amount ?? 0))}
                        </td>
                        <td
                          className="iv-date"
                          style={{
                            textAlign: 'right',
                            color: 'var(--color-ink-faint)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tanggal(i.paid_at ?? i.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Hubungi admin ─────────────────────────────────────────────────── */}
      <div className="section-title">Butuh Bantuan?</div>
      <div className="card">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
          Tanya tagihan, minta bukti bayar, atau ada pembayaran yang belum masuk: hubungi admin
          TokoKu. Pesan WhatsApp-nya sudah terisi nama toko dan paket Anda, jadi tidak perlu
          menjelaskan dari awal.
        </p>
        <WhatsAppButton
          storeName={org?.name ?? session.org!.name}
          planName={plan?.name ?? null}
          status={status.label}
        />
      </div>

      {/* ── Riwayat langganan ─────────────────────────────────────────────── */}
      <div className="section-title">Riwayat Langganan</div>
      <div className="table-card">
        {(events ?? []).length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada perubahan langganan yang tercatat.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <tbody>
                {(events ?? []).map((e) => {
                  const ke = (e.plan as unknown as { name: string } | null)?.name
                  const dari = (e.from_plan as unknown as { name: string } | null)?.name
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="cell-name">{AKSI[e.action] ?? e.action}</div>
                        <div className="cell-sub">
                          {dari && ke ? `${dari} → ${ke}` : (ke ?? '-')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {Number(e.amount ?? 0) > 0 ? rupiah(Number(e.amount)) : '-'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--color-ink-faint)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tanggal(e.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
