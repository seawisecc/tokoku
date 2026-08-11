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
/**
 * Kalimat untuk UPDATE yang ditolak RLS.
 *
 * Gerbang aplikasi memakai IZIN MODUL (`settings`), sementara policy database
 * memakai PERAN (owner/admin). Keduanya tidak sama: kasir yang diberi izin
 * Pengaturan lolos gerbang aplikasi lalu ditolak database — dan UPDATE yang
 * ditolak RLS menjawab "berhasil" dengan nol baris, bukan error. Tanpa
 * memeriksa jumlah barisnya, layar mengatakan "tersimpan" dan tidak ada yang
 * berubah.
 */
const NOT_MANAGER = 'Hanya pemilik atau admin toko yang boleh mengubah pengaturan ini.'

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
  const { data: changed, error } = await supabase
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
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!changed || changed.length === 0) return { ok: false, error: NOT_MANAGER }

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
  const { data: changed, error } = await supabase
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
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!changed || changed.length === 0) return { ok: false, error: NOT_MANAGER }

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

// ---------------------------------------------------------------- perangkat

/**
 * Hapus perangkat kasir terdaftar.
 *
 * Kenapa ini perlu ada: `max_devices` adalah kuota berbayar yang ditegakkan di
 * database, dan perangkat MENDAFTARKAN DIRINYA SENDIRI tiap kali layar Kasir
 * dibuka di outlet yang belum pernah dipakai. Tanpa tombol ini kuotanya cuma
 * bisa naik — toko yang penuh perangkat tidak bisa mendaftarkan kasir baru
 * sama sekali, walaupun HP yang lama sudah lama dijual atau rusak.
 *
 * Transaksi lamanya TIDAK ikut hilang: semua FK ke `devices` memakai
 * `on delete set null`, jadi barisnya tetap ada lengkap dengan nomornya. Kode
 * perangkat sudah tercetak di dalam nomor transaksi (TRX-…-K1-0042), jadi
 * asal-usulnya tetap terbaca walaupun tautannya putus.
 */
export async function deleteDevice(deviceId: string): Promise<Result> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()

  // `v_sync_health` sekaligus membawa antrean dan penolakan yang belum
  // ditinjau — angka yang sama persis dengan yang dilihat pemilik di tabel,
  // jadi tidak mungkin layarnya bilang "aman" sementara gerbangnya menolak.
  const { data: device } = await supabase
    .from('v_sync_health')
    .select('device_id, device_name, code, pending_count, open_rejections')
    .eq('organization_id', session.org!.id)
    .eq('device_id', deviceId)
    .maybeSingle()

  if (!device) {
    return { ok: false, error: 'Perangkat tidak ditemukan di toko ini.' }
  }

  /**
   * Antrean yang belum terkirim adalah PENJUALAN YANG SUDAH TERJADI dan uangnya
   * sudah diterima kasir. Perangkatnya dihapus, antrean di HP itu jadi yatim:
   * server menolaknya karena device_id-nya sudah tidak ada, dan penjualannya
   * hilang dari pembukuan tanpa ada yang menyadarinya.
   *
   * Karena itu ditolak, bukan diperingatkan. Pemiliknya cuma perlu menunggu
   * perangkat itu online sekali lagi.
   */
  const pending = Number(device.pending_count ?? 0)
  if (pending > 0) {
    return {
      ok: false,
      error:
        `Perangkat ${device.device_name} masih menyimpan ${pending} transaksi yang belum terkirim. ` +
        'Buka layar Kasir di perangkat itu sampai tersinkron, baru bisa dihapus.',
    }
  }

  const open = Number(device.open_rejections ?? 0)
  if (open > 0) {
    return {
      ok: false,
      error:
        `Perangkat ${device.device_name} punya ${open} transaksi yang gagal masuk dan belum ditinjau. ` +
        'Selesaikan dulu di bagian "Perlu Ditinjau" di bawah — kalau perangkatnya dihapus, ' +
        'asal-usul transaksi itu ikut hilang.',
    }
  }

  /**
   * `.select()` bukan hiasan: DELETE yang ditolak RLS mengembalikan "berhasil"
   * dengan nol baris terpengaruh, bukan error. Tanpa memeriksa hasilnya, kasir
   * yang izin `settings`-nya menyala tapi perannya bukan pemilik/admin akan
   * melihat "Perangkat dihapus." lalu barisnya tetap ada setelah refresh.
   */
  const { data: removed, error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)
    .eq('organization_id', session.org!.id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!removed || removed.length === 0) {
    return {
      ok: false,
      error: 'Hanya pemilik atau admin toko yang boleh menghapus perangkat kasir.',
    }
  }

  revalidatePath('/pengaturan/sinkronisasi')
  return {
    ok: true,
    message: `Perangkat ${device.device_name} (${device.code}) dihapus. Transaksi lamanya tetap tersimpan.`,
  }
}

// ---------------------------------------------------------------- logo toko

const LOGO_BUCKET = 'logo-toko'
const LOGO_MAX_BYTES = 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Unggah logo toko.
 *
 * Berkasnya disimpan di path TETAP `<organization_id>/logo` lalu ditimpa tiap
 * kali diganti. Alternatifnya menamai berkas dengan stempel waktu, dan itu
 * meninggalkan satu berkas yatim di storage setiap kali pemilik toko mencoba
 * logo baru — tidak ada yang membersihkannya, dan tidak ada yang menyadarinya
 * sampai tagihan storage naik tanpa sebab.
 *
 * Karena pathnya tetap, URL-nya juga tetap — jadi browser akan menampilkan logo
 * LAMA dari cache setelah diganti. Itu sebabnya `?v=` ditempel di belakangnya:
 * yang tersimpan di `logo_url` berubah tiap unggahan walaupun berkasnya di
 * tempat yang sama.
 */
export async function uploadStoreLogo(formData: FormData): Promise<Result> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Pilih dulu berkas logonya.' }
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { ok: false, error: 'Logo harus berupa gambar PNG, JPG, atau WebP.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return { ok: false, error: `Ukuran logo maksimal 1 MB, punya Anda ${mb} MB. Perkecil dulu.` }
  }

  const supabase = await createClient()
  const path = `${session.org!.id}/logo`

  /**
   * URUTANNYA PENTING: database dulu, storage belakangan.
   *
   * Versi pertama fungsi ini mengunggah lebih dulu lalu menulis `logo_url`.
   * Karena pathnya tetap (`<org>/logo`) dan `upsert: true`, unggahan itu
   * MENIMPA logo lama — dan baru sesudahnya ketahuan bahwa UPDATE-nya ditolak
   * RLS. Hasilnya logo toko benar-benar berganti di storage walaupun database
   * menolak, dan pemiliknya tidak pernah menyetujui apa pun.
   *
   * Dibalik seperti ini, penolakan terjadi sebelum ada satu byte pun ditulis.
   */
  const { data: sebelum } = await supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', session.org!.id)
    .maybeSingle()

  const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const { data: changed, error } = await supabase
    .from('organizations')
    .update({ logo_url: url })
    .eq('id', session.org!.id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!changed || changed.length === 0) {
    return { ok: false, error: 'Hanya pemilik atau admin toko yang boleh mengganti logo.' }
  }

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    // Tautannya sudah tersimpan tapi berkasnya gagal naik — kembalikan ke logo
    // lama, kalau tidak halaman menampilkan gambar rusak tanpa sebab.
    await supabase
      .from('organizations')
      .update({ logo_url: sebelum?.logo_url ?? null })
      .eq('id', session.org!.id)
    if (/row-level security|Unauthorized/i.test(uploadError.message)) {
      return { ok: false, error: 'Hanya pemilik atau admin toko yang boleh mengganti logo.' }
    }
    return { ok: false, error: `Logo gagal diunggah: ${uploadError.message}` }
  }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Logo toko tersimpan.' }
}

/**
 * Hapus logo.
 *
 * Berkas di storage ikut dibuang, bukan cuma tautannya dikosongkan: bucketnya
 * publik, jadi logo yang "sudah dihapus" tetap bisa dibuka siapa pun yang
 * pernah menyalin URL-nya. Untuk logo warung itu bukan bencana, tapi "dihapus"
 * harus berarti dihapus.
 */
export async function removeStoreLogo(): Promise<Result> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()

  // Sama seperti unggah: database dulu. Berkasnya dibuang hanya setelah
  // terbukti pemanggilnya memang berhak.
  const { data: changed, error } = await supabase
    .from('organizations')
    .update({ logo_url: null })
    .eq('id', session.org!.id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!changed || changed.length === 0) {
    return { ok: false, error: 'Hanya pemilik atau admin toko yang boleh menghapus logo.' }
  }

  const { error: removeError } = await supabase.storage
    .from(LOGO_BUCKET)
    .remove([`${session.org!.id}/logo`])

  if (removeError && !/not found/i.test(removeError.message)) {
    return { ok: false, error: `Logo gagal dihapus: ${removeError.message}` }
  }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Logo toko dihapus.' }
}
