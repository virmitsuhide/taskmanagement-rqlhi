import { Target } from 'lucide-react'
import { capaianSemua, kurikulumBulan } from '@/lib/data/analitik-cache'
import { BELUM_TERCATAT, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import { formatPeriod, monthName } from '@/lib/finance/period'
import { Panel } from '@/components/dashboard/kit'
import { CapaianKelompokPanel } from '@/components/dashboard/CapaianKelompok'
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
export async function SeksiCapaian({ info, jenjang, program = null, fokus, bulan, tanpaTargetAngkatan }: {
  info: InfoSeksi
  jenjang: Jenjang | null
  /**
   * Penyempitan program (koor QULS SD). Matriks kelas sudah dipisah per jalur
   * reguler/QULS, jadi yang tersisa cukup kelompok jalur QULS.
   */
  program?: readonly string[] | null
  fokus: 'semua' | 'tahsin' | 'tahfidz'
  bulan: string
  /** Koordinator unit: tabel target per angkatan tidak perlu, sudah terwakili matriks. */
  tanpaTargetAngkatan?: boolean
}) {
  const [capaian, kurikulum] = await Promise.all([capaianSemua(), kurikulumBulan(bulan)])
  /*
    Cakupan unit HANYA dari filter Unit di atas halaman. Dulu seksi ini punya
    saringan unit kedua (?cunit=) dan, pada pilihan "Semua", hanya membuka
    satu unit — dua filter unit di satu halaman, dan "Semua" yang tidak
    menampilkan semua. Kini "Semua" = seluruh unit yang sudah punya siswa,
    berurutan menurut jenjang; kelompok tanpa siswa tidak ditampilkan.
  */
  const kelompok = capaian.kelompok.filter(k =>
    (!jenjang || k.jenjang === jenjang) && (!program || k.jalur === 'quls') && k.siswa > 0)
  const unit = UNIT_ORDER.filter(u => kelompok.some(k => k.jenjang === u))
  const angkatan = kurikulum.rows.filter(r => unit.includes(r.jenjang))

  const siswa = kelompok.reduce((n, k) => n + k.siswa, 0)
  const persen = (pilih: (k: typeof kelompok[number]) => MatriksCapaian[]) => {
    const capai = kelompok.reduce((n, k) => n + pilih(k).reduce((a, m) => a + m.maju, 0), 0)
    const target = kelompok.reduce((n, k) => n + pilih(k).reduce((a, m) => a + (m.bertarget ?? 0), 0), 0)
    return target > 0 ? `${Math.round((capai / target) * 100)}%` : '—'
  }
  const belumTotal = kelompok.reduce((n, k) => n + belum(k.tahsin) + k.tahfidz.reduce((a, m) => a + belum(m), 0), 0)

  if (kelompok.length === 0) {
    return (
      <Seksi info={info} judul="Capaian per Kelas" pertanyaan="Di jilid dan juz mana siswa tiap kelas berada?">
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground bg-muted/30">
          {jenjang ? 'Belum ada siswa aktif di unit ini.' : 'Belum ada siswa aktif di unit mana pun.'}
        </p>
      </Seksi>
    )
  }

  return (
    <Seksi
      info={info}
      judul="Capaian per Kelas"
      pertanyaan="Di jilid dan juz mana siswa tiap kelas berada?"
      catatan="setoran terakhir"
      kunci={
        <>
          <Kunci label="Siswa" nilai={siswa.toLocaleString('id-ID')} />
          {fokus !== 'tahfidz' && <Kunci label="Capai target tahsin" nilai={persen(k => [k.tahsin])} />}
          {fokus !== 'tahsin' && <Kunci label="Capai target tahfidz" nilai={persen(k => k.tahfidz)} />}
          <Kunci label="Belum ada setoran" nilai={belumTotal.toLocaleString('id-ID')} nada={belumTotal > 0 ? 'waspada' : 'baik'} />
        </>
      }
    >
      {unit.map(u => {
        const diUnit = kelompok.filter(k => k.jenjang === u)
        const siswaUnit = diUnit.reduce((n, k) => n + k.siswa, 0)
        return (
          <section key={u} className="space-y-5" aria-labelledby={`capaian-unit-${u}`}>
            {/* Kepala unit: penanda yang terbaca dari jauh di antara tabel-tabel
                besar — dulu hanya teks kapital abu-abu kecil yang tenggelam. */}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-2 pb-2" style={{ borderColor: 'var(--primary)' }}>
              <h3 id={`capaian-unit-${u}`} className="font-heading text-2xl leading-tight">{UNIT_LABELS[u]}</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{siswaUnit.toLocaleString('id-ID')}</span> siswa
                {diUnit.length > 1 && <> · {diUnit.length} jalur program</>}
              </p>
            </div>
            {diUnit.map(k => (
              <div key={k.kode} className="space-y-3">
                <LabelKelompok k={k} unit={u} />
                <CapaianKelompokPanel k={k} tampil={fokus} />
              </div>
            ))}
          </section>
        )
      })}

      {fokus !== 'tahfidz' && !tanpaTargetAngkatan && angkatan.length > 0 && (
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

/**
 * Penanda satu kelompok (jalur program) di bawah kepala unitnya: lencana jalur
 * + keterangan. Nama unit tidak diulang — sudah ada di kepala unit.
 */
function LabelKelompok({ k, unit }: { k: { judul: string; keterangan: string; siswa: number; metode: string[] }; unit: Jenjang }) {
  const awalan = `${UNIT_LABELS[unit]} — `
  const jalur = k.judul.startsWith(awalan) ? k.judul.slice(awalan.length) : null
  // Unit yang tidak dipisah per jalur (satu kelompok): nama & jumlah siswanya
  // sudah di kepala unit — cukup metode, tanpa lencana "Seluruh program".
  const rincian = [
    jalur ? k.keterangan : null,
    jalur ? `${k.siswa.toLocaleString('id-ID')} siswa` : null,
    k.metode.length ? `metode ${k.metode.join(', ')}` : null,
  ].filter(Boolean).join(' · ')
  if (!jalur && !rincian) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {jalur && (
        <span className="rounded-md px-2.5 py-1 text-sm font-semibold" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
          {jalur}
        </span>
      )}
      {rincian && <span className="text-xs text-muted-foreground">{rincian}</span>}
    </div>
  )
}

function belum(m: MatriksCapaian): number {
  const i = m.kolom.indexOf(BELUM_TERCATAT)
  return i === -1 ? 0 : m.jumlahKolom[i]
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
