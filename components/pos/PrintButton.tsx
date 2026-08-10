'use client'

import { Icon } from '@/components/ui/icons'

export function PrintButton({ label = 'Cetak Struk' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-block" onClick={() => window.print()}>
      <Icon name="printer" size={15} /> {label}
    </button>
  )
}
