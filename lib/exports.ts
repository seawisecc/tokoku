import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toCsv } from './csv'

export type JenisEkspor = 'produk' | 'pelanggan' | 'transaksi' | 'item'

export const JENIS_EKSPOR: JenisEkspor[] = ['produk', 'pelanggan', 'transaksi', 'item']

/**
 * Susun satu berkas backup.
 *
 * SATU tempat, dipakai jalur toko maupun jalur Super Admin. Alasannya sama
 * dengan `org_usage` dan `v_consignment_summary`: dua penyusun berarti suatu
 * hari backup yang diunduh pemilik toko berisi kolom yang berbeda dari backup
 * yang dikirimkan admin untuk menolongnya — dan yang membandingkan keduanya
 * akan menyimpulkan salah satunya kehilangan data.
 *
 * Kliennya diterima sebagai argumen, bukan dibuat di dalam. Yang memanggil dari
 * sisi toko memakai sesi user (RLS penuh); yang memanggil dari Super Admin juga
 * memakai sesi user — bedanya `is_platform_admin()` yang meloloskannya di
 * policy baca. TIDAK ADA jalur yang memakai service role di sini, dan jangan
 * pernah menambahkannya: fungsi ini menerima `orgId` dari luar.
 */
export async function buildExport(
  supabase: SupabaseClient,
  orgId: string,
  orgName: string,
  jenis: JenisEkspor,
  hari: number,
): Promise<{ filename: string; csv: string }> {
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = orgName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'toko'

  if (jenis === 'produk') {
    /**
     * Kolomnya PERSIS sama dengan yang diterima layar impor.
     *
     * Backup yang tidak bisa dimasukkan kembali bukan backup. Bentuk yang sama
     * juga membuat "ekspor, rapikan di Excel, impor lagi" jadi cara yang wajar
     * untuk mengubah harga 200 barang sekaligus — sesuatu yang selama ini
     * hanya bisa dikerjakan satu per satu lewat drawer.
     */
    const { data } = await supabase
      .from('products')
      .select(
        'sku, name, barcode, unit, sell_price, cost_price, min_stock, track_stock, is_active, categories:category_id(name)',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('sku')

    return {
      filename: `produk-${slug}-${stamp}.csv`,
      csv: toCsv(
        [
          'sku',
          'nama',
          'kategori',
          'satuan',
          'barcode',
          'harga jual',
          'harga beli',
          'stok minimal',
          'lacak stok',
          'aktif',
        ],
        (data ?? []).map((p) => [
          p.sku,
          p.name,
          (p.categories as unknown as { name: string } | null)?.name ?? '',
          p.unit,
          p.barcode ?? '',
          p.sell_price,
          p.cost_price,
          p.min_stock,
          p.track_stock ? 'ya' : 'tidak',
          p.is_active ? 'ya' : 'tidak',
        ]),
      ),
    }
  }

  if (jenis === 'pelanggan') {
    const { data } = await supabase
      .from('customers')
      .select('name, phone, email, address, total_spent, visit_count, points, last_visit_at, note')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('name')

    return {
      filename: `pelanggan-${slug}-${stamp}.csv`,
      csv: toCsv(
        [
          'nama',
          'nomor hp',
          'email',
          'alamat',
          'total belanja',
          'jumlah kunjungan',
          'poin',
          'kunjungan terakhir',
          'catatan',
        ],
        (data ?? []).map((c) => [
          c.name,
          c.phone ?? '',
          c.email ?? '',
          c.address ?? '',
          c.total_spent,
          c.visit_count,
          c.points,
          c.last_visit_at ?? '',
          c.note ?? '',
        ]),
      ),
    }
  }

  const sejak = new Date(Date.now() - hari * 864e5).toISOString()

  if (jenis === 'transaksi') {
    /**
     * Transaksi TIDAK disaring per outlet, beda dengan halaman Transaksi.
     *
     * Ini backup pembukuan, bukan layar kerja: yang dibutuhkan SELURUH
     * penjualan toko. Disaring outlet aktif, pemilik toko dua cabang mengunduh
     * berkas yang tampak lengkap padahal separuh penjualannya hilang, dan tidak
     * ada apa pun di dalam berkas yang memberi tahu. Karena itu nama cabangnya
     * jadi kolom tersendiri. Aturan yang sama dengan Pembelian & Konsinyasi di
     * "Aturan cakupan outlet".
     */
    const { data } = await supabase
      .from('transactions')
      .select(
        'code, client_created_at, status, payment_method, subtotal, discount_total, tax_total, total, cost_total, paid_amount, change_amount, points_earned, points_redeemed, origin, void_reason, outlets:outlet_id(name), profiles:cashier_id(full_name), customers:customer_id(name, phone)',
      )
      .eq('organization_id', orgId)
      .gte('client_created_at', sejak)
      .order('client_created_at', { ascending: false })
      .limit(50_000)

    return {
      filename: `transaksi-${slug}-${stamp}.csv`,
      csv: toCsv(
        [
          'no transaksi',
          'waktu',
          'cabang',
          'status',
          'metode bayar',
          'subtotal',
          'potongan',
          'pajak',
          'total',
          'modal (hpp)',
          'laba kotor',
          'dibayar',
          'kembalian',
          'poin didapat',
          'poin ditukar',
          'kasir',
          'pelanggan',
          'nomor hp',
          'asal',
          'alasan pembatalan',
        ],
        (data ?? []).map((t) => {
          const pelanggan = t.customers as unknown as { name: string; phone: string | null } | null
          return [
            t.code,
            t.client_created_at,
            (t.outlets as unknown as { name: string } | null)?.name ?? '',
            t.status === 'void' ? 'dibatalkan' : 'lunas',
            t.payment_method,
            t.subtotal,
            t.discount_total,
            t.tax_total,
            t.total,
            t.cost_total,
            // Dihitung di sini, bukan diserahkan ke rumus Excel: inilah angka
            // yang benar-benar dicari orang saat membuka backup, dan
            // definisinya harus sama dengan halaman Laporan. Transaksi batal
            // berlaba nol, bukan berlaba negatif.
            t.status === 'void' ? 0 : t.total - t.cost_total,
            t.paid_amount,
            t.change_amount,
            t.points_earned,
            t.points_redeemed,
            (t.profiles as unknown as { full_name: string } | null)?.full_name ?? '',
            pelanggan?.name ?? '',
            pelanggan?.phone ?? '',
            t.origin,
            t.void_reason ?? '',
          ]
        }),
      ),
    }
  }

  // Rincian per barang. Dipisah dari berkas transaksi, bukan digabung: satu
  // nota punya banyak baris, dan menggabungkannya membuat kolom total nota
  // berulang sehingga penjumlahan di spreadsheet jadi berlipat.
  const { data } = await supabase
    .from('transaction_items')
    .select(
      'product_name, sku, unit, quantity, unit_price, unit_cost, discount, line_total, transactions:transaction_id(code, client_created_at, status)',
    )
    .eq('organization_id', orgId)
    .gte('created_at', sejak)
    .order('created_at', { ascending: false })
    .limit(100_000)

  return {
    filename: `item-terjual-${slug}-${stamp}.csv`,
    csv: toCsv(
      [
        'no transaksi',
        'waktu',
        'status',
        'sku',
        'nama barang',
        'satuan',
        'jumlah',
        'harga satuan',
        'modal satuan',
        'potongan',
        'total baris',
      ],
      (data ?? []).map((it) => {
        const t = it.transactions as unknown as {
          code: string
          client_created_at: string
          status: string
        } | null
        return [
          t?.code ?? '',
          t?.client_created_at ?? '',
          t?.status === 'void' ? 'dibatalkan' : 'lunas',
          it.sku ?? '',
          it.product_name,
          it.unit,
          it.quantity,
          it.unit_price,
          it.unit_cost,
          it.discount,
          it.line_total,
        ]
      }),
    ),
  }
}

/** Header unduhan yang sama untuk semua jalur ekspor. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Backup tidak boleh dilayani dari cache: yang diunduh besok harus
      // berisi penjualan hari ini.
      'Cache-Control': 'no-store',
    },
  })
}

/** Baca & jepit parameter URL yang dipakai semua jalur ekspor. */
export function bacaParam(url: URL): { jenis: JenisEkspor; hari: number } {
  const j = url.searchParams.get('jenis') ?? 'produk'
  return {
    jenis: (JENIS_EKSPOR as string[]).includes(j) ? (j as JenisEkspor) : 'produk',
    hari: Math.min(Math.max(Number(url.searchParams.get('hari')) || 90, 1), 3650),
  }
}
