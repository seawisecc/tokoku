import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Menyegarkan sesi Supabase di setiap request (dipanggil dari proxy.ts) dan meneruskan cookie barunya
 * ke Server Component. Tanpa ini, access token yang kedaluwarsa (1 jam)
 * akan membuat user terlempar ke login di tengah pemakaian.
 *
 * Penjagaan role/permission BELUM ada di sini — akan ditambah bersama
 * modul auth (fase 2). Untuk saat ini middleware hanya mengurus sesi.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!isSupabaseConfigured()) return response

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Jangan hapus: panggilan inilah yang memicu penyegaran token.
  await supabase.auth.getUser()

  return response
}
