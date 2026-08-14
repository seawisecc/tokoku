import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataError } from '@/components/domain/DataError'
import { LogoUploader } from '@/components/domain/LogoUploader'
import { StoreSettingsForm } from '@/components/domain/StoreSettingsForm'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pengaturan Toko | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PengaturanTokoPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('name, city, address, phone, email, low_stock_threshold, allow_negative_stock, logo_url, loyalty_enabled, loyalty_earn_per, loyalty_point_value, max_manual_discount_percent')
    .eq('id', session.org!.id)
    .single()

  return (
    <>
      <PageHeader eyebrow="Pengaturan" title="Informasi Toko" subtitle="Nama, alamat, logo, dan kebijakan stok." />
      {/* Borang TIDAK dirender kalau datanya gagal dibaca, dan ini yang paling
          mahal dari sepuluh halaman sejenis: isian yang tampil kosong lalu
          ditekan Simpan akan MENIMPA nama, alamat, dan seluruh kebijakan toko
          dengan nilai kosong. Layar yang salah baca berubah jadi data yang
          benar-benar rusak. */}
      {error || !org ? (
        <DataError apa="Informasi toko" />
      ) : (
        <>
        <LogoUploader logoUrl={org?.logo_url ?? null} storeName={org?.name ?? 'toko'} />
        <StoreSettingsForm
          initial={{
            name: org?.name ?? '',
            city: org?.city ?? '',
            address: org?.address ?? '',
            phone: org?.phone ?? '',
            email: org?.email ?? '',
            lowStockThreshold: org?.low_stock_threshold ?? 10,
            allowNegativeStock: org?.allow_negative_stock ?? false,
            loyaltyEnabled: org?.loyalty_enabled ?? false,
            loyaltyEarnPer: Number(org?.loyalty_earn_per ?? 10000),
            loyaltyPointValue: Number(org?.loyalty_point_value ?? 100),
            maxManualDiscountPercent: Number(org?.max_manual_discount_percent ?? 0),
          }}
        />
        </>
      )}
    </>
  )
}
