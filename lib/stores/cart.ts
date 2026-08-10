'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartLine = {
  productId: string
  name: string
  sku: string | null
  price: number
  qty: number
  stock: number
}

type CartState = {
  /** Toko pemilik keranjang ini. null = belum pernah diikat. */
  orgId: string | null
  /** Outlet tempat keranjang ini disusun. */
  outletId: string | null
  lines: CartLine[]
  /** Ikat keranjang ke satu toko + outlet; kosongkan kalau ternyata milik yang lain. */
  bindOrg: (orgId: string, outletId: string | null) => void
  add: (line: Omit<CartLine, 'qty'>) => void
  changeQty: (productId: string, delta: number) => void
  remove: (productId: string) => void
  clear: () => void
  total: () => number
  count: () => number
}

/**
 * Keranjang belanja.
 *
 * Di-persist ke localStorage: kasir sering menutup tab tanpa sengaja atau
 * kehabisan baterai di tengah transaksi. Kehilangan keranjang berisi 15 item
 * berarti mengulang scan semuanya di depan antrean pembeli.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      orgId: null,
      outletId: null,
      lines: [],

      /**
       * localStorage melekat pada BROWSER, bukan pada toko. Tanpa ikatan ini,
       * keranjang berisi produk toko sebelumnya ikut terbawa ke toko berikutnya
       * — kasir melihat total Rp 351.000 yang bukan miliknya, dan produknya
       * akan ditolak server saat dibayar.
       *
       * OUTLET ikut diikat. Keranjang yang disusun di cabang A lalu dibayar
       * setelah berpindah ke cabang B akan mengurangi stok cabang B atas barang
       * yang diambil dari rak cabang A — server menerimanya tanpa keluhan, dan
       * selisihnya baru ketahuan saat opname.
       */
      bindOrg: (orgId, outletId) =>
        set((s) =>
          s.orgId === orgId && s.outletId === outletId
            ? s
            : { orgId, outletId, lines: [] },
        ),

      add: (line) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === line.productId)
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.productId === line.productId ? { ...l, qty: l.qty + 1 } : l,
              ),
            }
          }
          return { lines: [...s.lines, { ...line, qty: 1 }] }
        }),

      changeQty: (productId, delta) =>
        set((s) => ({
          lines: s.lines
            .map((l) => (l.productId === productId ? { ...l, qty: l.qty + delta } : l))
            .filter((l) => l.qty > 0),
        })),

      remove: (productId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),

      clear: () => set({ lines: [] }),

      total: () => get().lines.reduce((sum, l) => sum + l.price * l.qty, 0),
      count: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
    }),
    {
      name: 'tokoku-cart',
      /**
       * Pemulihan dari localStorage ditunda sampai PosClient memanggilnya
       * (lihat useEffect di sana).
       *
       * Tanpa ini, render pertama di browser sudah membawa isi keranjang
       * sementara HTML dari server masih kosong. React menganggap keduanya
       * berbeda, membuang seluruh pohon halaman kasir, lalu membangunnya
       * ulang — kedipan penuh di layar tepat ketika kasir sedang melayani
       * antrean, dan tumpukan error di konsol yang menutupi masalah asli.
       */
      skipHydration: true,
    },
  ),
)
