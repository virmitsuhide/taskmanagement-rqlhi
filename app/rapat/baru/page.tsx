import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canCreateMeeting, getViewableMeetingTypes } from '@/lib/auth/permissions'
import { createMeetingAction } from '@/app/actions/meetings'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingForm } from '@/components/rapat/MeetingForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { MeetingType } from '@/types'

export default async function BuatRapatPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const viewable = getViewableMeetingTypes(session.role)
  const creatableTypes = viewable.filter(t => canCreateMeeting(session.role, t)) as MeetingType[]

  if (creatableTypes.length === 0) redirect('/rapat')

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Buat Rapat Baru" />
      <div className="p-4 md:p-6 max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/rapat"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
        </Button>
        <MeetingForm allowedTypes={creatableTypes} action={createMeetingAction} submitLabel="Buat Rapat" />
      </div>
    </div>
  )
}
