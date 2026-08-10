'use client'

import { cn } from '@/lib/format'

export function CategoryPills({
  categories,
  active,
  onChange,
}: {
  categories: string[]
  active: string
  onChange: (c: string) => void
}) {
  return (
    <div className="cat-pills">
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(active === c && 'active')}
          onClick={() => onChange(c)}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
