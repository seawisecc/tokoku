import 'server-only'

import type { Route } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { AppRole, Permission } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'

export type SessionContext = {
  userId: string
  email: string
  fullName: string
  initials: string
  role: AppRole
  permissions: Record<Permission, boolean>
  /** null untuk Super Admin — dia tidak terikat satu tenant. */
  org: {
    id: string
    name: string
    city: string | null
    status: string
    /** ISO, atau null kalau tanpa batas waktu. */
    trialEndsAt: string | null
  } | null
  /**
   * Outlet yang sedang DIKERJAKAN, bukan outlet asal anggota.
   *
   * Diambil dari cookie `tokoku_outlet` kalau ada dan sah, kalau tidak dari
   * `default_outlet_id`, kalau tidak juga dari outlet utama. Seluruh aplikasi
   * membaca satu nilai ini — POS, stok, laporan, pembelian, konsinyasi — jadi
   * berpindah outlet cukup dengan mengganti cookienya.
   */
  outletId: string | null
  /** Semua outlet aktif toko ini, untuk pemilih outlet. Kosong untuk Super Admin. */
  outlets: { id: string; name: string; code: string; isPrimary: boolean }[]
  memberId: string | null
  /**
   * Semua toko yang boleh dibuka akun ini — miliknya sendiri maupun tempat ia
   * diundang. Kosong untuk Super Admin. Dipakai pemilih toko.
   */
  organizations: { id: string; name: string; city: string | null; role: AppRole }[]
  /** Terisi saat Super Admin sedang melihat toko klien. */
  impersonating?: { adminName: string }
}

export const IMPERSONATION_COOKIE = 'tokoku_impersonasi'
export const OUTLET_COOKIE = 'tokoku_outlet'
export const ORG_COOKIE = 'tokoku_toko'

/**
 * Tentukan outlet yang sedang aktif.
 *
 * Cookie SELALU divalidasi ulang terhadap daftar outlet organisasi ini. Cookie
 * bisa diketik tangan siapa saja; dipercaya mentah-mentah, `outlet_id` toko lain
 * akan ikut tertulis ke transaksi baru. RLS memang menyaring per organisasi
 * sehingga datanya tidak bocor, tapi INSERT-nya sendiri lolos dan penjualannya
 * mendarat di outlet yang tidak ada isinya — rusak diam-diam, dan baru
 * ketahuan saat laporan cabang tidak cocok.
 *
 * Outlet yang tidak dikenal tidak dianggap error: cookie basi (outlet baru saja
 * dinonaktifkan, atau user pindah toko) harus jatuh mulus ke outlet yang benar,
 * bukan mengunci kasir di layar galat.
 */
function pickOutlet(
  outlets: { id: string; is_primary: boolean }[],
  cookieValue: string | undefined,
  defaultOutletId: string | null,
): string | null {
  if (cookieValue && outlets.some((o) => o.id === cookieValue)) return cookieValue
  if (defaultOutletId && outlets.some((o) => o.id === defaultOutletId)) return defaultOutletId
  return outlets.find((o) => o.is_primary)?.id ?? outlets[0]?.id ?? null
}

const OWNER_PERMISSIONS: Record<Permission, boolean> = {
  pos: true,
  products: true,
  reports: true,
  settings: true,
}

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/**
 * Konteks sesi lengkap: siapa user ini, perannya apa, di organisasi mana.
 *
 * Dibungkus `cache()` supaya beberapa komponen dalam satu render tidak
 * memicu query berulang ke Supabase.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient()

  /**
   * `getClaims()`, BUKAN `getUser()`.
   *
   * Yang dibutuhkan di sini cuma dua hal dari user: id dan email — keduanya ada
   * di dalam token itu sendiri (`sub` dan `email`). `getUser()` mengambilnya
   * dengan bertanya ke server Auth, dan di halaman yang dirender server itu
   * berarti satu pulang-pergi jaringan tambahan sebelum query pertama bahkan
   * dimulai. `getClaims()` memverifikasi tanda tangan ES256-nya secara lokal,
   * jadi jawabannya sama sahnya tanpa menunggu jaringan.
   *
   * Bedanya yang nyata: token yang sudah diverifikasi tetap dipercaya sampai
   * kedaluwarsa (1 jam), jadi keanggotaan yang dicabut di tengah jam itu baru
   * menggigit di token berikutnya. Aman di sini — setiap halaman tetap tunduk
   * pada RLS, dan RLS membaca keanggotaan langsung dari database tiap query.
   */
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) return null

  const userId = claims.claims.sub
  const userEmail = claims.claims.email ?? ''

  const [{ data: profile }, { data: platformAdmin }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ])

  const fullName = profile?.full_name || userEmail.split('@')[0] || 'Pengguna'
  const base = {
    userId,
    email: userEmail,
    fullName,
    initials: initialsOf(fullName),
  }

  if (platformAdmin) {
    // Super Admin bisa "masuk sebagai klien". Yang menentukan bukan cookie-nya
    // sendiri, melainkan gabungan cookie + keanggotaan di platform_admins yang
    // baru saja diverifikasi di atas. Cookie tanpa hak platform tidak berarti apa-apa.
    const jar = await cookies()
    const targetOrg = jar.get(IMPERSONATION_COOKIE)?.value

    if (targetOrg) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, city, status, trial_ends_at')
        .eq('id', targetOrg)
        .maybeSingle()

      if (org) {
        const { data: outlets } = await supabase
          .from('outlets')
          .select('id, name, code, is_primary')
          .eq('organization_id', org.id)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('is_primary', { ascending: false })
          .order('name')

        const rows = outlets ?? []
        const jarOutlet = jar.get(OUTLET_COOKIE)?.value

        return {
          ...base,
          role: 'owner',
          // Hak tulis TIDAK ikut: policy tulis mensyaratkan keanggotaan nyata di
          // organization_members, dan Super Admin bukan anggota. Jadi mode ini
          // efektif hanya-baca — dan bannernya menyatakan itu terang-terangan.
          permissions: OWNER_PERMISSIONS,
          org: { ...org, trialEndsAt: org.trial_ends_at },
          outletId: pickOutlet(rows, jarOutlet, null),
          outlets: rows.map((o) => ({
            id: o.id,
            name: o.name,
            code: o.code,
            isPrimary: o.is_primary,
          })),
          memberId: null,
          organizations: [],
          impersonating: { adminName: fullName },
        }
      }
    }

    return {
      ...base,
      role: 'platform_admin',
      permissions: OWNER_PERMISSIONS,
      org: null,
      outletId: null,
      outlets: [],
      memberId: null,
      organizations: [],
    }
  }

  /**
   * SEMUA keanggotaan aktif, bukan yang pertama saja.
   *
   * Dulu `.limit(1)` — dan selama `register_store` mengunci satu akun satu toko,
   * itu benar. Sekarang satu akun boleh punya beberapa toko (dan sejak dulu bisa
   * diundang ke toko orang lain), jadi mengambil yang pertama berarti toko
   * kedua menjadi data yang tidak bisa dicapai siapa pun — termasuk pemiliknya.
   */
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(
      'id, role, permissions, default_outlet_id, organization_id, organizations(id, name, city, status, trial_ends_at)',
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('joined_at')

  const all = memberships ?? []

  // Login berhasil tapi belum jadi anggota organisasi mana pun — mis. undangan
  // belum diterima, atau keanggotaannya dinonaktifkan.
  if (all.length === 0) return null

  const jar = await cookies()

  /**
   * Toko yang sedang dibuka. Aturannya sama persis dengan outlet: cookie
   * divalidasi ulang terhadap keanggotaan NYATA, bukan dipercaya mentah-mentah.
   *
   * Di sini taruhannya lebih besar daripada outlet. Cookie toko yang dipercaya
   * begitu saja berarti seluruh halaman dirender dengan `organization_id` yang
   * tidak dimiliki user — RLS memang akan mengembalikan kosong dan setiap tulis
   * ditolak, tapi hasilnya aplikasi yang tampak rusak tanpa sebab, bukan
   * penolakan yang bisa dibaca. Cookie basi (keanggotaan dicabut, toko dihapus)
   * jatuh mulus ke toko pertama.
   */
  const wantedOrg = jar.get(ORG_COOKIE)?.value
  const member = all.find((m) => m.organization_id === wantedOrg) ?? all[0]

  const organizations = all
    .map((m) => {
      const o = m.organizations as unknown as { id: string; name: string; city: string | null } | null
      return o ? { id: o.id, name: o.name, city: o.city, role: m.role as AppRole } : null
    })
    .filter((o): o is { id: string; name: string; city: string | null; role: AppRole } => o !== null)

  const orgRow = member.organizations as unknown as {
    id: string
    name: string
    city: string | null
    status: string
    trial_ends_at: string | null
  } | null
  const org: SessionContext['org'] = orgRow
    ? { ...orgRow, trialEndsAt: orgRow.trial_ends_at }
    : null
  const rawPerms = (member.permissions ?? {}) as Record<string, boolean>

  const { data: outletRows } = await supabase
    .from('outlets')
    .select('id, name, code, is_primary')
    .eq('organization_id', member.organization_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('name')

  const rows = outletRows ?? []

  return {
    ...base,
    role: member.role as AppRole,
    permissions:
      member.role === 'owner'
        ? OWNER_PERMISSIONS
        : {
            pos: rawPerms.pos === true,
            products: rawPerms.products === true,
            reports: rawPerms.reports === true,
            settings: rawPerms.settings === true,
          },
    org,
    outletId: pickOutlet(rows, jar.get(OUTLET_COOKIE)?.value, member.default_outlet_id),
    outlets: rows.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      isPrimary: o.is_primary,
    })),
    memberId: member.id,
    organizations,
  }
})

/** Wajib login. Melempar ke halaman masuk kalau belum. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext()
  if (!ctx) redirect('/masuk')
  return ctx
}

/** Wajib punya izin modul tertentu. */
export async function requirePermission(perm: Permission): Promise<SessionContext> {
  const ctx = await requireSession()
  if (!ctx.permissions[perm]) redirect('/profil?akses=ditolak' as Route)
  return ctx
}

/** Wajib Super Admin. */
export async function requirePlatformAdmin(): Promise<SessionContext> {
  const ctx = await requireSession()
  if (ctx.role !== 'platform_admin') redirect('/beranda')
  return ctx
}

export const READ_ONLY_MESSAGE =
  'Mode lihat-saja: keluar dari mode Super Admin dulu untuk mengubah data toko ini.'

/**
 * Gerbang untuk aksi yang MENULIS.
 *
 * Saat Super Admin melihat toko klien, RLS memang menahan setiap perubahan —
 * tapi UPDATE yang tidak cocok policy mengembalikan "berhasil" dengan 0 baris
 * terpengaruh, bukan error. Akibatnya drawer tertutup seolah tersimpan padahal
 * tidak ada yang berubah.
 *
 * Sengaja TIDAK melempar: error yang dilempar dari Server Action tidak sampai
 * ke penangan hasil di komponen, jadi kegagalannya tetap tak terlihat. Pemanggil
 * memeriksa `blocked` lalu mengembalikan error bertipe miliknya sendiri.
 */
export async function requireWrite(
  perm: Permission,
): Promise<{ session: SessionContext; blocked: string | null }> {
  const session = await requirePermission(perm)
  return { session, blocked: session.impersonating ? READ_ONLY_MESSAGE : null }
}
