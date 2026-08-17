import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewFinanceNotes, canManageFinanceNotes } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { NoteEditor } from './NoteEditor'
import type { PrivateNote } from '@/types'

export default async function NotesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinanceNotes(session.role)) redirect('/dashboard')

  const canManage = canManageFinanceNotes(session.role)

  // Buku catatan ini milik fungsi keuangan, bukan per-user: isinya catatan
  // yang ditulis akun ber-role bendahara, sehingga kepala RQ ikut melihat
  // buku yang sama (read-only) dan bukan catatannya sendiri yang kosong.
  const supabase = createServerClient()
  const { data: bendaharaUsers } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'bendahara')

  const bendaharaIds = (bendaharaUsers ?? []).map(u => u.id as string)

  const { data } = bendaharaIds.length
    ? await supabase
        .from('private_notes')
        .select('*')
        .in('user_id', bendaharaIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const notes = (data ?? []) as PrivateNote[]

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Catatan Keuangan Bendahara"
      />
      <div className="p-4 md:p-6 max-w-3xl">
        <p className="text-sm text-muted-foreground mb-6">
          {canManage
            ? 'Catatan keuangan ini hanya terlihat oleh Bendahara dan Kepala RQ.'
            : 'Catatan keuangan milik Bendahara — Anda dapat membacanya, tetapi tidak mengubahnya.'}
        </p>
        <NoteEditor notes={notes} canManage={canManage} />
      </div>
    </div>
  )
}
