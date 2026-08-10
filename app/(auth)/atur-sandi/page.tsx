import type { Metadata } from 'next'
import { NewPasswordForm } from '@/components/domain/NewPasswordForm'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kata Sandi Baru — TokoKu' }

/**
 * Halaman ganti kata sandi setelah tautan email diklik.
 *
 * Sesinya sudah dipasang oleh app/auth/konfirmasi/route.ts sebelum sampai ke
 * sini — halaman ini hanya memastikan sesi itu benar ada. Sengaja TIDAK
 * mengarahkan user bersesi ke beranda seperti /masuk: user yang sampai ke sini
 * memang sedang punya sesi (sesi pemulihan), dan mengusirnya ke beranda justru
 * membuat penggantian sandi mustahil diselesaikan.
 */
export default async function AturSandiPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="auth-single">
      <div className="auth-container">
        <NewPasswordForm valid={!!user} email={user?.email ?? null} />
      </div>
    </div>
  )
}
