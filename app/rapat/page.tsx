import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { getViewableMeetingTypes, canCreateMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingCard } from '@/components/rapat/MeetingCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { Meeting, MeetingType } from '@/types'

export default async function RapatPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const viewableTypes = getViewableMeetingTypes(session.role)
  const canCreate = viewableTypes.some(t => canCreateMeeting(session.role, t))

  const supabase = createServerClient()
  const { data } = await supabase
    .from('meetings')
    .select('*, creator:users!meetings_created_by_fkey(id, display_name)')
    .in('type', viewableTypes)
    .order('date', { ascending: false })

  const meetings = (data ?? []) as Meeting[]

  const grouped = viewableTypes.reduce<Record<MeetingType, Meeting[]>>((acc, type) => {
    acc[type] = meetings.filter(m => m.type === type)
    return acc
  }, {} as Record<MeetingType, Meeting[]>)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rapat & Notulen" />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{meetings.length} rapat ditemukan</p>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/rapat/baru"><Plus className="h-4 w-4 mr-1" />Buat Rapat</Link>
            </Button>
          )}
        </div>

        {viewableTypes.map(type => {
          const typeMeetings = grouped[type] ?? []
          if (typeMeetings.length === 0) return null
          return (
            <section key={type}>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                {MEETING_TYPE_LABELS[type]}
              </h2>
              <div className="space-y-2">
                {typeMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
              </div>
            </section>
          )
        })}

        {meetings.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p>Belum ada rapat.</p>
            {canCreate && (
              <Button asChild size="sm" className="mt-4">
                <Link href="/rapat/baru">Buat Rapat Pertama</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
