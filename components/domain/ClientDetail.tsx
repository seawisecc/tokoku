'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  setClientPlan,
  setClientStatus,
  setClientTrialEnd,
  startImpersonation,
} from '@/app/(platform)/admin/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { QuotaBars, quotaLines, isAlerting, type Quota } from '@/components/domain/QuotaBars'
import { rupiah } from '@/lib/format'

export type ClientDetailData = {
  id: string
  name: string
  city: string | null
  status: string
  planId: string | null
  outletCount: number
  userCount: number
  productCount: number
  revenueMtd: number
  quota: Quota | null
  /** yyyy-mm-dd untuk <input type="date">, null kalau tanpa batas. */
  trialEndsAt: string | null
  /** true kalau akses toko ini sedang tertutup (ditangguhkan / trial lewat). */
  lapsed: boolean
}

export type SubscriptionEvent = {
  id: string
  action: string
  fromPlan: string | null
  toPlan: string | null
  amount: number
  at: string
}

const ACTION_LABEL: Record<string, string> = {
  subscribe: 'Mulai berlangganan',
  upgrade: 'Naik paket',
  downgrade: 'Turun paket',
  renew: 'Perpanjang',
  cancel: 'Berhenti',
  reactivate: 'Aktif kembali',
}

const STATUSES = [
  { key: 'trial', label: 'Trial' },
  { key: 'active', label: 'Aktif' },
  { key: 'suspended', label: 'Ditangguhkan' },
  { key: 'inactive', label: 'Nonaktif' },
] as const

export function ClientDetail({
  client,
  plans,
  events,
}: {
  client: ClientDetailData
  plans: { id: string; name: string; code: string; priceMonthly: number }[]
  events: SubscriptionEvent[]
}) {
  const router = useRouter()
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const alerting = client.quota ? quotaLines(client.quota).filter(isAlerting) : []
  // Terkendali state — lihat jebakan reset <form> React 19 di CLAUDE.md.
  const [trialEnd, setTrialEnd] = useState(client.trialEndsAt ?? '')

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const res = await fn()
      setNotice(res.ok ? (res.message ? { tone: 'ok', text: res.message } : null) : { tone: 'bad', text: res.error! })
      if (res.ok) router.refresh()
    })
  }

  return (
    <>
      {notice && (
        <div
          className="empty-note"
          style={
            notice.tone === 'ok'
              ? { marginBottom: 16, background: 'var(--color-success-soft)', color: 'var(--color-success)' }
              : { marginBottom: 16 }
          }
          role="alert"
        >
          <Icon name={notice.tone === 'ok' ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{notice.text}</div>
        </div>
      )}

      {client.lapsed && (
        <div className="empty-note is-ok" style={{ marginBottom: 16 }} role="status">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong>Akses toko ini sedang tertutup.</strong> Kasir tidak bisa membuat transaksi
            baru dan data baru tidak bisa ditambah. Antrean transaksi lama dari perangkat offline
            tetap diterima. Ubah status ke Aktif, atau perpanjang masa trial, untuk membukanya.
          </div>
        </div>
      )}

      <div className="mini-stat-row" style={{ marginBottom: 18 }}>
        <div className="mini-stat"><b>{client.outletCount}</b><span>Outlet</span></div>
        <div className="mini-stat"><b>{client.userCount}</b><span>Pengguna</span></div>
        <div className="mini-stat"><b>{client.productCount}</b><span>Produk</span></div>
        <div className="mini-stat"><b>{rupiah(client.revenueMtd)}</b><span>Omset bulan ini</span></div>
      </div>

      <div className="section-title">
        Kuota Paket
        {alerting.length > 0 && (
          <span className="badge badge-low">{alerting.length} perlu perhatian</span>
        )}
      </div>
      <div className="card">
        {client.quota ? (
          <>
            <QuotaBars quota={client.quota} />
            <p className="field-hint" style={{ marginTop: 14 }}>
              Batas ini ditegakkan di database, jadi berlaku juga untuk perangkat kasir yang
              mendaftar sendiri saat sinkronisasi. Menurunkan paket tidak menghapus data yang
              sudah ada. Klien hanya tidak bisa menambah lagi sampai kembali di bawah batas.
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            Klien ini belum punya paket, jadi belum ada batas apa pun. Pilih paket di bawah.
          </p>
        )}
      </div>

      <div className="section-title">Paket Langganan</div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              style={
                p.id === client.planId
                  ? { background: 'var(--color-forest)', color: 'var(--color-mint)', borderColor: 'var(--color-forest)' }
                  : undefined
              }
              onClick={() => run(() => setClientPlan(client.id, p.id))}
            >
              {p.name} · {rupiah(p.priceMonthly)}
            </button>
          ))}
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Perubahan paket tercatat di riwayat langganan klien ini.
        </p>
      </div>

      <div className="section-title">Status</div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              style={
                s.key === client.status
                  ? { background: 'var(--color-forest)', color: 'var(--color-mint)', borderColor: 'var(--color-forest)' }
                  : undefined
              }
              onClick={() => run(() => setClientStatus(client.id, s.key))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">Masa Trial</div>
      <div className="card">
        <div className="field" style={{ marginBottom: 10, maxWidth: 260 }}>
          <label htmlFor="trialEnd">Trial berakhir</label>
          <input
            id="trialEnd"
            type="date"
            value={trialEnd}
            onChange={(e) => setTrialEnd(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-dark btn-sm"
            type="button"
            disabled={pending}
            onClick={() => run(() => setClientTrialEnd(client.id, trialEnd || null))}
          >
            Simpan Tanggal
          </button>
          {client.trialEndsAt && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={pending}
              onClick={() => {
                setTrialEnd('')
                run(() => setClientTrialEnd(client.id, null))
              }}
            >
              Hapus batas
            </button>
          )}
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Berlaku sampai akhir hari yang dipilih. Setelah lewat, dan selama status masih
          <strong> Trial</strong>, toko tidak bisa membuat transaksi baru atau menambah data.
          Transaksi yang dibuat sebelum tanggal itu tetap bisa tersinkron dari perangkat offline.
          Kosongkan untuk tanpa batas waktu.
        </p>
      </div>

      <div className="section-title">Riwayat Langganan</div>
      <div className="table-card">
        {events.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada perubahan paket yang tercatat.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="cell-name">{ACTION_LABEL[e.action] ?? e.action}</div>
                      <div className="cell-sub">
                        {e.fromPlan ? `${e.fromPlan} → ${e.toPlan ?? '-'}` : (e.toPlan ?? '-')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {e.amount > 0 ? rupiah(e.amount) : '-'}
                    </td>
                    <td style={{ color: 'var(--color-ink-faint)', whiteSpace: 'nowrap' }}>{e.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-title">Dukungan</div>
      <div className="card">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
          Masuk ke tampilan toko ini untuk menelusuri masalah yang dilaporkan klien.
          Mode ini <strong>hanya baca</strong>. Database menolak perubahan apa pun dari
          Super Admin karena Anda bukan anggota toko. Setiap sesi tercatat.
        </p>
        <button className="btn btn-dark" type="button" onClick={() => setAsking(true)}>
          <Icon name="login" size={15} /> Lihat sebagai Klien
        </button>
      </div>

      {asking && (
        <Drawer
          open
          title="Lihat sebagai Klien"
          subtitle={client.name}
          onClose={() => setAsking(false)}
          footer={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => setAsking(false)}>
                Batal
              </button>
              <button
                className="btn btn-dark"
                type="button"
                disabled={pending || reason.trim().length < 4}
                onClick={() => startTransition(() => startImpersonation(client.id, reason))}
              >
                {pending ? 'Membuka…' : 'Buka Toko'}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="reason">Alasan</label>
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. tiket #124, laporan stok tidak cocok"
            />
            <div className="field-hint">
              Tercatat permanen bersama waktu dan nama Anda. Pemilik toko bisa melihatnya.
            </div>
          </div>
        </Drawer>
      )}
    </>
  )
}
