'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/format'

export type SortDir = 'asc' | 'desc'

/**
 * Pengurutan tabel yang dipakai bersama semua tabel di aplikasi.
 *
 * Ditulis satu kali, bukan disalin ke tiap tabel. Aturan yang disalin akan
 * bergeser: satu tabel memperlakukan nilai kosong sebagai nol, tabel lain
 * membuangnya ke bawah, dan pemilik toko yang mengurutkan stok di dua halaman
 * berbeda melihat urutan yang tidak sama untuk data yang sama.
 */
export function useTableSort<T>(rows: T[], awal?: { key: keyof T; dir?: SortDir }) {
  const [key, setKey] = useState<keyof T | null>(awal?.key ?? null)
  const [dir, setDir] = useState<SortDir>(awal?.dir ?? 'asc')

  const sorted = useMemo(() => {
    if (!key) return rows
    const arah = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = a[key]
      const y = b[key]

      /**
       * Nilai kosong SELALU di bawah, apa pun arah pengurutannya.
       *
       * Dibalik ikut arah, mengurutkan "terakhir belanja" dari yang terbaru
       * membuat seluruh pelanggan yang BELUM pernah belanja menumpuk di paling
       * atas — persis kebalikan dari yang dicari orang saat menekan kolom itu.
       */
      const xKosong = x === null || x === undefined || x === ''
      const yKosong = y === null || y === undefined || y === ''
      if (xKosong && yKosong) return 0
      if (xKosong) return 1
      if (yKosong) return -1

      if (typeof x === 'number' && typeof y === 'number') return (x - y) * arah
      if (typeof x === 'boolean' && typeof y === 'boolean') {
        return (Number(x) - Number(y)) * arah
      }
      // Tanggal ISO ikut jalur teks: bentuknya sudah urut secara leksikal.
      return String(x).localeCompare(String(y), 'id-ID', { numeric: true }) * arah
    })
  }, [rows, key, dir])

  /** Klik pertama menurutkan naik, klik kedua membalik, klik ketiga melepas. */
  function toggle(k: keyof T) {
    if (key !== k) {
      setKey(k)
      setDir('asc')
    } else if (dir === 'asc') {
      setDir('desc')
    } else {
      setKey(null)
    }
  }

  return { sorted, sortKey: key, sortDir: dir, toggle }
}

/**
 * Kepala kolom yang bisa diklik.
 *
 * Panah hanya muncul di kolom yang SEDANG dipakai mengurutkan. Menampilkan
 * panah pudar di semua kolom membuat kepala tabel penuh tanda yang tidak
 * berarti apa-apa, dan kolom yang benar-benar aktif jadi tidak menonjol.
 */
export function SortTh<T>({
  label,
  sortKey,
  state,
  align = 'left',
}: {
  label: string
  sortKey: keyof T
  state: { sortKey: keyof T | null; sortDir: SortDir; toggle: (k: keyof T) => void }
  align?: 'left' | 'right'
}) {
  const aktif = state.sortKey === sortKey
  return (
    <th style={{ textAlign: align }}>
      <button
        type="button"
        className={cn('sort-th', aktif && 'is-active')}
        onClick={() => state.toggle(sortKey)}
        aria-label={`Urutkan menurut ${label}`}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {aktif ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  )
}
