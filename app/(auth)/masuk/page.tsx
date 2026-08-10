import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthPanel } from '@/components/domain/AuthPanel'
import { getSessionContext } from '@/lib/auth'
import { homeFor } from '@/lib/navigation'

export const metadata: Metadata = { title: 'Masuk — TokoKu' }

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; pesan?: string }>
}) {
  const ctx = await getSessionContext()
  if (ctx) redirect(homeFor(ctx.role, ctx.permissions))

  const { mode, pesan } = await searchParams
  return (
    <AuthPanel
      initialMode={mode === 'daftar' ? 'register' : 'login'}
      notice={
        pesan === 'sandi-diperbarui'
          ? 'Kata sandi berhasil diganti. Silakan masuk memakai kata sandi yang baru.'
          : undefined
      }
    />
  )
}
