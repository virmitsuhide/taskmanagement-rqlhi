import Link from 'next/link'
import { Check, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatJadwalSingkat, formatTahsinLevels, formatTanggalSingkat, getPredikatLabel, getTahfidzLabel,
} from '@/lib/rq/ujian'
import type { UjianStatus, UjianTahfidz, UjianTahsin } from '@/types'

/** Ujian selesai tetap tampil sekian hari supaya hasilnya sempat terbaca. */
const HASIL_TAMPIL_HARI = 14

interface Baris {
  id: string
  ujian: 'Tahfidz' | 'Tahsin'
  judul: string
  rincian: string
  status: UjianStatus
  diajukan: string
  jadwal: string | null
  penguji: string | null
  hasil: string | null
  /** Diajukan orang lain (biasanya koordinator) untuk anak halaqoh ini. */
  olehLain: string | null
}

const TAHAP: { status: UjianStatus; label: string }[] = [
  { status: 'diajukan', label: 'Diajukan' },
  { status: 'dijadwalkan', label: 'Dijadwalkan' },
  { status: 'selesai', label: 'Selesai' },
]
const URUTAN: Record<UjianStatus, number> = { diajukan: 0, dijadwalkan: 1, selesai: 2 }

function masihTampil(status: UjianStatus, selesaiAt: string | null | undefined, updatedAt: string): boolean {
  if (status !== 'selesai') return true
  const acuan = new Date(selesaiAt ?? updatedAt).getTime()
  return Date.now() - acuan <= HASIL_TAMPIL_HARI * 24 * 60 * 60 * 1000
}

/**
 * Progres ujian anak-anak guru ini, di beranda portal guru — baik yang ia
 * ajukan sendiri maupun yang diajukan koordinator untuk anak halaqohnya
 * (pengajuan sering disampaikan lisan lalu dimasukkan koordinator).
 *
 * Hanya yang masih berjalan, ditambah yang baru selesai dua pekan terakhir —
 * riwayat lengkapnya ada di halaman Pengajuan Ujian. Beranda menjawab
 * "anak mana yang sedang menunggu apa", bukan "apa saja yang pernah terjadi".
 */
export function ProgresUjianGuru({ teacherId, tahfidz, tahsin, idSiswa }: {
  teacherId: string
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  /** Anak halaqoh guru ini — pada ujian kelompok, hanya merekalah yang disebut. */
  idSiswa: string[]
}) {
  const milik = new Set(idSiswa)
  const baris: Baris[] = [
    ...tahfidz
      .filter(t => masihTampil(t.status, t.selesai_at, t.updated_at))
      .map((t): Baris => ({
        id: `tahfidz:${t.id}`, ujian: 'Tahfidz', judul: t.nama_siswa,
        rincian: `${getTahfidzLabel(t.tipe, t.juz)} · Kelas ${t.kelas}`,
        status: t.status, diajukan: t.created_at, jadwal: t.jadwal, penguji: t.penguji,
        hasil: t.predikat ? getPredikatLabel(t.predikat) : null,
        olehLain: t.created_by_teacher === teacherId ? null : t.created_by_user ? 'koordinator' : 'guru lain',
      })),
    ...tahsin
      .filter(t => masihTampil(t.status, t.selesai_at, t.updated_at))
      .map((t): Baris => {
        // Kelompok bisa berisi anak ustadz lain bila koordinator yang
        // menyusunnya; yang disebut dan dihitung hanya anak guru ini.
        const sendiri = t.created_by_teacher === teacherId
        const anak = sendiri ? t.siswa : t.siswa.filter(s => s.student_id && milik.has(s.student_id))
        const lulus = anak.filter(s => s.predikat === 'lulus').length
        return {
          id: `tahsin:${t.id}`, ujian: 'Tahsin',
          judul: anak.map(s => s.nama.split(' ')[0]).join(', ') || t.nama_kelompok,
          rincian: `${formatTahsinLevels(t)} · ${anak.length} siswa · Sesi ${t.sesi}`,
          status: t.status, diajukan: t.created_at, jadwal: t.jadwal, penguji: t.penguji,
          hasil: t.status === 'selesai' ? `${lulus}/${anak.length} lulus` : null,
          olehLain: sendiri ? null : t.created_by_user ? 'koordinator' : 'guru lain',
        }
      }),
  ].sort((a, b) => URUTAN[a.status] - URUTAN[b.status] || b.diajukan.localeCompare(a.diajukan))

  const berjalan = baris.filter(b => b.status !== 'selesai').length

  return (
    <section className="mb-6 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Progres Ujian Anak</h2>
        {berjalan > 0 && (
          <span className="rounded-full bg-primary-wash px-2 py-0.5 text-[11px] font-medium text-primary">
            {berjalan} berjalan
          </span>
        )}
        <Link href="/guru/ujian" className="ml-auto text-xs text-muted-foreground hover:underline">
          Semua pengajuan →
        </Link>
      </div>

      {baris.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada anak yang sedang diajukan ujian.</p>
          <Link href="/guru/ujian/baru" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
            Ajukan ujian →
          </Link>
        </div>
      ) : (
        <ul className="divide-y">
          {baris.map(b => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.judul}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {b.ujian} · {b.rincian}{b.olehLain ? ` · diajukan ${b.olehLain}` : ''}
                  </p>
                </div>
                {b.hasil && <span className="shrink-0 text-xs font-medium text-success">{b.hasil}</span>}
              </div>

              <Tahapan status={b.status} />

              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {b.status === 'diajukan'
                  ? `Diajukan ${formatTanggalSingkat(b.diajukan)} · menunggu dijadwalkan koordinator`
                  : `${formatJadwalSingkat(b.jadwal)} · ${b.penguji || 'Penguji belum ditentukan'}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Tahapan({ status }: { status: UjianStatus }) {
  const posisi = URUTAN[status]
  return (
    <ol className="mt-2 flex items-center gap-1" aria-label={`Tahap: ${TAHAP[posisi].label}`}>
      {TAHAP.map((t, i) => {
        const lewat = i <= posisi
        return (
          <li key={t.status} className="flex flex-1 items-center gap-1 last:flex-none">
            <span
              className={cn(
                'flex items-center gap-1 whitespace-nowrap text-[11px]',
                i === posisi ? 'font-semibold text-foreground' : lewat ? 'text-success' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border',
                  lewat ? 'border-success bg-success text-white' : 'border-border bg-transparent',
                )}
              >
                {lewat && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {t.label}
            </span>
            {i < TAHAP.length - 1 && (
              <span className={cn('h-px flex-1', i < posisi ? 'bg-success' : 'bg-border')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
