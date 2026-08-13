import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChangePasswordCard } from '@/components/domain/ChangePasswordCard'
import { PlatformSettingsForm } from '@/components/domain/PlatformSettingsForm'
import { requirePlatformAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pengaturan Platform | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PengaturanPlatformPage() {
  const session = await requirePlatformAdmin()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('platform_settings')
    .select(
      'platform_name, brand_tagline, support_email, support_phone, default_timezone, trial_days',
    )
    .maybeSingle()

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Pengaturan"
        subtitle="Konfigurasi umum platform TokoKu dan keamanan akun Super Admin."
      />

      <div className="section-title" style={{ marginTop: 0 }}>
        Keamanan Akun
      </div>
      {/* Ditaruh PALING ATAS, bukan di kaki halaman. Akun ini bisa membaca data
          seluruh toko klien, dan sandinya diserahkan ke pemilik project sebagai
          sandi bawaan — tugas pertama di halaman ini seharusnya menggantinya. */}
      <ChangePasswordCard />
      <p className="field-hint" style={{ marginTop: 8 }}>
        Masuk sebagai {session.email}. Akun ini bisa membaca data seluruh toko klien, jadi
        sandinya tidak boleh sama dengan sandi mana pun yang pernah dibagikan.
      </p>

      <div className="section-title">Identitas Platform</div>
      <PlatformSettingsForm
        value={{
          platformName: settings?.platform_name ?? 'TokoKu',
          brandTagline: settings?.brand_tagline ?? 'by Seawise Studio',
          supportEmail: settings?.support_email ?? '',
          supportPhone: settings?.support_phone ?? '',
          defaultTimezone: settings?.default_timezone ?? 'Asia/Makassar',
          trialDays: Number(settings?.trial_days ?? 14),
        }}
      />
    </>
  )
}
