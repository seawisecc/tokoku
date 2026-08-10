'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { IMPERSONATION_COOKIE, requirePlatformAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Mulai melihat toko klien.
 *
 * Tidak ada JWT yang dipalsukan. Super Admin memang sudah lolos policy BACA
 * lewat `is_platform_admin()`; cookie ini hanya memberi tahu aplikasi toko mana
 * yang sedang dilihat. Hak tulis tetap tidak ikut, karena policy tulis
 * mensyaratkan keanggotaan nyata.
 */
export async function startImpersonation(organizationId: string, reason: string) {
  const session = await requirePlatformAdmin()
  const supabase = await createClient()

  await supabase.from('impersonation_sessions').insert({
    admin_user_id: session.userId,
    organization_id: organizationId,
    reason: reason.trim() || null,
  })

  const jar = await cookies()
  jar.set(IMPERSONATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60, // sejam, sama dengan expires_at barisnya
    path: '/',
  })

  revalidatePath('/', 'layout')
  redirect('/beranda')
}

export async function stopImpersonation() {
  const jar = await cookies()
  const orgId = jar.get(IMPERSONATION_COOKIE)?.value
  jar.delete(IMPERSONATION_COOKIE)

  if (orgId) {
    const supabase = await createClient()
    await supabase
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('organization_id', orgId)
      .is('ended_at', null)
  }

  revalidatePath('/', 'layout')
  redirect('/admin/klien')
}

// ---------------------------------------------------------------- paket

const planSchema = z.object({
  code: z.string().trim().min(2).max(24).regex(/^[a-z0-9_-]+$/, 'Kode hanya huruf kecil, angka, strip'),
  name: z.string().trim().min(2, 'Nama paket minimal 2 huruf').max(60),
  description: z.string().trim().max(160).optional().or(z.literal('')),
  priceMonthly: z.coerce.number().int().min(0),
  maxOutlets: z.string().trim(),
  maxUsers: z.string().trim(),
  maxProducts: z.string().trim(),
  maxDevices: z.string().trim(),
  isActive: z.coerce.boolean(),
})

/** Kosong berarti "tak terbatas" — disimpan NULL, bukan 0. */
const limit = (v: string) => (v.trim() === '' ? null : Number(v))

export async function savePlan(planId: string | null, formData: FormData): Promise<AdminResult> {
  await requirePlatformAdmin()
  const parsed = planSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    priceMonthly: formData.get('priceMonthly') || 0,
    maxOutlets: formData.get('maxOutlets') ?? '',
    maxUsers: formData.get('maxUsers') ?? '',
    maxProducts: formData.get('maxProducts') ?? '',
    maxDevices: formData.get('maxDevices') ?? '',
    isActive: formData.get('isActive') === 'on',
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data

  const row = {
    code: v.code,
    name: v.name,
    description: v.description || null,
    price_monthly: v.priceMonthly,
    price_yearly: v.priceMonthly * 10,
    max_outlets: limit(v.maxOutlets),
    max_users: limit(v.maxUsers),
    max_products: limit(v.maxProducts),
    max_devices: limit(v.maxDevices),
    is_active: v.isActive,
  }

  const supabase = await createClient()
  const { error } = planId
    ? await supabase.from('plans').update(row).eq('id', planId)
    : await supabase.from('plans').insert(row)

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Kode paket ini sudah dipakai.' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/paket')
  revalidatePath('/masuk')
  return { ok: true, message: 'Paket tersimpan.' }
}

export async function setClientPlan(organizationId: string, planId: string): Promise<AdminResult> {
  const session = await requirePlatformAdmin()
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('organizations')
    .select('plan_id')
    .eq('id', organizationId)
    .single()

  const fromId = current?.plan_id ?? null
  if (fromId === planId) return { ok: true }

  const { error } = await supabase
    .from('organizations')
    .update({ plan_id: planId })
    .eq('id', organizationId)

  if (error) return { ok: false, error: error.message }

  // Dulu SELALU dicatat 'upgrade', termasuk saat klien diturunkan. Riwayat
  // langganan adalah dasar penagihan nanti — mencatat penurunan sebagai
  // kenaikan membuat angkanya tidak bisa dipercaya sejak awal.
  const { data: prices } = await supabase
    .from('plans')
    .select('id, price_monthly')
    .in('id', fromId ? [fromId, planId] : [planId])

  const priceOf = (id: string | null) =>
    prices?.find((p) => p.id === id)?.price_monthly ?? null

  const before = priceOf(fromId)
  const after = priceOf(planId)
  const action =
    fromId === null
      ? 'subscribe'
      : before !== null && after !== null && after < before
        ? 'downgrade'
        : before !== null && after !== null && after === before
          ? 'renew'
          : 'upgrade'

  await supabase.from('subscription_events').insert({
    organization_id: organizationId,
    plan_id: planId,
    from_plan_id: fromId,
    action,
    amount: after ?? 0,
    created_by: session.userId,
  })

  revalidatePath('/admin/klien')
  revalidatePath(`/admin/klien/${organizationId}`)
  return { ok: true, message: 'Paket klien diperbarui.' }
}

/**
 * Atur akhir masa trial.
 *
 * Kolomnya sudah ada sejak awal tapi tidak pernah punya UI, jadi tidak ada cara
 * melihat kapan trial seorang klien habis — apalagi memperpanjangnya. Sekarang
 * tanggal ini benar-benar menutup akses (lihat migrasi 0021), jadi ia harus bisa
 * diatur.
 */
export async function setClientTrialEnd(
  organizationId: string,
  isoDate: string | null,
): Promise<AdminResult> {
  await requirePlatformAdmin()

  let value: string | null = null
  if (isoDate) {
    const d = new Date(isoDate)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Tanggal tidak valid.' }
    // Akhir hari: trial yang "habis 20 Agustus" harus tetap bisa dipakai
    // sepanjang tanggal 20, bukan mati jam 00:00.
    d.setHours(23, 59, 59, 999)
    value = d.toISOString()
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ trial_ends_at: value })
    .eq('id', organizationId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/klien')
  revalidatePath(`/admin/klien/${organizationId}`)
  return {
    ok: true,
    message: value ? 'Masa trial diperbarui.' : 'Batas trial dihapus — akses tidak dibatasi tanggal.',
  }
}

export async function setClientStatus(
  organizationId: string,
  status: 'active' | 'trial' | 'suspended' | 'inactive',
): Promise<AdminResult> {
  await requirePlatformAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .update({ status })
    .eq('id', organizationId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/klien')
  revalidatePath(`/admin/klien/${organizationId}`)
  revalidatePath('/admin')
  return { ok: true, message: 'Status klien diperbarui.' }
}
