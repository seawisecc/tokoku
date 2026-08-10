'use client'

import { useEffect } from 'react'

/**
 * Daftarkan service worker.
 *
 * Hanya dipasang di area toko, bukan di seluruh aplikasi: yang butuh bertahan
 * tanpa internet adalah layar kasir, dan mempersempit cakupannya berarti lebih
 * sedikit halaman yang bisa tersaji basi.
 *
 * Dilewati di mode pengembangan — service worker menyimpan bundel lama dan
 * membuat hot reload membingungkan.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registrasi gagal (mis. mode penyamaran) — POS tetap jalan selama
      // tab tidak ditutup. Tidak perlu mengganggu kasir dengan pesan error.
    })
  }, [])
  return null
}
