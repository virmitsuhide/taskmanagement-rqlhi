import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { getViewableMeetingTypes, canCreateMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingRowActions } from '@/components/rapat/MeetingRowActions'
import { MeetingMonthYearFilter } from '@/components/rapat/MeetingMonthYearFilter'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import type { Meeting, MeetingType } from '@/types'

const PAGE_SIZE = 10

const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatDate(d: string): string {
  const [y, mo, day] = d.split('-').map(Number)
  return `${day} ${MONTHS_LONG[mo - 1]} ${y}`
}

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string; month?: string; year?: string; page?: string }>
}

export default async function RapatPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const viewableTypes = getViewableMeetingTypes(session.role)
  const canCreate = viewableTypes.some(t => canCreateMeeting(session.role, t))
  const showActions = session.role === 'kepala_rq'

  const typeFilter: MeetingType | null =
    params.type && (viewableTypes as string[]).includes(params.type)
      ? (params.type as MeetingType)
      : null

  // Filter bulan & tahun → rentang tanggal
  const now = new Date()
  const yearParam = params.year ? parseInt(params.year, 10) : null
  let month = params.month ? parseInt(params.month, 10) : null
  if (month && (month < 1 || month > 12)) month = null
  let year = yearParam && !Number.isNaN(yearParam) ? yearParam : null
  if (month && !year) year = now.getFullYear() // pilih bulan tanpa tahun → tahun berjalan

  let dateStart: string | null = null
  let dateEnd: string | null = null
  if (year) {
    if (month) {
      const mm = String(month).padStart(2, '0')
      const lastDay = new Date(year, month, 0).getDate()
      dateStart = `${year}-${mm}-01`
      dateEnd = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
    } else {
      dateStart = `${year}-01-01`
      dateEnd = `${year}-12-31`
    }
  }

  const supabase = createServerClient()

  // Tahun yang tersedia untuk dropdown (dari rapat terlama s/d tahun ini)
  const { data: earliestRow } = await supabase
    .from('meetings').select('date').in('type', viewableTypes).order('date', { ascending: true }).limit(1).maybeSingle()
  const earliestYear = earliestRow?.date ? parseInt(earliestRow.date.slice(0, 4), 10) : now.getFullYear()
  const years: number[] = []
  for (let y = now.getFullYear(); y >= earliestYear; y--) years.push(y)

  // Count
  let countQuery = supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .in('type', typeFilter ? [typeFilter] : viewableTypes)
  if (query) countQuery = countQuery.ilike('subject', `%${query}%`)
  if (dateStart) countQuery = countQuery.gte('date', dateStart).lte('date', dateEnd!)
  const { count, error: countError } = await countQuery
  if (countError) console.error('[rapat] gagal menghitung jumlah rapat:', countError)
  const total = count ?? 0

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Data (10 terbaru per halaman, urut tanggal desc)
  let dbQuery = supabase
    .from('meetings')
    .select('*, creator:users!created_by(id, display_name)')
    .in('type', typeFilter ? [typeFilter] : viewableTypes)
  if (query) dbQuery = dbQuery.ilike('subject', `%${query}%`)
  if (dateStart) dbQuery = dbQuery.gte('date', dateStart).lte('date', dateEnd!)
  dbQuery = dbQuery.order('date', { ascending: false }).range(from, to)
  const { data, error } = await dbQuery
  if (error) console.error('[rapat] gagal memuat daftar rapat:', error)
  const meetings = (data ?? []) as Meeting[]

  // Query gagal ≠ tidak ada data. Dibedakan supaya pengguna tidak disuruh
  // mengubah filter padahal masalahnya ada di sisi sistem.
  const loadFailed = Boolean(error || countError)

  function chipHref(nextType: MeetingType | null): string {
    const p = new URLSearchParams()
    if (nextType) p.set('type', nextType)
    if (query) p.set('q', query)
    if (params.month) p.set('month', params.month)
    if (params.year) p.set('year', params.year)
    const qs = p.toString()
    return qs ? `/rapat?${qs}` : '/rapat'
  }

  // Alamat halaman ini sendiri — dipakai tombol "Muat ulang" pada state gagal.
  // Sengaja <a>, bukan <Link>, agar benar-benar request ulang ke server.
  const selfHref = chipHref(typeFilter)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rapat & Notulen" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-2xl font-bold leading-tight">Rapat &amp; Notulen</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loadFailed ? 'Data tidak dapat dimuat' : `${total} rapat · 10 terbaru per halaman`}
            </p>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/rapat/baru"><Plus className="h-4 w-4 mr-1" />Buat Rapat</Link>
            </Button>
          )}
        </div>

        {/* Pencarian + filter bulan/tahun */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Cari rapat berdasarkan subjek…" />
          </div>
          <MeetingMonthYearFilter years={years} />
        </div>

        {/* Filter jenis rapat */}
        {viewableTypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <ChipLink href={chipHref(null)} active={!typeFilter}>Semua</ChipLink>
            {viewableTypes.map(t => (
              <ChipLink key={t} href={chipHref(t)} active={typeFilter === t}>{MEETING_TYPE_LABELS[t]}</ChipLink>
            ))}
          </div>
        )}

        {/* Tiga kondisi dibedakan: query gagal, tidak ada hasil, dan ada hasil.
            Empty state dipicu oleh baris yang benar-benar tampil (bukan oleh `total`,
            yang berasal dari query count terpisah). */}
        {loadFailed ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive/60 mx-auto mb-3" />
            <p className="font-medium">Gagal memuat data rapat.</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Ini gangguan pada sistem, bukan karena filter yang Anda pilih. Silakan muat ulang halaman.
            </p>
            <a
              href={selfHref}
              className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />Muat ulang
            </a>
            <p className="text-xs text-muted-foreground mt-4">
              Jika berulang, laporkan ke admin sistem.
            </p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">Tidak ada rapat cocok.</p>
            <p className="text-sm text-muted-foreground mt-1">Ubah filter atau buat rapat baru.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-3 w-12">No</th>
                    <th className="py-2.5 px-3">Judul Rapat</th>
                    <th className="py-2.5 px-3 w-44">Tanggal</th>
                    {showActions && <th className="py-2.5 px-3 w-28 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m, i) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top">
                      <td className="py-3 px-3 text-muted-foreground tabular-nums">{from + i + 1}</td>
                      <td className="py-3 px-3">
                        <Link href={`/rapat/${m.id}`} className="font-medium hover:underline">{m.subject}</Link>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{MEETING_TYPE_LABELS[m.type]}</span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{formatDate(m.date)}</td>
                      {showActions && (
                        <td className="py-3 px-3">
                          <MeetingRowActions meetingId={m.id} subject={m.subject} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/rapat"
              searchParams={{
                type: typeFilter ?? undefined,
                q: query || undefined,
                month: params.month || undefined,
                year: params.year || undefined,
              }}
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
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border'
      }`}
    >
      {children}
    </Link>
  )
}
