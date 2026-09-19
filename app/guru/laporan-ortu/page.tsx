import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getLaporanOrtu, getSesiGuruLaporan } from '@/lib/data/laporan-ortu'
import { pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { angka1, labelTotalHafalan, rentangLaporan, tambahHafalan, type AnakLaporan, type LaporanOrtu, type PresetPeriode } from '@/lib/rq/laporan-ortu'
import { tanggalWIB } from '@/lib/rq/ujian'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { cn } from '@/lib/utils'
import { PesanWaLaporanOrtu, TombolUnduhPdf } from '@/components/guru/KirimLaporanOrtu'

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
 * PDF-nya lewat cetak peramban; lihat components/guru/KirimLaporanOrtu.tsx.
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:px-6 print:max-w-none print:p-0">
        <div className="print:hidden">
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Laporan</p>
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
                <TombolUnduhPdf namaBerkas={`Laporan Ortu - ${sesi.name} - ${periode.label}`} />
              </div>
            </div>

            {laporan && <LembarLaporan l={laporan} />}
            {laporan && laporan.anak.length > 0 && <PesanWaLaporanOrtu laporan={laporan} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Lembar A4 ───────────────────────────────────────────────────────────────

function LembarLaporan({ l }: { l: LaporanOrtu }) {
  const r = l.ringkas
  // Sesi yang seluruh anaknya masih di tahap tahsin tidak punya apa pun untuk
  // kolom tahfidz. Kolom kosong berisi "belum ada hafalan" di tiap baris terbaca
  // sebagai kekurangan anak — padahal tahapnya memang belum sampai.
  const adaTahfidz = l.anak.some(a => a.tahfidz.terakhir || a.tahfidz.totalHalaman > 0 || a.tahfidz.murojaah > 0)
  // Begitu pula tahsin untuk sesi yang seluruh anaknya sudah Lulus Tahsin.
  const adaTahsin = l.anak.some(a => !a.tahsin.selesai || a.tahsin.setoran > 0)
  const jumlahKotak = 2 + Number(adaTahsin) + Number(adaTahfidz)
  return (
    <article className="ortu-sheet mx-auto rounded-xl border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* Kop */}
      <header className="flex flex-col gap-3 border-b-2 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4" style={{ borderColor: 'var(--primary)' }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-128.png" alt="" className="h-12 w-12" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: 'var(--primary)' }}>Rumah Qur&apos;an LHI</p>
            <h2 className="text-lg font-bold leading-tight">Laporan Capaian Pembelajaran Al-Qur&apos;an</h2>
          </div>
        </div>
        <dl className="text-[11px] leading-relaxed sm:shrink-0 sm:text-right">
          <div><dt className="inline text-muted-foreground">Sesi: </dt><dd className="inline font-semibold">{l.sesi.nama}</dd></div>
          <div><dt className="inline text-muted-foreground">Pengampu: </dt><dd className="inline font-semibold">{l.guru.nama}</dd></div>
          <div><dt className="inline text-muted-foreground">Periode: </dt><dd className="inline font-semibold">{l.periode.label}</dd></div>
        </dl>
      </header>

      {l.anak.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sesi ini belum berisi siswa aktif.</p>
      ) : (
        <>
          {/* Ringkasan */}
          <div className={cn('mt-4 grid grid-cols-2 gap-2', jumlahKotak === 4 ? 'sm:grid-cols-4' : jumlahKotak === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            <Kotak label="Pertemuan" nilai={`${l.hariPertemuan} hari`} ket="hari yang ada setoran" />
            <Kotak label="Ananda setor" nilai={`${r.anakSetor} / ${r.jumlahAnak}`} ket="anak" />
            {adaTahsin && <Kotak label="Tahsin" nilai={`${r.tahsinLulus} hal.`} ket="halaman lulus" />}
            {adaTahfidz && <Kotak label="Tahfidz" nilai={`${angka1(r.ziyadahHalaman)} hal.`} ket={`hafalan baru · ${r.murojaah}× muroja'ah`} />}
          </div>

          {l.hariPertemuan === 0 && (
            <p className="mt-3 rounded-md px-3 py-2 text-xs" style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
              Belum ada setoran tercatat pada periode ini. Posisi terakhir tiap anak tetap ditampilkan di bawah.
            </p>
          )}

          {/* Tabel per anak */}
          <table className="ortu-table mt-4 w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-left" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
                <th className="w-7 border px-1.5 py-1.5 text-center">No</th>
                <th className="border px-2 py-1.5">Nama</th>
                <th className="w-14 border px-1.5 py-1.5 text-center">Setor</th>
                {adaTahsin && <th className="border px-2 py-1.5">Tahsin</th>}
                {adaTahfidz && <th className="border px-2 py-1.5">Tahfidz</th>}
              </tr>
            </thead>
            <tbody>
              {l.anak.map((a, i) => <BarisAnak key={a.id} a={a} no={i + 1} pertemuan={l.hariPertemuan} tahsin={adaTahsin} tahfidz={adaTahfidz} />)}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            <b>Posisi</b> = capaian terakhir per tanggal cetak. <b>(+…)</b> = tambahan selama periode ini.
            Setor = hari Ananda setor dari seluruh hari pertemuan sesi. Halaman tahfidz dalam halaman mushaf Madinah.
          </p>

          {/* Penutup */}
          <footer className="mt-6 flex items-end justify-between gap-6">
            <p className="max-w-[60%] text-[11px] leading-relaxed text-muted-foreground">
              Semoga Allah menjadikan Ananda semua Ahlul Qur&apos;an. Mohon dukungan Ayah/Bunda untuk menyimak
              muroja&apos;ah Ananda di rumah. Jazakumullahu khairan.
            </p>
            <div className="text-center text-[11px]">
              <p>Banguntapan, {tanggalPanjang(l.dicetak)}</p>
              <p className="text-muted-foreground">Pengampu</p>
              <div className="flex h-14 items-center justify-center">
                {l.guru.ttdUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.guru.ttdUrl} alt="" className="max-h-14 max-w-[140px] object-contain" />
                  : null}
              </div>
              <p className="border-t pt-0.5 font-semibold">{l.guru.nama}</p>
            </div>
          </footer>
        </>
      )}
    </article>
  )
}

function Kotak({ label, nilai, ket }: { label: string; nilai: string; ket: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight tabular-nums">{nilai}</p>
      <p className="text-[10px] text-muted-foreground">{ket}</p>
    </div>
  )
}

function BarisAnak({ a, no, pertemuan, tahsin, tahfidz }: { a: AnakLaporan; no: number; pertemuan: number; tahsin: boolean; tahfidz: boolean }) {
  const t = a.tahfidz
  const belum = a.hariSetor === 0
  return (
    <tr className="align-top">
      <td className="border px-1.5 py-1.5 text-center tabular-nums">{no}</td>
      <td className="border px-2 py-1.5">
        <p className="font-semibold">{a.nama}</p>
        {a.kelas && <p className="text-[10px] text-muted-foreground">Kelas {a.kelas}</p>}
        {a.ujian.map(u => <p key={u} className="mt-0.5 text-[10px] font-medium" style={{ color: 'var(--success)' }}>🎉 {u}</p>)}
      </td>
      <td className="border px-1.5 py-1.5 text-center tabular-nums">
        {belum
          ? <span className="text-[10px]" style={{ color: 'var(--warning)' }}>belum</span>
          : pertemuan > 1 ? `${a.hariSetor}/${pertemuan}` : '✓'}
      </td>
      {tahsin && <td className="border px-2 py-1.5">
        <p>{a.tahsin.posisi ?? '—'}</p>
        {a.tahsin.setoran > 0 && (
          <p className="text-[10px] text-muted-foreground">
            +{a.tahsin.lulus} hal. lulus{a.tahsin.setoran > a.tahsin.lulus ? ` · ${a.tahsin.setoran} setoran` : ''}
          </p>
        )}
      </td>}
      {tahfidz && <td className="border px-2 py-1.5">
        <p>{t.terakhir ?? '—'}</p>
        {/* Tiga keterangan berlabel — wali membaca "ziyadah" dan "total hafalan"
            sebagai dua hal berbeda: yang pertama periode ini, yang kedua seluruhnya. */}
        {t.ziyadahSetoran > 0 && (
          <p className="text-[10px]">
            <span className="text-muted-foreground">Ziyadah:</span> {tambahHafalan(t.ziyadahHalaman, t.ziyadahAyat)}
            {t.ziyadahHalaman >= 1 ? ` (${t.ziyadahAyat} ayat)` : ''}
            <span className="text-muted-foreground"> · {t.ziyadahSetoran}× setor</span>
          </p>
        )}
        {t.murojaah > 0 && (
          <p className="text-[10px]"><span className="text-muted-foreground">Muroja&apos;ah:</span> {t.murojaah}×</p>
        )}
        {t.totalHalaman > 0 && (
          <p className="text-[10px]">
            <span className="text-muted-foreground">Total hafalan:</span> <b>{labelTotalHafalan(t)}</b>
            {t.sedangJuz ? <span className="text-muted-foreground"> · sedang juz {t.sedangJuz}</span> : null}
          </p>
        )}
      </td>}
    </tr>
  )
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function tanggalPanjang(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
}
