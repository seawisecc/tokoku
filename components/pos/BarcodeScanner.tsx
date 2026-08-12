'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icons'

/**
 * Format yang dipindai.
 *
 * Sengaja dibatasi ke yang benar-benar dipakai barang warung. Tiap format
 * tambahan membuat pendeteksi memeriksa lebih banyak kemungkinan pada tiap
 * frame, dan di HP kelas bawah itu langsung terasa sebagai kamera yang patah-
 * patah. EAN-13 menutup hampir semua barang bermerek di Indonesia; EAN-8 untuk
 * kemasan kecil; UPC untuk barang impor; Code 128 untuk label cetak sendiri.
 */
const FORMAT: ("ean_13" | "ean_8" | "upc_a" | "upc_e" | "code_128" | "code_39")[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']

type Props = {
  onClose: () => void
  /** Kembalikan true kalau kodenya cocok dengan sebuah produk. */
  onScan: (kode: string) => boolean
}

/**
 * Pemindai barcode lewat kamera.
 *
 * `BarcodeDetector` bawaan browser hanya ada di Chrome Android; Safari iOS
 * belum punya sama sekali. Karena kasir di sini memakai iPhone maupun Android,
 * dipakai ponyfill `barcode-detector` yang otomatis memakai versi bawaan kalau
 * tersedia dan jatuh ke WASM kalau tidak. Diimpor DINAMIS supaya WASM-nya tidak
 * ikut terunduh oleh kasir yang tidak pernah membuka pemindai.
 */
export function BarcodeScanner({ onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [siap, setSiap] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let batal = false
    let raf = 0
    /**
     * Kode yang baru saja dibaca ditahan sebentar.
     *
     * Kamera membaca 30 frame per detik dan barcode yang sama terbaca di setiap
     * frame. Tanpa jeda ini, satu kali arahkan langsung menambah puluhan barang
     * yang sama ke keranjang.
     */
    let terakhir = { kode: '', pada: 0 }

    async function mulai() {
      try {
        const { BarcodeDetector } = await import('barcode-detector/ponyfill')
        const detector = new BarcodeDetector({ formats: FORMAT })

        stream = await navigator.mediaDevices.getUserMedia({
          // Kamera belakang. `ideal`, bukan `exact`: laptop hanya punya kamera
          // depan, dan `exact` membuatnya gagal total alih-alih memakai yang ada.
          video: { facingMode: { ideal: 'environment' } },
        })
        if (batal) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        setSiap(true)

        const periksa = async () => {
          if (batal || !videoRef.current) return
          try {
            const hasil = await detector.detect(videoRef.current)
            const kode = hasil[0]?.rawValue?.trim()
            if (kode) {
              const now = Date.now()
              const ulangan = kode === terakhir.kode && now - terakhir.pada < 1500
              if (!ulangan) {
                terakhir = { kode, pada: now }
                // Getar pendek sebagai tanda terbaca. Di warung yang ramai,
                // bunyi tidak terdengar dan mata kasir ada di barangnya.
                navigator.vibrate?.(40)
                if (onScan(kode)) onClose()
              }
            }
          } catch {
            // Satu frame gagal dibaca bukan kegagalan pemindaian. Diam saja
            // dan coba frame berikutnya.
          }
          raf = requestAnimationFrame(periksa)
        }
        raf = requestAnimationFrame(periksa)
      } catch (e) {
        const nama = (e as { name?: string })?.name
        setError(
          nama === 'NotAllowedError'
            ? 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, lalu coba lagi.'
            : nama === 'NotFoundError'
              ? 'Tidak ada kamera yang bisa dipakai di perangkat ini.'
              : 'Kamera gagal dibuka. Pakai alat pemindai atau ketik barcodenya di kotak cari.',
        )
      }
    }

    mulai()
    return () => {
      batal = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onScan, onClose])

  return (
    <div className="scan-overlay" role="dialog" aria-modal="true" aria-label="Pindai barcode">
      <div className="scan-head">
        <span>Arahkan ke barcode</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          Tutup
        </button>
      </div>

      <div className="scan-stage">
        {/* `playsInline` wajib: tanpa itu Safari iOS memutar video kamera
            layar penuh dan menutupi seluruh antarmuka pemindai. */}
        <video ref={videoRef} playsInline muted className="scan-video" />
        {!error && <div className="scan-frame" aria-hidden="true" />}
        {!siap && !error && <div className="scan-status">Membuka kamera…</div>}
        {error && (
          <div className="scan-status is-error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="scan-foot">
        Barang yang cocok langsung masuk keranjang. Pemindai bisa terus diarahkan ke barang
        berikutnya.
      </div>
    </div>
  )
}
