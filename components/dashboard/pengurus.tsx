import Link from 'next/link'
import {
  AlertCircle, AlertTriangle, BookMarked, BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardList,
  Inbox, ListTodo, MapPin, Megaphone, UserRound, Users,
} from 'lucide-react'
import { Panel, StackedBar } from '@/components/dashboard/kit'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import { MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { formatPeriod } from '@/lib/finance/period'
import { LABEL_SARING, sisaHari, type RingkasanFokus, type SaringTugas } from '@/lib/tasks/fokus'
import { requestStatus } from '@/lib/humas/request-status'
import { LABEL_PERHATIAN, type GukarPerhatian } from '@/lib/data/gukar'
import type { RingkasanPembinaan } from '@/lib/data/ringkasan-pembinaan'
import { cn } from '@/lib/utils'
import type { ContentRequest, Meeting, Task, UjianStats } from '@/types'

/**
 * Panel dashboard pengurus. Semuanya Server Component dan berbicara dengan
 * kosakata kit.tsx (Panel, KpiCard, StackedBar) — dashboard pengurus dan
 * Analitik RQ harus terbaca sebagai satu aplikasi, bukan dua.
 *
 * Tiap panel wajib punya cabang kosong yang menjelaskan keadaannya: "tidak
 * ada tugas terlambat" adalah kabar baik yang layak diucapkan, bukan ruang
 * kosong yang membuat pembaca menyangka halamannya gagal memuat.
 */

// ─── Tanggal ─────────────────────────────────────────────────────────────────

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function tanggalPendek(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${BULAN_PENDEK[m - 1]} ${y}`
}

/** Keterangan tenggat untuk satu tugas, dengan nada statusnya. */
function keteranganTenggat(t: Pick<Task, 'due_date' | 'status'>, hariIni: string): { teks: string; nada: string } | null {
  const sisa = sisaHari(t, hariIni)
  if (sisa === null) return null
  if (sisa < 0 && t.status !== 'submitted') return { teks: `Terlambat ${-sisa} hari`, nada: 'text-destructive font-medium' }
  if (sisa === 0) return { teks: 'Tenggat hari ini', nada: 'text-warning font-medium' }
  if (sisa === 1) return { teks: 'Tenggat besok', nada: 'text-warning font-medium' }
  if (sisa <= 7) return { teks: `${sisa} hari lagi`, nada: 'text-foreground' }
  return { teks: tanggalPendek(t.due_date!), nada: 'text-muted-foreground' }
}

// ─── Fokus kerja ─────────────────────────────────────────────────────────────

/**
 * Daftar tugas yang tersaring slicer di baris atas. Barisnya sengaja jauh
 * lebih rapat dari TaskCard: di dashboard yang dicari adalah "apa berikutnya",
 * dan delapan baris yang bisa dipindai sekilas lebih berguna daripada tiga
 * kartu besar yang harus digulir.
 */
export function PanelFokus({ judul, sub, ringkasan, saring, tampilPelaksana, hariIni, semuaHref, className }: {
  judul: string
  sub: string
  ringkasan: RingkasanFokus<Task>
  saring: SaringTugas
  /** Tampilkan nama pelaksana (dashboard tim), bukan nama pemberi tugas. */
  tampilPelaksana?: boolean
  hariIni: string
  semuaHref: string
  className?: string
}) {
  const { daftar, totalTersaring } = ringkasan
  return (
    <Panel
      className={className}
      title={judul}
      icon={<ListTodo className="h-4 w-4" />}
      sub={saring === 'semua' ? sub : <>Disaring: <span className="font-medium text-foreground">{LABEL_SARING[saring]}</span> · {totalTersaring.toLocaleString('id-ID')} tugas</>}
      action={{ href: semuaHref, label: 'Semua tugas' }}
    >
      {daftar.length === 0 ? (
        <Kosong ikon={<CheckCircle2 className="h-5 w-5" />}>
          {saring === 'semua'
            ? 'Tidak ada tugas aktif. Tugas baru akan muncul di sini.'
            : `Tidak ada tugas dengan status “${LABEL_SARING[saring].toLowerCase()}”.`}
        </Kosong>
      ) : (
        <>
          <ul className="space-y-2">
            {daftar.map(t => <BarisTugas key={t.id} tugas={t} hariIni={hariIni} tampilPelaksana={tampilPelaksana} />)}
          </ul>
          {totalTersaring > daftar.length && (
            <Link href={semuaHref} className="mt-3 inline-block text-[13px] font-semibold text-primary hover:underline">
              +{(totalTersaring - daftar.length).toLocaleString('id-ID')} tugas lainnya →
            </Link>
          )}
        </>
      )}
    </Panel>
  )
}

function BarisTugas({ tugas, hariIni, tampilPelaksana }: { tugas: Task; hariIni: string; tampilPelaksana?: boolean }) {
  const tenggat = keteranganTenggat(tugas, hariIni)
  const orang = tampilPelaksana ? tugas.assignee?.display_name : tugas.assigner?.display_name
  return (
    <li>
      <Link href={`/tasks/${tugas.id}`} className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm">
        {/* Titik prioritas: bentuk + warna, bukan warna saja. */}
        <span
          className={cn(
            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4',
            tugas.priority === 'high' ? 'bg-destructive ring-destructive-wash' : tugas.priority === 'middle' ? 'bg-warning ring-warning-wash' : 'bg-muted-foreground/40 ring-muted',
          )}
          title={`Prioritas ${tugas.priority === 'high' ? 'tinggi' : tugas.priority === 'middle' ? 'sedang' : 'rendah'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{tugas.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {tenggat && (
              <span className={cn('inline-flex items-center gap-1', tenggat.nada)}>
                {tenggat.nada.includes('destructive') ? <AlertCircle className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
                {tenggat.teks}
              </span>
            )}
            {orang && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <UserRound className="h-3 w-3 shrink-0" />
                <span className="truncate">{tampilPelaksana ? orang : `dari ${orang}`}</span>
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0"><TaskStatusBadge status={tugas.status} /></span>
      </Link>
    </li>
  )
}

/** Tugas yang diserahkan kepada pengguna ini untuk diperiksa. */
export function PanelReview({ tugas, className }: { tugas: Task[]; className?: string }) {
  return (
    <Panel
      className={className}
      title="Menunggu Review Anda"
      icon={<Inbox className="h-4 w-4" />}
      sub="Tugas yang Anda berikan dan sudah diserahkan pelaksananya."
    >
      {tugas.length === 0 ? (
        // Satu baris, bukan kotak kosong besar: panel ini duduk di kolom
        // samping, dan "tidak ada" di sini adalah keadaan yang paling sering.
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> Tidak ada yang menunggu review.
        </p>
      ) : (
        <ul className="-mx-2 divide-y">
          {tugas.slice(0, 6).map(t => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
                <Inisial nama={t.assignee?.display_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">oleh {t.assignee?.display_name ?? '—'}</span>
                </span>
                <span className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">Tinjau</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ─── Capaian siswa ───────────────────────────────────────────────────────────

/**
 * Sebaran capaian tahsin + kelengkapan penilaian bulan ini.
 *
 * Jilid → Al-Qur'an → Tahfidz adalah jenjang BERURUT, jadi warnanya dari
 * palet hijau berjenjang (--chart-*), makin tua makin jauh — bukan warna
 * status. "Belum terdata" abu-abu: ia bukan capaian, melainkan lubang data.
 * Kelengkapan sebaliknya memang STATUS (≥80% baik, 50–79% perhatian,
 * <50% bermasalah), jadi di sana warna status dipakai.
 */
export function PanelCapaian({ data, cakupan, className }: { data: RingkasanPembinaan; cakupan: string; className?: string }) {
  const { bulan } = data
  const nada = bulan.percent >= 80 ? 'success' : bulan.percent >= 50 ? 'warning' : 'destructive'
  return (
    <Panel
      className={className}
      title="Capaian Siswa"
      icon={<BookOpen className="h-4 w-4" />}
      sub={`${cakupan} · ${data.totalSiswa.toLocaleString('id-ID')} siswa aktif · posisi hari ini`}
      action={{ href: '/dashboard/analitik#capaian', label: 'Analitik' }}
    >
      {data.totalSiswa === 0 ? (
        <Kosong ikon={<Users className="h-5 w-5" />}>Belum ada siswa aktif dalam cakupan ini.</Kosong>
      ) : (
        <>
          <StackedBar
            satuan="siswa"
            segments={[
              { label: 'Masih di jilid', value: data.jilid, color: 'var(--chart-4)' },
              { label: 'Sudah Al-Qur’an', value: data.quran, color: 'var(--chart-1)' },
              { label: 'Tahfidz', value: data.tahfidz, color: 'var(--chart-5)' },
              { label: 'Belum terdata', value: data.belumTerdata, color: 'var(--muted-foreground)' },
            ]}
          />

          <div className="mt-5 border-t pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-xs font-semibold">Dinilai {bulan.period ? formatPeriod(bulan.period) : 'bulan ini'}</h3>
              <p className="text-xs tabular-nums text-muted-foreground">
                <span className={cn('font-semibold', nada === 'success' ? 'text-success' : nada === 'warning' ? 'text-warning' : 'text-destructive')}>
                  {bulan.percent}%
                </span>
                {' '}· {bulan.dinilai.toLocaleString('id-ID')} dari {bulan.total.toLocaleString('id-ID')} siswa
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, bulan.percent)}%`, background: `var(--${nada})` }} />
            </div>
            {/* Halaqoh kosong disebut terpisah dari persentase: sepuluh halaqoh
                terisi separuh dan lima halaqoh tak tersentuh bisa berpersen
                sama, tapi menuntut tindakan yang berbeda. */}
            {bulan.halaqohKosong > 0 ? (
              <Link href="/dashboard/analitik/kelengkapan" className="mt-2.5 flex items-start gap-1.5 text-xs text-warning hover:underline">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{bulan.halaqohKosong} dari {bulan.totalHalaqoh} halaqoh belum dinilai sama sekali — lihat daftarnya</span>
              </Link>
            ) : (
              <p className="mt-2.5 text-xs text-muted-foreground">Seluruh {bulan.totalHalaqoh} halaqoh sudah mulai dinilai.</p>
            )}
          </div>
        </>
      )}
    </Panel>
  )
}

// ─── Ujian ───────────────────────────────────────────────────────────────────

/**
 * Antrian ujian. Angka paling besar adalah yang menunggu dijadwalkan —
 * satu-satunya yang menuntut tindakan koordinator; terjadwal dan selesai
 * cukup jadi konteks.
 */
export function PanelUjian({ tahsin, tahfidz, cakupan, baru, className }: {
  tahsin: UjianStats
  tahfidz: UjianStats
  cakupan: string
  /** Pengajuan yang belum dibuka pengguna ini. */
  baru: number
  className?: string
}) {
  const baris = [
    { jenis: 'tahsin', label: 'Ujian Tahsin', ket: 'Kenaikan jilid & Al-Qur’an', s: tahsin, ikon: <ClipboardList className="h-4 w-4" /> },
    { jenis: 'tahfidz', label: 'Ujian Tahfidz', ket: 'Tasmi’ 1, 3, dan 5 juz', s: tahfidz, ikon: <BookMarked className="h-4 w-4" /> },
  ]
  return (
    <Panel
      className={className}
      title="Antrian Ujian"
      icon={<ClipboardList className="h-4 w-4" />}
      // getUjianBaruCount menghitung pengajuan yang MASUK sejak halaman kelola
      // terakhir dibuka — termasuk yang sudah dijadwalkan/selesai. Menyebutnya
      // "pengajuan baru" di samping "0 perlu dijadwalkan" terbaca kontradiksi.
      sub={<>{cakupan}{baru > 0 && <> · <span className="font-medium text-foreground">{baru > 99 ? '99+' : baru} masuk sejak kunjungan terakhir</span></>}</>}
      action={{ href: '/ujian/ajukan', label: 'Ajukan' }}
    >
      <ul className="space-y-4">
        {baris.map(b => (
          <li key={b.jenis}>
            <Link href={`/ujian/kelola?jenis=${b.jenis}`} className="group block rounded-xl transition-colors">
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold group-hover:underline">{b.label}</span>
                <span className="truncate text-xs text-muted-foreground">{b.ket}</span>
              </span>
              {/* Tiga tahap berurutan: hanya "diajukan" yang menuntut tindakan. */}
              <span className="mt-2 grid grid-cols-3 gap-1.5">
                <Tahap n={b.s.diajukan} label="Perlu dijadwalkan" nada={b.s.diajukan > 0 ? 'warning' : 'muted'} />
                <Tahap n={b.s.dijadwalkan} label="Terjadwal" nada="info" />
                <Tahap n={b.s.selesai} label="Selesai" nada="success" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ─── Rapat ───────────────────────────────────────────────────────────────────

export function PanelRapat({ rapat, judul = 'Rapat Terbaru', className }: { rapat: Meeting[]; judul?: string; className?: string }) {
  return (
    <Panel className={className} title={judul} icon={<CalendarDays className="h-4 w-4" />} action={{ href: '/rapat', label: 'Semua rapat' }}>
      {rapat.length === 0 ? (
        <Kosong ikon={<CalendarDays className="h-5 w-5" />}>Belum ada rapat.</Kosong>
      ) : (
        <ul className="-mx-2 divide-y">
          {rapat.map(m => {
            const [, bln, tgl] = m.date.slice(0, 10).split('-').map(Number)
            return (
              <li key={m.id}>
                <Link href={`/rapat/${m.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-background py-1.5">
                    <span className="font-heading text-xl font-medium leading-none tabular-nums">{tgl}</span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{BULAN_PENDEK[bln - 1]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.subject}</span>
                    <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                      <span>{MEETING_TYPE_LABELS[m.type] ?? m.type}</span>
                      {m.location && <span className="inline-flex min-w-0 items-center gap-0.5"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{m.location}</span></span>}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ─── Pintasan ────────────────────────────────────────────────────────────────

export interface Pintasan {
  href: string
  label: string
  ket: string
  ikon: React.ReactNode
}

export function PanelPintasan({ items, className }: { items: Pintasan[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <Panel className={className} title="Pintasan" icon={<ChevronRight className="h-4 w-4" />}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(p => (
          <Link key={p.href} href={p.href} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
              {p.ikon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.ket}</span>
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}

// ─── Gukar (SDM) ─────────────────────────────────────────────────────────────

/**
 * Pisahkan dua arti yang dulu tercampur di satu daftar.
 *
 * "Belum direkap" berarti PENGAMPU belum mengisi kehadiran — lubang data,
 * bukan orang yang bermasalah. Di awal bulan hampir semua peserta berstatus
 * itu, sehingga "161 perlu didampingi" menyesatkan SDM ke arah yang salah:
 * yang perlu ditagih adalah pengampunya, bukan pesertanya.
 */
export function pisahPerhatian(perhatian: GukarPerhatian | null) {
  const semua = perhatian?.peserta ?? []
  return {
    didampingi: semua.filter(p => p.status !== 'belum_direkap'),
    belumDirekap: semua.filter(p => p.status === 'belum_direkap').length,
  }
}

/** Nama peserta pembinaan guru & karyawan yang perlu didampingi bulan ini. */
export function PanelGukar({ perhatian, periode, className }: { perhatian: GukarPerhatian | null; periode: string; className?: string }) {
  const { didampingi, belumDirekap } = pisahPerhatian(perhatian)
  const total = perhatian?.totalPeserta ?? 0
  return (
    <Panel
      className={className}
      title="Perlu Didampingi"
      icon={<Users className="h-4 w-4" />}
      sub={`Halaqoh Qur'an guru & karyawan · ${formatPeriod(periode)}`}
      action={{ href: '/dashboard/analitik/gukar', label: 'Analitik gukar' }}
    >
      {total === 0 ? (
        <Kosong ikon={<Users className="h-5 w-5" />}>Belum ada kelompok pembinaan di semester berjalan.</Kosong>
      ) : (
        <>
          {didampingi.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              {belumDirekap === total
                ? 'Belum bisa dinilai — kehadiran bulan ini belum direkap.'
                : 'Tidak ada peserta yang tercatat bermasalah bulan ini.'}
            </p>
          ) : (
            <ul className="-mx-2 divide-y">
              {didampingi.slice(0, 7).map(p => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.nama}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.unit} · {p.kelompok}</span>
                  </span>
                  <span className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                    p.status === 'belum_mengaji' ? 'bg-destructive-wash text-destructive' : 'bg-warning-wash text-warning',
                  )}>
                    {LABEL_PERHATIAN[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {didampingi.length > 7 && (
            <Link href="/dashboard/analitik/gukar" className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground">
              +{didampingi.length - 7} nama lainnya →
            </Link>
          )}
          {belumDirekap > 0 && (
            <Link href="/dashboard/analitik/gukar" className="mt-4 flex items-start gap-1.5 border-t pt-3 text-xs text-warning hover:underline">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Kehadiran {belumDirekap.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')} peserta belum direkap
                pengampunya bulan ini.
              </span>
            </Link>
          )}
        </>
      )}
    </Panel>
  )
}


// ─── Request Humas ───────────────────────────────────────────────────────────

const JENIS_REQUEST: Record<string, string> = {
  flyer_ujian: 'Flyer ujian', flyer_lain: 'Flyer', video: 'Video', lain_lain: 'Lain-lain',
}

export function PanelRequest({ request, className }: { request: ContentRequest[]; className?: string }) {
  return (
    <Panel
      className={className}
      title="Request Konten Masuk"
      icon={<Megaphone className="h-4 w-4" />}
      sub="Yang belum selesai, terbaru di atas."
      action={{ href: '/humas-request', label: 'Semua request' }}
    >
      {request.length === 0 ? (
        <Kosong ikon={<CheckCircle2 className="h-5 w-5" />}>Tidak ada request yang menunggu.</Kosong>
      ) : (
        <ul className="-mx-2 divide-y">
          {request.slice(0, 6).map(r => {
            const baru = requestStatus(r) === 'requested'
            return (
              <li key={r.id}>
                <Link href="/humas-request" className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.description || JENIS_REQUEST[r.request_type]}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {JENIS_REQUEST[r.request_type] ?? r.request_type} · {r.requester?.display_name ?? '—'} · {tanggalPendek(r.requested_date ?? r.created_at)}
                    </span>
                  </span>
                  <span className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                    baru ? 'bg-warning-wash text-warning' : 'bg-info-wash text-info',
                  )}>
                    {baru ? 'Diminta' : 'Diproses'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ─── Bantu ───────────────────────────────────────────────────────────────────

/**
 * Pintasan sebagai deretan tombol di bawah judul halaman. Tombol pertama
 * adalah aksi utama jabatan itu (urutan dari KONFIG), sisanya sekunder.
 */
export function PintasanBaris({ items }: { items: Pintasan[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Pintasan" className="flex flex-wrap gap-2">
      {items.map((p, i) => (
        <Link
          key={p.href}
          href={p.href}
          title={p.ket}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors [&_svg]:h-4 [&_svg]:w-4',
            i === 0
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border bg-card text-foreground hover:border-primary/40 [&_svg]:text-primary',
          )}
        >
          {p.ikon}
          {p.label}
        </Link>
      ))}
    </nav>
  )
}

function Tahap({ n, label, nada }: { n: number; label: string; nada: 'warning' | 'info' | 'success' | 'muted' }) {
  const warna = nada === 'muted' ? 'var(--muted-foreground)' : `var(--${nada})`
  const latar = nada === 'muted' ? 'var(--muted)' : `var(--${nada}-wash)`
  return (
    <span className="flex flex-col rounded-lg px-2.5 py-2" style={{ background: latar, color: warna }}>
      <span className="font-heading text-2xl font-medium leading-none tabular-nums">{n.toLocaleString('id-ID')}</span>
      <span className="mt-1 text-[11px] font-semibold leading-tight">{label}</span>
    </span>
  )
}

/** Lingkaran inisial dari nama tampilan — dekorasi, jadi aria-hidden. */
function Inisial({ nama }: { nama?: string | null }) {
  const huruf = (nama ?? '?').replace(/^(Ust(adz|adzah|zh)?\.?)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-warm-wash text-xs font-bold text-warning">
      {huruf || '?'}
    </span>
  )
}

function Kosong({ ikon, children }: { ikon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/30 px-4 py-8 text-center">
      <span className="text-muted-foreground/60">{ikon}</span>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
