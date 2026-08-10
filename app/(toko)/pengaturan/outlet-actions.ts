'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { OUTLET_COOKIE, requireSession, requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type OutletResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Pindah outlet kerja.
 *
 * Butuh sesi saja, bukan izin `settings`: kasir pun berpindah cabang, dan
 * berpindah outlet BUKAN perubahan data — hanya konteks kerja. Lihat catatan
 * "outlet bukan batas keamanan" di migrasi 0027.
 *
 * Divalidasi terhadap daftar outlet organisasi ini sebelum ditulis, walaupun
 * `getSessionContext()` juga memvalidasi ulang saat membaca. Dua-duanya perlu:
 * yang di sini memberi pesan jujur saat outletnya memang tidak ada, yang di sana
 * menjaga cookie yang diketik tangan.
 */
export async function switchOutlet(outletId: string): Promise<OutletResult> {
  const session = await requireSession()
  if (!session.outlets.some((o) => o.id === outletId)) {
    return { ok: false, error: 'Outlet tidak ditemukan atau sedang tidak aktif.' }
  }

  const jar = await cookies()
  jar.set(OUTLET_COOKIE, outletId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  // Seluruh tampilan toko bergantung pada outlet aktif.
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function createOutlet(input: {
  name: string
  code: string
  address: string
  phone: string
}): Promise<OutletResult> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_outlet', {
    p_org: session.org!.id,
    p_payload: {
      name: input.name,
      code: input.code,
      address: input.address,
      phone: input.phone,
    },
  })

  // Pesan dari database sudah ditulis untuk pemilik warung — TK001 kuota outlet,
  // TK002 langganan, TK003 isi borang.
  if (error) return { ok: false, error: error.message }

  const res = data as { name: string; code: string }
  revalidatePath('/', 'layout')
  return { ok: true, message: `Outlet ${res.name} (${res.code}) dibuat.` }
}

export async function updateOutlet(
  outletId: string,
  input: { name: string; address: string; phone: string },
): Promise<OutletResult> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }
  if (input.name.trim().length < 2) return { ok: false, error: 'Nama outlet minimal 2 huruf.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('outlets')
    .update({
      name: input.name.trim(),
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
    })
    .eq('id', outletId)
    .eq('organization_id', session.org!.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Outlet diperbarui.' }
}

export async function setPrimaryOutlet(outletId: string): Promise<OutletResult> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_primary_outlet', {
    p_org: session.org!.id,
    p_outlet: outletId,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Outlet utama dipindahkan.' }
}

/**
 * Nonaktifkan outlet.
 *
 * TIDAK menghapus barisnya. Transaksi, kartu stok, dan shift lama menunjuk ke
 * outlet ini (`on delete restrict`), dan riwayat penjualan cabang yang ditutup
 * tetap harus bisa dibaca. Trigger `enforce_outlet_invariants` menolak kalau ini
 * outlet utama atau satu-satunya yang tersisa.
 */
export async function deactivateOutlet(outletId: string): Promise<OutletResult> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { error } = await supabase
    .from('outlets')
    .update({ is_active: false })
    .eq('id', outletId)
    .eq('organization_id', session.org!.id)

  if (error) return { ok: false, error: error.message }

  // Kalau yang dinonaktifkan justru outlet yang sedang dibuka, cookienya dibuang
  // supaya sesi ini jatuh ke outlet utama — bukan tersangkut menunjuk cabang
  // yang sudah tidak ada.
  const jar = await cookies()
  if (jar.get(OUTLET_COOKIE)?.value === outletId) jar.delete(OUTLET_COOKIE)

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Outlet dinonaktifkan. Riwayat penjualannya tetap tersimpan.' }
}

/**
 * Aktifkan kembali outlet yang pernah dinonaktifkan.
 *
 * Bukan lubang kuota, walau trigger `max_outlets` hanya berjalan pada INSERT:
 * `org_usage(_, 'outlets')` menghitung baris yang belum di-soft-delete TANPA
 * memandang `is_active`. Outlet yang dinonaktifkan tetap memakan jatahnya, jadi
 * mengaktifkannya lagi tidak menambah apa pun.
 */
/**
 * Pindahkan stok antar outlet.
 *
 * Butuh izin `products`, bukan `settings`: ini memindahkan barang, bukan
 * mengubah struktur toko. Admin toko yang mengurus stok harus bisa melakukannya
 * tanpa diberi kunci ke seluruh pengaturan.
 */
export async function transferStock(input: {
  fromOutletId: string
  toOutletId: string
  transferredOn: string
  note: string
  items: { productId: string; quantity: number }[]
}): Promise<OutletResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  const items = input.items.filter((i) => i.productId && i.quantity > 0)
  if (items.length === 0) return { ok: false, error: 'Tambahkan minimal satu barang.' }
  if (input.fromOutletId === input.toOutletId) {
    return { ok: false, error: 'Outlet asal dan tujuan tidak boleh sama.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('transfer_stock', {
    p_org: session.org!.id,
    p_payload: {
      from_outlet_id: input.fromOutletId,
      to_outlet_id: input.toOutletId,
      transferred_on: input.transferredOn,
      note: input.note,
      items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    },
  })
  if (error) return { ok: false, error: error.message }

  const res = data as { code: string; quantity: number; from: string; to: string }
  revalidatePath('/', 'layout')
  return {
    ok: true,
    message: `${res.code}: ${res.quantity} satuan dipindahkan dari ${res.from} ke ${res.to}.`,
  }
}

export async function reactivateOutlet(outletId: string): Promise<OutletResult> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { error } = await supabase
    .from('outlets')
    .update({ is_active: true })
    .eq('id', outletId)
    .eq('organization_id', session.org!.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Outlet diaktifkan kembali.' }
}
