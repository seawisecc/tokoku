import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { StoreSettingsForm } from '@/components/domain/StoreSettingsForm'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pengaturan Toko — TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PengaturanTokoPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('name, city, address, phone, email, low_stock_threshold, allow_negative_stock')
    .eq('id', session.org!.id)
    .single()

  return (
    <>
      <PageHeader eyebrow="Pengaturan" title="Informasi Toko" subtitle="Nama, alamat, dan kebijakan stok." />
      <StoreSettingsForm
        initial={{
          name: org?.name ?? '',
          city: org?.city ?? '',
          address: org?.address ?? '',
          phone: org?.phone ?? '',
          email: org?.email ?? '',
          lowStockThreshold: org?.low_stock_threshold ?? 10,
          allowNegativeStock: org?.allow_negative_stock ?? false,
        }}
      />
    </>
  )
}
