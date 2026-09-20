import Link from 'next/link'
import { ABSENSI_META, persenHadir, STATUS_ABSENSI } from '@/lib/rq/absensi'
import { cn } from '@/lib/utils'
import type { AbsensiBulan } from '@/lib/data/absensi'

const HARI = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb']

/**
 * Daftar hadir satu sesi sepanjang sebulan — siswa × tanggal.
 *
 * Bentuknya sengaja dikembarkan dengan Progres per Sesi: kolom tanggal yang
 * sama, kolom nama yang menempel saat digeser, dan garis tebal tiap Senin
 * supaya "pekan ketiga" bisa ditemukan tanpa menghitung kolom.
 *
 * Tiga keadaan "tidak ada huruf" dibedakan, sebab ketiganya menuntut
 * tindakan yang berbeda:
 *   ·   belum diabsen — ada pertemuan, absensinya belum diisi
 *   ✕   tidak ada sesi — di luar jadwal program, atau ditiadakan (0084)
 *   ●   pertemuan terlewat — hari lampau yang tak seorang pun diabsen
 * Sel yang dibiarkan benar-benar kosong akan terbaca sebagai "tidak hadir",
 * dan itu kesalahan yang mahal.
 */
export function TabelAbsensi({ data, hariIni, tautanSiswa }: {
  data: AbsensiBulan
  /** 'YYYY-MM-DD' WIB, dihitung di server supaya tidak berbeda saat hidrasi. */
  hariIni: string
  tautanSiswa: string
}) {
  const adaAbsensi = data.baris.some(b => b.rekap.total > 0)
  // Hari yang sudah diabsen untuk siapa pun — pembeda "pertemuan terlewat"
  // dari "hari yang memang belum tiba".
  const sudahDiabsen = new Set(
    data.tanggal.filter(t => data.baris.some(b => b.sel[t])),
  )

  return (
    <div className="rounded-xl border bg-card">
      {!adaAbsensi && (
        <p className="border-b px-3 py-2 text-sm text-muted-foreground">
          Belum ada absensi di sesi ini pada bulan tersebut.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="sticky left-0 z-10 min-w-40 bg-card px-3 py-2 text-left font-medium">Siswa</th>
              {data.tanggal.map(t => {
                const d = new Date(`${t}T00:00:00`)
                const liburSesi = data.liburSesi[t]
                // Hari yang memang tidak ada sesinya tidak pernah "terlewat" —
                // tidak ada yang perlu diabsen di sana.
                const terlewat = !liburSesi && t < hariIni && !sudahDiabsen.has(t)
                return (
                  <th
                    key={t}
                    title={liburSesi
                      ? `Tidak ada sesi — ${liburSesi}`
                      : terlewat ? 'Belum ada absensi pada hari ini' : undefined}
                    className={cn(
                      'px-1.5 py-2 text-center font-medium',
                      d.getDay() === 1 && 'border-l-2',
                      t === hariIni && 'bg-primary-wash text-primary',
                      t > hariIni && 'opacity-50',
                      liburSesi && 'bg-muted/60',
                    )}
                  >
                    <span className="block text-[10px]">{HARI[d.getDay()]}</span>
                    <span className={cn('block text-sm tabular-nums', t === hariIni ? 'font-bold' : 'text-foreground')}>
                      {d.getDate()}
                    </span>
                    {liburSesi ? (
                      <span aria-hidden className="mx-auto mt-0.5 block text-[9px] leading-none text-muted-foreground">✕</span>
                    ) : terlewat ? (
                      <span aria-hidden className="mx-auto mt-0.5 block h-1 w-1 rounded-full" style={{ background: 'var(--warning)' }} />
                    ) : null}
                  </th>
                )
              })}
              <th className="sticky right-0 z-10 min-w-24 border-l-2 bg-card px-3 py-2 text-center font-medium">Hadir</th>
            </tr>
          </thead>

          <tbody>
            {data.baris.map(b => {
              const persen = persenHadir(b.rekap)
              return (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                    <Link href={`${tautanSiswa}${b.id}`} className="font-medium hover:underline">{b.nama}</Link>
                    {b.kelas && <span className="ml-1.5 text-[10px] text-muted-foreground">{b.kelas}</span>}
                  </td>

                  {data.tanggal.map(t => {
                    const isi = b.sel[t]
                    const libur = b.libur[t]
                    const d = new Date(`${t}T00:00:00`)
                    return (
                      <td
                        key={t}
                        className={cn('px-1.5 py-1.5 text-center', d.getDay() === 1 && 'border-l-2', libur && 'bg-muted/60')}
                      >
                        {isi ? (
                          <span
                            title={`${ABSENSI_META[isi.status].label}${isi.catatan ? ` — ${isi.catatan}` : ''}`}
                            className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white"
                            style={{ background: ABSENSI_META[isi.status].warna }}
                          >
                            {ABSENSI_META[isi.status].singkat}
                          </span>
                        ) : libur ? (
                          // Tidak ada sesi: bukan ketidakhadiran, dan bukan
                          // pekerjaan yang tertinggal.
                          <span title={`Tidak ada sesi — ${libur}`} className="text-muted-foreground/70">✕</span>
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </td>
                    )
                  })}

                  <td className="sticky right-0 z-10 border-l-2 bg-card px-3 py-1.5 text-center tabular-nums">
                    {b.rekap.total === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className="font-semibold">{b.rekap.hadir}</span>
                        <span className="text-muted-foreground">/{b.rekap.total}</span>
                        <span className={cn('ml-1 text-[10px]', (persen ?? 0) < 75 && 'font-semibold text-[color:var(--destructive)]')}>
                          {persen}%
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legenda — satu huruf tidak menjelaskan dirinya sendiri. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-3 py-2 text-[11px] text-muted-foreground">
        {STATUS_ABSENSI.map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ background: ABSENSI_META[s].warna }}>
              {ABSENSI_META[s].singkat}
            </span>
            {ABSENSI_META[s].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/40">·</span> belum diabsen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/70">✕</span> tidak ada sesi
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--warning)' }} />
          pertemuan terlewat
        </span>
      </div>
    </div>
  )
}
