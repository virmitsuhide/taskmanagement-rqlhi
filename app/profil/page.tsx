import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ProfileForm } from './ProfileForm'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { User } from '@/types'

export default async function ProfilPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('users')
    .select('id, username, role, display_name, email, can_change_password')
    .eq('id', session.userId)
    .single()

  if (!data) redirect('/login')
  const user = data as User

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Profil" />
      <div className="p-4 md:p-6 max-w-md">
        <div className="mb-6 p-4 rounded-lg border bg-muted/30">
          <p className="text-sm font-medium">{user.display_name}</p>
          <p className="text-xs text-muted-foreground">@{user.username}</p>
          <span className="inline-block mt-2 text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <ProfileForm user={user} />
      </div>
    </div>
  )
}
