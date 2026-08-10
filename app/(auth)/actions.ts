'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth'
import { homeFor } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error?: string }

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Email dan kata sandi wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Pesan Supabase berbahasa Inggris dan terlalu teknis untuk kasir.
    // Sengaja tidak membedakan "email tidak ada" dari "sandi salah" —
    // membedakannya membocorkan email mana yang terdaftar.
    const message =
      error.message.includes('Invalid login credentials')
        ? 'Email atau kata sandi salah.'
        : error.message.includes('Email not confirmed')
          ? 'Email belum dikonfirmasi. Cek kotak masuk Anda.'
          : 'Gagal masuk. Coba lagi sebentar lagi.'
    return { error: message }
  }

  const ctx = await getSessionContext()
  if (!ctx) {
    // Belum jadi anggota toko mana pun. Sebelum mengeluarkannya, cek undangan
    // yang menunggu: tanpa langkah ini penerima undangan terjebak — dia harus
    // login untuk menerima undangan, tapi login-nya justru menendang dia keluar.
    const { data: invite } = await supabase
      .from('invitations')
      .select('token')
      .ilike('email', email)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (invite) {
      revalidatePath('/', 'layout')
      redirect(`/undangan/${invite.token}` as Route)
    }

    // Tidak ada undangan. Bisa jadi dia mendaftar sendiri lalu konfirmasi email —
    // akunnya ada, tokonya belum. Menendangnya keluar di sini akan membuat
    // pendaftaran mandiri jadi jalan buntu.
    revalidatePath('/', 'layout')
    redirect('/daftar-toko')
  }

  revalidatePath('/', 'layout')
  redirect(homeFor(ctx.role, ctx.permissions))
}

/**
 * Alamat asal aplikasi untuk tautan yang dikirim lewat email.
 *
 * Dibaca dari header request, bukan dari satu variabel lingkungan, supaya
 * tautannya tetap benar di preview Vercel yang domainnya berganti tiap deploy.
 */
async function siteOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export type ResetRequestState = { error?: string; notice?: string }

/**
 * Langkah 1 reset kata sandi: kirim tautan ke email.
 *
 * Jawabannya sengaja sama untuk email terdaftar maupun tidak — sama seperti
 * `signIn` di atas. Membedakannya memberi tahu siapa pun yang mencoba, email
 * mana yang punya akun di toko ini.
 *
 * Yang TIDAK disembunyikan: kegagalan pengiriman yang sesungguhnya. Kalau SMTP
 * mati atau kuotanya habis, user berhak tahu — menjawab "cek email Anda" untuk
 * email yang tidak pernah terkirim membuatnya menunggu selamanya.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email.includes('@')) return { error: 'Masukkan alamat email yang benar.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/konfirmasi?next=/atur-sandi`,
  })

  if (error) {
    const m = error.message.toLowerCase()
    if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes')) {
      return { error: 'Terlalu banyak permintaan. Tunggu beberapa menit, lalu coba lagi.' }
    }
    return { error: 'Email gagal dikirim. Coba lagi sebentar lagi.' }
  }

  return {
    notice:
      'Kalau email itu terdaftar, tautan penggantian kata sandi sudah dikirim ke sana. ' +
      'Cek kotak masuk dan folder spam. Tautannya berlaku 1 jam.',
  }
}

export type NewPasswordState = { error?: string }

/**
 * Langkah 2 reset kata sandi: simpan sandi baru.
 *
 * Sesi yang dipakai di sini datang dari tautan email (lihat
 * app/auth/konfirmasi/route.ts), bukan dari login biasa. Karena itu setelah
 * sandi tersimpan sesinya ditutup dan user diminta masuk ulang: sekalian
 * membuktikan sandi barunya benar-benar bekerja, dan tidak meninggalkan sesi
 * hidup di perangkat yang mungkin bukan miliknya.
 */
export async function updatePassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < 8) return { error: 'Kata sandi minimal 8 karakter.' }
  if (password !== confirm) return { error: 'Ketikan kata sandi belum sama. Periksa lagi keduanya.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        'Tautannya sudah kedaluwarsa atau sudah pernah dipakai. Minta tautan baru lewat "Lupa kata sandi".',
    }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    const m = error.message.toLowerCase()
    const message = m.includes('weak password') || m.includes('password should')
      ? 'Kata sandi terlalu lemah. Campur huruf besar, huruf kecil, dan angka.'
      : m.includes('should be different') || m.includes('same as the old')
        ? 'Kata sandi barunya masih sama dengan yang lama. Pakai yang berbeda.'
        : 'Kata sandi gagal disimpan. Coba lagi sebentar lagi.'
    return { error: message }
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/masuk?pesan=sandi-diperbarui')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/masuk')
}

export type SignUpState = { error?: string; notice?: string }

/**
 * Pendaftaran toko mandiri.
 *
 * Dua langkah yang harus utuh: buat akun, lalu buat tokonya. Kalau langkah
 * kedua gagal, user punya akun tanpa toko — dan pesan errornya harus
 * menjelaskan itu, bukan berpura-pura semuanya beres.
 */
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const storeName = String(formData.get('storeName') ?? '').trim()
  const fullName = String(formData.get('fullName') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (storeName.length < 2) return { error: 'Nama toko minimal 2 huruf.' }
  if (fullName.length < 2) return { error: 'Nama Anda minimal 2 huruf.' }
  if (!email.includes('@')) return { error: 'Format email tidak valid.' }
  if (password.length < 8) return { error: 'Kata sandi minimal 8 karakter.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, pending_store_name: storeName, pending_store_city: city } },
  })

  if (error) {
    // Pesan Supabase berbahasa Inggris dan teknis. Diterjemahkan ke kalimat
    // yang bisa ditindaklanjuti pemilik warung.
    const m = error.message.toLowerCase()
    const message = m.includes('already registered')
      ? 'Email ini sudah terdaftar. Silakan masuk lewat tab sebelah.'
      : m.includes('is invalid') || m.includes('invalid format')
        ? 'Email ini ditolak. Pakai email aktif yang bisa menerima pesan — mis. Gmail.'
        : m.includes('weak password') || m.includes('password should')
          ? 'Kata sandi terlalu lemah. Campur huruf besar, huruf kecil, dan angka.'
          : m.includes('rate limit') || m.includes('too many')
            ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
            : 'Pendaftaran gagal. Coba lagi sebentar lagi.'
    return { error: message }
  }

  // Konfirmasi email menyala di project ini: akun terbuat tapi belum ada sesi,
  // jadi tokonya belum bisa dibuat sekarang.
  if (!data.session) {
    return {
      notice:
        'Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk untuk menyelesaikan pendaftaran toko.',
    }
  }

  const { error: rpcError } = await supabase.rpc('register_store', {
    p_name: storeName,
    p_city: city || undefined,
  })

  if (rpcError) {
    if (rpcError.message.includes('already_has_store')) {
      revalidatePath('/', 'layout')
      redirect('/beranda')
    }
    return {
      error:
        'Akun Anda berhasil dibuat, tapi tokonya gagal dibuat: ' +
        rpcError.message +
        '. Coba masuk lalu ulangi.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/beranda')
}
