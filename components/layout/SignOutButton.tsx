import { Icon } from '@/components/ui/icons'
import { signOut } from '@/app/(auth)/actions'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="icon-btn" type="submit" aria-label="Keluar" title="Keluar">
        <Icon name="logout" size={16} />
      </button>
    </form>
  )
}
