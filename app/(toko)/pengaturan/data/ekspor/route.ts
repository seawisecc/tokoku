import { getSessionContext } from '@/lib/auth'
import { bacaParam, buildExport, csvResponse } from '@/lib/exports'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Unduh backup toko dalam bentuk CSV.
 *
 * Route Handler, bukan Server Action: yang diminta adalah BERKAS, dan satu-
 * satunya cara mengirim berkas dengan nama yang benar adalah lewat header
 * `Content-Disposition`. Server Action harus mengembalikan seluruh isinya ke
 * memori browser dulu untuk kemudian dijadikan blob — pada toko dengan puluhan
 * ribu transaksi itu berarti seluruh riwayat menumpuk di RAM ponsel sebelum
 * satu baris pun tersimpan.
 */
export async function GET(request: Request) {
  const session = await getSessionContext()

  /**
   * Route Handler TIDAK boleh me-redirect ke halaman masuk seperti page.
   *
   * Yang memanggilnya adalah tautan unduh, dan halaman HTML yang mendarat di
   * dalam berkas .csv terbaca sebagai backup yang rusak — orangnya membukanya
   * di Excel, melihat markup, lalu menyimpulkan datanya hilang.
   */
  if (!session?.org) {
    return new Response('Sesi sudah berakhir. Masuk lagi lalu ulangi.', { status: 401 })
  }
  if (!session.permissions.settings) {
    return new Response('Akun ini tidak berhak mengunduh data toko.', { status: 403 })
  }

  const { jenis, hari } = bacaParam(new URL(request.url))
  const supabase = await createClient()
  const { filename, csv } = await buildExport(
    supabase,
    session.org.id,
    session.org.name,
    jenis,
    hari,
  )

  return csvResponse(filename, csv)
}
