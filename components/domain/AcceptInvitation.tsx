'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitation } from '@/app/(auth)/undangan/actions'
import { Icon } from '@/components/ui/icons'

const MESSAGES: Record<string, string> = {
  invalid: 'Tautan undangan tidak dikenali.',
  revoked: 'Undangan ini sudah dibatalkan.',
  already_accepted: 'Undangan ini sudah pernah diterima.',
  expired: 'Undangan ini sudah kedaluwarsa.',
}

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <>
      {error && (
        <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInvitation(token)
            if (res.status === 'accepted') {
              router.replace('/')
              router.refresh()
              return
            }
            setError(MESSAGES[res.status] ?? 'Gagal menerima undangan.')
          })
        }
      >
        {pending ? 'Memproses…' : 'Terima Undangan'}
      </button>
    </>
  )
}
