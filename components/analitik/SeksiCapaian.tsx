import { BookMarked, BookOpen, Target } from 'lucide-react'
import { capaianSemua, kurikulumBulan } from '@/lib/data/analitik-cache'
import { BELUM_TERCATAT, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { formatPeriod, monthName } from '@/lib/finance/period'
import { Panel, GroupLabel } from '@/components/dashboard/kit'
import { MatriksCapaianTable } from '@/components/dashboard/MatriksCapaianTable'
import { Seksi, Kunci, type InfoSeksi } from './seksi'
import type { Jenjang } from '@/types'

/**
 * Seksi 2 — sebaran jilid & juz tiap kelas (posisi hari ini), lalu
 * ketercapaian target tahsin per angkatan (rekap bulanan).
 *
 * Dua bagian ini menjawab pertanyaan berbeda dan sengaja tidak diulang:
 * matriks = "di mana anak-anak berada sekarang", tabel target = "berapa
 * yang sudah memenuhi target semesternya, dari bulan ke bulan". Sebaran
 * per angkatan versi rekap bulanan (halaman Kurikulum) tidak ditampilkan
 * lagi di sini karena sudah diwakili matriks.
 */
export async function SeksiCapaian({ info, jenjang, fokus, bulan }: {
  info: InfoSeksi
  jenjang: Jenjang | null
  fokus: 'semua' | 'tahsin' | 'tahfidz'
  bulan: string
}) {
  const [capaian, kurikulum] = await Promise.all([capaianSemua(), kurikulumBulan(bulan)])
  const kelompok = capaian.kelompok.filter(k => !jenjang || k.jenjang === jenjang)
  const angkatan = kurikulum.rows.filter(r => !jenjang || r.jenjang === jenjang)

  const siswa = kelompok.reduce((n, k) => n + k.siswa, 0)
  const persen = (pilih: (k: typeof kelompok[number]) => MatriksCapaian) => {
    const maju = kelompok.reduce((n, k) => n + pilih(k).maju, 0)
    const tercatat = kelompok.reduce((n, k) => n + pilih(k).total - belum(pilih(k)), 0)
    return tercatat > 0 ? `${Math.round((maju / tercatat) * 100)}%` : '—'
  }
  const belumTotal = kelompok.reduce((n, k) => n + belum(k.tahsin) + belum(k.tahfidz), 0)

  if (kelompok.length === 0) {
    return (
      <Seksi info={info} judul="Capaian per Kelas" pertanyaan="Di jilid dan juz mana siswa tiap kelas berada?">
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground bg-muted/30">
          Matriks capaian per kelas tersedia untuk SDIT (CLIL, QULS) dan SMPIT. Unit ini belum termasuk.
        </p>
      </Seksi>
    )
  }

  return (
    <Seksi
      info={info}
      judul="Capaian per Kelas"
      pertanyaan="Di jilid dan juz mana siswa tiap kelas berada?"
      catatan="posisi hari ini"
      kunci={
        <>
          <Kunci label="Siswa" nilai={siswa.toLocaleString('id-ID')} />
          {fokus !== 'tahfidz' && <Kunci label="Sudah Al-Qur'an" nilai={persen(k => k.tahsin)} />}
          {fokus !== 'tahsin' && <Kunci label="Lewat Juz 30" nilai={persen(k => k.tahfidz)} />}
          <Kunci label="Belum tercatat" nilai={belumTotal.toLocaleString('id-ID')} nada={belumTotal > 0 ? 'waspada' : 'baik'} />
        </>
      }
    >
      {kelompok.map(k => (
        <div key={k.kode} className="space-y-3">
          <GroupLabel note={`${k.keterangan} · ${k.siswa.toLocaleString('id-ID')} siswa${k.metode.length ? ` · ${k.metode.join(', ')}` : ''}`}>
            {k.judul}
          </GroupLabel>
          {fokus !== 'tahfidz' && (
            <Panel title="Tahsin" icon={<BookOpen className="h-4 w-4" />} sub="Jilid/tahap yang sedang dijalani">
              <MatriksCapaianTable matriks={k.tahsin} kosong={kosongDari(k.kode, k.judul)} />
            </Panel>
          )}
          {fokus !== 'tahsin' && (
            <Panel title="Tahfidz" icon={<BookMarked className="h-4 w-4" />} sub="Juz yang sedang dihafal — setoran & ujian, yang terjauh">
              <MatriksCapaianTable matriks={k.tahfidz} kosong={kosongDari(k.kode, k.judul)} />
            </Panel>
          )}
        </div>
      ))}

      {fokus !== 'tahfidz' && angkatan.length > 0 && (
        <Panel
          title="Ketercapaian Target Tahsin per Angkatan"
          icon={<Target className="h-4 w-4" />}
          sub={`Dari rekap bulanan guru · jumlah siswa yang mencapai target semester, s.d. ${formatPeriod(bulan)}`}
          action={{ href: '/dashboard/analitik/kurikulum', label: 'Rincian' }}
        >
          <TabelTarget periods={kurikulum.periods} rows={angkatan} bulan={bulan} />
        </Panel>
      )}
    </Seksi>
  )
}

function belum(m: MatriksCapaian): number {
  const i = m.kolom.indexOf(BELUM_TERCATAT)
  return i === -1 ? 0 : m.jumlahKolom[i]
}

function kosongDari(kode: string, judul: string): string {
  return kode === 'quls'
    ? 'Belum ada siswa SDIT yang ditandai program QULS. Tandai programnya di data siswa agar kelas QULS muncul di sini.'
    : `Belum ada siswa aktif di ${judul}.`
}

/**
 * Tabel angkatan × bulan. Hanya 6 bulan terakhir yang ditampilkan supaya
 * tabelnya muat tanpa geser — riwayat lengkap ada di halaman rinciannya.
 */
function TabelTarget({ periods, rows, bulan }: {
  periods: string[]
  rows: Awaited<ReturnType<typeof kurikulumBulan>>['rows']
  bulan: string
}) {
  const tampil = periods.slice(-6)
  return (
    <table className="w-full table-fixed text-xs sm:text-sm">
      <thead>
        <tr className="border-b text-left text-[10px] text-muted-foreground sm:text-[11px]">
          <th className="w-[28%] py-2 pr-2 font-medium">Angkatan</th>
          <th className="hidden w-[18%] py-2 pr-2 font-medium sm:table-cell">Target</th>
          {tampil.map(p => (
            <th key={p} className="py-2 text-right font-medium">{monthName(p).slice(0, 3)}</th>
          ))}
          <th className="w-12 py-2 pl-2 text-right font-medium">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const kini = row.bulanan.find(b => b.period === bulan)
          const persen = kini?.tercatat ? kini.percent : null
          return (
            <tr key={`${row.jenjang}-${row.tingkat}`} className="border-b last:border-0">
              <td className="truncate py-1.5 pr-2 font-medium">{JENJANG_LABELS[row.jenjang]} {row.tingkat}</td>
              <td className="hidden truncate py-1.5 pr-2 text-muted-foreground sm:table-cell">
                {row.targetTahsin || <span className="text-warning">belum diatur</span>}
              </td>
              {tampil.map(p => {
                const b = row.bulanan.find(x => x.period === p)
                return (
                  <td key={p} className="py-1.5 text-right tabular-nums">
                    {!b || b.tercatat === 0 ? <span className="text-muted-foreground/50">—</span> : b.tercapai}
                  </td>
                )
              })}
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                {persen === null ? <span className="text-muted-foreground">—</span> : (
                  <span className={persen >= 75 ? 'text-success' : persen >= 50 ? 'text-warning' : 'text-destructive'}>{persen}%</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
