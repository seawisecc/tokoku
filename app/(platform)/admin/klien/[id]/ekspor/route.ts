import { getSessionContext } from '@/lib/auth'
import { bacaParam, buildExport, csvResponse } from '@/lib/exports'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Unduh data satu klien, dari sisi Super Admin.
 *
 * Ada karena satu keadaan yang nyata: klien menelepon minta backup dan tidak
 * pernah berhasil menemukan menunya sendiri. Tanpa jalur ini, satu-satunya cara
 * menolongnya adalah membuka SQL editor Supabase dan menempelkan hasilnya ke
 * spreadsheet dengan tangan — dan itu jenis pekerjaan yang cepat berubah jadi
 * kebiasaan mengambil data klien tanpa jejak.
 *
 * **Hanya BACA.** Impor sengaja tidak diberikan di sisi Super Admin, dan itu
 * keputusan yang disengaja, bukan kekurangan. Menulis ke tenant klien dari
 * sini butuh melewati RLS (`createAdminClient()`), yang dilarang di project ini
 * untuk melayani request biasa — dan konsekuensi produknya lebih berat lagi:
 * begitu admin bisa memasukkan barang atas nama klien, "siapa yang mengubah
 * daftar harga saya" tidak lagi punya jawaban tunggal. Klien mengimpor
 * sendiri di Pengaturan → Data; admin memandu.
 *
 * RLS tetap berlaku penuh di sini: yang meloloskan Super Admin adalah
 * `is_platform_admin()` di dalam policy baca, bukan service role.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext()

  if (!session) {
    return new Response('Sesi sudah berakhir. Masuk lagi lalu ulangi.', { status: 401 })
  }
  if (session.role !== 'platform_admin') {
    return new Response('Halaman ini hanya untuk Super Admin.', { status: 403 })
  }

  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()

  if (!org) return new Response('Toko tidak ditemukan.', { status: 404 })

  const { jenis, hari } = bacaParam(new URL(request.url))
  const { filename, csv } = await buildExport(supabase, org.id, org.name, jenis, hari)

  return csvResponse(filename, csv)
}
