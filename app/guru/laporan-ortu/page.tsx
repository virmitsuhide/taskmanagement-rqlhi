import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getLaporanOrtu, getSesiGuruLaporan } from '@/lib/data/laporan-ortu'
import { pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { rentangLaporan, type PresetPeriode } from '@/lib/rq/laporan-ortu'
import { tanggalWIB } from '@/lib/rq/ujian'
import { createLaporanToken } from '@/lib/rapor-token'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { PesanWaLaporanOrtu, TombolUnduhPdf, TombolUnduhPng } from '@/components/guru/KirimLaporanOrtu'
import { LembarLaporanOrtu } from '@/components/rapor/LembarLaporanOrtu'

interface PageProps {
  searchParams: Promise<{ sesi?: string; p?: string; dari?: string; sampai?: string }>
}

const PATH = '/guru/laporan-ortu'
const PRESET: { kode: PresetPeriode; label: string }[] = [
  { kode: 'hari', label: 'Hari ini' },
  { kode: 'pekan', label: 'Pekan ini' },
  { kode: 'bulan', label: 'Bulan ini' },
  { kode: 'rentang', label: 'Rentang tanggal' },
]

/**
 * Laporan orang tua per sesi — lembar A4 berisi capaian seluruh anak satu
 * halaqoh pada periode pilihan guru, plus pesan WhatsApp untuk grup wali.
 * PDF-nya lewat cetak peramban, PNG lewat html-to-image; lihat components/guru/KirimLaporanOrtu.tsx.
 */
export default async function LaporanOrtuPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const semuaSesi = await getSesiGuruLaporan(session.teacherId)
  const sesi = pilihHalaqoh(semuaSesi, sp.sesi)
  const preset: PresetPeriode = PRESET.some(x => x.kode === sp.p) ? (sp.p as PresetPeriode) : 'pekan'
  const periode = rentangLaporan(preset, tanggalWIB(new Date()), { dari: sp.dari, sampai: sp.sampai })

  const params = { sesi: sesi?.id, p: preset, dari: preset === 'rentang' ? periode.dari : undefined, sampai: preset === 'rentang' ? periode.sampai : undefined }
  const href = (g: Record<string, string | undefined>) => hrefDengan(PATH, params, g)

  const laporan = sesi ? await getLaporanOrtu(session.teacherId, sesi, periode) : null

  // Tautan publik untuk grup wali — tanggalnya dibekukan di dalam token, jadi
  // tautan "pekan ini" tetap menampilkan pekan ini meski dibuka bulan depan.
  const tautan = sesi
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/laporan/${
        await createLaporanToken({ hid: sesi.id, tid: session.teacherId, d: periode.dari, s: periode.sampai })}`
    : ''

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:px-6 print:max-w-none print:p-0">
        <div className="print:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Laporan</p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Laporan Orang Tua
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Capaian pembelajaran Al-Qur&apos;an satu sesi untuk grup wali — per sesi. Rapor per anak ada di halaman tiap siswa.
          </p>
        </div>

        {!sesi ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground print:hidden">
            Anda belum mengampu halaqoh aktif.
          </div>
        ) : (
          <>
            {/* ── Pilihan ── */}
            <div className="space-y-3 rounded-xl border bg-card p-4 print:hidden">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                {semuaSesi.length > 1 && (
                  <Slicer label="Sesi" options={semuaSesi.map(h => ({
                    // "Sesi 2" cukup membedakan halaqoh seorang guru; nama lengkap bila nomornya kosong/kembar.
                    label: h.sesi && semuaSesi.filter(x => x.sesi === h.sesi).length === 1 ? `Sesi ${h.sesi}` : h.name,
                    href: href({ sesi: h.id }), active: h.id === sesi.id,
                  }))} />
                )}
                <Slicer label="Periode" options={PRESET.map(x => ({
                  label: x.label,
                  href: href({ p: x.kode, dari: undefined, sampai: undefined }),
                  active: preset === x.kode,
                }))} />
              </div>
              {preset === 'rentang' && (
                <form action={PATH} className="flex flex-wrap items-end gap-2 text-xs">
                  <input type="hidden" name="sesi" value={sesi.id} />
                  <input type="hidden" name="p" value="rentang" />
                  <label className="space-y-1">
                    <span className="block text-muted-foreground">Dari</span>
                    <input type="date" name="dari" defaultValue={periode.dari} max={tanggalWIB(new Date())}
                      className="h-9 rounded-md border bg-background px-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-muted-foreground">Sampai</span>
                    <input type="date" name="sampai" defaultValue={periode.sampai} max={tanggalWIB(new Date())}
                      className="h-9 rounded-md border bg-background px-2 text-sm" />
                  </label>
                  <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Terapkan</button>
                </form>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-sm"><span className="text-muted-foreground">Periode:</span> <b>{periode.label}</b></p>
                <div className="flex flex-wrap gap-2">
                  <TombolUnduhPng namaBerkas={`Laporan Ortu - ${sesi.name} - ${periode.label}`} />
                  <TombolUnduhPdf namaBerkas={`Laporan Ortu - ${sesi.name} - ${periode.label}`} />
                </div>
              </div>
            </div>

            {laporan && <LembarLaporanOrtu l={laporan} />}
            {laporan && laporan.anak.length > 0 && <PesanWaLaporanOrtu laporan={laporan} tautan={tautan} />}
          </>
        )}
      </div>
    </div>
  )
}
