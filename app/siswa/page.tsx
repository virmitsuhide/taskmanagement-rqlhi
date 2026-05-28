import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageStudents, canViewStudents, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { Plus, Users } from 'lucide-react'
import type { Jenjang, Student, Halaqoh } from '@/types'

const PAGE_SIZE = 24

interface PageProps {
  searchParams: Promise<{ q?: string; jenjang?: string; halaqoh?: string; page?: string }>
}

interface StudentRow extends Pick<Student, 'id' | 'full_name' | 'nis' | 'jenjang' | 'kelas' | 'gender' | 'is_active'> {
  halaqoh: Pick<Halaqoh, 'id' | 'name'> | null
}

export default async function SiswaListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewStudents(session.role)) redirect('/dashboard')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const jenjangFilter = params.jenjang as Jenjang | undefined
  const halaqohFilter = params.halaqoh
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const allowed = getManageableJenjang(session.role)
  const viewableJenjang: Jenjang[] = ['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(session.role)
    ? ['paud', 'sd', 'smp', 'sma']
    : allowed
  const canCreate = allowed.length > 0

  const supabase = createServerClient()

  let q = supabase
    .from('students')
    .select('id, full_name, nis, jenjang, kelas, gender, is_active, halaqoh:halaqoh(id, name)', { count: 'exact' })
    .order('full_name')

  if (viewableJenjang.length > 0) {
    q = q.in('jenjang', viewableJenjang)
  }
  if (jenjangFilter && viewableJenjang.includes(jenjangFilter)) {
    q = q.eq('jenjang', jenjangFilter)
  }
  if (halaqohFilter) q = q.eq('halaqoh_id', halaqohFilter)
  if (query) q = q.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, count } = await q.range(from, to)
  const students = (data ?? []) as unknown as StudentRow[]
  const total = count ?? 0

  // Counter per jenjang untuk chip
  const { data: jenjangCounts } = await supabase
    .from('students')
    .select('jenjang')
    .in('jenjang', viewableJenjang)
  const countMap = new Map<Jenjang, number>()
  for (const row of jenjangCounts ?? []) {
    countMap.set(row.jenjang as Jenjang, (countMap.get(row.jenjang as Jenjang) ?? 0) + 1)
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Siswa" showBack />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Siswa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} siswa total
              {jenjangFilter && ` · jenjang ${JENJANG_LABELS[jenjangFilter]}`}
            </p>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/siswa/baru"><Plus className="h-4 w-4 mr-1" />Tambah Siswa</Link>
            </Button>
          )}
        </div>

        <div className="mb-3">
          <SearchInput placeholder="Cari nama atau NIS..." />
        </div>

        {/* Jenjang chips */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <FilterChip href={searchHref(query, undefined, halaqohFilter)} active={!jenjangFilter}>
            Semua <span className="opacity-60 ml-1">({total})</span>
          </FilterChip>
          {viewableJenjang.map(j => (
            <FilterChip
              key={j}
              href={searchHref(query, j, halaqohFilter)}
              active={jenjangFilter === j}
            >
              {JENJANG_LABELS[j]} <span className="opacity-60 ml-1">({countMap.get(j) ?? 0})</span>
            </FilterChip>
          ))}
        </div>

        {students.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">Tidak ada siswa</p>
            <p className="text-xs text-muted-foreground mt-1">
              {query ? `Tidak ada hasil untuk "${query}"` : 'Mulai dengan menambah siswa baru'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {students.map(s => (
                <Link
                  key={s.id}
                  href={`/siswa/${s.id}`}
                  className={`rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors ${
                    !s.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                      {s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {JENJANG_LABELS[s.jenjang]}
                        {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.halaqoh?.name ?? <em>tanpa halaqoh</em>}
                      </p>
                    </div>
                  </div>
                  {!s.is_active && (
                    <p className="text-[10px] text-amber-600 mt-2">⚠ Nonaktif</p>
                  )}
                </Link>
              ))}
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/siswa"
              searchParams={{
                q: query || undefined,
                jenjang: jenjangFilter || undefined,
                halaqoh: halaqohFilter || undefined,
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function searchHref(q: string, jenjang?: Jenjang, halaqoh?: string): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (jenjang) p.set('jenjang', jenjang)
  if (halaqoh) p.set('halaqoh', halaqoh)
  const qs = p.toString()
  return qs ? `/siswa?${qs}` : '/siswa'
}

function FilterChip({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-muted-foreground hover:text-foreground border-border'
      }`}
    >
      {children}
    </Link>
  )
}
