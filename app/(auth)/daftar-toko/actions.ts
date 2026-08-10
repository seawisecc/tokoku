'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ORG_COOKIE, OUTLET_COOKIE } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type FinishState = { error?: string }

/**
 * Buat toko — untuk akun yang belum punya toko sama sekali, maupun untuk
 * menambah toko kedua dan seterusnya.
 *
 * Setelah berhasil, toko baru langsung DIJADIKAN AKTIF. Tanpa itu, pemilik yang
 * baru saja mengisi nama toko akan mendarat di toko lamanya dan menyangka
 * pembuatannya gagal — cookie tokonya masih menunjuk yang lama, dan tidak ada
 * apa pun di layar yang menjelaskan kenapa.
 *
 * Cookie outlet ikut dibuang: isinya outlet milik toko lama.
 */
export async function finishRegistration(
  _prev: FinishState,
  formData: FormData,
): Promise<FinishState> {
  const name = String(formData.get('storeName') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  if (name.length < 2) return { error: 'Nama toko minimal 2 huruf.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_store', {
    p_name: name,
    p_city: city || undefined,
  })

  if (error) {
    if (error.message.includes('not_authenticated')) {
      return { error: 'Sesi Anda berakhir. Masuk ulang lalu coba lagi.' }
    }
    if (error.message.includes('store_name_too_short')) {
      return { error: 'Nama toko minimal 2 huruf.' }
    }
    // TK003 — batas 5 toko dan nama kembar. Pesannya sudah ditulis untuk
    // pemilik toko di dalam RPC, jadi diteruskan apa adanya.
    if (error.code === 'TK003') return { error: error.message }
    return { error: 'Toko gagal dibuat. Coba lagi sebentar lagi.' }
  }

  const orgId = (data as { organization_id?: string } | null)?.organization_id
  if (orgId) {
    const jar = await cookies()
    jar.set(ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    jar.delete(OUTLET_COOKIE)
  }

  revalidatePath('/', 'layout')
  redirect('/beranda')
}
