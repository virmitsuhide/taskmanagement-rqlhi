import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canManageTeachers, canViewTeachers, getManageableJenjang, isKoorUnit, JENJANG_LABELS,
  canManageTeacherProfiles, KATEGORI_GURU_LABELS, KATEGORI_GURU_ORDER,
  getUnitPenunjukPembinaGukar, unitPenunjukanGukar,
} from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Plus, CircleAlert, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RestoreTeacherButton, KategoriPicker, PembinaGukarToggle } from './TeacherActions'
import { contractDaysLeft } from '@/lib/auth/contract'
import { getBarisHitungGuru, getWaliHalaqohAktif, ringkas, statusBaris, type BarisHitungGuru } from '@/lib/data/ustadz-extra'
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
  const restrictToUnit = isKoorUnit(session.role)
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

  /*
    Halaqoh & slot sesi tiap guru, dari SATU kueri.

    Slotnya dibaca dari kolom halaqoh.sesi, bukan dijumlahkan dari tabel
    halaqoh_sessions seperti sebelumnya. Tabel itu tidak pernah terisi — jadwal
    hari & jam belum pernah dimasukkan siapa pun — sehingga angka "beban sesi"
    di sini SELALU 0 untuk setiap guru, tanpa ada yang menandainya salah.

    Lagi pula keduanya menjawab pertanyaan yang berbeda. Jumlah beban dihitung
    lewat halaqoh_teachers (siapa pengampunya), sementara "3 halaqoh" di
    sebelahnya dihitung lewat wali_teacher_id (siapa walinya) — dua relasi
    berbeda yang dipajang seolah sebanding. Yang benar-benar ditanyakan koor
    saat membuka daftar ini adalah KAPAN seorang guru mengajar, dan itulah slot
    1/2/3 yang memang sudah terisi untuk seluruh halaqoh.
  */
  const ids = teachers.map(t => t.id)

  // Koor TPAIT & SMA menunjuk pembina gukar unitnya sendiri (0106). Dibaca
  // terpisah supaya daftar tetap hidup walau kolomnya belum ada.
  const unitPenunjuk = status === 'active' ? getUnitPenunjukPembinaGukar(session.role) : null
  const pembinaMap = new Map<string, boolean>()
  let perluMigrasiPembina = false
  if (unitPenunjuk && ids.length > 0) {
    const { data, error } = await supabase.from('teachers').select('id, pembina_gukar').in('id', ids)
    perluMigrasiPembina = error !== null
    for (const r of (data ?? []) as { id: string; pembina_gukar: boolean }[]) pembinaMap.set(r.id, r.pembina_gukar)
  }
  const bisaDitunjuk = (t: BarisGuru) =>
    !perluMigrasiPembina && unitPenunjuk !== null
    && unitPenunjukanGukar({ unit: t.unit, kategori_guru: t.kategori_guru ?? null }) === unitPenunjuk
  const jumlahPembina = teachers.filter(t => bisaDitunjuk(t) && pembinaMap.get(t.id)).length

  const halaqohCountMap = new Map<string, number>()
  const sesiSlotMap = new Map<string, number[]>()
  if (ids.length > 0) {
    const { data: halaqohRows } = await supabase
      .from('halaqoh')
      .select('wali_teacher_id, sesi')
      .in('wali_teacher_id', ids)
      .eq('is_active', true)

    for (const row of (halaqohRows ?? []) as { wali_teacher_id: string | null; sesi: number | null }[]) {
      if (!row.wali_teacher_id) continue
      halaqohCountMap.set(row.wali_teacher_id, (halaqohCountMap.get(row.wali_teacher_id) ?? 0) + 1)
      // Slot yang sama boleh dipegang dua halaqoh sekaligus; yang ditampilkan
      // adalah slot mana saja yang terisi, bukan berapa kali.
      if (row.sesi == null) continue
      const slot = sesiSlotMap.get(row.wali_teacher_id) ?? []
      if (!slot.includes(row.sesi)) slot.push(row.sesi)
      sesiSlotMap.set(row.wali_teacher_id, slot)
    }
    for (const slot of sesiSlotMap.values()) slot.sort((a, b) => a - b)
  }

  // ── Angka chip & kartu ringkasan: dihitung atas SELURUH guru dalam lingkup
  // penglihat (unit), bukan hanya daftar yang sedang tersaring. Satu select
  // kolom ringan; bila ada pencarian, chip mengikuti pencarian sedangkan kartu
  // ringkasan tetap atas seluruh guru berstatus yang sama.
  const lingkup = { unitTeacherIds, unitScope: unitScope as string[], denganKategori: !perluMigrasi }
  const [barisCari, barisSemua, waliAktif] = await Promise.all([
    getBarisHitungGuru({ ...lingkup, query }),
    query ? getBarisHitungGuru({ ...lingkup, query: '' }) : Promise.resolve(null),
    getWaliHalaqohAktif(),
  ])
  const cocokKategori = (b: BarisHitungGuru, k: KategoriFilter) =>
    k === 'semua' || (k === 'belum' ? !b.kategori_guru : b.kategori_guru === k)
  const hitungStatus = (st: TeacherListStatus) =>
    barisCari.filter(b => statusBaris(b) === st && cocokKategori(b, kategoriAktif)).length
  const hitungKategori = (k: KategoriFilter) =>
    barisCari.filter(b => statusBaris(b) === status && cocokKategori(b, k)).length
  const ring = ringkas((barisSemua ?? barisCari).filter(b => statusBaris(b) === status), waliAktif)
  const jumlahTetap = ring.tetap
  const kontrakYys = ring.kontrakYys
  const kontrakRq = ring.kontrakRq
  const kontrakMendesak = ring.kontrakMendesak
  const belumMengampu = ring.belumMengampu
  const belumKategori = perluMigrasi ? 0 : ring.belumKategori
  const persenDari = (n: number) => (ring.total ? Math.round((n / ring.total) * 100) : 0)
  const labelSemua = `semua guru ${STATUS_LABELS[status].toLowerCase()}`

  const judulMiring: string[] = []
  if (status !== 'deleted') {
    if (kontrakMendesak > 0) judulMiring.push(`${kontrakMendesak} kontrak habis dalam 60 hari`)
    if (belumKategori > 0 && kategoriAktif !== 'belum') judulMiring.push(`${belumKategori} belum berkategori`)
  }

  // Lebar kolom kategori mengikuti isinya: pemilih kategori (SDM) jauh lebih lebar dari chip.
  const lebarKategori = bolehSortir ? 'lg:w-[236px]' : 'lg:w-[150px]'

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Ustadz / Guru" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Pembinaan Qur&rsquo;an · ustadz / guru</p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[34px]">
              {teachers.length} guru {STATUS_LABELS[status].toLowerCase()}
              {kategoriAktif !== 'semua' && ` · ${labelKategori(kategoriAktif)}`}
              {judulMiring.length > 0 ? <> — <i>{judulMiring.join(', ')}.</i></> : '.'}
            </h1>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/ustadz/baru"><Plus className="mr-1 h-4 w-4" />Tambah guru</Link>
            </Button>
          )}
        </div>

        {/* Status & kategori menyaring pada sumbu berbeda dan berlaku bersamaan —
            dua kelompok chip yang terpisah jelas, bukan satu deret. */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <nav aria-label="Status akun" className="flex flex-wrap gap-1.5">
            <Chip href={hrefDaftar(query, 'active', kategoriAktif)} active={status === 'active'} count={hitungStatus('active')}>Aktif</Chip>
            <Chip href={hrefDaftar(query, 'inactive', kategoriAktif)} active={status === 'inactive'} count={hitungStatus('inactive')}>Nonaktif</Chip>
            {canCreate && (
              <Chip href={hrefDaftar(query, 'deleted', kategoriAktif)} active={status === 'deleted'} count={hitungStatus('deleted')}>Terhapus</Chip>
            )}
          </nav>
          {!perluMigrasi && (
            <nav aria-label="Kategori guru" className="flex flex-wrap gap-1.5 xl:border-l xl:pl-3">
              {KATEGORI_FILTERS.map(k => (
                <Chip
                  key={k.value}
                  href={hrefDaftar(query, status, k.value)}
                  active={kategoriAktif === k.value}
                  warm={k.value === 'belum' && kategoriAktif !== 'belum'}
                  count={k.value === 'semua' ? undefined : hitungKategori(k.value)}
                >
                  {k.value === 'semua' ? 'Semua kategori' : k.label}
                </Chip>
              ))}
            </nav>
          )}
          <div className="xl:ml-auto xl:w-60">
            <SearchInput placeholder="Cari nama, username, atau NIP" />
          </div>
        </div>

        {perluMigrasi && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-wash px-4 py-2.5 text-sm text-warning">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Kategori guru belum ada di database. Jalankan{' '}
              <b>drizzle/0053_kategori_guru_PASTE_TO_SUPABASE.sql</b> di Supabase untuk
              memunculkan tab Guru RQ, Guru QULS SD, dan Musyrif/ah SMP.
            </p>
          </div>
        )}

        {unitPenunjuk && (
          perluMigrasiPembina ? (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-wash px-4 py-2.5 text-sm text-warning">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Penunjukan pembina GuKar belum aktif. Jalankan <b>drizzle/0106_pembina_gukar_PASTE_TO_SUPABASE.sql</b> di Supabase.</p>
            </div>
          ) : (
            <p className="rounded-xl border bg-card px-4 py-2.5 text-sm text-muted-foreground">
              <b className="text-foreground">Pembina GuKar {JENJANG_LABELS[unitPenunjuk]}:</b>{' '}
              hanya guru yang Anda tunjuk yang bisa mengampu pembinaan guru &amp; karyawan dari portal guru.
              Tekan tombol di baris guru untuk menunjuk atau mencabut. {jumlahPembina} guru ditunjuk.
            </p>
          )
        )}

        {status !== 'deleted' && ring.total > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Tetap yayasan" value={jumlahTetap} note={`${persenDari(jumlahTetap)}% dari ${labelSemua}`} />
            <StatTile label="Kontrak" value={kontrakYys + kontrakRq} note={`YYS ${kontrakYys} · RQ ${kontrakRq}`} />
            <StatTile label="Kontrak habis ≤ 60 hari" value={kontrakMendesak} note="perpanjang atau akhiri" warm={kontrakMendesak > 0} />
            <StatTile label="Belum mengampu" value={belumMengampu} note="tidak menjadi wali halaqoh aktif" warm={belumMengampu > 0} />
            {(query || kategoriAktif !== 'semua') && (
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground lg:col-span-4">
                Ringkasan di atas menghitung {labelSemua}, bukan hanya hasil saringan.
              </p>
            )}
          </div>
        )}

        {teachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">
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
          <div className="overflow-hidden rounded-2xl border bg-card">
            {/* Kepala kolom — hanya di layar lebar; di ponsel tiap baris membawa keterangannya sendiri. */}
            <div className="hidden items-center gap-4 border-b px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground lg:flex">
              <span className="min-w-0 flex-1">Guru</span>
              <span className="w-24">Unit</span>
              <span className={lebarKategori}>Kategori</span>
              <span className="w-28">Status</span>
              {status === 'deleted' ? <span className="w-[230px]" /> : <span className="w-36">Mengampu</span>}
              {unitPenunjuk && !perluMigrasiPembina && status !== 'deleted' && <span className="w-[150px]" />}
              {status !== 'deleted' && <span className="w-4" />}
            </div>
            <ul className="divide-y">
              {teachers.map(t => {
                const inisial = t.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                const halaqohN = halaqohCountMap.get(t.id) ?? 0
                const slot = sesiSlotMap.get(t.id) ?? []
                const hrefGuru = keProfil ? `/ustadz/profil?unit=${t.unit ?? 'sd'}&guru=${t.id}` : `/ustadz/${t.id}`
                const kategoriChip = t.kategori_guru ? (
                  <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold">
                    {KATEGORI_GURU_LABELS[t.kategori_guru]}
                  </span>
                ) : !perluMigrasi ? (
                  <span className="inline-flex rounded-md bg-accent-warm-wash px-2 py-0.5 text-[11px] font-semibold text-accent-warm">
                    Belum ditentukan
                  </span>
                ) : null
                const statusChip = t.employment_type ? (
                  <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold',
                    t.employment_type === 'tetap_yayasan' ? 'bg-primary-wash text-primary' : 'bg-info-wash text-info')}>
                    {EMPLOYMENT_SHORT[t.employment_type]}
                  </span>
                ) : <span className="text-xs text-muted-foreground">—</span>
                // Tanpa halaqoh tidak ada slot — ditiadakan, bukan diisi "sesi -".
                const mengampu = `${halaqohN} halaqoh${slot.length > 0 ? ` · sesi ${slot.join(', ')}` : ''}`

                const identitas = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-wash font-heading text-base font-semibold text-primary">
                      {inisial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{t.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{t.username}
                        {t.nip && ` · NIP ${t.nip}`}
                        {t.email && ` · ${t.email}`}
                      </span>
                      <ContractHint contractEnd={t.contract_end} />
                      {/* Keterangan ringkas untuk layar sempit, tempat kolom-kolomnya disembunyikan. */}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground lg:hidden">
                        {t.unit && <span className="font-semibold text-foreground">{JENJANG_LABELS[t.unit]}</span>}
                        {!bolehSortir && kategoriChip}
                        {t.employment_type && statusChip}
                        {!t.deleted_at && <span>{mengampu}</span>}
                      </span>
                    </span>
                  </>
                )

                const kolomLebar = (
                  <>
                    <span className="hidden w-24 text-sm font-bold lg:block">{t.unit ? JENJANG_LABELS[t.unit] : '—'}</span>
                    {!bolehSortir && <span className={cn('hidden lg:block', lebarKategori)}>{kategoriChip ?? '—'}</span>}
                  </>
                )

                // Baris terhapus tidak dibungkus tautan: tombol Pulihkan di
                // dalam tautan membuat sebagian baris jadi jebakan salah klik.
                if (t.deleted_at) {
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-5">
                      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">{identitas}</div>
                      {kolomLebar}
                      <span className="hidden w-28 lg:block">{statusChip}</span>
                      <div className="flex shrink-0 items-center gap-2 lg:w-[230px] lg:justify-end">
                        <span className="text-xs text-muted-foreground">
                          Dihapus {new Date(t.deleted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <RestoreTeacherButton id={t.id} name={t.full_name} />
                      </div>
                    </li>
                  )
                }

                // Pemilih kategori & tombol pembina berdiri di LUAR tautan: select
                // yang bersarang dalam <a> akan ikut menavigasi begitu disentuh.
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/30 lg:px-5">
                    <Link href={hrefGuru} className="flex min-w-0 flex-1 basis-60 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {identitas}
                    </Link>
                    {kolomLebar}
                    {bolehSortir && (
                      <div className={cn('pl-[52px] lg:pl-0', lebarKategori)}>
                        <KategoriPicker id={t.id} name={t.full_name} current={t.kategori_guru ?? null} />
                      </div>
                    )}
                    <span className="hidden w-28 lg:block">{statusChip}</span>
                    <span className="hidden w-36 text-[13px] text-muted-foreground tabular-nums lg:block">{mengampu}</span>
                    {unitPenunjuk && !perluMigrasiPembina && (
                      <div className="pl-[52px] lg:w-[150px] lg:pl-0">
                        {bisaDitunjuk(t) && (
                          <PembinaGukarToggle id={t.id} name={t.full_name} current={pembinaMap.get(t.id) ?? false} />
                        )}
                      </div>
                    )}
                    <Link href={hrefGuru} aria-label={`Buka ${t.full_name}`} className="hidden w-4 text-muted-foreground/60 hover:text-foreground lg:block">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, note, warm }: { label: string; value: number; note: string; warm?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5 md:px-5 md:py-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-[34px] leading-none tabular-nums', warm && 'text-accent-warm')}>{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
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

function Chip({
  href, active, count, warm, children,
}: { href: string; active: boolean; count?: number; warm?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('inline-flex h-[34px] items-center gap-1 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground'
          : warm ? 'bg-card text-accent-warm hover:bg-accent-warm-wash'
            : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
    >
      {children}
      {count !== undefined && <span className="tabular-nums opacity-70">{count}</span>}
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
    return <span className="block text-xs font-bold text-destructive">Kontrak habis</span>
  }
  return (
    <span className="block text-xs font-bold text-accent-warm">
      Kontrak habis {daysLeft} hari lagi
    </span>
  )
}
