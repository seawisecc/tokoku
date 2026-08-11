import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { requirePlatformAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pengaturan Platform | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PengaturanPlatformPage() {
  await requirePlatformAdmin()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('platform_name, brand_tagline, support_email, default_timezone, trial_days')
    .maybeSingle()

  return (
    <>
      <PageHeader eyebrow="Platform" title="Pengaturan" subtitle="Konfigurasi umum platform TokoKu." />
      <div className="card">
        <div className="field">
          <label htmlFor="pname">Nama Platform</label>
          <input id="pname" defaultValue={settings?.platform_name ?? 'TokoKu'} readOnly />
        </div>
        <div className="field">
          <label htmlFor="tagline">Tagline Brand</label>
          <input id="tagline" defaultValue={settings?.brand_tagline ?? 'by Seawise Studio'} readOnly />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="email">Email Support</label>
            <input id="email" defaultValue={settings?.support_email ?? ''} readOnly />
          </div>
          <div className="field">
            <label htmlFor="tz">Zona Waktu</label>
            <input id="tz" defaultValue={settings?.default_timezone ?? ''} readOnly />
          </div>
        </div>
        <button className="btn btn-dark" type="button" disabled title="Menyusul di fase 7">
          Simpan Perubahan
        </button>
      </div>
    </>
  )
}
