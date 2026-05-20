import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessNotes } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { NoteEditor } from './NoteEditor'
import type { PrivateNote } from '@/types'

export default async function NotesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessNotes(session.role)) redirect('/dashboard')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('private_notes')
    .select('*')
    .eq('user_id', session.userId)
    .order('updated_at', { ascending: false })

  const notes = (data ?? []) as PrivateNote[]

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Catatan Pribadi" />
      <div className="p-4 md:p-6 max-w-3xl">
        <p className="text-sm text-muted-foreground mb-6">
          Catatan ini hanya terlihat oleh Anda.
        </p>
        <NoteEditor notes={notes} />
      </div>
    </div>
  )
}
