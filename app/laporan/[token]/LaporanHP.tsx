import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  angka1, labelTotalHafalan, tambahHafalan, teksMurojaah, teksTahsinPeriode,
  type AnakLaporan, type LaporanOrtu,
} from '@/lib/rq/laporan-ortu'

/**
 * Tampilan HP laporan orang tua satu sesi — kartu per ananda, bukan tabel lebar.
 *
 * Hanya dipakai halaman publik /laporan/[token] di layar sempit. Lembar A4
 * (LembarLaporanOrtu) tetap dipakai di layar lebar, saat dicetak, dan di
 * layar guru untuk unduhan PNG/PDF — isinya sama, hanya susunannya berbeda.
 */
export function LaporanHP({ l }: { l: LaporanOrtu }) {
  const r = l.ringkas
  const adaTahfidz = l.anak.some(a => a.tahfidz.terakhir || a.tahfidz.totalHalaman > 0 || a.tahfidz.murojaah > 0)
  const adaTahsin = l.anak.some(a => !a.tahsin.selesai || a.tahsin.setoran > 0)

  return (
    <div className="space-y-4" style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}>
      <header className="rounded-2xl bg-[#0E3531] p-5 text-white">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-128.png" alt="" className="h-10 w-10 rounded-full bg-white" />
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#E3A93C]">
            Laporan Capaian Pembelajaran Al-Qur&apos;an
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-white/70">Sesi</dt><dd className="font-bold">{l.sesi.nama}</dd>
          <dt className="text-white/70">Pengampu</dt><dd className="font-bold">{l.guru.nama}</dd>
          <dt className="text-white/70">Periode</dt><dd className="font-bold">{l.periode.label}</dd>
        </dl>
      </header>

      {l.anak.length === 0 ? (
        <p className="rounded-2xl border bg-card py-8 text-center text-sm text-muted-foreground">
          Sesi ini belum berisi siswa aktif.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Kotak label="Pertemuan" nilai={`${l.hariPertemuan} hari`} ket="hari yang ada setoran" />
            <Kotak label="Ananda setor" nilai={`${r.anakSetor} / ${r.jumlahAnak}`} ket="anak" />
            {adaTahsin && <Kotak label="Tahsin" nilai={`${r.tahsinLulus} hal.`} ket="halaman lulus" />}
            {adaTahfidz && (
              <Kotak
                label="Tahfidz"
                nilai={`${angka1(r.ziyadahHalaman)} hal.`}
                ket={`hafalan baru · ${angka1(r.murojaahHalaman)} hal. muroja'ah`}
              />
            )}
          </div>

          {l.hariPertemuan === 0 && (
            <p className="rounded-xl bg-warning-wash px-4 py-3 text-xs text-warning">
              Belum ada setoran tercatat pada periode ini. Posisi terakhir tiap anak tetap ditampilkan di bawah.
            </p>
          )}

          <h2 className="pt-2 font-heading text-2xl">Per ananda</h2>
          <div className="space-y-3">
            {l.anak.map(a => (
              <KartuAnak key={a.id} a={a} pertemuan={l.hariPertemuan} tahsin={adaTahsin} tahfidz={adaTahfidz} />
            ))}
          </div>

          <details className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-bold">Cara membaca laporan</summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <b>Posisi</b> = capaian terakhir per tanggal cetak (tahsin: halaman terakhir yang lulus). <b>(+…)</b> = tambahan selama periode ini.
              Setor = hari Ananda setor dari seluruh hari pertemuan sesi. Halaman tahfidz dalam halaman mushaf Madinah.
            </p>
          </details>

          <footer className="rounded-2xl border bg-card p-5">
            <p className="font-heading text-base leading-relaxed">
              Semoga Allah menjadikan Ananda semua Ahlul Qur&apos;an. Mohon dukungan Ayah/Bunda untuk menyimak
              muroja&apos;ah Ananda di rumah. Jazakumullahu khairan.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Banguntapan, {tanggalPanjang(l.dicetak)} · Pengampu
            </p>
            <div className="flex h-14 items-center">
              {l.guru.ttdUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={l.guru.ttdUrl} alt="" className="max-h-14 max-w-[140px] object-contain" />
                : null}
            </div>
            <p className="inline-block border-t border-dashed pt-1 font-heading text-lg">{l.guru.nama}</p>
          </footer>
        </>
      )}
    </div>
  )
}

function Kotak({ label, nilai, ket }: { label: string; nilai: string; ket: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl leading-tight tabular-nums">{nilai}</p>
      <p className="text-[11px] leading-snug text-muted-foreground">{ket}</p>
    </div>
  )
}

function KartuAnak({ a, pertemuan, tahsin, tahfidz }: {
  a: AnakLaporan; pertemuan: number; tahsin: boolean; tahfidz: boolean
}) {
  const t = a.tahfidz
  const belum = a.hariSetor === 0
  const penuh = !belum && a.hariSetor >= pertemuan

  const lencana = belum
    ? { teks: 'Belum setor', kelas: 'bg-muted text-muted-foreground' }
    : {
        teks: pertemuan > 1 ? `Setor ${a.hariSetor}/${pertemuan}` : 'Setor ✓',
        kelas: penuh ? 'bg-primary-wash text-primary' : 'bg-accent-warm-wash text-accent-warm',
      }

  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-bold">
          {a.nama}
          {a.kelas && <span className="font-normal text-muted-foreground"> · {a.kelas}</span>}
        </p>
        <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold', lencana.kelas)}>{lencana.teks}</span>
      </div>

      {a.ujian.map(u => (
        <p key={u} className="mt-2 flex items-center gap-1.5 rounded-lg bg-success-wash px-3 py-1.5 text-xs font-bold text-success">
          <Check className="h-3.5 w-3.5" /> {u}
        </p>
      ))}

      <dl className="mt-2.5 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {tahsin && (
          <>
            <dt className="font-bold text-primary">Tahsin</dt>
            <dd>
              <p className="font-bold">{a.tahsin.posisi ?? '—'}</p>
              {a.tahsin.setoran > 0 && (
                <p className="text-xs text-muted-foreground">
                  {teksTahsinPeriode(a.tahsin) ?? 'belum ada halaman lulus'} · {a.tahsin.setoran}× setor
                </p>
              )}
            </dd>
          </>
        )}
        {tahfidz && (
          <>
            <dt className="font-bold text-accent-warm">Tahfidz</dt>
            <dd className="space-y-0.5 text-xs text-muted-foreground">
              <p className="text-sm font-bold text-foreground">{t.terakhir ?? '—'}</p>
              {t.ziyadahSetoran > 0 && (
                <p>
                  Ziyadah: {tambahHafalan(t.ziyadahHalaman, t.ziyadahAyat)}
                  {t.ziyadahHalaman >= 1 ? ` (${t.ziyadahAyat} ayat)` : ''} · {t.ziyadahSetoran}× setor
                </p>
              )}
              {t.murojaah > 0 && (
                <p>Muroja&apos;ah: {teksMurojaah(t)} · {t.murojaah}× setor</p>
              )}
              {t.totalHalaman > 0 && (
                <p>
                  Total hafalan: <b className="text-foreground">{labelTotalHafalan(t)}</b>
                  {t.sedangJuz ? ` · sedang juz ${t.sedangJuz}` : null}
                </p>
              )}
            </dd>
          </>
        )}
      </dl>
    </article>
  )
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function tanggalPanjang(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
}
