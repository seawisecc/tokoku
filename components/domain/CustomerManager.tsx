'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCustomer, saveCustomer } from '@/app/(toko)/pelanggan/actions'
import { IconAction } from '@/components/data/IconAction'
import { SortTh, useTableSort } from '@/components/data/SortableTable'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah, tanggal } from '@/lib/format'
import { hpLokal } from '@/lib/phone'

export type CustomerRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  note: string | null
  totalSpent: number
  visitCount: number
  lastVisitAt: string | null
  points: number
}

type Draft = { name: string; phone: string; email: string; address: string; note: string }

const kosong = (): Draft => ({ name: '', phone: '', email: '', address: '', note: '' })

/**
 * Segmentasi pelanggan.
 *
 * Sengaja tiga saja, dan batasnya bulat. Pemilik warung tidak menghitung
 * "recency-frequency"; yang dia tanyakan cuma "siapa yang sering datang" dan
 * "siapa yang sudah lama tidak kelihatan". Segmen yang lebih halus dari ini
 * tidak mengubah tindakan apa pun yang bisa dia ambil.
 */
function segmen(c: CustomerRow): { kunci: string; label: string; kelas: string } | null {
  if (!c.lastVisitAt) return { kunci: 'baru', label: 'Belum pernah belanja', kelas: 'badge-ok' }
  const hari = Math.floor((Date.now() - new Date(c.lastVisitAt).getTime()) / 864e5)
  if (hari > 60) return { kunci: 'lama', label: `Lama tak datang · ${hari} hari`, kelas: 'badge-low' }
  if (c.visitCount >= 5) return { kunci: 'sering', label: 'Sering datang', kelas: 'badge-active' }
  return null
}

export function CustomerManager({
  customers,
  loyaltyOn,
  full,
}: {
  customers: CustomerRow[]
  /** Poin hanya ditampilkan kalau toko memang menyalakannya. */
  loyaltyOn: boolean
  /** Paket `full`: poin, riwayat belanja, segmentasi. */
  full: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [segmenFilter, setSegmenFilter] = useState<'semua' | 'baru' | 'sering' | 'lama'>('semua')
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [err, setErr] = useState<{ error: string; field?: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const tersaring = useMemo(() => {
    const q = query.trim().toLowerCase()
    const dasar = !q
      ? customers
      : customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? '').includes(q.replace(/^0/, '62')) ||
            (c.phone ?? '').includes(q),
        )
    if (segmenFilter === 'semua') return dasar
    return dasar.filter((c) => {
      const seg = segmen(c)?.kunci ?? 'biasa'
      return seg === segmenFilter
    })
  }, [customers, query, segmenFilter])

  const { sorted: visible, ...urut } = useTableSort(tersaring, { key: 'lastVisitAt', dir: 'desc' })

  function simpan() {
    if (!editing) return
    const fd = new FormData()
    Object.entries(editing.draft).forEach(([k, v]) => fd.set(k, v))
    startTransition(async () => {
      const res = await saveCustomer(editing.id, fd)
      if (!res.ok) {
        setErr({ error: res.error, field: res.field })
        return
      }
      setErr(null)
      setEditing(null)
      setNotice({ tone: 'ok', text: res.message ?? 'Tersimpan.' })
      router.refresh()
    })
  }

  function hapus(id: string) {
    startTransition(async () => {
      const res = await deleteCustomer(id)
      setNotice(
        res.ok
          ? { tone: 'ok', text: res.message ?? 'Pelanggan dihapus.' }
          : { tone: 'bad', text: res.error },
      )
      if (res.ok) router.refresh()
    })
  }

  return (
    <>
      <div className="scan-row">
        <div className="tf-input" style={{ flex: 1, minWidth: 0 }}>
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau nomor HP…"
            aria-label="Cari pelanggan"
          />
        </div>
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => {
            setErr(null)
            setEditing({ id: null, draft: kosong() })
          }}
        >
          <Icon name="plus" size={15} />
          Tambah
        </button>
      </div>

      {full && (
        <div className="filter-row">
          {(
            [
              ['semua', 'Semua'],
              ['sering', 'Sering datang'],
              ['lama', 'Lama tak datang'],
              ['baru', 'Belum pernah belanja'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={cn('btn', 'btn-sm', segmenFilter === k ? 'btn-dark' : 'btn-ghost')}
              onClick={() => setSegmenFilter(k)}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div
          className="empty-note"
          style={
            notice.tone === 'ok'
              ? {
                  marginBottom: 14,
                  background: 'var(--color-success-soft)',
                  color: 'var(--color-success)',
                }
              : { marginBottom: 14 }
          }
          role="alert"
        >
          <Icon name={notice.tone === 'ok' ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{notice.text}</div>
        </div>
      )}

      <div className="table-card">
        {visible.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            {customers.length === 0
              ? 'Belum ada pelanggan. Tambahkan di sini, atau catat langsung saat menerima pembayaran di Kasir.'
              : 'Tidak ada pelanggan yang cocok.'}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <SortTh<CustomerRow> label="Pelanggan" sortKey="name" state={urut} />
                  <SortTh<CustomerRow> label="Terakhir belanja" sortKey="lastVisitAt" state={urut} />
                  {full && (
                    <SortTh<CustomerRow> label="Total belanja" sortKey="totalSpent" state={urut} align="right" />
                  )}
                  {full && (
                    <SortTh<CustomerRow> label="Kunjungan" sortKey="visitCount" state={urut} align="right" />
                  )}
                  {full && loyaltyOn && (
                    <SortTh<CustomerRow> label="Poin" sortKey="points" state={urut} align="right" />
                  )}
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const seg = full ? segmen(c) : null
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="cell-name">{c.name}</div>
                        <div className="cell-sub mono">{hpLokal(c.phone)}</div>
                        {seg && (
                          <span
                            className={cn('badge', seg.kelas)}
                            style={{ marginTop: 5, display: 'inline-flex' }}
                          >
                            {seg.label}
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-ink-faint)' }}>
                        {c.lastVisitAt ? tanggal(c.lastVisitAt) : '-'}
                      </td>
                      {full && (
                        <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {rupiah(c.totalSpent)}
                        </td>
                      )}
                      {full && <td style={{ textAlign: 'right' }}>{c.visitCount}</td>}
                      {full && loyaltyOn && (
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.points}</td>
                      )}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <IconAction
                          icon="edit"
                          label="Ubah pelanggan"
                          disabled={pending}
                          onClick={() => {
                            setErr(null)
                            setEditing({
                              id: c.id,
                              draft: {
                                name: c.name,
                                phone: hpLokal(c.phone) === '-' ? '' : hpLokal(c.phone),
                                email: c.email ?? '',
                                address: c.address ?? '',
                                note: c.note ?? '',
                              },
                            })
                          }}
                        />
                        <IconAction
                          icon="trash"
                          label="Hapus pelanggan"
                          danger
                          confirm
                          disabled={pending}
                          onClick={() => hapus(c.id)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Drawer
          open
          key={editing.id ?? 'baru'}
          title={editing.id ? 'Ubah Pelanggan' : 'Pelanggan Baru'}
          subtitle={editing.id ? editing.draft.name : 'Data pembeli langganan'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-dark"
                disabled={pending}
                onClick={simpan}
              >
                {pending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          }
        >
          {(
            [
              ['name', 'Nama', 'Mis. Bu Sri'],
              ['phone', 'Nomor HP', 'Ketik nomornya di sini'],
              ['email', 'Email', 'Opsional'],
              ['address', 'Alamat', 'Opsional'],
              ['note', 'Catatan', 'Opsional, mis. langganan beras'],
            ] as const
          ).map(([key, label, ph]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                value={editing.draft[key]}
                onChange={(e) =>
                  setEditing((s) => (s ? { ...s, draft: { ...s.draft, [key]: e.target.value } } : s))
                }
                placeholder={ph}
                aria-invalid={err?.field === key}
              />
              {key === 'phone' && (
                <div className="field-hint">
                  Dipakai untuk mengirim nota lewat WhatsApp, dan untuk mengenali pelanggan yang
                  sama di kasir.
                </div>
              )}
              {err?.field === key && <div className="field-error">{err.error}</div>}
            </div>
          ))}

          {err && !err.field && (
            <div className="empty-note" role="alert">
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>{err.error}</div>
            </div>
          )}
        </Drawer>
      )}
    </>
  )
}
