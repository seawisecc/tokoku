import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Penyusun berkas untuk EKSPOR LAPORAN.
 *
 * Dipisah dari `lib/exports.ts`, dan pemisahannya disengaja. Berkas di sana
 * adalah BACKUP: seluruh isi tabel, kolomnya sengaja sama persis dengan yang
 * diterima layar impor supaya bisa dimasukkan kembali. Yang di sini adalah
 * laporan: sudah diringkas, sudah dihitung, dan mengikuti persis periode serta
 * cakupan outlet yang sedang dilihat di layar.
 *
 * Aturan yang paling menentukan di modul ini: **angkanya harus sama persis
 * dengan yang tampil di layar saat tombolnya ditekan.** Berkas yang berbeda
 * dari layarnya lebih buruk daripada tidak ada berkas sama sekali, karena yang
 * membandingkan keduanya tidak punya cara tahu mana yang benar. Karena itu
 * saringannya dioper apa adanya dari halaman (`dari`, `sampai`, `outletId`),
 * bukan dihitung ulang di sini dengan aturan sendiri.
 */
export type JenisLaporan = 'penjualan' | 'shift' | 'pengeluaran' | 'laba-rugi' | 'arus-kas'

export const JENIS_LAPORAN: JenisLaporan[] = [
  'penjualan',
  'shift',
  'pengeluaran',
  'laba-rugi',
  'arus-kas',
]

/**
 * Jenis tiap kolom, ditentukan penyusunnya.
 *
 * Dipakai HANYA oleh lembar cetak, bukan CSV. CSV harus tetap berisi angka
 * mentah dan tanggal ISO: begitu ribuannya diberi titik, Excel berlokal
 * Inggris membaca "3.681.940" sebagai teks (atau lebih buruk, sebagai 3,68) dan
 * seluruh gunanya sebagai berkas yang bisa dihitung ulang hilang. Yang butuh
 * enak dibaca manusia adalah lembar cetaknya.
 *
 * Ditentukan di sini, bukan ditebak dari nama kolom di halaman cetak: nama
 * kolom bisa diubah kapan saja, dan tebakan yang meleset akan menampilkan
 * rupiah tanpa pemisah ribuan tanpa satu pun error.
 */
export type KolomJenis = 'teks' | 'angka' | 'uang' | 'tanggal' | 'waktu'

export type DataLaporan = {
  /** Judul yang tercetak di lembar PDF. */
  judul: string
  filename: string
  headers: string[]
  kolom: KolomJenis[]
  rows: unknown[][]
}

export const JUDUL_LAPORAN: Record<JenisLaporan, string> = {
  penjualan: 'Penjualan Harian',
  shift: 'Laporan Shift',
  pengeluaran: 'Pengeluaran',
  'laba-rugi': 'Laba Rugi',
  'arus-kas': 'Arus Kas',
}

export type LingkupLaporan = {
  /** YYYY-MM-DD, inklusif. */
  dari: string
  /** YYYY-MM-DD, inklusif. */
  sampai: string
  /** null berarti seluruh outlet. */
  outletId: string | null
}

const SUMBER: Record<string, string> = {
  penjualan: 'Penjualan',
  pembelian: 'Pembelian',
  pengeluaran: 'Pengeluaran',
}

const METODE: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  other: 'Lainnya',
}

/**
 * Pengeluaran ber-`outlet_id` NULL berlaku untuk SELURUH toko, jadi ia harus
 * ikut terbawa di cakupan cabang mana pun. Aturan yang sama dengan halaman
 * Laporan Keuangan; kalau berbeda, berkasnya tidak akan pernah cocok dengan
 * layarnya.
 */
const seluruhToko = (outletId: string) => `outlet_id.eq.${outletId},outlet_id.is.null`

/**
 * SATU penyusun untuk CSV maupun PDF.
 *
 * Yang dikembalikan bukan teks CSV melainkan judul, nama berkas, kepala kolom,
 * dan barisnya. Rute unduh menjadikannya CSV; halaman cetak menjadikannya tabel
 * HTML lalu dicetak jadi PDF. Kalau keduanya menyusun angkanya sendiri-sendiri,
 * suatu hari PDF dan CSV untuk periode yang sama akan berbeda isinya, dan yang
 * membandingkan keduanya tidak punya cara tahu mana yang benar. Alasan yang
 * sama dengan `org_usage` dan `v_consignment_summary`.
 */
export async function buildReportData(
  supabase: SupabaseClient,
  orgId: string,
  orgName: string,
  jenis: JenisLaporan,
  lingkup: LingkupLaporan,
): Promise<DataLaporan> {
  const { dari, sampai, outletId } = lingkup
  const slug = orgName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'toko'
  const nama = (bagian: string) => `${bagian}-${slug}-${dari}-sd-${sampai}.csv`

  if (jenis === 'penjualan') {
    let q = supabase
      .from('v_daily_sales')
      .select('sales_date, transaction_count, revenue, cogs, gross_profit, avg_ticket, cash_revenue, offline_count, outlet_id')
      .eq('organization_id', orgId)
      .gte('sales_date', dari)
      .lte('sales_date', sampai)
      .order('sales_date')
    if (outletId) q = q.eq('outlet_id', outletId)
    const { data, error } = await q
    if (error) throw error

    return {
      judul: JUDUL_LAPORAN.penjualan,
      filename: nama('penjualan-harian'),
      headers: ['Tanggal', 'Transaksi', 'Omzet', 'HPP', 'Laba kotor', 'Rata-rata nota', 'Omzet tunai', 'Transaksi offline'],
      kolom: ['tanggal', 'angka', 'uang', 'uang', 'uang', 'uang', 'uang', 'angka'],
      rows: (data ?? []).map((r) => [
          r.sales_date,
          r.transaction_count,
          r.revenue,
          r.cogs,
          r.gross_profit,
          r.avg_ticket,
          r.cash_revenue ?? 0,
          r.offline_count,
      ]),
    }
  }

  if (jenis === 'shift') {
    let q = supabase
      .from('v_shift_summary')
      .select('*')
      .eq('organization_id', orgId)
      .gte('opened_at', `${dari}T00:00:00Z`)
      .lte('opened_at', `${sampai}T23:59:59Z`)
      .order('opened_at', { ascending: false })
    if (outletId) q = q.eq('outlet_id', outletId)
    const { data, error } = await q
    if (error) throw error

    return {
      judul: JUDUL_LAPORAN.shift,
      filename: nama('laporan-shift'),
      headers: ['Dibuka', 'Ditutup', 'Kasir', 'Perangkat', 'Status', 'Transaksi', 'Penjualan', 'Penjualan tunai', 'Penjualan non-tunai', 'Kas awal', 'Kas seharusnya', 'Kas fisik', 'Selisih', 'Transaksi batal'],
      kolom: ['waktu', 'waktu', 'teks', 'teks', 'teks', 'angka', 'uang', 'uang', 'uang', 'uang', 'uang', 'uang', 'uang', 'angka'],
      rows: (data ?? []).map((r) => [
          r.opened_at,
          r.closed_at,
          r.cashier_name,
          r.device_code,
          r.status,
          r.trx_count,
          r.sales_total,
          r.cash_total,
          r.noncash_total,
          r.opening_cash,
          r.expected_cash,
          r.closing_cash,
          // Shift yang masih berjalan sengaja dikosongkan, bukan ditulis 0:
          // kasnya memang belum dihitung, dan 0 akan terbaca sebagai "cocok".
          r.status === 'open' ? '' : r.cash_difference,
          r.void_count,
      ]),
    }
  }

  if (jenis === 'pengeluaran') {
    let q = supabase
      .from('expenses')
      /**
       * KEDUA embed menyebut nama CONSTRAINT, bukan nama kolom.
       *
       * Migrasi 0044 mengganti FK satu kolom dengan FK komposit untuk kategori
       * MAUPUN outlet, dan petunjuk berupa satu nama kolom tidak pernah cocok
       * dengan FK dua kolom: PostgREST menjawab "Could not find a relationship"
       * dan SELURUH query gagal. Sudah menggigit sekali di halaman Pengeluaran;
       * `outlets:outlet_id(name)` di sini hampir mengulanginya persis.
       */
      .select('expense_date, amount, payment_method, payee, note, outlet_id, expense_categories!expenses_category_same_org(name), outlets!expenses_outlet_same_org(name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('expense_date', dari)
      .lte('expense_date', sampai)
      .order('expense_date')
    if (outletId) q = q.or(seluruhToko(outletId))
    const { data, error } = await q
    if (error) throw error

    return {
      judul: JUDUL_LAPORAN.pengeluaran,
      filename: nama('pengeluaran'),
      headers: ['Tanggal', 'Kategori', 'Jumlah', 'Dibayar pakai', 'Dibayar ke', 'Catatan', 'Cabang'],
      kolom: ['tanggal', 'teks', 'uang', 'teks', 'teks', 'teks', 'teks'],
      rows: (data ?? []).map((r) => [
          r.expense_date,
          (r.expense_categories as unknown as { name: string } | null)?.name ?? '',
          r.amount,
          METODE[r.payment_method as string] ?? r.payment_method,
          r.payee ?? '',
          r.note ?? '',
          // Kosong berarti seluruh toko, dan itu ditulis apa adanya supaya yang
          // membuka berkasnya di Excel tidak mengira cabangnya lupa diisi.
          (r.outlets as unknown as { name: string } | null)?.name ?? 'Seluruh toko',
      ]),
    }
  }

  if (jenis === 'laba-rugi') {
    let plQ = supabase
      .from('v_profit_loss')
      .select('period_month, transaction_count, net_revenue, tax_collected, cogs, gross_profit, outlet_id')
      .eq('organization_id', orgId)
      .gte('period_month', dari)
      .lte('period_month', sampai)
      .order('period_month')
    let expQ = supabase
      .from('v_expense_monthly')
      .select('period_month, category_name, amount, outlet_id')
      .eq('organization_id', orgId)
      .gte('period_month', dari)
      .lte('period_month', sampai)
    if (outletId) {
      plQ = plQ.eq('outlet_id', outletId)
      expQ = expQ.or(seluruhToko(outletId))
    }
    const [pl, exp] = await Promise.all([plQ, expQ])
    if (pl.error) throw pl.error
    if (exp.error) throw exp.error

    const omzet = (pl.data ?? []).reduce((n, r) => n + Number(r.net_revenue), 0)
    const pajak = (pl.data ?? []).reduce((n, r) => n + Number(r.tax_collected), 0)
    const hpp = (pl.data ?? []).reduce((n, r) => n + Number(r.cogs), 0)
    const perKategori = [...(exp.data ?? [])
      .reduce((m, r) => {
        const k = r.category_name ?? 'Tanpa kategori'
        m.set(k, (m.get(k) ?? 0) + Number(r.amount))
        return m
      }, new Map<string, number>())
      .entries()]
      .sort((a, b) => b[1] - a[1])
    const biaya = perKategori.reduce((n, [, v]) => n + v, 0)

    /**
     * Bentuknya baris-baris "pos + nilai", bukan satu baris lebar.
     *
     * Laba rugi memang dibaca menurun dan saling dikurangkan; ditulis melebar,
     * yang menerimanya harus menyusun ulang sendiri sebelum bisa dipakai. Ini
     * juga bentuk yang paling gampang ditempel ke kertas kerja akuntan.
     */
    const baris: unknown[][] = [
      ['Omzet', omzet],
      ['Harga pokok barang terjual', -hpp],
      ['Laba kotor', omzet - hpp],
      ...perKategori.map(([k, v]) => [k, -v]),
      ['Total pengeluaran', -biaya],
      ['Laba bersih', omzet - hpp - biaya],
    ]
    if (pajak > 0) {
      baris.push(['Pajak terpungut (bukan omzet, untuk disetor)', pajak])
    }

    return {
      judul: JUDUL_LAPORAN['laba-rugi'],
      filename: nama('laba-rugi'),
      headers: ['Pos', 'Nilai'],
      kolom: ['teks', 'uang'],
      rows: baris,
    }
  }

  // arus kas
  let q = supabase
    .from('v_cash_flow')
    .select('flow_date, source, direction, is_cash, amount, entry_count, outlet_id')
    .eq('organization_id', orgId)
    .gte('flow_date', dari)
    .lte('flow_date', sampai)
    .order('flow_date')
  if (outletId) q = q.or(seluruhToko(outletId))
  const { data, error } = await q
  if (error) throw error

  return {
    judul: JUDUL_LAPORAN['arus-kas'],
    filename: nama('arus-kas'),
    headers: ['Tanggal', 'Sumber', 'Arah', 'Tunai', 'Jumlah', 'Banyak catatan'],
    kolom: ['tanggal', 'teks', 'teks', 'teks', 'uang', 'angka'],
    rows: (data ?? []).map((r) => [
        r.flow_date,
        SUMBER[r.source as string] ?? r.source,
        r.direction === 'masuk' ? 'Masuk' : 'Keluar',
        r.is_cash ? 'Ya' : 'Tidak',
        r.amount,
      r.entry_count,
    ]),
  }
}
