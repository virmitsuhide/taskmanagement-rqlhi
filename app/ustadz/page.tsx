import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers, canViewTeachers, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Plus, Mail } from 'lucide-react'
import { RestoreTeacherButton } from './TeacherActions'
import { contractDaysLeft } from '@/lib/auth/contract'
import { getCurrentTerm, getTeacherSessionLoad } from '@/lib/data/terms'
import type { Teacher, TeacherEmployment } from '@/types'

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>
}

type TeacherListStatus = 'active' | 'inactive' | 'deleted'

const STATUS_LABELS: Record<TeacherListStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  deleted: 'Terhapus',
}

export default async function UstadzListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewTeachers(session.role)) redirect('/dashboard')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  // 'deleted' hanya untuk yang boleh mengelola — role lain tidak punya urusan
  // dengan akun terhapus dan tidak boleh bisa mengintipnya lewat URL.
  const canCreate = canManageTeachers(session.role)
  const status: TeacherListStatus =
    params.status === 'inactive' ? 'inactive'
      : params.status === 'deleted' && canCreate ? 'deleted'
        : 'active'

  const supabase = createServerClient()

  // Koor hanya melihat guru di unitnya. Guru terhubung ke unit lewat halaqoh —
  // sebagai wali (halaqoh.wali_teacher_id) atau pengampu (halaqoh_teachers).
  // Manajemen (kepala RQ, SDM, kumik) tidak dibatasi.
  const unitScope = getManageableJenjang(session.role)
  const restrictToUnit = session.role === 'koor_sd' || session.role === 'koor_smp'
  let unitTeacherIds: string[] | null = null

  if (restrictToUnit) {
    const { data: unitHalaqoh } = await supabase
      .from('halaqoh')
      .select('id, wali_teacher_id')
      .in('jenjang', unitScope)

    const halaqohIds = (unitHalaqoh ?? []).map(h => h.id as string)
    const ids = new Set<string>()
    for (const h of unitHalaqoh ?? []) {
      if (h.wali_teacher_id) ids.add(h.wali_teacher_id as string)
    }

    if (halaqohIds.length > 0) {
      const { data: pengampu } = await supabase
        .from('halaqoh_teachers')
        .select('teacher_id')
        .in('halaqoh_id', halaqohIds)
      for (const r of pengampu ?? []) ids.add(r.teacher_id as string)
    }

    unitTeacherIds = [...ids]
  }

  let q = supabase
    .from('teachers')
    .select('id, username, full_name, nip, email, phone, is_active, deleted_at, created_at, employment_type, unit, contract_end')
    .order('full_name')

  // Tab Aktif/Nonaktif hanya memuat guru yang masih ada; guru terhapus punya
  // tabnya sendiri, kalau tidak ia akan muncul di salah satu dari keduanya.
  if (status === 'deleted') {
    q = q.not('deleted_at', 'is', null)
  } else {
    q = q.is('deleted_at', null).eq('is_active', status === 'active')
  }
  if (query) q = q.or(`full_name.ilike.%${query}%,username.ilike.%${query}%,nip.ilike.%${query}%`)

  // Koor melihat guru unitnya lewat dua jalur: kolom `unit` pada akun guru,
  // atau halaqoh yang diampunya. Jalur pertama penting tiap awal tahun ajaran
  // — guru OS baru sudah punya unit penempatan tapi belum dapat halaqoh, dan
  // tanpa ini ia tak terlihat oleh koordinator yang harus membaginya.
  if (unitTeacherIds) {
    const unitFilter = unitScope.map(j => `unit.eq.${j}`).join(',')
    q = unitTeacherIds.length > 0
      ? q.or(`id.in.(${unitTeacherIds.join(',')}),${unitFilter}`)
      : q.or(unitFilter)
  }

  const { data } = await q
  const teachers = (data ?? []) as Pick<
    Teacher,
    'id' | 'username' | 'full_name' | 'nip' | 'email' | 'phone' | 'is_active' | 'deleted_at'
    | 'created_at' | 'employment_type' | 'unit' | 'contract_end'
  >[]

  // Beban sesi dihitung dari jadwal halaqoh semester berjalan — inilah angka
  // "2 sesi"/"3 sesi" pada MPP, dan dasar perhitungan Gaji OS.
  const currentTerm = await getCurrentTerm()
  const sessionLoad = currentTerm ? await getTeacherSessionLoad(currentTerm.id) : new Map<string, number>()

  // Counter siswa & halaqoh per guru
  const ids = teachers.map(t => t.id)
  let halaqohCountMap = new Map<string, number>()
  if (ids.length > 0) {
    const { data: halaqohRows } = await supabase
      .from('halaqoh')
      .select('wali_teacher_id')
      .in('wali_teacher_id', ids)
      .eq('is_active', true)
    halaqohCountMap = new Map()
    for (const row of halaqohRows ?? []) {
      if (row.wali_teacher_id) {
        halaqohCountMap.set(row.wali_teacher_id, (halaqohCountMap.get(row.wali_teacher_id) ?? 0) + 1)
      }
    }
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Ustadz / Guru" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Ustadz / Guru</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {teachers.length} guru {STATUS_LABELS[status].toLowerCase()}
            </p>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/ustadz/baru"><Plus className="h-4 w-4 mr-1" />Tambah Guru</Link>
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-4 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Cari nama, username, atau NIP..." />
          </div>
          <div className="flex gap-1 border rounded-lg p-0.5 bg-card">
            <StatusChip href={statusHref(query, 'active')} active={status === 'active'}>Aktif</StatusChip>
            <StatusChip href={statusHref(query, 'inactive')} active={status === 'inactive'}>Nonaktif</StatusChip>
            {canCreate && (
              <StatusChip href={statusHref(query, 'deleted')} active={status === 'deleted'}>Terhapus</StatusChip>
            )}
          </div>
        </div>

        {teachers.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            {query
              ? `Tidak ada hasil untuk "${query}"`
              : status === 'deleted'
                ? 'Tidak ada akun guru yang terhapus'
                : 'Belum ada guru terdaftar'}
          </div>
        ) : (
          <div className="rounded-lg border divide-y bg-card">
            {teachers.map(t => {
              const identity = (
                <>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                    {t.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{t.full_name}</p>
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">@{t.username}</code>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {t.employment_type && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                          {EMPLOYMENT_SHORT[t.employment_type]}
                        </span>
                      )}
                      {t.unit && <span>{JENJANG_LABELS[t.unit]}</span>}
                      {t.nip && <span>NIP {t.nip}</span>}
                      {t.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{t.email}</span>}
                      <ContractHint contractEnd={t.contract_end} />
                    </div>
                  </div>
                </>
              )

              // Baris terhapus tidak dibungkus tautan: tombol Pulihkan di
              // dalam tautan membuat sebagian baris jadi jebakan salah klik.
              if (t.deleted_at) {
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3">
                    {identity}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        Dihapus {new Date(t.deleted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <RestoreTeacherButton id={t.id} name={t.full_name} />
                    </div>
                  </div>
                )
              }

              return (
                <Link
                  key={t.id}
                  href={`/ustadz/${t.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                >
                  {identity}
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{halaqohCountMap.get(t.id) ?? 0} halaqoh</div>
                    <div className="tabular-nums">{sessionLoad.get(t.id) ?? 0} sesi</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function statusHref(q: string, status: TeacherListStatus): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (status !== 'active') p.set('status', status)
  const qs = p.toString()
  return qs ? `/ustadz?${qs}` : '/ustadz'
}

function StatusChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}

/** Label pendek untuk baris daftar — nama panjangnya dipakai di halaman detail. */
const EMPLOYMENT_SHORT: Record<TeacherEmployment, string> = {
  tetap_yayasan: 'Tetap YYS',
  kontrak_yayasan: 'Kontrak YYS',
  kontrak_rq: 'Kontrak RQ',
}

/**
 * Peringatan masa kontrak. Hanya muncul kalau memang mendesak — kontrak yang
 * masih lama tidak perlu ikut meramaikan baris. Ambang 60 hari memberi jarak
 * cukup untuk memproses perpanjangan sebelum aksesnya gugur sendiri.
 */
function ContractHint({ contractEnd }: { contractEnd: string | null }) {
  const daysLeft = contractDaysLeft(contractEnd)
  if (daysLeft === null || daysLeft > 60) return null

  if (daysLeft < 0) {
    return <span className="font-medium text-destructive">Kontrak habis</span>
  }
  return (
    <span className="font-medium text-amber-600 dark:text-amber-400">
      Kontrak {daysLeft} hari lagi
    </span>
  )
}
