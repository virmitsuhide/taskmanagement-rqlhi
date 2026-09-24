import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditMeeting, getCreatableMeetingTypes } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { updateMeetingAction } from '@/app/actions/meetings'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingForm } from '@/components/rapat/MeetingForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Meeting, AgendaItem, MeetingType } from '@/types'

export default async function EditRapatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const [meetingRes, agendaRes] = await Promise.all([
    supabase.from('meetings').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('agenda_items').select('*').eq('meeting_id', id).order('order_num'),
  ])

  if (!meetingRes.data) notFound()
  const meeting = meetingRes.data as Meeting

  if (!canEditMeeting(session.role, meeting.type)) redirect(`/rapat/${id}`)

  // Jenis tujuan yang boleh dipilih = yang boleh DIBUAT peran ini, ditambah
  // jenis rapat ini sendiri.
  //
  // Menambahkan jenis saat ini bukan sekadar kerapian. MEETING_EDIT.kumik
  // memuat para koor, sementara MEETING_CREATE.kumik tidak — jadi seorang koor
  // SD yang mengedit notulen kumik akan mendapati jenis aslinya absen dari
  // daftar, dan simpanan berikutnya diam-diam memindahkan rapat itu ke Koor SD.
  // Rapat berpindah tanpa ada yang menyentuh dropdown-nya.
  const movableTypes = [
    meeting.type as MeetingType,
    ...getCreatableMeetingTypes(session.role).filter(t => t !== meeting.type),
  ]

  const meetingWithAgenda = {
    ...meeting,
    agenda_items: (agendaRes.data ?? []) as AgendaItem[],
  }

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Edit Rapat"
        breadcrumbs={[
          { label: 'Rapat & Notulen', href: '/rapat' },
          { label: meeting.subject, href: `/rapat/${id}` },
          { label: 'Edit' },
        ]}
      />
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href={`/rapat/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
          </Button>
          <MeetingForm
            allowedTypes={movableTypes}
            action={updateMeetingAction}
            defaultValues={meetingWithAgenda}
            submitLabel="Simpan Perubahan"
          />
        </div>
      </div>
    </div>
  )
}
