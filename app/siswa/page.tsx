import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewStudents, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { Plus, Users, Upload } from 'lucide-react'
import { tingkatOf } from '@/lib/rq/sesi'
import { cn } from '@/lib/utils'
import type { Jenjang, Student, Halaqoh } from '@/types'

const PAGE_SIZE = 24

interface PageProps {
  searchParams: Promise<{
    q?: string
    jenjang?: string
    halaqoh?: string
    tingkat?: string
    kelas?: string
    page?: string
  }>
}

interface StudentRow extends Pick<Student, 'id' | 'full_name' | 'nis' | 'jenjang' | 'kelas' | 'gender' | 'is_active'> {
  halaqoh: Pick<Halaqoh, 'id' | 'name'> | null
}

/** Keadaan penyaring yang ikut ditulis ke URL. `page` sengaja di luar: setiap
 *  pergantian penyaring memulai daftar dari halaman satu. */
interface Filters {
  q?: string
  jenjang?: Jenjang
  halaqoh?: string
  tingkat?: number
  kelas?: string
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
    ? ['paud', 'sd', 'sd_juara', 'smp', 'sma']
    : allowed
  const canCreate = allowed.length > 0

  const supabase = createServerClient()

  // ── Cakupan: seluruh siswa yang boleh dilihat, sesudah pencarian & halaqoh
  // tapi SEBELUM unit/kelas — karena dari himpunan inilah ketiga baris
  // penyaring menghitung angkanya. Satu ambilan ~700 baris dua kolom lebih
  // murah daripada tiga query hitung terpisah, dan menjaga angka pada tab
  // tetap jujur terhadap pencarian yang sedang aktif.
  let scopeQuery = supabase.from('students').select('jenjang, kelas')
  if (viewableJenjang.length > 0) scopeQuery = scopeQuery.in('jenjang', viewableJenjang)
  if (halaqohFilter) scopeQuery = scopeQuery.eq('halaqoh_id', halaqohFilter)
  if (query) scopeQuery = scopeQuery.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)
  const { data: scopeData } = await scopeQuery
  const scopeRows = (scopeData ?? []) as { jenjang: Jenjang; kelas: string | null }[]

  const jenjangCount = new Map<Jenjang, number>()
  for (const row of scopeRows) {
    jenjangCount.set(row.jenjang, (jenjangCount.get(row.jenjang) ?? 0) + 1)
  }

  // Tingkat & rombel dihitung di dalam unit yang sedang dipilih: kelas 7 tidak
  // ada di SD, jadi menawarkannya saat SD aktif hanya menyesatkan.
  const inJenjang = jenjangFilter
    ? scopeRows.filter(r => r.jenjang === jenjangFilter)
    : scopeRows
  const rombelPerTingkat = new Map<number, Map<string, number>>()
  for (const row of inJenjang) {
    const t = tingkatOf(row.kelas)
    if (t === null || !row.kelas) continue
    let rombel = rombelPerTingkat.get(t)
    if (!rombel) rombelPerTingkat.set(t, (rombel = new Map()))
    rombel.set(row.kelas, (rombel.get(row.kelas) ?? 0) + 1)
  }
  const tingkatList = [...rombelPerTingkat.keys()].sort((a, b) => a - b)

  // Penyaring dari URL divalidasi terhadap data yang benar-benar ada, sama
  // seperti jenjang. Tingkat yang tak dikenal diabaikan, bukan menghasilkan
  // daftar kosong yang tak bisa dijelaskan.
  const tingkatFilter = rombelPerTingkat.has(Number(params.tingkat)) ? Number(params.tingkat) : undefined
  const rombelList = tingkatFilter
    ? [...rombelPerTingkat.get(tingkatFilter)!].sort((a, b) => a[0].localeCompare(b[0]))
    : []
  const kelasFilter = rombelList.some(([k]) => k === params.kelas) ? params.kelas : undefined

  const base: Filters = { q: query, jenjang: jenjangFilter, halaqoh: halaqohFilter, tingkat: tingkatFilter, kelas: kelasFilter }

  let q = supabase
    .from('students')
    .select('id, full_name, nis, jenjang, kelas, gender, is_active, halaqoh:halaqoh!students_halaqoh_id_fkey(id, name)', { count: 'exact' })
    .order('kelas')
    .order('full_name')

  if (viewableJenjang.length > 0) {
    q = q.in('jenjang', viewableJenjang)
  }
  if (jenjangFilter && viewableJenjang.includes(jenjangFilter)) {
    q = q.eq('jenjang', jenjangFilter)
  }
  if (halaqohFilter) q = q.eq('halaqoh_id', halaqohFilter)
  if (query) q = q.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)
  // Tingkat disaring lewat daftar rombelnya, bukan 'kelas LIKE 4%': nilai
  // kelas ditulis bebas ('4A', tapi juga '4.0' yang lolos dari Excel), dan
  // daftar itu sudah dihitung dari data yang sama.
  if (kelasFilter) q = q.eq('kelas', kelasFilter)
  else if (tingkatFilter) q = q.in('kelas', [...rombelPerTingkat.get(tingkatFilter)!.keys()])

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, count } = await q.range(from, to)
  const students = (data ?? []) as unknown as StudentRow[]
  const total = count ?? 0

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Siswa" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Siswa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} siswa
              {jenjangFilter && ` · ${JENJANG_LABELS[jenjangFilter]}`}
              {kelasFilter
                ? ` · kelas ${kelasFilter}`
                : tingkatFilter ? ` · kelas ${tingkatFilter}` : ''}
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/siswa/impor"><Upload className="h-4 w-4 mr-1" />Impor Excel</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/siswa/baru"><Plus className="h-4 w-4 mr-1" />Tambah Siswa</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="mb-3">
          <SearchInput placeholder="Cari nama atau NIS..." />
        </div>

        {/* Tiga tingkat penyaring, tiga rupa berbeda supaya susunannya terbaca
            sekali lihat: unit (pil) → tingkat (tab) → rombel (segmen). */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <FilterChip
            href={hrefFor({ ...base, jenjang: undefined, tingkat: undefined, kelas: undefined })}
            active={!jenjangFilter}
          >
            Semua <span className="opacity-60 ml-1">({scopeRows.length})</span>
          </FilterChip>
          {viewableJenjang.map(j => (
            <FilterChip
              key={j}
              // Berganti unit membuang tingkat & rombel: keduanya milik unit
              // yang ditinggalkan.
              href={hrefFor({ ...base, jenjang: j, tingkat: undefined, kelas: undefined })}
              active={jenjangFilter === j}
            >
              {JENJANG_LABELS[j]} <span className="opacity-60 ml-1">({jenjangCount.get(j) ?? 0})</span>
            </FilterChip>
          ))}
        </div>

        {tingkatList.length > 0 && (
          <div className="flex gap-1 mb-3 overflow-x-auto border-b">
            <TingkatTab
              href={hrefFor({ ...base, tingkat: undefined, kelas: undefined })}
              active={!tingkatFilter}
            >
              Semua Kelas <Count n={inJenjang.length} />
            </TingkatTab>
            {tingkatList.map(t => (
              <TingkatTab
                key={t}
                href={hrefFor({ ...base, tingkat: t, kelas: undefined })}
                active={tingkatFilter === t}
              >
                Kelas {t} <Count n={jumlah(rombelPerTingkat.get(t)!)} />
              </TingkatTab>
            ))}
          </div>
        )}

        {/* Rombel baru muncul setelah tingkatnya dipilih — dan hanya kalau
            tingkat itu memang terbagi. Satu rombel tunggal tidak menyaring
            apa pun, jadi tabnya cuma menambah baris kosong. */}
        {tingkatFilter && rombelList.length > 1 && (
          <div className="flex w-fit max-w-full gap-1 mb-4 rounded-lg bg-muted p-1 overflow-x-auto">
            <RombelChip
              href={hrefFor({ ...base, kelas: undefined })}
              active={!kelasFilter}
            >
              Semua {tingkatFilter}
            </RombelChip>
            {rombelList.map(([k, n]) => (
              <RombelChip key={k} href={hrefFor({ ...base, kelas: k })} active={kelasFilter === k}>
                {k} <span className="opacity-60 tabular-nums">({n})</span>
              </RombelChip>
            ))}
          </div>
        )}

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
                    <p className="text-[10px] text-warning mt-2">⚠ Nonaktif</p>
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
                tingkat: tingkatFilter ? String(tingkatFilter) : undefined,
                kelas: kelasFilter || undefined,
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function jumlah(rombel: Map<string, number>): number {
  let n = 0
  for (const v of rombel.values()) n += v
  return n
}

/** Tautan daftar siswa. Penyaring yang tidak diubah ikut terbawa — memilih
 *  kelas tidak boleh membuang pencarian yang sedang aktif, dan sebaliknya. */
function hrefFor(f: Filters): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.jenjang) p.set('jenjang', f.jenjang)
  if (f.halaqoh) p.set('halaqoh', f.halaqoh)
  if (f.tingkat) p.set('tingkat', String(f.tingkat))
  if (f.kelas) p.set('kelas', f.kelas)
  const qs = p.toString()
  return qs ? `/siswa?${qs}` : '/siswa'
}

function FilterChip({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-muted-foreground hover:text-foreground border-border',
      )}
    >
      {children}
    </Link>
  )
}

function TingkatTab({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function RombelChip({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-xs text-muted-foreground tabular-nums">({n})</span>
}
