import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canManageTeachers, canViewTeachers, getManageableJenjang, JENJANG_LABELS,
  canManageTeacherProfiles, KATEGORI_GURU_LABELS, KATEGORI_GURU_ORDER,
} from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Plus, Mail, CircleAlert } from 'lucide-react'
import { RestoreTeacherButton, KategoriPicker } from './TeacherActions'
import { contractDaysLeft } from '@/lib/auth/contract'
import { getCurrentTerm, getTeacherSessionLoad } from '@/lib/data/terms'
import type { KategoriGuru, Teacher, TeacherEmployment } from '@/types'

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; kategori?: string }>
}

type TeacherListStatus = 'active' | 'inactive' | 'deleted'

const STATUS_LABELS: Record<TeacherListStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  deleted: 'Terhapus',
}

/**
 * Penyaring kategori guru (0053). 'belum' bukan nilai enum melainkan baris yang
 * kategorinya masih NULL — dan justru tab itulah daftar kerja SDM.
 */
type KategoriFilter = KategoriGuru | 'semua' | 'belum'

const KATEGORI_FILTERS: { value: KategoriFilter; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  ...KATEGORI_GURU_ORDER.map(k => ({ value: k as KategoriFilter, label: KATEGORI_GURU_LABELS[k] })),
  { value: 'belum', label: 'Belum ditentukan' },
]

/** Kolom yang pasti ada walau 0053 belum dijalankan. */
const KOLOM_DAFTAR =
  'id, username, full_name, nip, email, phone, is_active, deleted_at, created_at,' +
  ' employment_type, unit, contract_end'

/**
 * Kategori sengaja opsional: baris dari kueri cadangan tidak memuatnya sama
 * sekali, dan itu keadaan yang berbeda dari "sudah ada kolomnya, isinya NULL".
 */
type BarisGuru = Pick<
  Teacher,
  'id' | 'username' | 'full_name' | 'nip' | 'email' | 'phone' | 'is_active' | 'deleted_at'
  | 'created_at' | 'employment_type' | 'unit' | 'contract_end'
> & { kategori_guru?: KategoriGuru | null }

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

  const kategori: KategoriFilter =
    KATEGORI_FILTERS.some(k => k.value === params.kategori)
      ? (params.kategori as KategoriFilter)
      : 'semua'

  // SDM-lah yang mengelola profil guru, jadi baginya nama guru mengantar ke
  // profil — pintu yang sama dengan profil pengurus. Peran lain tetap diantar
  // ke halaman akun & kontrak seperti sebelumnya; keduanya saling bertaut, jadi
  // tidak ada yang jadi tak terjangkau.
  const keProfil = canManageTeacherProfiles(session.role)

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

  // Kuerinya disusun lewat fungsi supaya bisa diulang tanpa kolom kategori_guru.
  // Migrasi di repo ini di-paste manual ke Supabase, dan /ustadz adalah halaman
  // sehari-hari SDM — ia tidak boleh ikut mati hanya karena 0053 belum sempat
  // dijalankan. Pola yang sama dipakai lib/data/guru-profil.ts untuk 0044/0052.
  const bangunKueri = (kolom: string, denganKategori: boolean) => {
    let q = supabase.from('teachers').select(kolom).order('full_name')

    // Tab Aktif/Nonaktif hanya memuat guru yang masih ada; guru terhapus punya
    // tabnya sendiri, kalau tidak ia akan muncul di salah satu dari keduanya.
    if (status === 'deleted') {
      q = q.not('deleted_at', 'is', null)
    } else {
      q = q.is('deleted_at', null).eq('is_active', status === 'active')
    }
    if (query) q = q.or(`full_name.ilike.%${query}%,username.ilike.%${query}%,nip.ilike.%${query}%`)

    // Tab "Belum ditentukan" menyaring baris NULL, jadi ia memakai .is() —
    // .eq('kategori_guru', null) tidak akan pernah cocok dengan apa pun sebab
    // NULL tidak sama dengan apa pun, termasuk dirinya sendiri.
    if (denganKategori && kategori === 'belum') {
      q = q.is('kategori_guru', null)
    } else if (denganKategori && kategori !== 'semua') {
      q = q.eq('kategori_guru', kategori)
    }

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

    return q
  }

  const penuh = await bangunKueri(`${KOLOM_DAFTAR}, kategori_guru`, true)
  // Galat di sini praktis hanya berarti satu hal: kolomnya belum ada. Tab
  // kategori disembunyikan, selebihnya halaman tetap sama seperti sebelum 0053.
  const perluMigrasi = penuh.error !== null
  const hasil = perluMigrasi ? await bangunKueri(KOLOM_DAFTAR, false) : penuh

  const teachers = (hasil.data ?? []) as unknown as BarisGuru[]

  // Tanpa kolomnya tidak ada penyaringan yang benar-benar terjadi, jadi judul
  // dan tautan tidak boleh mengaku sedang menyaring.
  const kategoriAktif: KategoriFilter = perluMigrasi ? 'semua' : kategori

  // Sortir massal hanya untuk yang mengelola profil, dan hanya kalau kolomnya
  // memang ada. Tab Terhapus dikecualikan: mengategorikan akun yang sudah
  // dihapus menambah data pada baris yang justru sedang ditiadakan.
  const bolehSortir = keProfil && !perluMigrasi && status !== 'deleted'

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
              {kategoriAktif !== 'semua' && ` · ${labelKategori(kategoriAktif)}`}
            </p>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/ustadz/baru"><Plus className="h-4 w-4 mr-1" />Tambah Guru</Link>
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Cari nama, username, atau NIP..." />
          </div>
          <div className="flex gap-1 border rounded-lg p-0.5 bg-card">
            <TabChip href={hrefDaftar(query, 'active', kategoriAktif)} active={status === 'active'}>Aktif</TabChip>
            <TabChip href={hrefDaftar(query, 'inactive', kategoriAktif)} active={status === 'inactive'}>Nonaktif</TabChip>
            {canCreate && (
              <TabChip href={hrefDaftar(query, 'deleted', kategoriAktif)} active={status === 'deleted'}>Terhapus</TabChip>
            )}
          </div>
        </div>

        {/* Baris kategori berdiri sendiri, bukan bersanding dengan tab status:
            keduanya menyaring pada sumbu yang berbeda dan berlaku bersamaan,
            jadi menaruhnya dalam satu deret akan terbaca seolah saling meniadakan. */}
        {!perluMigrasi && (
          <div className="flex gap-1 mb-4 border rounded-lg p-0.5 bg-card overflow-x-auto">
            {KATEGORI_FILTERS.map(k => (
              <TabChip
                key={k.value}
                href={hrefDaftar(query, status, k.value)}
                active={kategoriAktif === k.value}
              >
                {k.label}
              </TabChip>
            ))}
          </div>
        )}

        {perluMigrasi && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-wash px-4 py-2.5 text-sm text-warning">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Kategori guru belum ada di database. Jalankan{' '}
              <b>drizzle/0053_kategori_guru_PASTE_TO_SUPABASE.sql</b> di Supabase untuk
              memunculkan tab Guru RQ, Guru QULS SD, dan Musyrif/ah SMP.
            </p>
          </div>
        )}

        {teachers.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            {query
              ? `Tidak ada hasil untuk "${query}"`
              : status === 'deleted'
                ? 'Tidak ada akun guru yang terhapus'
                : kategoriAktif === 'belum'
                  // Tab ini adalah daftar kerja SDM; kosongnya berarti selesai,
                  // bukan berarti tidak ada apa-apa untuk ditampilkan.
                  ? 'Semua guru sudah punya kategori'
                  : kategoriAktif !== 'semua'
                    ? `Belum ada ${labelKategori(kategoriAktif)}`
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
                      {t.kategori_guru && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                          {KATEGORI_GURU_LABELS[t.kategori_guru]}
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

              // Pemilih kategori berdiri di LUAR tautan, bukan di dalamnya. Select
              // yang bersarang dalam <a> akan ikut menavigasi begitu disentuh, dan
              // baris ini justru ada supaya SDM tidak berpindah halaman.
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                >
                  <Link
                    href={keProfil ? `/ustadz/profil?unit=${t.unit ?? 'sd'}&guru=${t.id}` : `/ustadz/${t.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    {identity}
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div>{halaqohCountMap.get(t.id) ?? 0} halaqoh</div>
                      <div className="tabular-nums">{sessionLoad.get(t.id) ?? 0} sesi</div>
                    </div>
                  </Link>
                  {bolehSortir && (
                    <KategoriPicker id={t.id} name={t.full_name} current={t.kategori_guru ?? null} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Kedua penyaring dibawa bersama di tiap tautan. Kalau tidak, mengganti tab
 * status akan diam-diam melepas kategori yang sedang dipilih — dan sebaliknya
 * — sehingga mustahil melihat, misalnya, Musyrif yang akunnya nonaktif.
 */
function hrefDaftar(q: string, status: TeacherListStatus, kategori: KategoriFilter): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (status !== 'active') p.set('status', status)
  if (kategori !== 'semua') p.set('kategori', kategori)
  const qs = p.toString()
  return qs ? `/ustadz?${qs}` : '/ustadz'
}

/** Label satu nilai penyaring kategori, termasuk 'semua' dan 'belum'. */
function labelKategori(kategori: KategoriFilter): string {
  return KATEGORI_FILTERS.find(k => k.value === kategori)?.label ?? 'Semua'
}

function TabChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
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
