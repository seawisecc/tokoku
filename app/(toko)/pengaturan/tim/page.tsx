import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { TeamManager, type Invitation, type Member } from '@/components/domain/TeamManager'
import { initialsOf, requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Tim & Akses | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function TimPage() {
  const session = await requireSession()
  // Komposisi tim adalah wewenang pemilik saja — admin dengan izin `settings`
  // tetap tidak boleh mengubah peran orang lain.
  if (session.role !== 'owner') redirect('/pengaturan/toko')

  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: rows }, { data: invites }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id, user_id, role, permissions, profiles:user_id(full_name)')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('role'),
    supabase
      .from('invitations')
      .select('id, email, role, token, expires_at')
      .eq('organization_id', orgId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ])

  const members: Member[] = (rows ?? []).map((m) => {
    const name = (m.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Tanpa nama'
    return {
      id: m.id,
      userId: m.user_id,
      name,
      initials: initialsOf(name),
      role: m.role as Member['role'],
      permissions: (m.permissions ?? {}) as Record<string, boolean>,
      isSelf: m.user_id === session.userId,
    }
  })

  const invitations: Invitation[] = (invites ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    token: i.token,
    expiresAt: i.expires_at,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Tim & Akses"
        subtitle="Atur siapa boleh melakukan apa di toko ini."
      />
      <TeamManager
        members={members}
        invitations={invitations}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}
      />
    </>
  )
}
