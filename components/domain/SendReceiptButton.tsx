'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'
import { normalkanHp, hpLokal } from '@/lib/phone'
import { bagikanGambar, buatGambarStruk, type ReceiptImageData } from '@/lib/receipt-image'

/**
 * Kirim nota ke pembeli.
 *
 * Dua jalur, dan keduanya ada karena masing-masing menutup kelemahan yang lain:
 *
 * - **Gambar** dibagikan lewat share sheet perangkat. Itu SATU-SATUNYA cara
 *   melampirkan berkas ke WhatsApp dari web — tautan `wa.me` cuma bisa mengisi
 *   teks, tidak bisa melampirkan apa pun. Tidak perlu nomor: kasir memilih
 *   kontaknya di dalam WhatsApp. Di chat, gambar tampil LANGSUNG tanpa perlu
 *   ditekan, beda dengan PDF yang muncul sebagai lampiran.
 * - **Teks** perlu nomor, tapi jalan di perangkat mana pun termasuk desktop,
 *   dan isinya bisa dicari pembeli di riwayat chat berbulan-bulan kemudian.
 */
export function SendReceiptButton({
  data,
  customerName,
  customerPhone,
}: {
  data: ReceiptImageData
  customerName?: string | null
  customerPhone?: string | null
}) {
  const [buka, setBuka] = useState(false)
  const [nomor, setNomor] = useState(hpLokal(customerPhone) === '-' ? '' : hpLokal(customerPhone))
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const METODE: Record<string, string> = {
    cash: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer',
    card: 'Kartu',
  }

  function pesanTeks(): string {
    const waktu = new Date(data.at).toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const baris = [
      `*${data.storeName}*`,
      `Nota ${data.code}`,
      waktu,
      '',
      ...data.items.map((i) => `${i.name} x${i.qty}  ${rupiah(i.lineTotal)}`),
      '',
      `*Total: ${rupiah(data.total)}*`,
      `Bayar: ${METODE[data.paymentMethod] ?? data.paymentMethod}`,
    ]
    baris.push('', data.footer?.trim() || 'Terima kasih sudah berbelanja.')
    return baris.join('\n')
  }

  function kirimTeks() {
    const hp = normalkanHp(nomor)
    if (!hp) {
      setError('Nomor HP tidak dikenali. Contoh: 081234567890.')
      return
    }
    setError(null)
    window.open(
      `https://wa.me/${hp}?text=${encodeURIComponent(pesanTeks())}`,
      '_blank',
      'noopener',
    )
    setBuka(false)
  }

  function bagikanStruk() {
    setError(null)
    setInfo(null)
    startTransition(async () => {
      try {
        const blob = await buatGambarStruk(data)
        const hasil = await bagikanGambar(blob, `nota-${data.code}.png`)
        if (hasil === 'downloaded') {
          setInfo(
            'Perangkat ini tidak punya menu bagikan, jadi gambarnya diunduh. Lampirkan sendiri di WhatsApp.',
          )
        } else if (hasil === 'shared') {
          setBuka(false)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gambar struk gagal dibuat.')
      }
    })
  }

  if (!buka) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setBuka(true)}>
        <Icon name="whatsapp" size={16} />
        Kirim Nota ke Pembeli
      </button>
    )
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <button
        type="button"
        className="btn btn-dark"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={pending}
        onClick={bagikanStruk}
      >
        <Icon name="whatsapp" size={16} />
        {pending ? 'Menyiapkan…' : 'Bagikan Struk (gambar)'}
      </button>
      <div className="field-hint" style={{ marginTop: 6 }}>
        Membuka menu bagikan HP. Pilih WhatsApp, lalu pilih pembelinya. Gambarnya tampil langsung
        di chat tanpa perlu dibuka.
      </div>

      <div className="kirim-pisah">atau kirim sebagai teks</div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="waNomor">Nomor WhatsApp pembeli</label>
        <input
          id="waNomor"
          value={nomor}
          onChange={(e) => setNomor(e.target.value)}
          placeholder="081234567890"
          inputMode="tel"
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
          Tutup
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={kirimTeks}
        >
          Kirim teks
        </button>
      </div>

      {info && (
        <div className="empty-note" style={{ marginTop: 10 }} role="status">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{info}</div>
        </div>
      )}
    </div>
  )
}
