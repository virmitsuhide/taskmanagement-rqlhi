import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getCurrentTerm } from '@/lib/data/terms'
import { getAngkatan, getKalender, getKelasAngkatan } from '@/lib/data/kalender-quran'
import { hitungTM } from '@/lib/rq/kalender-quran'
import { agendaPerTanggal, adalahLibur, getKaldikEvents } from '@/lib/data/kaldik'
import { PROGRAMS_BY_JENJANG } from '@/lib/rq/programs'
import { BULAN_ID, tanggalWIB } from '@/lib/rq/ujian'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PageTitle } from '@/components/layout/PageTitle'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { KalenderQuran, type AgendaHari } from '@/components/kalender/KalenderQuran'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; angkatan?: string; bulan?: string }>
}

const PATH = '/kalender-quran'

/** Unit kaldik yang mewakili sebuah jenjang — agenda SD berlaku untuk SD Juara juga. */
const UNIT_KALDIK: Record<Jenjang, string> = {
  paud: 'PAUD', sd: 'SD', sd_juara: 'SD', smp: 'SMP', sma: 'SMA',
}

/**
 * Kalender aktif pembelajaran Al-Qur'an — milik koordinator unit.
 *
 * Menjawab "berapa kali angkatan ini seharusnya mengaji bulan ini", dan
 * jawabannya menjadi penyebut kehadiran tiap anak di rapor. Sebelum ada
 * halaman ini, penyebutnya adalah banyaknya tanggal yang sempat diabsen —
 * sehingga pertemuan yang lupa diabsen menghilang dan kehadiran anak
 * terlihat lebih baik daripada kenyataannya.
 */
export default async function KalenderQuranPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unitBoleh = getManageableJenjang(session.role).filter(j => canManageRaporTemplate(session.role, j))
  if (unitBoleh.length === 0) redirect('/dashboard')

  const sp = await searchParams
  const unit = (unitBoleh.includes(sp.unit as Jenjang) ? sp.unit : unitBoleh[0]) as Jenjang

  const hariIni = tanggalWIB(new Date())
  const bulanKode = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') ? sp.bulan! : hariIni.slice(0, 7)
  const tahun = Number(bulanKode.slice(0, 4))
  const bulan = Number(bulanKode.slice(5, 7))

  const [term, angkatan] = await Promise.all([getCurrentTerm(), getAngkatan(unit)])
  if (!term) {
    redirect('/tahun-ajaran')
  }

  const tingkat = Number(sp.angkatan) || angkatan[0] || 1
  const awal = `${bulanKode}-01`
  const akhir = `${bulanKode}-${String(new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()).padStart(2, '0')}`

  const [kalender, kelas, kaldik, kalenderSemester] = await Promise.all([
    getKalender(term.id, [unit], awal, akhir),
    getKelasAngkatan(unit, tingkat),
    getKaldikEvents([tahun]),
    // Rekap semester perlu seluruh rentang, bukan hanya bulan yang dibuka.
    getKalender(term.id, [unit], term.start_date, term.end_date),
  ])

  const agenda: AgendaHari[] = [...agendaPerTanggal(kaldik, UNIT_KALDIK[unit])]
    .filter(([t]) => t.startsWith(bulanKode))
    .flatMap(([t, daftar]) => daftar.map(e => ({ tanggal: t, judul: e.title, libur: adalahLibur(e) })))

  // '' = anak tanpa program; ia tetap punya jadwal dan TM sendiri.
  const programs = [{ code: '', label: 'Reguler / tanpa program' }, ...PROGRAMS_BY_JENJANG[unit]]

  const params = { unit, angkatan: String(tingkat), bulan: bulanKode }
  const href = (g: Record<string, string | undefined>) => hrefDengan(PATH, params, g)
  const geser = (n: number) => {
    const d = new Date(Date.UTC(tahun, bulan - 1 + n, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Kalender Qur'an" showBack ownH1 />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 md:p-6">
        <PageTitle icon={<CalendarRange className="size-5" aria-hidden />} title="Kalender Qur'an">
          Hari aktif pembelajaran Al-Qur&apos;an dan sesi yang ditiadakan. Hasilnya adalah jumlah tatap muka (TM) —
          penyebut kehadiran tiap anak di rapor.
        </PageTitle>

        {!kalender.tabelAda ? (
          <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
            Tabel kalender belum ada di basis data. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0084_kalender_quran_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor lebih dulu.
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl border bg-card p-4">
              {unitBoleh.length > 1 && (
                <Slicer label="Unit" options={unitBoleh.map(j => ({
                  label: JENJANG_LABELS[j], href: href({ unit: j, angkatan: undefined }), active: j === unit,
                }))} />
              )}
              {angkatan.length > 0 && (
                <Slicer label="Angkatan" options={angkatan.map(t => ({
                  label: `Kelas ${t}`, href: href({ angkatan: String(t) }), active: t === tingkat,
                }))} />
              )}
              <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1">
                  <Link href={href({ bulan: geser(-1) })} className="flex size-10 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-accent md:size-9" aria-label="Bulan sebelumnya">
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                  <span className="min-w-0 flex-1 text-center text-sm font-semibold sm:w-36 sm:flex-none">
                    {BULAN_ID[bulan - 1]} {tahun}
                  </span>
                  <Link href={href({ bulan: geser(1) })} className="flex size-10 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-accent md:size-9" aria-label="Bulan berikutnya">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <span className="text-center text-xs text-muted-foreground sm:text-right">
                  Semester berjalan: {term.semester === 'ganjil' ? 'Ganjil' : 'Genap'} {term.year_label}
                </span>
              </div>
            </div>

            {angkatan.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa aktif di {JENJANG_LABELS[unit]}, jadi belum ada angkatan untuk dijadwalkan.
              </div>
            ) : (
              <KalenderQuran
                key={`${unit}|${tingkat}|${bulanKode}`}
                termId={term.id}
                jenjang={unit}
                tingkat={tingkat}
                tahun={tahun}
                bulan={bulan}
                programs={programs}
                jadwal={kalender.jadwal}
                kosong={kalender.kosong}
                agenda={agenda}
                kelas={kelas}
                bolehUbah={canManageRaporTemplate(session.role, unit)}
              />
            )}

            {/* ── Rekap semester ──
                Ditanyakan tiap akhir semester: berapa TM angkatan ini
                seluruhnya. Angka yang sama dipakai rapor sebagai penyebut
                kehadiran, jadi ia sengaja ditampilkan berdampingan dengan
                rekap bulanan — bukan di halaman lain. */}
            {angkatan.length > 0 && (
              <section className="space-y-2 rounded-2xl border bg-card p-4">
                <div>
                  <h2 className="font-semibold">
                    Rekap tatap muka satu semester — {term.semester === 'ganjil' ? 'Ganjil' : 'Genap'} {term.year_label}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {term.start_date} sampai {term.end_date}. Penandaan kosong satu rombel tidak mengurangi TM rombel lain.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="border-b px-2 py-1.5">Angkatan</th>
                        {programs.map(p => (
                          <th key={p.code || 'r'} className="border-b px-2 py-1.5 text-center">{p.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {angkatan.map(t => (
                        <tr key={t}>
                          <td className="border-b px-2 py-1.5 font-medium">Kelas {t}</td>
                          {programs.map(p => (
                            <td key={p.code || 'r'} className="border-b px-2 py-1.5 text-center tabular-nums">
                              {hitungTM(term.start_date, term.end_date, kalenderSemester.jadwal, kalenderSemester.kosong, {
                                jenjang: unit, tingkat: t, kelas: null, program: p.code,
                              })}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Angka di atas untuk angkatan penuh. Anak di rombel yang pernah ditandai kosong sendiri punya TM lebih
                  sedikit, dan rapornya memakai angka miliknya.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
