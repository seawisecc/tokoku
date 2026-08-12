import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Kemampuan yang dibuka paket langganan.
 *
 * SATU tempat untuk membaca `plans.features`. Sebelumnya aturannya disalin di
 * tiap halaman yang butuh, dan aturan yang disalin akan bergeser: cukup satu
 * halaman lupa memakai default yang benar, klien yang sudah membayar kehilangan
 * fitur tanpa ada yang menyadarinya.
 *
 * ATURAN DEFAULT: kolom yang kosong dianggap kemampuan PENUH. Paket dibuat
 * tangan lewat Super Admin, jadi penanda yang lupa diisi itu wajar — dan
 * memberi kelebihan jauh lebih murah daripada mengunci toko yang sudah bayar
 * lalu menunggu mereka mengeluh.
 */
export type PlanFeatures = {
  /** basic = ringkasan penjualan · full = laba kotor, produk terlaris, metode bayar, 90 hari. */
  reports: 'basic' | 'full'
  /** basic = catat barang masuk saja · full = pemasok, tempo, hutang, konsinyasi. */
  purchasing: 'basic' | 'full'
  /**
   * basic = catat pelanggan di kasir, daftar pelanggan, kirim nota via WhatsApp
   * full  = + poin loyalty, riwayat belanja per pelanggan, segmentasi
   *
   * Dibelah, bukan dikunci seluruhnya di paket atas, mengikuti prinsip yang
   * sama dengan `purchasing`: melayani pembeli adalah hal yang membuat toko
   * berjalan benar, sementara poin dan segmentasi adalah lapisan analisanya.
   */
  crm: 'basic' | 'full'
  multiOutlet: boolean
  api: boolean
}

export const FULL_PLAN: PlanFeatures = {
  reports: 'full',
  purchasing: 'full',
  crm: 'full',
  multiOutlet: true,
  api: true,
}

const tier = (v: unknown): 'basic' | 'full' => (v === 'basic' ? 'basic' : 'full')

/**
 * Kemampuan paket satu organisasi.
 *
 * Dibungkus `cache()` supaya beberapa komponen dalam satu render tidak
 * menembak Supabase berulang — pola yang sama dengan `getSessionContext()`.
 *
 * Organisasi tanpa paket (`plan_id` belum diisi) juga dapat kemampuan penuh.
 * Aturannya sama dengan kuota: jangan pernah mengunci toko hanya karena
 * kolomnya belum terisi.
 */
export const getPlanFeatures = cache(async (orgId: string): Promise<PlanFeatures> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('plans(features)')
    .eq('id', orgId)
    .maybeSingle()

  const raw = (data?.plans as unknown as { features: Record<string, unknown> } | null)?.features
  if (!raw) return FULL_PLAN

  return {
    reports: tier(raw.reports),
    purchasing: tier(raw.purchasing),
    crm: tier(raw.crm),
    multiOutlet: raw.multi_outlet !== false,
    api: raw.api !== false,
  }
})
