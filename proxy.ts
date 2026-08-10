import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

/**
 * Next 16 memakai konvensi "proxy" (dulu "middleware").
 * Tugasnya di sini hanya menyegarkan sesi Supabase; penjagaan role/permission
 * ditambahkan bersama modul auth (fase 2).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Semua rute kecuali aset statis dan file gambar.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
