import {
  AlertCircle, BarChart3, BookMarked, CalendarPlus, CalendarRange, CalendarClock, ClipboardCheck, ClipboardList,
  FileText, Inbox, LayoutGrid, LayoutTemplate, ListTodo, Megaphone, Newspaper, Plus, ScrollText, Upload, Users, Wallet,
  Gauge, Hourglass, Clock,
} from 'lucide-react'
import {
  canViewFinance, canViewFinanceNotes, canViewGukarRecap, canViewHalaqoh, canViewHumasRequests, canViewKpi,
  canViewStudents, canViewTasks, canViewUnitAnalytics, canCreateNews, canManageHomepage, canManageRaporTemplate,
  canPostToHome, getAnalyticsJenjang, getCreatableMeetingTypes, getManageableJenjang, getUjianUnits,
  getViewableMeetingTypes, ROLE_LABELS,
} from '@/lib/auth/permissions'
import {
  getCompletionHistory, getPendingVerifications, getRecentMeetings, getSemuaTugasAktifSaya, getTeamActiveTasks,
} from '@/lib/data/dashboard'
import { getBoardTasks } from '@/lib/data/board'
import { getRingkasanPembinaan, type RingkasanPembinaan } from '@/lib/data/ringkasan-pembinaan'
import { getUjianBaruCount, getUjianStats } from '@/lib/data/ujian'
import { getCurrentTerm } from '@/lib/data/terms'
import { getGukarPerhatian, type GukarPerhatian } from '@/lib/data/gukar'
import { currentPeriod } from '@/lib/finance/period'
import { liveRequests, requestStatus } from '@/lib/humas/request-status'
import { createServerClient } from '@/lib/supabase/server'
import { tanggalWIB } from '@/lib/rq/ujian'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import { bacaSaring, LABEL_SARING, ringkasFokus, type SaringTugas } from '@/lib/tasks/fokus'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop, KpiCard, Slicer, hrefDengan, type NadaKpi } from '@/components/dashboard/kit'
import {
  PanelCapaian, PanelFokus, PanelGukar, PintasanBaris, PanelRapat, PanelRequest, PanelReview, PanelUjian,
  pisahPerhatian,
  type Pintasan,
} from '@/components/dashboard/pengurus'
import { Fragment } from 'react'
import { TeamTasksSwitcher } from '@/components/dashboard/TeamTasksSwitcher'
import { CompletionHistory } from '@/components/dashboard/CompletionHistory'
import { getBoardDivisions } from '@/lib/auth/permissions'
import type { ContentRequest, Jenjang, MeetingType, SessionData, UjianStats, UserRole } from '@/types'

/**
 * Dashboard pengurus — satu kerangka untuk semua jabatan, isinya menurut
 * kebutuhan jabatan itu.
 *
 * Dulu sepuluh halaman menyusun blok yang sama (DivisionStats, daftar
 * TaskCard, MeetingCard) menurun dalam satu kolom sempit, tanpa filter, dan
 * tanpa satu pun angka yang menyentuh pekerjaan utama jabatannya kecuali di
 * dashboard manajemen. Kini semuanya membaca dalam pola Z yang sama dengan
 * Analitik RQ:
 *
 *   ┌ judul & konteks ─────────────────────► slicer (tugas · unit) ┐
 *   │ 4 KPI jabatan ini — tiap kartu menaut ke tempat mengurusnya  │
 *   │ Fokus kerja (tersaring slicer) ──────► menunggu review Anda  │
 *   └ panel utama jabatan ─────────────────► panel pendamping ─────┘
 *
 * Slicer berupa tautan query string (?tugas=, ?unit=), bukan state klien —
 * sama dengan kit.tsx: halaman dirender di server dengan data yang sudah
 * tersaring, bisa dibagikan lewat URL, dan tombol Back membatalkan filter.
 */

export type HalamanDashboard =
  | 'manajemen' | 'kumik' | 'sdm' | 'koor-sd' | 'koor-smp' | 'koor-qulssd'
  | 'koor-ekstra' | 'humas' | 'div-training' | 'pribadi'

type KunciPanel = 'capaian' | 'ujian' | 'rapat' | 'gukar' | 'request'
type KunciPintasan =
  | 'analitik' | 'gukar' | 'papanTugas' | 'tugasBaru' | 'rapatBaru' | 'halaqoh' | 'siswa' | 'ujian'
  | 'templateRapor' | 'kalenderQuran' | 'postBeranda' | 'beranda' | 'request' | 'berita' | 'catatanKeuangan'
  | 'keuangan' | 'kpi' | 'imporSiswa' | 'imporHalaqoh'

interface Konfig {
  judul: string
  /** Pertanyaan yang dijawab halaman ini — judul besar di bagian atas. */
  tanya: string
  /** Fokus kerja memuat tugas SELURUH tim, bukan tugas pribadi. */
  tim?: boolean
  rapat: (role: UserRole) => MeetingType[]
  rapatJudul?: string
  /**
   * Kolom kanan baris fokus, di bawah "Menunggu Review": panel yang juga
   * menuntut TINDAKAN (antrian ujian, rapat). Menumpuknya di sini mengisi
   * ruang yang kalau tidak akan kosong di samping daftar tugas yang panjang.
   */
  samping: KunciPanel[]
  /** Baris panel INFORMASI di bawahnya; dua panel = 7/5, satu = penuh. */
  baris: KunciPanel[][]
  pintasan: KunciPintasan[]
}

const KONFIG: Record<HalamanDashboard, Konfig> = {
  manajemen: {
    judul: 'Dashboard Manajemen',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Pekerjaan tim mana yang tertahan, dan bagaimana pembinaan siswa bulan ini?',
    tim: true,
    rapat: () => ['manajemen'],
    rapatJudul: 'Rapat Manajemen',
    samping: ['ujian'],
    baris: [['capaian', 'rapat']],
    pintasan: ['analitik', 'papanTugas', 'kpi', 'rapatBaru'],
  },
  kumik: {
    judul: 'Dashboard Kurikulum',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Apa yang perlu saya selesaikan, dan apakah penilaian serta ujian berjalan?',
    rapat: role => getCreatableMeetingTypes(role),
    rapatJudul: 'Rapat Kumik',
    samping: ['ujian'],
    baris: [['capaian', 'rapat']],
    pintasan: ['analitik', 'ujian', 'templateRapor', 'tugasBaru'],
  },
  sdm: {
    judul: 'Dashboard SDM',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Siapa guru & karyawan yang perlu didampingi, dan apa tugas saya?',
    rapat: () => ['new_squad'],
    rapatJudul: 'Rapat New Squad',
    samping: ['rapat'],
    baris: [['gukar', 'capaian']],
    pintasan: ['gukar', 'kpi', 'tugasBaru', 'rapatBaru'],
  },
  'koor-sd': {
    judul: 'Dashboard Koordinator SD',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Sampai mana siswa SD, apakah penilaian lengkap, dan ujian apa yang menunggu?',
    rapat: role => [...getCreatableMeetingTypes(role), 'kumik'],
    samping: ['ujian'],
    baris: [['capaian', 'rapat']],
    pintasan: ['halaqoh', 'siswa', 'postBeranda', 'kalenderQuran'],
  },
  'koor-smp': {
    judul: 'Dashboard Koordinator SMP',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Sampai mana siswa SMP, apakah penilaian lengkap, dan ujian apa yang menunggu?',
    rapat: role => [...getCreatableMeetingTypes(role), 'kumik'],
    samping: ['ujian'],
    baris: [['capaian', 'rapat']],
    pintasan: ['halaqoh', 'siswa', 'templateRapor', 'kalenderQuran'],
  },
  'koor-qulssd': {
    judul: 'Dashboard Koordinator QULS SD',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Sampai mana siswa QULS, dan kelompok mana yang belum dinilai?',
    // Rapat koor SD ikut: kelompok QULS duduk di unit dan sesi yang sama.
    rapat: role => [...getCreatableMeetingTypes(role), 'koor_sd', 'kumik'],
    // Tanpa panel ujian: pengajuan ujian SD masih dipegang koor SD
    // (getUjianUnits), menampilkannya hanya menjanjikan tombol yang tak ada.
    samping: ['rapat'],
    baris: [['capaian']],
    pintasan: ['halaqoh', 'imporHalaqoh', 'imporSiswa', 'siswa'],
  },
  'koor-ekstra': {
    judul: 'Dashboard Koordinator Ekstra',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Tugas apa yang perlu saya selesaikan pekan ini?',
    rapat: () => ['kumik'],
    rapatJudul: 'Rapat Kumik',
    samping: ['rapat'],
    baris: [],
    pintasan: ['tugasBaru', 'papanTugas', 'rapatBaru', 'postBeranda'],
  },
  humas: {
    judul: 'Dashboard Humas',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Request konten apa yang masuk, dan tugas apa yang harus selesai?',
    rapat: () => [],
    samping: ['request'],
    baris: [],
    pintasan: ['beranda', 'request', 'berita', 'postBeranda'],
  },
  'div-training': {
    judul: 'Dashboard Divisi Training',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Tugas apa yang perlu saya selesaikan pekan ini?',
    rapat: () => ['new_squad'],
    rapatJudul: 'Rapat New Squad',
    samping: ['rapat'],
    baris: [],
    pintasan: ['tugasBaru', 'papanTugas', 'rapatBaru'],
  },
  pribadi: {
    judul: 'Dashboard Saya',
    // Pertanyaan jabatan — tampil sebagai judul halaman.
    tanya: 'Apa yang perlu saya kerjakan, dan apa yang terjadi di rapat terakhir?',
    rapat: role => getViewableMeetingTypes(role),
    samping: ['rapat'],
    baris: [],
    pintasan: ['catatanKeuangan', 'keuangan', 'ujian', 'tugasBaru'],
  },
}

/** Pintasan hanya ditawarkan bila penggunanya lolos aturan akses yang sama dengan sidebar. */
const PINTASAN: Record<KunciPintasan, Pintasan & { boleh: (r: UserRole) => boolean }> = {
  analitik: { href: '/dashboard/analitik', label: 'Analitik RQ', ket: 'Capaian, target, ujian, kelengkapan', ikon: <BarChart3 className="h-4 w-4" />, boleh: canViewUnitAnalytics },
  gukar: { href: '/dashboard/analitik/gukar', label: 'Analitik Gukar', ket: 'Halaqoh guru & karyawan', ikon: <BookMarked className="h-4 w-4" />, boleh: canViewGukarRecap },
  papanTugas: { href: '/tasks/board', label: 'Papan Tugas', ket: 'Kanban seluruh divisi', ikon: <LayoutGrid className="h-4 w-4" />, boleh: canViewTasks },
  tugasBaru: { href: '/tasks/baru', label: 'Buat Tugas', ket: 'Tugaskan ke pengurus', ikon: <Plus className="h-4 w-4" />, boleh: canViewTasks },
  rapatBaru: { href: '/rapat/baru', label: 'Buat Rapat', ket: 'Agenda & notulen', ikon: <CalendarPlus className="h-4 w-4" />, boleh: r => getCreatableMeetingTypes(r).length > 0 },
  halaqoh: { href: '/halaqoh', label: 'Halaqoh', ket: 'Kelompok & pengampu', ikon: <BookMarked className="h-4 w-4" />, boleh: canViewHalaqoh },
  siswa: { href: '/siswa', label: 'Siswa', ket: 'Data & capaian per anak', ikon: <Users className="h-4 w-4" />, boleh: canViewStudents },
  ujian: { href: '/ujian/kelola', label: 'Pengajuan Ujian', ket: 'Jadwalkan & nilai ujian', ikon: <ScrollText className="h-4 w-4" />, boleh: r => getUjianUnits(r).length > 0 },
  templateRapor: { href: '/rapor-quran/template', label: 'Template Rapor', ket: 'Lembar rapor Qur’an unit', ikon: <LayoutTemplate className="h-4 w-4" />, boleh: r => canManageRaporTemplate(r) },
  kalenderQuran: { href: '/kalender-quran', label: 'Kalender Qur’an', ket: 'Hari aktif & jumlah TM', ikon: <CalendarRange className="h-4 w-4" />, boleh: r => canManageRaporTemplate(r) },
  postBeranda: { href: '/home-post/baru', label: 'Post Beranda', ket: 'Pengumuman & tugas guru', ikon: <Megaphone className="h-4 w-4" />, boleh: canPostToHome },
  beranda: { href: '/humas/beranda', label: 'Kelola Beranda', ket: 'Seksi, header & footer', ikon: <LayoutTemplate className="h-4 w-4" />, boleh: canManageHomepage },
  request: { href: '/humas-request', label: 'Request Humas', ket: 'Flyer, video, konten', ikon: <Inbox className="h-4 w-4" />, boleh: canViewHumasRequests },
  berita: { href: '/humas/berita', label: 'Berita', ket: 'Tulis & terbitkan', ikon: <Newspaper className="h-4 w-4" />, boleh: canCreateNews },
  catatanKeuangan: { href: '/notes', label: 'Catatan Keuangan', ket: 'Pemasukan & pengeluaran', ikon: <FileText className="h-4 w-4" />, boleh: canViewFinanceNotes },
  keuangan: { href: '/keuangan', label: 'Keuangan', ket: 'Anggaran & laporan', ikon: <Wallet className="h-4 w-4" />, boleh: canViewFinance },
  kpi: { href: '/kpi', label: 'KPI Guru', ket: 'Rapor kinerja bulanan', ikon: <Gauge className="h-4 w-4" />, boleh: canViewKpi },
  imporSiswa: { href: '/siswa/impor', label: 'Impor Siswa', ket: 'Dari berkas Excel', ikon: <Upload className="h-4 w-4" />, boleh: r => getManageableJenjang(r).length > 0 },
  imporHalaqoh: { href: '/halaqoh/impor', label: 'Impor Pembagian', ket: 'Pembagian kelompok', ikon: <Upload className="h-4 w-4" />, boleh: r => getManageableJenjang(r).length > 0 },
}

const SARING_PRIBADI: SaringTugas[] = ['semua', 'terlambat', 'pekan', 'mendesak', 'kendala']
const SARING_TIM: SaringTugas[] = ['semua', 'terlambat', 'mendesak', 'kendala', 'review']

export async function DashboardPengurus({ halaman, session, searchParams }: {
  halaman: HalamanDashboard
  session: SessionData
  searchParams: { tugas?: string; unit?: string }
}) {
  const k = KONFIG[halaman]
  const role = session.role
  const path = `/dashboard/${halaman}`
  const hariIni = tanggalWIB(new Date())
  const periode = currentPeriod()

  const denganTugas = canViewTasks(role)
  // Tanpa modul tugas (Div Quran BPA/BPI) tidak ada baris fokus, jadi panel
  // samping naik menjadi baris biasa — didahului antrian ujian, satu-satunya
  // pekerjaan harian mereka yang tercatat di aplikasi.
  const samping: KunciPanel[] = denganTugas ? k.samping : []
  const baris: KunciPanel[][] = denganTugas
    ? k.baris
    : [[...(getUjianUnits(role).length ? ['ujian' as const] : []), ...k.samping], ...k.baris].filter(b => b.length > 0)
  const ada = (p: KunciPanel) => samping.includes(p) || baris.some(b => b.includes(p))
  const unitUjian = ada('ujian') || !denganTugas ? getUjianUnits(role) : []
  const pintasan = k.pintasan.map(p => PINTASAN[p]).filter(p => p.boleh(role)).slice(0, 4)

  // Unit: hanya ditawarkan bila cakupan jabatan ini lebih dari satu unit.
  const lingkup = getAnalyticsJenjang(role)
  const unitPilihan = UNIT_ORDER.filter(j => lingkup.includes(j))
  const unit = unitPilihan.includes(searchParams.unit as Jenjang) ? (searchParams.unit as Jenjang) : null
  const cakupanCapaian = unit ? [unit] : lingkup

  const saringBoleh = k.tim ? SARING_TIM : SARING_PRIBADI
  const saring = bacaSaring(searchParams.tugas, saringBoleh)

  const [tugas, review, rapat, capaian, ujian, gukar, request, tim] = await Promise.all([
    !denganTugas ? Promise.resolve([]) : k.tim ? getTeamActiveTasks() : getSemuaTugasAktifSaya(session.userId),
    denganTugas ? getPendingVerifications(session.userId) : Promise.resolve([]),
    (async () => { const t = k.rapat(role); return ada('rapat') && t.length ? getRecentMeetings(t, 5) : [] })(),
    ada('capaian') ? getRingkasanPembinaan(cakupanCapaian) : Promise.resolve(null),
    unitUjian.length
      ? Promise.all([getUjianStats('tahsin', unitUjian), getUjianStats('tahfidz', unitUjian), getUjianBaruCount(session.userId, unitUjian)])
      : Promise.resolve(null),
    ada('gukar') ? ambilGukar(periode) : Promise.resolve(null),
    ada('request') ? ambilRequest() : Promise.resolve(null),
    k.tim
      ? Promise.all([getCompletionHistory(), getBoardTasks({ session, scope: 'divisi', divisi: null })])
      : Promise.resolve(null),
  ])

  const fokus = ringkasFokus(tugas, saring, hariIni)
  const params = { tugas: saring === 'semua' ? undefined : saring, unit: unit ?? undefined }
  const href = (g: Record<string, string | undefined>) => hrefDengan(path, params, g)
  const cakupanLabel = unit ? UNIT_LABELS[unit] : lingkup.length === 1 ? UNIT_LABELS[lingkup[0]] : 'Seluruh unit'

  const kpi = susunKpi({ halaman, denganTugas, tim: !!k.tim, fokus: fokus.hitung, review: review.length, capaian, ujian, gukar, request, href })

  const panel: Record<KunciPanel, (cls: string) => React.ReactNode> = {
    capaian: cls => capaian && <PanelCapaian className={cls} data={capaian} cakupan={cakupanLabel} />,
    ujian: cls => ujian && (
      <PanelUjian className={cls} tahsin={ujian[0]} tahfidz={ujian[1]} baru={ujian[2]}
        cakupan={unitUjian.length > 1 ? 'SD & SMP' : unitUjian[0] ?? ''} />
    ),
    rapat: cls => <PanelRapat className={cls} rapat={rapat} judul={k.rapatJudul} />,
    gukar: cls => <PanelGukar className={cls} perhatian={gukar} periode={periode} />,
    request: cls => request && <PanelRequest className={cls} request={request} />,
  }

  const hariTeks = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={role} title={k.judul} ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:space-y-7 md:p-8">

        {/* ── Z · garis atas: siapa & kapan ► saringan ── */}
        <DashTop
          eyebrow={`${k.judul} · ${ROLE_LABELS[role]}`}
          title={k.tanya}
          context={<>{session.displayName} · {hariTeks}{ada('capaian') && <> · {cakupanLabel}</>}</>}
          filters={
            <>
              {denganTugas && (
                <Slicer
                  label={k.tim ? 'Tugas tim' : 'Tugas saya'}
                  options={saringBoleh.map(s => ({
                    label: LABEL_SARING[s],
                    href: href({ tugas: s === 'semua' ? undefined : s }),
                    active: saring === s,
                    count: fokus.hitung[s],
                  }))}
                />
              )}
              {ada('capaian') && unitPilihan.length > 1 && (
                <Slicer
                  label="Unit"
                  options={[
                    { label: 'Semua', href: href({ unit: undefined }), active: !unit },
                    ...unitPilihan.map(j => ({ label: UNIT_LABELS[j], href: href({ unit: j }), active: unit === j })),
                  ]}
                />
              )}
            </>
          }
        />

        {/* Pintasan jabatan ini — tombol di bawah judul, bukan panel di dasar halaman. */}
        <PintasanBaris items={pintasan} />

        {/* ── KPI jabatan ini ── */}
        {kpi.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {kpi.map(x => <KpiCard key={x.label} {...x} />)}
          </div>
        )}

        {/* ── Z · garis tengah: fokus kerja ► yang menunggu Anda ── */}
        {denganTugas && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <PanelFokus
              className="lg:col-span-7"
              judul={k.tim ? 'Tugas Tim yang Berjalan' : 'Fokus Kerja Saya'}
              sub={k.tim ? 'Seluruh divisi · terlambat & tenggat terdekat di atas' : 'Terlambat & tenggat terdekat di atas'}
              ringkasan={fokus}
              saring={saring}
              tampilPelaksana={k.tim}
              hariIni={hariIni}
              semuaHref={k.tim ? '/tasks/board' : '/tasks'}
            />
            <div className="min-w-0 space-y-6 lg:col-span-5">
              <PanelReview tugas={review} />
              {samping.map(p => <Fragment key={p}>{panel[p]('')}</Fragment>)}
            </div>
          </div>
        )}

        {/* ── Z · garis bawah: panel jabatan ── */}
        {baris.map((b, i) => (
          <div key={i} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {b.map((p, j) => (
              <Fragment key={p}>{panel[p](b.length === 1 ? 'lg:col-span-12' : j === 0 ? 'lg:col-span-7' : 'lg:col-span-5')}</Fragment>
            ))}
          </div>
        ))}


        {/* Manajemen: tugas per pengurus & riwayat penyelesaian — alat
            telusur, sengaja di bawah garis Z karena bukan bacaan harian. */}
        {tim && (
          <>
            <TeamTasksSwitcher
              tasks={tugas}
              currentUserId={session.userId}
              currentRole={role}
              boardColumns={tim[1]}
              divisions={getBoardDivisions(role)}
            />
            <section>
              <h2 className="mb-2 font-heading text-xl font-medium">Riwayat Penyelesaian Tugas</h2>
              <CompletionHistory members={tim[0]} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

// ─── KPI per jabatan ─────────────────────────────────────────────────────────

type Kpi = React.ComponentProps<typeof KpiCard>

function susunKpi({ halaman, denganTugas, tim, fokus, review, capaian, ujian, gukar, request, href }: {
  halaman: HalamanDashboard
  denganTugas: boolean
  tim: boolean
  fokus: Record<SaringTugas, number>
  review: number
  capaian: RingkasanPembinaan | null
  ujian: [UjianStats, UjianStats, number] | null
  gukar: GukarPerhatian | null
  request: ContentRequest[] | null
  href: (g: Record<string, string | undefined>) => string
}): Kpi[] {
  const nada = (n: number, t: NadaKpi): NadaKpi | undefined => (n > 0 ? t : undefined)

  const k = {
    tugasAktif: (): Kpi => ({
      label: tim ? 'Tugas tim berjalan' : 'Tugas aktif saya',
      value: fokus.semua,
      icon: <ListTodo className="h-3.5 w-3.5" />,
      sub: `${fokus.mendesak} prioritas tinggi · ${fokus.kendala} ada kendala`,
      href: href({ tugas: undefined }),
    }),
    terlambat: (): Kpi => ({
      label: tim ? 'Terlambat (tim)' : 'Tugas terlambat',
      value: fokus.terlambat,
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      tone: nada(fokus.terlambat, 'destructive'),
      sub: fokus.terlambat > 0 ? 'Lewat tenggat, belum diserahkan' : 'Tidak ada yang lewat tenggat',
      href: href({ tugas: 'terlambat' }),
    }),
    pekan: (): Kpi => ({
      label: 'Tenggat 7 hari',
      value: fokus.pekan,
      icon: <Clock className="h-3.5 w-3.5" />,
      tone: nada(fokus.pekan, 'warning'),
      sub: 'Termasuk hari ini',
      href: href({ tugas: 'pekan' }),
    }),
    review: (): Kpi => ({
      label: 'Menunggu review Anda',
      value: review,
      icon: <ClipboardCheck className="h-3.5 w-3.5" />,
      tone: nada(review, 'warning'),
      sub: 'Diserahkan pelaksana',
      href: '/tasks?tab=delegated',
    }),
    siswa: (): Kpi => ({
      label: 'Siswa aktif',
      value: capaian?.totalSiswa ?? 0,
      icon: <Users className="h-3.5 w-3.5" />,
      sub: capaian ? `${capaian.bulan.totalHalaqoh.toLocaleString('id-ID')} halaqoh` : undefined,
      href: '/siswa',
    }),
    penilaian: (): Kpi => {
      const b = capaian?.bulan
      const p = b?.percent ?? 0
      const t: NadaKpi = p >= 80 ? 'success' : p >= 50 ? 'warning' : 'destructive'
      return {
        label: 'Dinilai bulan ini',
        value: b && b.total > 0 ? `${p}%` : '—',
        icon: <Hourglass className="h-3.5 w-3.5" />,
        ratio: b && b.total > 0 ? p / 100 : undefined,
        ratioTone: t,
        sub: b && b.total > 0 ? `${b.dinilai.toLocaleString('id-ID')} dari ${b.total.toLocaleString('id-ID')} siswa` : 'Belum ada siswa',
        href: '/dashboard/analitik/kelengkapan',
      }
    },
    halaqohKosong: (): Kpi => ({
      label: 'Halaqoh belum dinilai',
      value: capaian?.bulan.halaqohKosong ?? 0,
      icon: <BookMarked className="h-3.5 w-3.5" />,
      tone: nada(capaian?.bulan.halaqohKosong ?? 0, 'warning'),
      sub: capaian ? `dari ${capaian.bulan.totalHalaqoh} halaqoh` : undefined,
      href: '/dashboard/analitik/kelengkapan',
    }),
    ujianAntri: (): Kpi => {
      const n = ujian ? ujian[0].diajukan + ujian[1].diajukan : 0
      return {
        label: 'Ujian perlu dijadwalkan',
        value: n,
        icon: <CalendarClock className="h-3.5 w-3.5" />,
        tone: nada(n, 'warning'),
        sub: ujian ? `Tahsin ${ujian[0].diajukan} · Tahfidz ${ujian[1].diajukan}` : undefined,
        href: '/ujian/kelola',
      }
    },
    gukarPeserta: (): Kpi => ({
      label: 'Peserta gukar',
      value: gukar?.totalPeserta ?? 0,
      icon: <Users className="h-3.5 w-3.5" />,
      sub: gukar ? `${gukar.kelompok.length} kelompok aktif` : 'Belum ada semester berjalan',
      href: '/dashboard/analitik/gukar',
    }),
    gukarPerhatian: (): Kpi => {
      const { didampingi, belumDirekap } = pisahPerhatian(gukar)
      return {
        label: 'Perlu didampingi',
        value: didampingi.length,
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        tone: nada(didampingi.length, 'warning'),
        sub: belumDirekap > 0 ? `${belumDirekap} lainnya belum direkap` : 'Belum mengaji / tanpa capaian',
        href: '/dashboard/analitik/gukar',
      }
    },
    requestBaru: (): Kpi => {
      const n = (request ?? []).filter(r => requestStatus(r) === 'requested').length
      return { label: 'Request baru', value: n, icon: <Inbox className="h-3.5 w-3.5" />, tone: nada(n, 'warning'), sub: 'Belum mulai dikerjakan', href: '/humas-request' }
    },
    requestProses: (): Kpi => ({
      label: 'Request diproses',
      value: (request ?? []).filter(r => requestStatus(r) === 'on_process').length,
      icon: <Megaphone className="h-3.5 w-3.5" />,
      sub: 'Sedang dikerjakan',
      href: '/humas-request',
    }),
    ujianTahsin: (): Kpi => ({ label: 'Ujian tahsin', value: ujian?.[0].diajukan ?? 0, icon: <ClipboardList className="h-3.5 w-3.5" />, tone: nada(ujian?.[0].diajukan ?? 0, 'warning'), sub: 'Perlu dijadwalkan', href: '/ujian/kelola?jenis=tahsin' }),
    ujianTahfidz: (): Kpi => ({ label: 'Ujian tahfidz', value: ujian?.[1].diajukan ?? 0, icon: <BookMarked className="h-3.5 w-3.5" />, tone: nada(ujian?.[1].diajukan ?? 0, 'warning'), sub: 'Perlu dijadwalkan', href: '/ujian/kelola?jenis=tahfidz' }),
    ujianTerjadwal: (): Kpi => ({ label: 'Ujian terjadwal', value: ujian ? ujian[0].dijadwalkan + ujian[1].dijadwalkan : 0, icon: <CalendarClock className="h-3.5 w-3.5" />, sub: 'Tahsin & tahfidz', href: '/ujian/kelola' }),
    ujianSelesai: (): Kpi => ({ label: 'Ujian selesai', value: ujian ? ujian[0].selesai + ujian[1].selesai : 0, icon: <ClipboardCheck className="h-3.5 w-3.5" />, sub: 'Sepanjang catatan', href: '/ujian/kelola' }),
  }

  // Maksimal empat — pembaca berhenti membedakan mana yang penting
  // begitu barisnya lebih panjang dari itu (lihat skill dashboard-analitik).
  switch (halaman) {
    case 'manajemen': return [k.tugasAktif(), k.terlambat(), k.review(), k.penilaian()]
    case 'kumik': return [k.tugasAktif(), k.terlambat(), k.ujianAntri(), k.penilaian()]
    case 'koor-sd':
    case 'koor-smp': return [k.siswa(), k.penilaian(), k.ujianAntri(), k.terlambat()]
    case 'koor-qulssd': return [k.siswa(), k.penilaian(), k.halaqohKosong(), k.terlambat()]
    case 'sdm': return [k.gukarPeserta(), k.gukarPerhatian(), k.tugasAktif(), k.terlambat()]
    case 'humas': return [k.requestBaru(), k.requestProses(), k.tugasAktif(), k.terlambat()]
    default:
      if (!denganTugas) return ujian ? [k.ujianTahsin(), k.ujianTahfidz(), k.ujianTerjadwal(), k.ujianSelesai()] : []
      return [k.tugasAktif(), k.terlambat(), k.pekan(), k.review()]
  }
}

// ─── Data khusus jabatan ─────────────────────────────────────────────────────

async function ambilGukar(periode: string): Promise<GukarPerhatian | null> {
  const term = await getCurrentTerm()
  return term ? getGukarPerhatian(term.id, periode) : null
}

/**
 * Request humas yang belum selesai. Tidak menyaring lewat kolom `status`:
 * sejak 0033 kolom itu tak lagi ditulis — status diturunkan dari tugasnya
 * (lib/humas/request-status.ts), dan request yang tugasnya dihapus dianggap batal.
 */
async function ambilRequest(): Promise<ContentRequest[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('content_requests')
    .select('*, requester:users!requested_by(id, display_name), task:tasks!task_id(id, status, priority, problem_type, assigned_to, assigned_by, deleted_at)')
    .order('created_at', { ascending: false })
    .limit(100)
  return liveRequests((data ?? []) as ContentRequest[]).filter(r => requestStatus(r) !== 'finish')
}

