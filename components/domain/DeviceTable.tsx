'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteDevice } from '@/app/(toko)/pengaturan/actions'
import { IconAction } from '@/components/data/IconAction'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type DeviceRow = {
  id: string
  name: string
  code: string
  appVersion: string | null
  syncLabel: string
  syncTone: 'ok' | 'warn' | 'bad'
  pendingCount: number
  openRejections: number
  offlineTrx7d: number
}

const TONE_BADGE = { ok: 'badge-active', warn: 'badge-trial', bad: 'badge-low' } as const

/**
 * Kenapa perangkat perlu bisa dihapus sama sekali: `max_devices` adalah kuota
 * berbayar, dan perangkat mendaftarkan dirinya sendiri tiap kali layar Kasir
 * dibuka di outlet baru. Tanpa tombol ini angkanya cuma bisa naik, dan toko
 * yang kuotanya penuh tidak bisa mendaftarkan kasir baru walaupun HP lamanya
 * sudah dijual.
 */
export function DeviceTable({ devices }: { devices: DeviceRow[] }) {
  const router = useRouter()
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function hapus(id: string) {
    startTransition(async () => {
      const res = await deleteDevice(id)
      if (!res.ok) {
        setNotice({ tone: 'bad', text: res.error })
        return
      }
      setNotice({ tone: 'ok', text: res.message ?? 'Perangkat dihapus.' })
      router.refresh()
    })
  }

  if (devices.length === 0) {
    return (
      <div className="table-card">
        <div className="placeholder-card" style={{ border: 'none' }}>
          Belum ada perangkat terdaftar. Perangkat mendaftar otomatis saat layar Kasir pertama
          kali dibuka.
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Perangkat</th>
                <th>Sinkron terakhir</th>
                <th>Belum terkirim</th>
                <th>Transaksi offline (7 hari)</th>
                <th>Perlu ditinjau</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                /**
                 * Tombolnya dimatikan DI SINI juga, bukan cuma ditolak server.
                 *
                 * Alasannya sama dengan tombol Bayar yang dikunci sebelum
                 * keranjang disusun: penolakan yang baru muncul setelah
                 * konfirmasi dua langkah membuat orang mengira tombolnya rusak.
                 * Lapis keduanya tetap ada di `deleteDevice`.
                 */
                const tertahan = d.pendingCount > 0 || d.openRejections > 0
                const alasan =
                  d.pendingCount > 0
                    ? `Masih ada ${d.pendingCount} transaksi belum terkirim dari perangkat ini`
                    : d.openRejections > 0
                      ? `Masih ada ${d.openRejections} transaksi yang perlu ditinjau`
                      : 'Hapus perangkat'

                return (
                  <tr key={d.id}>
                    <td>
                      <div className="cell-name">{d.name}</div>
                      <div className="cell-sub mono">
                        {d.code}
                        {d.appVersion ? ` · ${d.appVersion}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className={cn('badge', TONE_BADGE[d.syncTone])}>{d.syncLabel}</span>
                    </td>
                    <td>
                      {d.pendingCount > 0 ? (
                        <span className="badge badge-low">{d.pendingCount}</span>
                      ) : (
                        <span style={{ color: 'var(--color-ink-faint)' }}>-</span>
                      )}
                    </td>
                    <td>{d.offlineTrx7d}</td>
                    <td>
                      {d.openRejections > 0 ? (
                        <span className="badge badge-low">{d.openRejections}</span>
                      ) : (
                        <span style={{ color: 'var(--color-ink-faint)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <IconAction
                        icon="trash"
                        label={tertahan ? alasan : 'Hapus perangkat'}
                        danger
                        confirm={!tertahan}
                        disabled={tertahan || pending}
                        onClick={() => hapus(d.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {notice && (
        <div
          className="empty-note"
          style={
            notice.tone === 'ok'
              ? {
                  marginTop: 14,
                  background: 'var(--color-success-soft)',
                  color: 'var(--color-success)',
                }
              : { marginTop: 14 }
          }
          role="alert"
        >
          <Icon
            name={notice.tone === 'ok' ? 'check' : 'alert'}
            size={16}
            style={{ marginTop: 1 }}
          />
          <div style={{ flex: 1 }}>{notice.text}</div>
        </div>
      )}

      <div className="field-hint" style={{ marginTop: 10 }}>
        Menghapus perangkat mengosongkan jatah kuota paket, dan transaksi lamanya tetap
        tersimpan. Nomor transaksinya sudah memuat kode perangkat. Perangkat yang masih
        menyimpan antrean belum terkirim tidak bisa dihapus.
      </div>
    </>
  )
}
