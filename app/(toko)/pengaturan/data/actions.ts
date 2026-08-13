'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ImportRow = {
  sku: string
  name: string
  category: string | null
  unit: string | null
  barcode: string | null
  sell_price: number
  cost_price: number
  min_stock: number | null
  /** null = kolom stok memang kosong. Lihat aturannya di migrasi 0040. */
  stock: number | null
}

export type ImportResult =
  | { ok: true; created: number; updated: number; skipped: number; categoriesCreated: number }
  | { ok: false; error: string }

const barisSchema = z.object({
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).nullable(),
  unit: z.string().trim().max(16).nullable(),
  barcode: z.string().trim().max(64).nullable(),
  sell_price: z.number().int().min(0),
  cost_price: z.number().int().min(0),
  min_stock: z.number().int().min(0).nullable(),
  stock: z.number().int().min(0).nullable(),
})

/**
 * Impor daftar produk.
 *
 * Validasinya diulang di sini walau layar impor sudah memeriksa tiap baris:
 * yang di layar untuk memberi tahu pemilik toko baris mana yang salah SEBELUM
 * ia menunggu, yang di sini karena server action bisa dipanggil langsung tanpa
 * lewat layar mana pun.
 */
export async function importProducts(
  rows: ImportRow[],
  updateExisting: boolean,
): Promise<ImportResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  if (!session.outletId) {
    return { ok: false, error: 'Akun ini belum ditugaskan ke outlet mana pun.' }
  }

  const parsed = z.array(barisSchema).min(1).max(2000).safeParse(rows)
  if (!parsed.success) {
    return { ok: false, error: 'Ada baris yang tidak lengkap. Periksa lagi berkasnya.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('import_products', {
    p_org: session.org!.id,
    p_outlet: session.outletId,
    p_rows: parsed.data,
    p_update_existing: updateExisting,
  })

  if (error) {
    // TK001 = kuota paket, TK002 = langganan berakhir, TK003 = isi berkasnya.
    // Ketiganya sudah berbahasa Indonesia dan siap ditampilkan apa adanya;
    // sisanya tidak, jadi jangan diteruskan mentah-mentah ke pemilik warung.
    const siap = ['TK001', 'TK002', 'TK003'].includes(error.code ?? '')
    return {
      ok: false,
      error: siap
        ? error.message
        : 'Impor gagal dan tidak ada satu pun baris yang tersimpan. Coba lagi sebentar lagi.',
    }
  }

  const hasil = data as {
    created: number
    updated: number
    skipped: number
    categories_created: number
  }

  revalidatePath('/produk')
  revalidatePath('/pengaturan/data')
  revalidatePath('/pengaturan/kategori')

  return {
    ok: true,
    created: hasil.created,
    updated: hasil.updated,
    skipped: hasil.skipped,
    categoriesCreated: hasil.categories_created,
  }
}
