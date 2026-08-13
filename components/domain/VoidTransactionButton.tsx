'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { voidTransaction } from '@/app/(toko)/transaksi/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'

export function VoidTransactionButton({ trxId, code }: { trxId: string; code: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await voidTransaction(trxId, reason)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>
        <Icon name="x" size={15} /> Batalkan Transaksi
      </button>

      {open && (
        <Drawer
          open
          title="Batalkan Transaksi"
          subtitle={code}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
              >
                Jangan jadi
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--color-coral)', color: '#fff' }}
                disabled={pending}
                onClick={submit}
              >
                {pending ? 'Membatalkan…' : 'Ya, batalkan'}
              </button>
            </>
          }
        >
          <div className="empty-note" style={{ marginBottom: 16 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Stok akan dikembalikan dan transaksi ditandai batal. Barisnya tetap tersimpan.
              Laporan hari itu akan menunjukkan pembatalan ini, bukan menyembunyikannya.
            </div>
          </div>

          <div className="field">
            <label htmlFor="reason">Alasan pembatalan</label>
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. salah input, pembeli batal, barang rusak"
              aria-invalid={Boolean(error)}
            />
            {error && <div className="field-error">{error}</div>}
            <div className="field-hint">Tercatat permanen dan bisa dilihat pemilik kapan saja.</div>
          </div>
        </Drawer>
      )}
    </>
  )
}
