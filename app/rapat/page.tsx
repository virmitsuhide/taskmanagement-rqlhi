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
import { Pagination } from '@/components/ui/pagination'
import type { Meeting, MeetingType } from '@/types'

const PAGE_SIZE = 15

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>
}

export default async function RapatPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const viewableTypes = getViewableMeetingTypes(session.role)
  const canCreate = viewableTypes.some(t => canCreateMeeting(session.role, t))

  const typeFilter: MeetingType | null =
    params.type && (viewableTypes as string[]).includes(params.type)
      ? (params.type as MeetingType)
      : null

  const supabase = createServerClient()

  // Count for pagination
  let countQuery = supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .in('type', typeFilter ? [typeFilter] : viewableTypes)
  if (query) countQuery = countQuery.ilike('subject', `%${query}%`)
  const { count } = await countQuery
  const total = count ?? 0

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Use grouped view only when: no type filter, no search, no pagination beyond page 1
  const useGrouped = !typeFilter && !query && safePage === 1

  let dbQuery = supabase
    .from('meetings')
    .select('*, creator:users!meetings_created_by_fkey(id, display_name)')
    .in('type', typeFilter ? [typeFilter] : viewableTypes)
  if (query) dbQuery = dbQuery.ilike('subject', `%${query}%`)
  dbQuery = dbQuery.order('date', { ascending: false })
  if (!useGrouped) dbQuery = dbQuery.range(from, to)
  const { data } = await dbQuery

  const meetings = (data ?? []) as Meeting[]

  const grouped = viewableTypes.reduce<Record<MeetingType, Meeting[]>>((acc, type) => {
    acc[type] = meetings.filter(m => m.type === type)
    return acc
  }, {} as Record<MeetingType, Meeting[]>)

  function chipHref(nextType: MeetingType | null): string {
    const p = new URLSearchParams()
    if (nextType) p.set('type', nextType)
    if (query) p.set('q', query)
    const qs = p.toString()
    return qs ? `/rapat?${qs}` : '/rapat'
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rapat & Notulen" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-2xl font-bold leading-tight">Rapat & Notulen</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} rapat tersedia · {viewableTypes.length} jenis dapat diakses
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

        {/* Type filter chips */}
        {viewableTypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <ChipLink href={chipHref(null)} active={!typeFilter}>Semua</ChipLink>
            {viewableTypes.map(t => (
              <ChipLink key={t} href={chipHref(t)} active={typeFilter === t}>
                {MEETING_TYPE_LABELS[t]}
              </ChipLink>
            ))}
          </div>
        )}

        {total === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">{query ? 'Tidak ada rapat cocok.' : 'Belum ada rapat.'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {query ? 'Coba kata kunci lain.' : 'Buat rapat pertama untuk mulai mencatat notulen.'}
            </p>
            {canCreate && !query && (
              <Button asChild size="sm" className="mt-4">
                <Link href="/rapat/baru"><Plus className="h-4 w-4 mr-1" />Buat Rapat Pertama</Link>
              </Button>
            )}
          </div>
        ) : useGrouped ? (
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
        ) : (
          <>
            <div className="space-y-2">
              {meetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/rapat"
              searchParams={{ type: typeFilter ?? undefined, q: query || undefined }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function ChipLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border'
      }`}
    >
      {children}
    </Link>
  )
}
