'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icons'

/**
 * Ajakan memasang TokoKu ke layar utama perangkat.
 *
 * Chrome memang punya tombol instalnya sendiri, tapi letaknya di pojok bilah
 * alamat sebagai ikon kecil tanpa tulisan — pemilik warung tidak akan pernah
 * menemukannya, dan di Chrome Android ia bahkan bersembunyi di dalam menu tiga
 * titik. Padahal terpasangnya aplikasi bukan soal kenyamanan di sini: layar
 * kasir yang dibuka dari layar utama berjalan tanpa bilah alamat, tidak bisa
 * tertutup tab lain, dan tidak hilang saat orang menekan tombol Home.
 *
 * Muncul HANYA kalau perangkatnya memang bisa memasang. Tombol "Pasang" yang
 * tetap terlihat lalu tidak melakukan apa-apa adalah cacat yang sudah pernah
 * terjadi di project ini (lonceng notifikasi di wireframe), dan akibatnya sama:
 * orang menekannya berulang kali lalu menyimpulkan aplikasinya rusak.
 */

/**
 * `beforeinstallprompt` belum ada di lib DOM TypeScript — ia belum jadi
 * standar dan hanya ada di browser berbasis Chromium.
 */
type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Event-nya ditangkap skrip kecil di `<head>` (lihat `app/layout.tsx`) dan
 * dititipkan di sini, karena ia bisa menyala jauh sebelum React hidrasi.
 */
declare global {
  interface Window {
    __tokokuPasang?: PromptEvent | null
  }
}

const DITUTUP = 'tokoku_pasang_ditutup'

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [tutup, setTutup] = useState(true)

  useEffect(() => {
    // Sudah terpasang: jangan pernah tampil. Di Android/desktop tandanya mode
    // tampilan `standalone`, di iOS ia properti non-standar milik Safari.
    const terpasang =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (terpasang) return

    // Sengaja dibungkus try/catch: di mode penyamaran sebagian browser
    // MELEMPAR saat localStorage disentuh, bukan mengembalikan null. Tanpa ini
    // seluruh AppShell ikut gagal dirender karena sebuah spanduk ajakan.
    try {
      if (localStorage.getItem(DITUTUP)) return
    } catch {
      // Tidak bisa dibaca — anggap belum pernah ditutup.
    }

    setTutup(false)

    // Sudah keburu menyala sebelum komponen ini ada? Ambil titipannya.
    if (window.__tokokuPasang) setPrompt(window.__tokokuPasang)

    const onSiap = () => setPrompt(window.__tokokuPasang ?? null)
    const onSelesai = () => {
      setPrompt(null)
      setTutup(true)
    }

    // Dua pendengar untuk satu kabar, dan keduanya perlu: yang bernama
    // `tokoku:` datang dari skrip di head (kunjungan kedua dan seterusnya,
    // saat eventnya menyala sebelum hidrasi), yang asli menangkap kunjungan
    // PERTAMA — di sana service worker baru didaftarkan setelah hidrasi, jadi
    // Chrome baru menyalakan eventnya sesudah komponen ini hidup.
    window.addEventListener('tokoku:pasang-siap', onSiap)
    window.addEventListener('tokoku:pasang-selesai', onSelesai)
    window.addEventListener('appinstalled', onSelesai)

    // iOS tidak punya `beforeinstallprompt` sama sekali dan tidak akan pernah
    // punya — Apple tidak mengizinkan pemasangan lewat tombol. Satu-satunya
    // jalan adalah menu Bagikan, jadi yang bisa diberikan cuma petunjuknya.
    // Dibatasi Safari: di dalam Chrome atau WhatsApp iOS menu itu tidak ada,
    // dan petunjuk yang mengarah ke tombol yang tidak ada lebih membingungkan
    // daripada diam.
    const ua = navigator.userAgent
    const iphone = /iPad|iPhone|iPod/.test(ua)
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|FBAN|FBAV|Instagram|Line/.test(ua)
    if (iphone && safari) setIos(true)

    return () => {
      window.removeEventListener('tokoku:pasang-siap', onSiap)
      window.removeEventListener('tokoku:pasang-selesai', onSelesai)
      window.removeEventListener('appinstalled', onSelesai)
    }
  }, [])

  if (tutup || (!prompt && !ios)) return null

  const tutupSelamanya = () => {
    setTutup(true)
    try {
      localStorage.setItem(DITUTUP, '1')
    } catch {
      // Tidak bisa disimpan — spanduknya muncul lagi lain kali. Tidak apa-apa.
    }
  }

  const pasang = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    // Event `beforeinstallprompt` hanya boleh dipakai SEKALI. Dibuang apa pun
    // jawabannya — titipan di window ikut dikosongkan, kalau tidak spanduknya
    // muncul lagi di halaman berikutnya membawa event yang sudah hangus dan
    // tombol Pasang-nya diam saja saat ditekan. Kalau ditolak, Chrome akan
    // mengirimkannya lagi lain hari.
    window.__tokokuPasang = null
    setPrompt(null)
    if (outcome === 'accepted') setTutup(true)
  }

  return (
    <div className="pwa-bar" role="status">
      <span className="pwa-ikon" aria-hidden>
        <Icon name="store" size={16} />
      </span>

      <div className="pwa-teks">
        <strong>Pasang TokoKu di perangkat ini.</strong>{' '}
        {ios ? (
          <>
            Tekan tombol Bagikan di bawah layar, lalu pilih &quot;Tambah ke Layar Utama&quot;.
            Setelah itu TokoKu bisa dibuka seperti aplikasi biasa.
          </>
        ) : (
          <>
            Ikonnya masuk ke layar utama dan terbuka tanpa bilah alamat, seperti aplikasi biasa.
            Layar kasir tetap bisa dipakai walau internet mati.
          </>
        )}
      </div>

      <div className="pwa-aksi">
        {prompt && (
          <button type="button" className="btn btn-sm btn-dark" onClick={pasang}>
            Pasang
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={tutupSelamanya}
          aria-label="Tutup ajakan pasang aplikasi"
        >
          Nanti saja
        </button>
      </div>
    </div>
  )
}
