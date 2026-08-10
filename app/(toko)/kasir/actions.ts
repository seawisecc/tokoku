'use server'

import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Daftarkan perangkat POS ini.
 *
 * Kode perangkat (K1, K2, …) menjadi segmen tengah nomor transaksi, dan itulah
 * yang membuat setiap mesin kasir bisa menomori sendiri saat offline tanpa
 * bentrok dengan mesin lain. Karena itu kodenya harus dialokasikan server,
 * sekali, saat perangkat masih online.
 */
export async function registerDevice(): Promise<{ id: string; code: string } | { error: string }> {
  const { session, blocked } = await requireWrite('pos')
  if (blocked) return { error: blocked }
  const supabase = await createClient()

  const orgId = session.org!.id
  const outletId = session.outletId
  if (!outletId) return { error: 'Akun ini belum ditugaskan ke outlet mana pun.' }

  const { data: existing } = await supabase
    .from('devices')
    .select('code')
    .eq('outlet_id', outletId)
    .order('code')

  const used = new Set((existing ?? []).map((d) => d.code))
  let code = ''
  for (let i = 1; i <= 99; i++) {
    const candidate = `K${i}`
    if (!used.has(candidate)) {
      code = candidate
      break
    }
  }
  if (!code) return { error: 'Batas jumlah perangkat outlet ini sudah tercapai.' }

  const { data, error } = await supabase
    .from('devices')
    .insert({
      organization_id: orgId,
      outlet_id: outletId,
      code,
      name: `Kasir ${code}`,
      registered_by: session.userId,
    })
    .select('id, code')
    .single()

  if (error) return { error: error.message }
  return { id: data.id, code: data.code }
}

/**
 * Pastikan kasir punya shift terbuka di outlet ini.
 *
 * `open_shift` bersifat idempoten — kalau sudah ada shift terbuka, id yang sama
 * dikembalikan. Jadi aman dipanggil setiap kali POS dibuka.
 *
 * Butuh jaringan. Kalau perangkat sedang offline, transaksi tetap dicatat
 * dengan shift_id kosong dan bisa dikaitkan belakangan lewat waktu & kasirnya —
 * memblokir penjualan hanya karena shift belum terbuka jelas lebih buruk.
 */
export async function ensureShift(deviceId: string): Promise<{ id: string } | { error: string }> {
  const { session, blocked } = await requireWrite('pos')
  if (blocked) return { error: blocked }
  const supabase = await createClient()
  if (!session.outletId) return { error: 'Akun ini belum ditugaskan ke outlet.' }

  const { data, error } = await supabase.rpc('open_shift', {
    p_org: session.org!.id,
    p_outlet: session.outletId,
    p_device: deviceId,
    p_opening_cash: 0,
  })
  if (error) return { error: error.message }
  return { id: data as string }
}
