'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { voidTransaction } from '@/app/(toko)/transaksi/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'

/**
 * Tombol aksi di baris transaksi: lihat detail, cetak ulang, batalkan.
 *
 * **Tidak ada tombol hapus, dan itu disengaja.** Transaksi adalah catatan
 * keuangan: nomornya berurut, stoknya sudah terpotong, poin pelanggannya sudah
 * bertambah, dan angkanya sudah masuk laporan hari itu. Menghapus barisnya
 * membuat nomor transaksi bolong tanpa ada yang bisa menjelaskan ke mana
 * perginya, dan itu persis bentuk yang dipakai menutupi uang yang diambil.
 *
 * Yang benar adalah PEMBATALAN: barisnya tetap ada, ditandai batal, stok
 * dikembalikan, poin ditarik lagi, dan alasannya tercatat permanen. Hasil
 * akhirnya sama untuk pemilik toko (angkanya tidak lagi dihitung) tapi jejaknya
 * tidak hilang.
 *
 * Cetak sengaja membawa ke halaman detail dengan `?cetak=1`, bukan mencetak
 * dari daftar. Struk butuh rincian itemnya, dan daftar ini tidak memuatnya.
 * Merakit struk tersembunyi di dalam daftar berarti jalur cetak kedua yang
 * harus ikut diuji tiap kali struknya berubah; halaman detail sudah punya
 * struk yang sama persis dengan yang keluar dari printer.
 */
export function TransactionRowActions({
  id,
  code,
  voided,
  canVoid,
}: {
  id: string
  code: string
  voided: boolean
  canVoid: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await voidTransaction(id, reason)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <>
      <div className="row-actions">
        <Link
          href={`/transaksi/${id}` as Route}
          className="icon-btn"
          title="Lihat detail"
          aria-label={`Lihat detail ${code}`}
        >
          <Icon name="search" size={15} />
        </Link>

        {/* Struk transaksi batal tidak bisa dicetak dari sini. Yang keluar dari
            printer akan membawa penanda "TRANSAKSI DIBATALKAN", tapi tombol
            cetak yang tetap hidup di baris batal mengundang orang mencetaknya
            lalu menyerahkannya ke pembeli. Halaman detailnya tetap bisa
            dicetak, di sana penandanya tidak mungkin terlewat. */}
        {!voided && (
          <Link
            href={`/transaksi/${id}?cetak=1` as Route}
            className="icon-btn"
            title="Cetak struk"
            aria-label={`Cetak struk ${code}`}
          >
            <Icon name="printer" size={15} />
          </Link>
        )}

        {canVoid && !voided && (
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            title="Batalkan transaksi"
            aria-label={`Batalkan transaksi ${code}`}
            onClick={() => setOpen(true)}
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

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
                style={{ flex: 1 }}
                onClick={() => setOpen(false)}
              >
                Jangan jadi
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  background: 'var(--color-coral)',
                  color: '#fff',
                }}
                disabled={pending}
                onClick={submit}
              >
                {pending ? 'Membatalkan…' : 'Ya, batalkan'}
              </button>
            </>
          }
        >
          <div className="empty-note" style={{ marginBottom: 14 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Stok barangnya dikembalikan dan poin pelanggan ditarik lagi. Barisnya tetap ada di
              daftar, ditandai batal, supaya nomor transaksinya tidak terlihat hilang.
            </div>
          </div>
          <div className="field">
            <label htmlFor={`alasan-${id}`}>Alasan pembatalan</label>
            <input
              id={`alasan-${id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. Pembeli batal, barang dikembalikan"
              autoFocus
            />
            <div className="field-hint">Tercatat permanen dan tidak bisa diubah lagi.</div>
            {error && <div className="field-error">{error}</div>}
          </div>
        </Drawer>
      )}
    </>
  )
}
