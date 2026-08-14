'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ExpenseResult = { ok: true } | { ok: false; error: string }

const METODE = ['cash', 'qris', 'transfer', 'card', 'other'] as const

const schema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid('Pilih kategori pengeluarannya.'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggalnya belum diisi.'),
  amount: z.coerce.number().int().positive('Jumlahnya harus lebih dari nol.'),
  paymentMethod: z.enum(METODE),
  /** '' berarti seluruh toko, bukan outlet yang lupa dipilih. */
  outletId: z.string().uuid().or(z.literal('')),
  payee: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
})

const bersih = (v: FormDataEntryValue | null) => String(v ?? '').trim()

/**
 * Simpan pengeluaran, baru maupun perubahan.
 *
 * Tidak lewat RPC, berbeda dengan `create_purchase` dan `bulk_adjust_stock`.
 * Keduanya butuh RPC karena satu tindakan menyentuh beberapa tabel sekaligus
 * (nota + stok + HPP) dan kegagalan di tengah menyisakan keadaan yang tidak
 * bisa dijelaskan ke siapa pun. Pengeluaran cuma satu baris di satu tabel:
 * ia sudah atomik dengan sendirinya, dan membungkusnya dalam RPC cuma
 * menambah satu tempat lagi yang harus ikut diperbarui tiap kolomnya berubah.
 */
export async function saveExpense(formData: FormData): Promise<ExpenseResult> {
  const { session, blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const parsed = schema.safeParse({
    id: bersih(formData.get('id')) || undefined,
    categoryId: bersih(formData.get('categoryId')),
    expenseDate: bersih(formData.get('expenseDate')),
    amount: bersih(formData.get('amount')),
    paymentMethod: bersih(formData.get('paymentMethod')) || 'cash',
    outletId: bersih(formData.get('outletId')),
    payee: bersih(formData.get('payee')),
    note: bersih(formData.get('note')),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const v = parsed.data
  const supabase = await createClient()

  const baris = {
    organization_id: session.org!.id,
    outlet_id: v.outletId || null,
    category_id: v.categoryId,
    expense_date: v.expenseDate,
    amount: v.amount,
    payment_method: v.paymentMethod,
    payee: v.payee || null,
    note: v.note || null,
  }

  if (v.id) {
    /**
     * `.select()` bukan hiasan: UPDATE yang ditolak RLS mengembalikan
     * "berhasil" dengan nol baris, bukan error. Tanpa memeriksa jumlah
     * barisnya, orang yang tidak berhak melihat pesan tersimpan lalu
     * angkanya tidak berubah sama sekali. Jebakan yang sama sudah menggigit
     * saat menghapus perangkat kasir.
     */
    const { data, error } = await supabase
      .from('expenses')
      .update(baris)
      .eq('id', v.id)
      .eq('organization_id', session.org!.id)
      .is('deleted_at', null)
      .select('id')

    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) {
      return { ok: false, error: 'Pengeluaran ini tidak bisa diubah dari akun Anda.' }
    }
  } else {
    const { error } = await supabase
      .from('expenses')
      .insert({ ...baris, created_by: session.userId })

    // Pesan TK002 (langganan berhenti) sudah ditulis untuk pemilik warung,
    // jadi diteruskan apa adanya.
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/laporan/pengeluaran')
  revalidatePath('/laporan')
  return { ok: true }
}

/**
 * Hapus pengeluaran. SOFT, dan alasannya wajib.
 *
 * Pengeluaran boleh diperbaiki kalau salah ketik, tapi baris yang sudah pernah
 * masuk laporan tidak boleh lenyap tanpa jejak: itu bentuk paling gampang untuk
 * merapikan angka setelah ditanya. Barisnya tetap ada, ditandai terhapus,
 * lengkap dengan alasannya.
 */
export async function deleteExpense(id: string, reason: string): Promise<ExpenseResult> {
  const { session, blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const alasan = reason.trim()
  if (alasan.length < 3) return { ok: false, error: 'Tulis dulu alasan penghapusannya.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString(), delete_reason: alasan })
    .eq('id', id)
    .eq('organization_id', session.org!.id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Pengeluaran ini tidak bisa dihapus dari akun Anda.' }
  }

  revalidatePath('/laporan/pengeluaran')
  revalidatePath('/laporan')
  return { ok: true }
}

export async function createExpenseCategory(name: string): Promise<ExpenseResult> {
  const { session, blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const nama = name.trim()
  if (nama.length < 2) return { ok: false, error: 'Nama kategori minimal 2 huruf.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('expense_categories')
    .insert({ organization_id: session.org!.id, name: nama, sort_order: 99 })

  if (error) {
    // Unique index-nya membandingkan huruf kecil, jadi "Sewa" dan "sewa"
    // memang satu kategori yang sama.
    return {
      ok: false,
      error: error.code === '23505' ? `Kategori "${nama}" sudah ada.` : error.message,
    }
  }

  revalidatePath('/laporan/pengeluaran')
  return { ok: true }
}

/**
 * Hapus kategori. SOFT juga, dan itu wajib di sini: pengeluaran lama menunjuk
 * barisnya, dan laporan bulan lalu harus tetap bisa menyebut namanya.
 */
export async function deleteExpenseCategory(id: string): Promise<ExpenseResult> {
  const { session, blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()

  // Kategori yang masih dipakai tidak boleh hilang dari pilihan begitu saja:
  // pemilik toko akan mengira pengeluarannya ikut terhapus.
  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Kategori ini masih dipakai ${count} pengeluaran. Pindahkan dulu pengeluarannya ke kategori lain.`,
    }
  }

  const { data, error } = await supabase
    .from('expense_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', session.org!.id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Kategori ini tidak bisa dihapus dari akun Anda.' }
  }

  revalidatePath('/laporan/pengeluaran')
  return { ok: true }
}
