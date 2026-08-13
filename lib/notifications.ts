import 'server-only'

import type { Route } from 'next'
import type { SessionContext } from './auth'
import { subscriptionState } from './subscription'
import { createClient } from './supabase/server'

export type Notice = {
  id: string
  /** Menentukan warna dan urutannya. */
  tone: 'danger' | 'warn' | 'info'
  title: string
  body: string
  href: Route
}

/**
 * Isi lonceng di topbar.
 *
 * Sampai hari ini tombol loncengnya BENAR-BENAR MATI: `<button>` tanpa
 * `onClick`, tanpa panel, tanpa apa pun. Ia ada di wireframe dan ikut terbawa
 * ke kode, lalu tidak pernah disambungkan. Untuk aplikasi yang dijual, tombol
 * yang tidak melakukan apa-apa lebih buruk daripada tidak ada tombol: orang
 * menekannya berulang kali dan menyimpulkan aplikasinya rusak.
 *
 * **Yang masuk ke sini hanya hal yang BISA DITINDAKLANJUTI HARI INI**, dan
 * setiap butir punya tujuan yang jelas. Notifikasi yang tidak menuntut apa pun
 * (penjualan hari ini sekian, ada pelanggan baru) akan menumpuk sampai orang
 * berhenti membukanya — dan begitu itu terjadi, peringatan sungguhan ikut
 * tenggelam.
 *
 * **Disaring izin modul.** Kasir tidak diberi tahu soal nota jatuh tempo: dia
 * tidak bisa membukanya, tidak bisa membayarnya, dan tidak bisa berbuat apa pun
 * selain cemas. Aturannya sama dengan navigasi — izin modul yang menentukan
 * apa yang terlihat.
 */
export async function getNotifications(session: SessionContext): Promise<Notice[]> {
  if (!session.org || session.role === 'platform_admin') return []

  const out: Notice[] = []
  const orgId = session.org.id
  const perms = session.permissions

  // ---------- langganan ----------
  // Selalu ditampilkan tanpa memandang izin: kalau langganan berakhir, kasir
  // pun berhenti bisa menerima uang, jadi dia berhak tahu sebelum antreannya
  // mengular. Tujuannya tetap halaman langganan, yang butuh izin settings —
  // tapi tahu lebih awal sudah cukup untuk memberi tahu pemiliknya.
  const sub = subscriptionState(session.org)
  if (sub.kind === 'lapsed') {
    out.push({
      id: 'sub-lapsed',
      tone: 'danger',
      title: 'Langganan tidak aktif',
      body:
        sub.reason === 'trial'
          ? 'Masa coba gratis sudah berakhir. Penjualan baru tidak bisa dicatat.'
          : sub.reason === 'paid'
            ? 'Masa langganan sudah berakhir. Penjualan baru tidak bisa dicatat.'
            : 'Langganan toko ini sedang ditangguhkan. Penjualan baru tidak bisa dicatat.',
      href: '/pengaturan/langganan' as Route,
    })
  } else if (sub.kind === 'ending') {
    out.push({
      id: 'sub-ending',
      tone: 'warn',
      title: `${sub.reason === 'trial' ? 'Masa coba' : 'Langganan'} tinggal ${sub.daysLeft} hari`,
      body: 'Perpanjang sebelum habis supaya kasir tidak berhenti mendadak.',
      href: '/pengaturan/langganan' as Route,
    })
  }

  const supabase = await createClient()

  /**
   * Dijalankan bersamaan, dan yang tidak berizin dilewati sebagai `null`.
   *
   * Bukan sekadar kerapian: lonceng ini ikut dirender di SETIAP halaman lewat
   * AppShell, jadi tiap query di sini dibayar pada setiap perpindahan halaman.
   * Semuanya `head: true` — yang dibutuhkan cuma jumlahnya, bukan isinya.
   */
  const [stok, tempo, tolak] = await Promise.all([
    perms.products && session.outletId
      ? supabase
          .from('v_stock_alert')
          .select('product_id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('outlet_id', session.outletId)
      : null,
    perms.products
      ? supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('payment', 'credit')
          .is('paid_at', null)
          .lte('due_date', new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA'))
      : null,
    perms.settings
      ? supabase
          .from('sync_rejections')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('resolved_at', null)
          .neq('reason_code', 'warning')
      : null,
  ])

  /**
   * Penolakan sinkronisasi ditaruh PALING ATAS setelah langganan, dan diberi
   * warna merah walau jumlahnya satu.
   *
   * Tiap penolakan adalah penjualan yang sudah terjadi di warung tapi tidak
   * pernah sampai ke pembukuan — uang yang hilang tanpa jejak. Stok menipis
   * bisa menunggu besok; ini tidak.
   */
  if (tolak?.count) {
    out.push({
      id: 'sync-rejected',
      tone: 'danger',
      title: `${tolak.count} transaksi gagal masuk`,
      body: 'Penjualan yang ditolak server belum tercatat di pembukuan. Perlu diperiksa.',
      href: '/pengaturan/sinkronisasi' as Route,
    })
  }

  if (tempo?.count) {
    out.push({
      id: 'purchase-due',
      tone: 'warn',
      title: `${tempo.count} nota jatuh tempo minggu ini`,
      body: 'Tagihan pemasok yang perlu disiapkan uangnya.',
      href: '/pembelian' as Route,
    })
  }

  if (stok?.count) {
    out.push({
      id: 'low-stock',
      tone: 'info',
      title: `${stok.count} barang menipis`,
      body: 'Stoknya sudah di bawah ambang yang Anda tetapkan.',
      href: '/produk' as Route,
    })
  }

  return out
}
