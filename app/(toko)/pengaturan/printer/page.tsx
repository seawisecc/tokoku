import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrinterSettingsForm, type PrinterValues } from '@/components/domain/PrinterSettingsForm'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Struk & Printer — TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PengaturanPrinterPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()

  const [{ data: outlet }, { data: org }] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, receipt_settings')
      .eq('id', session.outletId!)
      .single(),
    supabase.from('organizations').select('name, logo_url').eq('id', session.org!.id).single(),
  ])

  const rs = (outlet?.receipt_settings ?? {}) as Partial<{
    paper: string
    header: string
    footer: string
    show_logo: boolean
    auto_print: boolean
  }>

  const initial: PrinterValues = {
    paper: rs.paper === '80mm' ? '80mm' : '58mm',
    header: rs.header ?? '',
    footer: rs.footer ?? 'Terima kasih telah berbelanja',
    showLogo: rs.show_logo ?? true,
    autoPrint: rs.auto_print ?? true,
  }

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Struk & Printer"
        subtitle={`Outlet ${outlet?.name ?? ''}`}
      />
      <PrinterSettingsForm
        outletId={outlet!.id}
        storeName={org?.name ?? 'Toko'}
        logoUrl={org?.logo_url ?? null}
        initial={initial}
      />
    </>
  )
}
