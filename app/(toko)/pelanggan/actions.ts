'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { normalkanHp } from '@/lib/phone'
import { createClient } from '@/lib/supabase/server'

export type Result = { ok: true; message?: string } | { ok: false; error: string; field?: string }

const schema = z.object({
  name: z.string().trim().min(2, 'Nama pelanggan minimal 2 huruf').max(120),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  email: z.string().trim().email('Format email tidak valid').optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  note: z.string().trim().max(240).optional().or(z.literal('')),
})

export async function saveCustomer(customerId: string | null, formData: FormData): Promise<Result> {
  const { session, blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const parsed = schema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    address: formData.get('address') ?? '',
    note: formData.get('note') ?? '',
  })
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    return { ok: false, error: i.message, field: i.path[0]?.toString() }
  }
  const v = parsed.data

  const hp = v.phone ? normalkanHp(v.phone) : null
  if (v.phone && !hp) {
    return {
      ok: false,
      error: 'Nomor itu belum lengkap. Tulis lengkap dengan kode awalnya, misalnya 0812 3456 7890.',
      field: 'phone',
    }
  }

  const supabase = await createClient()
  const row = {
    organization_id: session.org!.id,
    name: v.name,
    phone: hp,
    email: v.email || null,
    address: v.address || null,
    note: v.note || null,
  }

  const { data, error } = customerId
    ? await supabase
        .from('customers')
        .update(row)
        .eq('id', customerId)
        .eq('organization_id', session.org!.id)
        .select('id')
    : await supabase.from('customers').insert(row).select('id')

  if (error) {
    // Indeks unik (organization_id, phone) untuk baris yang belum dihapus.
    if (error.message.includes('customers_phone_idx')) {
      return {
        ok: false,
        error: 'Nomor HP ini sudah dipakai pelanggan lain.',
        field: 'phone',
      }
    }
    return { ok: false, error: error.message }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Perubahan ditolak. Pastikan Anda masih anggota toko ini.' }
  }

  revalidatePath('/pelanggan')
  return { ok: true, message: customerId ? 'Pelanggan diperbarui.' : 'Pelanggan ditambahkan.' }
}

/**
 * Soft delete, mengikuti aturan yang sama dengan produk dan kategori.
 *
 * Transaksi lamanya menunjuk ke baris ini lewat `customer_id`; dihapus keras,
 * riwayat belanja kehilangan nama pembelinya dan laporan lama ikut berubah.
 */
export async function deleteCustomer(customerId: string): Promise<Result> {
  const { session, blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', customerId)
    .eq('organization_id', session.org!.id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Penghapusan ditolak. Pastikan Anda masih anggota toko ini.' }
  }

  revalidatePath('/pelanggan')
  return { ok: true, message: 'Pelanggan dihapus. Riwayat belanjanya tetap tersimpan.' }
}
