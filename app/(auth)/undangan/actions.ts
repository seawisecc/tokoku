'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function acceptInvitation(token: string): Promise<{ status: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (error) return { status: 'invalid' }

  const result = data as { status: string }
  if (result.status === 'accepted') revalidatePath('/', 'layout')
  return result
}
