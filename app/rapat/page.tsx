import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { getViewableMeetingTypes, canCreateMeeting, canViewPapanRapat, canPurgeMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { bacaStatusNotulen, getMeetingRowStats, getOpenFollowUps, type MeetingRowStats, type OpenFollowUp } from '@/lib/data/rapat-extra'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MeetingRowActions } from '@/components/rapat/MeetingRowActions'
import { MeetingMonthYearFilter } from '@/components/rapat/MeetingMonthYearFilter'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen, AlertTriangle, RefreshCw, Trash2, Kanban, ChevronRight, Clock, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import type { Meeting, MeetingType } from '@/types'

const PAGE_SIZE = 10

const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/**
 * Membungkus nilai untuk dipakai di dalam .or() PostgREST.
 *
 * PostgREST memisah argumen or() dengan koma dan membaca tanda kurung sebagai
 * sintaks. Tanpa dikutip, pencarian "rapat, evaluasi" akan pecah jadi dua
 * syarat yang tidak sah dan seluruh query gagal — bukan sekadar tidak
 * menemukan apa-apa.
 */
function orArg(raw: string): string {
  // JSON.stringify kebetulan menghasilkan persis bentuk yang diminta PostgREST:
  // dikutip ganda, dengan kutip dan garis miring terbalik di dalamnya di-escape.
  return JSON.stringify(raw)
}


const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** Bagian-bagian tanggal 'YYYY-MM-DD' tanpa pergeseran zona waktu. */
function dateParts(d: string) {
  const [y, mo, day] = d.split('-').map(Number)
  const weekday = WEEKDAYS_SHORT[new Date(y, mo - 1, day).getDay()]
  return { y, mo, day, weekday, monthKey: `${y}-${String(mo).padStart(2, '0')}`, monthLabel: `${MONTHS_LONG[mo - 1]} ${y}` }
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
    .from('meetings').select('date').is('deleted_at', null).in('type', viewableTypes).order('date', { ascending: true }).limit(1).maybeSingle()
  const earliestYear = earliestRow?.date ? parseInt(earliestRow.date.slice(0, 4), 10) : now.getFullYear()
  const years: number[] = []
  for (let y = now.getFullYear(); y >= earliestYear; y--) years.push(y)

  // Pencarian menjangkau isi notulen, bukan cuma judulnya. Orang mengingat
  // rapat lewat apa yang dibahas ("seragam", "tasmi'"), bukan lewat subjek
  // yang kerap hanya berbunyi "Rapat Bulanan".
  //
  // Dua langkah, bukan satu join: PostgREST tidak bisa menyaring baris induk
  // berdasarkan isi tabel anak sekaligus menghitung totalnya dengan
  // head:true. Jadi id rapat yang agendanya cocok dikumpulkan dulu, lalu
  // dipakai sebagai syarat OR di kedua query di bawah.
  let agendaMatchIds: string[] = []
  if (query) {
    const { data: hits } = await supabase
      .from('agenda_items')
      .select('meeting_id')
      .or(`discussion.ilike.${orArg(`%${query}%`)},follow_up.ilike.${orArg(`%${query}%`)}`)
    agendaMatchIds = [...new Set((hits ?? []).map(h => h.meeting_id).filter(Boolean))]
  }

  // Judul ATAU isi — pencarian tidak semestinya menghukum orang yang mengingat
  // kata dari sisi yang salah.
  const searchOr = query
    ? [
        `subject.ilike.${orArg(`%${query}%`)}`,
        ...(agendaMatchIds.length ? [`id.in.(${agendaMatchIds.join(',')})`] : []),
      ].join(',')
    : null

  // Count
  let countQuery = supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('type', typeFilter ? [typeFilter] : viewableTypes)
  if (searchOr) countQuery = countQuery.or(searchOr)
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
    .is('deleted_at', null)
    .in('type', typeFilter ? [typeFilter] : viewableTypes)
  if (searchOr) dbQuery = dbQuery.or(searchOr)
  if (dateStart) dbQuery = dbQuery.gte('date', dateStart).lte('date', dateEnd!)
  dbQuery = dbQuery.order('date', { ascending: false }).range(from, to)
  const { data, error } = await dbQuery
  if (error) console.error('[rapat] gagal memuat daftar rapat:', error)
  const meetings = (data ?? []) as Meeting[]

  // Query gagal ≠ tidak ada data. Dibedakan supaya pengguna tidak disuruh
  // mengubah filter padahal masalahnya ada di sisi sistem.
  const loadFailed = Boolean(error || countError)

  // Ringkasan notulen & tindak lanjut untuk baris yang tampil (satu batch),
  // dan kartu "Tindak lanjut terbuka" lintas rapat yang boleh dilihat.
  const [rowStats, openFU] = await Promise.all([
    getMeetingRowStats(meetings.map(m => m.id), Object.fromEntries(meetings.map(m => [m.id, bacaStatusNotulen(m)]))),
    getOpenFollowUps(viewableTypes, 5),
  ])

  const bolehLihatSampah = canPurgeMeeting(session.role)
  const { count: trashCount } = bolehLihatSampah
    ? await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
    : { count: 0 }

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

  // Kelompokkan rapat di halaman ini per bulan (urutan sudah tanggal menurun).
  const groups: { key: string; label: string; items: Meeting[] }[] = []
  for (const m of meetings) {
    const { monthKey, monthLabel } = dateParts(m.date)
    const last = groups[groups.length - 1]
    if (last && last.key === monthKey) last.items.push(m)
    else groups.push({ key: monthKey, label: monthLabel, items: [m] })
  }

  const filterBits: string[] = []
  if (typeFilter) filterBits.push(`jenis ${MEETING_TYPE_LABELS[typeFilter]}`)
  if (month && year) filterBits.push(`${MONTHS_LONG[month - 1]} ${year}`)
  else if (year) filterBits.push(`tahun ${year}`)
  if (query) filterBits.push(`cocok dengan “${query}”`)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rapat & Notulen" ownH1 />
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Kolaborasi · rapat &amp; notulen</p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[34px]">
              {loadFailed ? 'Data rapat tidak dapat dimuat.' : (
                <>
                  {total} rapat {filterBits.length ? 'ditemukan' : 'tercatat'}
                  {filterBits.length > 0 ? <> — <i>{filterBits.join(', ')}.</i></>
                    : openFU.total > 0 && <> — <i>{openFU.total} tindak lanjut terbuka.</i></>}
                </>
              )}
            </h1>
            {!loadFailed && <p className="mt-1 text-sm text-muted-foreground">10 terbaru per halaman</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewPapanRapat(session.role) && (
              <Button asChild size="sm" variant="outline">
                <Link href="/rapat/papan"><Kanban className="mr-1 h-4 w-4" />Papan rapat</Link>
              </Button>
            )}
            {bolehLihatSampah && (trashCount ?? 0) > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link href="/rapat/sampah">
                  <Trash2 className="mr-1 h-4 w-4" />Keranjang ({trashCount})
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild size="sm">
                <Link href="/rapat/baru"><Plus className="mr-1 h-4 w-4" />Buat rapat</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Filter jenis rapat + pencarian + bulan/tahun */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {viewableTypes.length > 1 && (
            <nav aria-label="Jenis rapat" className="flex flex-wrap gap-1.5">
              <ChipLink href={chipHref(null)} active={!typeFilter}>Semua</ChipLink>
              {viewableTypes.map(t => (
                <ChipLink key={t} href={chipHref(t)} active={typeFilter === t}>{MEETING_TYPE_LABELS[t]}</ChipLink>
              ))}
            </nav>
          )}
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <div className="min-w-[200px] flex-1 lg:w-72 lg:flex-none">
              <SearchInput placeholder="Cari subjek, pembahasan, tindak lanjut" />
            </div>
            <MeetingMonthYearFilter years={years} />
          </div>
        </div>

        {/* Tiga kondisi dibedakan: query gagal, tidak ada hasil, dan ada hasil.
            Empty state dipicu oleh baris yang benar-benar tampil (bukan oleh `total`,
            yang berasal dari query count terpisah). */}
        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-8">
        {loadFailed ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive-wash py-16 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
            <p className="font-medium">Gagal memuat data rapat.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Ini gangguan pada sistem, bukan karena filter yang Anda pilih. Silakan muat ulang halaman.
            </p>
            <a
              href={selfHref}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />Muat ulang
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Jika berulang, laporkan ke admin sistem.
            </p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">Tidak ada rapat cocok.</p>
            <p className="mt-1 text-sm text-muted-foreground">Ubah filter atau buat rapat baru.</p>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {groups.map(g => (
                <section key={g.key} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-baseline justify-between gap-3 border-b px-5 py-3.5">
                    <h2 className="font-heading text-[21px]">{g.label}</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">{g.items.length} rapat</span>
                  </div>
                  <ul>
                    {g.items.map(m => {
                      const d = dateParts(m.date)
                      const hadir = m.participants?.length ?? 0
                      const izin = m.peserta_izin?.length ?? 0
                      return (
                        <li key={m.id} className="flex items-center gap-2 border-b px-3 transition-colors last:border-0 hover:bg-muted/30 sm:px-5">
                          <Link href={`/rapat/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="flex h-[52px] w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted/70">
                              <span className="text-[10.5px] font-bold uppercase tracking-wide text-primary">{d.weekday}</span>
                              <span className="font-heading text-[22px] leading-none">{d.day}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14.5px] font-bold leading-snug">{m.subject}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="rounded-full bg-primary-wash px-2 py-px text-[11px] font-semibold text-primary">{MEETING_TYPE_LABELS[m.type]}</span>
                                {m.start_time && (
                                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{m.start_time.slice(0, 5)}{m.end_time ? `–${m.end_time.slice(0, 5)}` : ''}</span>
                                )}
                                {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                                {(hadir > 0 || izin > 0) && (
                                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{hadir} hadir{izin > 0 ? ` · ${izin} izin` : ''}</span>
                                )}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                                <FollowUpProgress s={rowStats[m.id]} />
                                <NotulenChip s={rowStats[m.id]} />
                              </span>
                            </span>
                            <span className="hidden w-[170px] shrink-0 text-[12.5px] text-muted-foreground md:block">
                              <FollowUpProgress s={rowStats[m.id]} />
                            </span>
                            <span className="hidden w-[150px] shrink-0 md:block">
                              <NotulenChip s={rowStats[m.id]} />
                            </span>
                            {!showActions && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />}
                          </Link>
                          {showActions && (
                            <div className="shrink-0">
                              <MeetingRowActions meetingId={m.id} subject={m.subject} />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
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
        <aside className="flex flex-col gap-5 lg:col-span-4">
          {!loadFailed && (
            <OpenFollowUpCard
              items={openFU.items}
              total={openFU.total}
              moreHref={canViewPapanRapat(session.role) ? '/rapat/papan' : null}
            />
          )}
        </aside>
        </div>
      </div>
    </div>
  )
}

function FollowUpProgress({ s }: { s: MeetingRowStats | undefined }) {
  if (!s || s.tindakLanjut === 0) return <span>belum ada tindak lanjut</span>
  const semua = s.tindakLanjutSelesai === s.tindakLanjut
  return (
    <span className={cn('tabular-nums', semua && 'text-success')}>
      {s.tindakLanjutSelesai}/{s.tindakLanjut} tindak lanjut selesai
    </span>
  )
}

/**
 * Status notulen. Dengan migrasi 0108: belum diisi (tanpa poin) → Draf notulen
 * → Notulen terbit → Selesai (terbit dan semua tindak lanjut selesai).
 * Sebelum migrasi (status null) tetap: belum diisi / terisi · N poin / Selesai.
 */
function NotulenChip({ s }: { s: MeetingRowStats | undefined }) {
  const poin = s?.poin ?? 0
  const status = s?.notulenStatus ?? null
  const tuntas = Boolean(s && s.tindakLanjut > 0 && s.tindakLanjutSelesai === s.tindakLanjut)
  const [label, cls] =
    poin === 0 ? ['Notulen belum diisi', 'bg-destructive-wash text-destructive']
      : status === 'draf' ? ['Draf notulen', 'bg-warning-wash text-warning']
      : status === 'terbit' ? (tuntas ? ['Selesai', 'bg-success-wash text-success'] : ['Notulen terbit', 'bg-primary-wash text-primary'])
      : tuntas ? ['Selesai', 'bg-success-wash text-success']
      : [`Notulen terisi · ${poin} poin`, 'bg-primary-wash text-primary']
  return <span className={cn('inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold', cls)}>{label}</span>
}

function dueLabel(due: string | null): { text: string; late: boolean } {
  if (!due) return { text: 'tanpa tenggat', late: false }
  const [y, m, d] = due.split('-').map(Number)
  const today = new Date()
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((Date.UTC(y, m - 1, d) - t0) / 86400000)
  if (diff < 0) return { text: `lewat ${-diff} hari`, late: true }
  if (diff === 0) return { text: 'tenggat hari ini', late: false }
  if (diff === 1) return { text: 'tenggat besok', late: false }
  const { weekday } = dateParts(due)
  return { text: diff < 7 ? `tenggat ${weekday} ${d}/${m}` : `tenggat ${d} ${MONTHS_LONG[m - 1].slice(0, 3)}`, late: false }
}

function OpenFollowUpCard({ items, total, moreHref }: { items: OpenFollowUp[]; total: number; moreHref: string | null }) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card px-[22px] py-[18px]">
      <h2 className="font-heading text-[21px]">Tindak lanjut terbuka</h2>
      <p className="text-[12.5px] text-muted-foreground">Dari semua rapat · terdekat dulu</p>
      {items.length === 0 ? (
        <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">Tidak ada tugas tindak lanjut yang terbuka.</p>
      ) : (
        <ul className="mt-2">
          {items.map(it => {
            const due = dueLabel(it.dueDate)
            return (
              <li key={it.taskId} className="border-t py-2.5">
                <Link href={`/rapat/${it.meeting.id}`} className="group block">
                  <span className="block text-[13.5px] font-bold leading-snug group-hover:underline">{it.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {it.owner ?? 'Tanpa PIC'} · <span className={cn(due.late && 'font-semibold text-destructive')}>{due.text}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground/80">{it.meeting.subject}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {total > items.length && (
        moreHref ? (
          <Link href={moreHref} className="mt-1 text-[13px] font-semibold text-primary hover:underline">
            Lihat {total - items.length} lainnya →
          </Link>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">+{total - items.length} lainnya</p>
        )
      )}
    </section>
  )
}

function ChipLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('inline-flex h-[34px] items-center rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
    >
      {children}
    </Link>
  )
}
