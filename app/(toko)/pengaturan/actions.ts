'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite, requireSession } from '@/lib/auth'
import { invitationEmail, sendEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'

export type Result = { ok: true; message?: string } | { ok: false; error: string; field?: string }

function firstIssue(e: z.ZodError): { ok: false; error: string; field?: string } {
  const i = e.issues[0]
  return { ok: false, error: i.message, field: i.path[0]?.toString() }
}

/**
 * Hanya pemilik yang boleh menyentuh komposisi tim.
 *
 * Super Admin yang sedang melihat toko klien berperan `owner`, jadi cek peran
 * saja tidak cukup — mode itu harus ditolak eksplisit di sini.
 */
async function requireOwner() {
  const session = await requireSession()
  if (session.impersonating) {
    throw new Error(
      'Mode lihat-saja: keluar dari mode Super Admin dulu untuk mengubah tim toko ini.',
    )
  }
  if (session.role !== 'owner') {
    throw new Error('Hanya pemilik toko yang boleh mengubah tim.')
  }
  return session
}

// ---------------------------------------------------------------- toko

const storeSchema = z.object({
  name: z.string().trim().min(2, 'Nama toko minimal 2 huruf').max(120),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  email: z.string().trim().email('Format email tidak valid').optional().or(z.literal('')),
  lowStockThreshold: z.coerce.number().int().min(0).max(9999),
  allowNegativeStock: z.coerce.boolean(),
})

export async function saveStore(formData: FormData): Promise<Result> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }
  const parsed = storeSchema.safeParse({
    name: formData.get('name'),
    city: formData.get('city') ?? '',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    lowStockThreshold: formData.get('lowStockThreshold') || 10,
    allowNegativeStock: formData.get('allowNegativeStock') === 'on',
  })
  if (!parsed.success) return firstIssue(parsed.error)
  const v = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      name: v.name,
      city: v.city || null,
      address: v.address || null,
      phone: v.phone || null,
      email: v.email || null,
      low_stock_threshold: v.lowStockThreshold,
      allow_negative_stock: v.allowNegativeStock,
    })
    .eq('id', session.org!.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Informasi toko tersimpan.' }
}

// ---------------------------------------------------------------- printer

const printerSchema = z.object({
  paper: z.enum(['58mm', '80mm']),
  header: z.string().trim().max(120).optional().or(z.literal('')),
  footer: z.string().trim().max(120).optional().or(z.literal('')),
  showLogo: z.coerce.boolean(),
  autoPrint: z.coerce.boolean(),
})

export async function savePrinter(outletId: string, formData: FormData): Promise<Result> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }
  const parsed = printerSchema.safeParse({
    paper: formData.get('paper'),
    header: formData.get('header') ?? '',
    footer: formData.get('footer') ?? '',
    showLogo: formData.get('showLogo') === 'on',
    autoPrint: formData.get('autoPrint') === 'on',
  })
  if (!parsed.success) return firstIssue(parsed.error)
  const v = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('outlets')
    .update({
      receipt_settings: {
        paper: v.paper,
        header: v.header || '',
        footer: v.footer || '',
        show_logo: v.showLogo,
        auto_print: v.autoPrint,
      },
    })
    .eq('id', outletId)
    .eq('organization_id', session.org!.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/pengaturan/printer')
  revalidatePath('/kasir')
  return { ok: true, message: 'Pengaturan struk tersimpan.' }
}

// ---------------------------------------------------------------- kategori

const COLOR_KEYS = ['sembako', 'minuman', 'snack', 'kebutuhan', 'default'] as const

export async function saveCategory(
  categoryId: string | null,
  name: string,
  colorKey: string,
): Promise<Result> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  const trimmed = name.trim()
  if (trimmed.length < 2) return { ok: false, error: 'Nama kategori minimal 2 huruf.', field: 'name' }
  const color = (COLOR_KEYS as readonly string[]).includes(colorKey) ? colorKey : 'default'

  const supabase = await createClient()
  const row = { organization_id: session.org!.id, name: trimmed, color_key: color }

  const { error } = categoryId
    ? await supabase.from('categories').update(row).eq('id', categoryId)
    : await supabase.from('categories').insert(row)

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Kategori dengan nama itu sudah ada.', field: 'name' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/pengaturan/kategori')
  revalidatePath('/produk')
  revalidatePath('/kasir')
  return { ok: true }
}

/**
 * Hapus kategori — soft delete, dan produknya TIDAK ikut hilang.
 *
 * `products.category_id` bersifat ON DELETE SET NULL, tapi kita tidak menghapus
 * barisnya sama sekali: perangkat offline perlu melihat `deleted_at` untuk
 * membuang salinan lokalnya.
 */
export async function deleteCategory(categoryId: string): Promise<Result> {
  const { blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  const supabase = await createClient()

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .is('deleted_at', null)

  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', categoryId)

  if (error) return { ok: false, error: error.message }

  await supabase.from('products').update({ category_id: null }).eq('category_id', categoryId)

  revalidatePath('/pengaturan/kategori')
  revalidatePath('/produk')
  revalidatePath('/kasir')
  return {
    ok: true,
    message: count ? `Kategori dihapus. ${count} produk kini tanpa kategori.` : undefined,
  }
}

// ---------------------------------------------------------------- tim

const PERMISSION_KEYS = ['pos', 'products', 'reports', 'settings'] as const

function readPermissions(formData: FormData): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, formData.get(`perm_${k}`) === 'on']))
}

export type InviteResult =
  | {
      ok: true
      /** Selalu ada. Tautannya tetap ditampilkan walau emailnya terkirim. */
      token: string
      email: string
      delivery: 'sent' | 'skipped' | 'failed'
      deliveryError?: string
    }
  | { ok: false; error: string; field?: string }

/**
 * Buat undangan, lalu kirim emailnya.
 *
 * URUTANNYA MENENTUKAN, dan email tidak pernah boleh membatalkan undangan.
 * Barisnya sudah ada di database begitu insert lolos; kalau kegagalan kirim
 * dijadikan error, pemilik toko melihat "gagal" padahal undangannya nyata —
 * lalu mencoba lagi dan ditolak "undangan masih menunggu diterima". Buntu, dan
 * penyebabnya tidak kelihatan.
 *
 * Jadi hasil pengiriman dilaporkan TERPISAH dari keberhasilan undangannya, dan
 * tautannya selalu dikembalikan. Di Indonesia itu bukan sekadar cadangan:
 * banyak pemilik warung memang lebih suka mengirimnya lewat WhatsApp.
 */
export async function inviteMember(formData: FormData): Promise<InviteResult> {
  const session = await requireOwner()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? 'cashier')

  const parsed = z.string().email('Format email tidak valid').safeParse(email)
  if (!parsed.success) return { ok: false, error: 'Format email tidak valid.', field: 'email' }
  if (!['owner', 'admin', 'cashier'].includes(role)) return { ok: false, error: 'Peran tidak dikenal.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      organization_id: session.org!.id,
      email,
      role: role as 'owner' | 'admin' | 'cashier',
      permissions: readPermissions(formData),
      invited_by: session.userId,
    })
    .select('token')
    .single()

  if (error) {
    if (error.code === '23505')
      return { ok: false, error: 'Undangan untuk email ini masih menunggu diterima.', field: 'email' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/pengaturan/tim')

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'TokoKu'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const mail = invitationEmail({
    storeName: session.org!.name,
    inviterName: session.fullName,
    role,
    link: `${appUrl}/undangan/${data.token}`,
    appName,
  })

  const sent = await sendEmail({ to: email, ...mail })

  return {
    ok: true,
    token: data.token,
    email,
    delivery: sent.status,
    deliveryError: sent.status === 'failed' ? sent.error : undefined,
  }
}

export async function updateMember(memberId: string, formData: FormData): Promise<Result> {
  const session = await requireOwner()
  const role = String(formData.get('role') ?? 'cashier')
  if (!['owner', 'admin', 'cashier'].includes(role)) return { ok: false, error: 'Peran tidak dikenal.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_members')
    .update({ role: role as 'owner' | 'admin' | 'cashier', permissions: readPermissions(formData) })
    .eq('id', memberId)
    .eq('organization_id', session.org!.id)

  if (error) {
    if (error.message.includes('last_owner_cannot_be_removed')) {
      return { ok: false, error: 'Toko harus punya minimal satu pemilik.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/pengaturan/tim')
  revalidatePath('/profil')
  return { ok: true, message: 'Akses anggota diperbarui.' }
}

export async function disableMember(memberId: string): Promise<Result> {
  const session = await requireOwner()
  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_members')
    .update({ status: 'disabled' })
    .eq('id', memberId)
    .eq('organization_id', session.org!.id)

  if (error) {
    if (error.message.includes('last_owner_cannot_be_removed')) {
      return { ok: false, error: 'Toko harus punya minimal satu pemilik.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/pengaturan/tim')
  return { ok: true, message: 'Anggota dinonaktifkan. Riwayat transaksinya tetap tersimpan.' }
}

export async function revokeInvitation(invitationId: string): Promise<Result> {
  const session = await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('organization_id', session.org!.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/pengaturan/tim')
  return { ok: true }
}
