import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth'
import { homeFor } from '@/lib/navigation'

/**
 * Pintu masuk: arahkan ke beranda yang sesuai peran.
 * Halaman status penyiapan dipindah ke /setup.
 */
export default async function RootPage() {
  const ctx = await getSessionContext()
  if (!ctx) redirect('/masuk')
  redirect(homeFor(ctx.role, ctx.permissions))
}
