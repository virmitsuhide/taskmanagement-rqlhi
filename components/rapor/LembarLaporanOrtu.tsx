import { cn } from '@/lib/utils'
import {
  angka1, labelTotalHafalan, tambahHafalan,
  type AnakLaporan, type LaporanOrtu,
} from '@/lib/rq/laporan-ortu'

/**
 * Lembar A4 laporan orang tua satu sesi.
 *
 * Dipakai dua tempat dengan markup yang sama persis: layar guru di
 * /guru/laporan-ortu (untuk dicetak jadi PDF) dan halaman publik
 * /laporan/[token] yang dibuka wali tanpa login. Satu komponen, supaya
 * lembar yang dilihat guru dan yang dibaca wali tidak pernah berbeda.
 */

// ─── Lembar A4 ───────────────────────────────────────────────────────────────

export function LembarLaporanOrtu({ l }: { l: LaporanOrtu }) {
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

