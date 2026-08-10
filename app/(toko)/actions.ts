'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { ORG_COOKIE, OUTLET_COOKIE, requireSession } from '@/lib/auth'

export type StoreResult = { ok: true } | { ok: false; error: string }

/**
 * Pindah toko.
 *
 * Butuh sesi saja — berpindah toko bukan perubahan data, dan izin modul user di
 * toko tujuan ditentukan oleh keanggotaannya di sana, bukan oleh izinnya di
 * toko yang sedang dibuka. Divalidasi terhadap daftar keanggotaan nyata;
 * `getSessionContext()` memvalidasi ulang saat membaca.
 *
 * COOKIE OUTLET IKUT DIBUANG. Ia berisi id outlet milik toko lama, dan outlet
 * tidak pernah dipakai bersama antar toko. `pickOutlet()` memang sudah menolak
 * outlet asing, jadi ini bukan soal keamanan — melainkan supaya toko tujuan
 * mendarat di outlet utamanya sendiri alih-alih bergantung pada urutan
 * jatuh-balik yang tidak kelihatan dari luar.
 */
export async function switchStore(organizationId: string): Promise<StoreResult> {
  const session = await requireSession()
  if (!session.organizations.some((o) => o.id === organizationId)) {
    return { ok: false, error: 'Toko tidak ditemukan, atau Anda bukan lagi anggotanya.' }
  }

  const jar = await cookies()
  jar.set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  jar.delete(OUTLET_COOKIE)

  revalidatePath('/', 'layout')
  return { ok: true }
}
