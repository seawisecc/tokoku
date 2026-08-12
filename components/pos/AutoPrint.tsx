'use client'

import { useEffect, useRef } from 'react'

/**
 * Membuka dialog cetak sekali saat halaman dibuka dari tombol Cetak di daftar
 * transaksi (`?cetak=1`).
 *
 * Ada di halaman detail, bukan di daftarnya, karena struk butuh rincian item
 * yang memang tidak diambil daftar. Halaman ini sudah merender struk yang
 * persis sama dengan yang keluar dari printer, jadi tidak ada jalur cetak kedua
 * yang harus ikut diuji tiap kali struknya berubah.
 *
 * Dijaga `useRef`, bukan hanya daftar dependensi: StrictMode memanggil efek dua
 * kali di pengembangan, dan dialog cetak yang muncul dua kali membuat orang
 * mengira strukya tercetak dobel. Aturannya sama dengan
 * `getOrRegisterDevice()`.
 */
export function AutoPrint({ aktif }: { aktif: boolean }) {
  const sudah = useRef(false)

  useEffect(() => {
    if (!aktif || sudah.current) return
    sudah.current = true
    // Satu frame supaya struknya benar-benar sudah tergambar sebelum dialog
    // cetak mengambil alih; logo toko diambil lewat jaringan.
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [aktif])

  return null
}
