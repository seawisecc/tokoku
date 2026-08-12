'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'
import { normalkanHp, hpLokal } from '@/lib/phone'

export type ReceiptLine = { name: string; qty: number; lineTotal: number }

/**
 * Kirim nota lewat WhatsApp.
 *
 * Kenapa WhatsApp dan bukan email: pembeli warung tidak punya email, tapi
 * hampir semuanya punya WhatsApp. Dan kenapa TEKS dan bukan gambar struk:
 * teks bisa dicari di riwayat chat pembeli berbulan-bulan kemudian, sementara
 * tangkapan layar tenggelam di galeri.
 *
 * Nomornya tidak pernah dikirim dari server. Yang dibuka adalah aplikasi
 * WhatsApp milik kasir sendiri dengan pesan yang sudah terisi, jadi tidak ada
 * biaya, tidak perlu penyedia, dan tidak ada nomor pembeli yang keluar dari
 * perangkat ke pihak ketiga.
 */
export function SendReceiptButton({
  storeName,
  code,
  at,
  items,
  total,
  paymentMethod,
  customerName,
  customerPhone,
  footer,
}: {
  storeName: string
  code: string
  at: string
  items: ReceiptLine[]
  total: number
  paymentMethod: string
  customerName?: string | null
  customerPhone?: string | null
  footer?: string | null
}) {
  const [buka, setBuka] = useState(false)
  const [nomor, setNomor] = useState(hpLokal(customerPhone) === '-' ? '' : hpLokal(customerPhone))
  const [error, setError] = useState<string | null>(null)

  const waktu = new Date(at).toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const METODE: Record<string, string> = {
    cash: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer',
    card: 'Kartu',
  }

  function pesan(): string {
    const baris = [
      `*${storeName}*`,
      `Nota ${code}`,
      waktu,
      '',
      ...items.map((i) => `${i.name} x${i.qty}  ${rupiah(i.lineTotal)}`),
      '',
      `*Total: ${rupiah(total)}*`,
      `Bayar: ${METODE[paymentMethod] ?? paymentMethod}`,
    ]
    // Penutupnya cuma satu. Toko yang sudah menulis baris bawah struknya
    // sendiri tidak perlu ditambahi ucapan bawaan di bawahnya lagi.
    baris.push('', footer?.trim() || 'Terima kasih sudah berbelanja.')
    return baris.join('\n')
  }

  function kirim() {
    const hp = normalkanHp(nomor)
    if (!hp) {
      setError('Nomor HP tidak dikenali. Contoh: 081234567890.')
      return
    }
    setError(null)
    window.open(`https://wa.me/${hp}?text=${encodeURIComponent(pesan())}`, '_blank', 'noopener')
    setBuka(false)
  }

  if (!buka) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setBuka(true)}>
        <Icon name="whatsapp" size={16} />
        Kirim Nota via WhatsApp
      </button>
    )
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="waNomor">Nomor WhatsApp pembeli</label>
        <input
          id="waNomor"
          value={nomor}
          onChange={(e) => setNomor(e.target.value)}
          placeholder="081234567890"
          inputMode="tel"
          autoFocus
        />
        {customerName && (
          <div className="field-hint">Terisi dari pelanggan {customerName}. Bisa diganti.</div>
        )}
        {error && <div className="field-error">{error}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ flex: 1 }}
          onClick={() => setBuka(false)}
        >
          Batal
        </button>
        <button
          type="button"
          className="btn btn-dark btn-sm"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={kirim}
        >
          Buka WhatsApp
        </button>
      </div>
      <div className="field-hint" style={{ marginTop: 8 }}>
        Terbuka di aplikasi WhatsApp Anda sendiri dengan notanya sudah tertulis. Tidak ada pesan
        yang dikirim otomatis.
      </div>
    </div>
  )
}
