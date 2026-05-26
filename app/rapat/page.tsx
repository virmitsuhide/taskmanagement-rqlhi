import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { getViewableMeetingTypes, canCreateMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingCard } from '@/components/rapat/MeetingCard'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import type { Meeting, MeetingType } from '@/types'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function RapatPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { q } = await searchParams
  const query = (q ?? '').trim()

  const viewableTypes = getViewableMeetingTypes(session.role)
  const canCreate = viewableTypes.some(t => canCreateMeeting(session.role, t))

  const supabase = createServerClient()
  let dbQuery = supabase
    .from('meetings')
    .select('*, creator:users!meetings_created_by_fkey(id, display_name)')
    .in('type', viewableTypes)
  if (query) dbQuery = dbQuery.ilike('subject', `%${query}%`)
  const { data } = await dbQuery.order('date', { ascending: false })

  const meetings = (data ?? []) as Meeting[]

  const grouped = viewableTypes.reduce<Record<MeetingType, Meeting[]>>((acc, type) => {
    acc[type] = meetings.filter(m => m.type === type)
    return acc
  }, {} as Record<MeetingType, Meeting[]>)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rapat & Notulen" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-2xl font-bold leading-tight">Rapat & Notulen</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {meetings.length} rapat tersedia · {viewableTypes.length} jenis dapat diakses
            </p>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/rapat/baru"><Plus className="h-4 w-4 mr-1" />Buat Rapat</Link>
            </Button>
          )}
        </div>

        <div>
          <SearchInput placeholder="Cari rapat berdasarkan subjek…" />
          {query && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Menampilkan hasil untuk <span className="font-medium">&ldquo;{query}&rdquo;</span>
            </p>
          )}
        </div>

        {meetings.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">Belum ada rapat.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Buat rapat pertama untuk mulai mencatat notulen.
            </p>
            {canCreate && (
              <Button asChild size="sm" className="mt-4">
                <Link href="/rapat/baru"><Plus className="h-4 w-4 mr-1" />Buat Rapat Pertama</Link>
              </Button>
            )}
          </div>
        ) : (
          viewableTypes.map(type => {
            const typeMeetings = grouped[type] ?? []
            if (typeMeetings.length === 0) return null
            return (
              <section key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {MEETING_TYPE_LABELS[type]}
                  </h2>
                  <span className="text-xs text-muted-foreground/70">· {typeMeetings.length}</span>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <div className="space-y-2">
                  {typeMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
