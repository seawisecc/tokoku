import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/domain/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Lupa Kata Sandi | TokoKu' }

export default function LupaSandiPage() {
  return (
    <div className="auth-single">
      <div className="auth-container">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
