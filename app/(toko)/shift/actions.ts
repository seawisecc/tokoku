'use server'

import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type CloseShiftResult =
  | { ok: true; expected: number; actual: number; difference: number }
  | { ok: false; error: string }

export async function closeShift(shiftId: string, closingCash: number, note: string | null) {
  const { blocked } = await requireWrite('pos')
  if (blocked) return { ok: false as const, error: blocked }
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('close_shift', {
    p_shift: shiftId,
    p_closing_cash: closingCash,
    p_note: note ?? undefined,
  })
  if (error) return { ok: false as const, error: error.message }

  const r = data as { expected_cash: number; closing_cash: number; difference: number }

  // SENGAJA tidak revalidatePath('/profil') di sini. Revalidasi akan me-render
  // ulang halaman, shift terbuka sudah tidak ada, sehingga kartunya lenyap
  // bersama ringkasan selisih kas — justru satu-satunya angka yang perlu
  // dibaca kasir saat menutup shift. Halaman akan segar sendiri pada navigasi
  // berikutnya.
  return {
    ok: true as const,
    expected: r.expected_cash,
    actual: r.closing_cash,
    difference: r.difference,
  }
}
