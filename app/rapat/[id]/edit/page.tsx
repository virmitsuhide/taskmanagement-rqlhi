import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditMeeting } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { updateMeetingAction } from '@/app/actions/meetings'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingForm } from '@/components/rapat/MeetingForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Meeting, AgendaItem } from '@/types'

export default async function EditRapatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const [meetingRes, agendaRes] = await Promise.all([
    supabase.from('meetings').select('*').eq('id', id).single(),
    supabase.from('agenda_items').select('*').eq('meeting_id', id).order('order_num'),
  ])

  if (!meetingRes.data) notFound()
  const meeting = meetingRes.data as Meeting

  if (!canEditMeeting(session.role, meeting.type)) redirect(`/rapat/${id}`)

  const meetingWithAgenda = {
    ...meeting,
    agenda_items: (agendaRes.data ?? []) as AgendaItem[],
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Edit Rapat" />
      <div className="p-4 md:p-6 max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href={`/rapat/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
        </Button>
        <MeetingForm
          allowedTypes={[meeting.type]}
          action={updateMeetingAction}
          defaultValues={meetingWithAgenda}
          submitLabel="Simpan Perubahan"
        />
      </div>
    </div>
  )
}
