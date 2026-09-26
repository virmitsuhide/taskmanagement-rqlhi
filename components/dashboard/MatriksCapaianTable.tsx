import { cn } from '@/lib/utils'
import { BELUM_TERCATAT, type BarisMatriks, type MatriksCapaian, type SiswaSel } from '@/lib/data/capaian-kelas'
import { RincianSel } from '@/components/dashboard/RincianSel'

/**
 * Tabel tingkat × level — padanan tabel "Capaian Tahsin/Tahfidz" di Laporan
 * Eksekutif. Tiap sel diwarnai tipis menurut porsinya dalam baris, supaya
 * "di mana kebanyakan anak kelas ini berada" terbaca sekilas; angkanya tetap
 * tercetak, jadi warna bukan satu-satunya pembawa makna.
 *
 * Tabel ini sengaja MUAT SELEBAR WADAHNYA, tanpa geser ke kanan: satu unit
 * harus terbaca utuh sekali pandang. Karena itu kolomnya dibagi rata
 * (table-fixed) dan di layar sempit judul kolom memakai singkatan.
 *
 * Bila matriksnya membawa rincian siswa, setiap angka (dan nama kelas) bisa
 * diklik untuk membuka daftar siswanya.
 *
 * Kolom tidak pernah diurut menurut jumlah — urutan jilid dan juz itu ordinal.
 */
export function MatriksCapaianTable({ matriks, kosong, kepalaBaris = 'Kelas', satuan = 'siswa', topik }: {
  matriks: MatriksCapaian
  kosong: string
  /** Judul kolom baris — 'Kelas' untuk siswa, 'Unit' untuk gukar. */
  kepalaBaris?: string
  satuan?: string
  /** Awalan judul dialog rincian, mis. 'SDIT — QULS · Tahsin'. */
  topik?: string
}) {
  if (matriks.total === 0) {
    return <p className="text-sm text-muted-foreground">{kosong}</p>
  }

  const belum = matriks.kolom.indexOf(BELUM_TERCATAT)
  const adaSingkatan = matriks.kolom.some(k => singkat(k) !== k)
  // Baris bernama (unit) butuh kolom label yang lebih lebar daripada nomor kelas.
  const barisBernama = matriks.baris.some(b => b.tingkat === null)
  const berbasisTarget = matriks.bertarget !== undefined
  const penyebut = (b: Pick<BarisMatriks, 'total' | 'bertarget'>, nBelum: number) =>
    berbasisTarget ? b.bertarget ?? 0 : b.total - nBelum
  const judulDialog = (b: BarisMatriks, kolom?: string) =>
    [topik, b.label, kolom === BELUM_TERCATAT ? 'Belum ada setoran' : kolom].filter(Boolean).join(' · ')

  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-0 text-[11px] sm:text-sm">
        <colgroup>
          <col className={barisBernama ? 'w-20 sm:w-36' : 'w-6 sm:w-20'} />
          {matriks.kolom.map(k => <col key={k} />)}
          <col className="w-7 sm:w-16" />
          <col className="w-8 sm:w-24" />
        </colgroup>
        <thead>
          <tr className="text-[10px] text-muted-foreground sm:text-[11px]">
            <th className="pb-2 text-left font-medium">
              <span className="sm:hidden">{barisBernama ? kepalaBaris : kepalaBaris.slice(0, 3)}</span><span className="hidden sm:inline">{kepalaBaris}</span>
            </th>
            {matriks.kolom.map(k => (
              <th
                key={k}
                title={matriks.kolomInfo?.[k] ?? k}
                className={cn(
                  'px-0 pb-2 sm:px-0.5 text-center font-medium leading-tight',
                  k === BELUM_TERCATAT && 'italic',
                  matriks.kolomInfo?.[k] && 'text-foreground',
                )}
              >
                <span className="sm:hidden">{singkat(k)}</span>
                <span className="hidden sm:inline">{k === BELUM_TERCATAT ? 'Belum' : k}</span>
              </th>
            ))}
            <th className="px-0 pb-2 sm:px-0.5 text-right font-medium">
              <span className="sm:hidden">Σ</span><span className="hidden sm:inline">Jumlah</span>
            </th>
            <th className="pb-2 pl-1 text-right font-medium leading-tight">
              <span className="sm:hidden">%</span><span className="hidden sm:inline">{matriks.labelMaju}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {matriks.baris.map(b => {
            const semua = b.rincian?.flat()
            return (
              <tr key={b.label}>
                <td className="truncate border-t py-1.5 pr-1 font-medium" title={b.target ? `${b.label} · target ${b.target}` : b.label}>
                  {semua ? (
                    <RincianSel judul={judulDialog(b)} siswa={semua} className="text-left">
                      <LabelBaris b={b} />
                    </RincianSel>
                  ) : <LabelBaris b={b} />}
                </td>
                {b.sel.map((n, i) => (
                  <Sel
                    key={matriks.kolom[i]}
                    n={n}
                    total={b.total}
                    redup={i === belum}
                    rincian={b.rincian?.[i]}
                    judul={judulDialog(b, matriks.kolom[i])}
                  />
                ))}
                <td className="border-t px-0 py-1.5 sm:px-0.5 text-right font-semibold tabular-nums">{b.total.toLocaleString('id-ID')}</td>
                <td className="border-t py-1.5 pl-1 text-right tabular-nums">
                  <Persen n={b.maju} dari={penyebut(b, belum >= 0 ? b.sel[belum] : 0)} warna={berbasisTarget} />
                </td>
              </tr>
            )
          })}
          <tr>
            <td className="border-t-2 py-1.5 font-semibold">
              <span className="sm:hidden">Σ</span><span className="hidden sm:inline">Total</span>
            </td>
            {matriks.jumlahKolom.map((n, i) => (
              <td key={matriks.kolom[i]} className={cn('border-t-2 px-0 py-1.5 sm:px-0.5 text-center font-semibold tabular-nums', n === 0 && 'text-muted-foreground/50')}>
                {n === 0 ? '·' : n.toLocaleString('id-ID')}
              </td>
            ))}
            <td className="border-t-2 px-0 py-1.5 sm:px-0.5 text-right font-bold tabular-nums">{matriks.total.toLocaleString('id-ID')}</td>
            <td className="border-t-2 py-1.5 pl-1 text-right font-semibold tabular-nums">
              <Persen n={matriks.maju} dari={penyebut(matriks, belum >= 0 ? matriks.jumlahKolom[belum] : 0)} warna={berbasisTarget} />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {adaSingkatan && (
          <span className="sm:hidden">
            J = Jilid, Qr = Al-Qur&apos;an, Gh = Gharib, Tj = Tajwid, Tsh = Tashih, BM = belum mengaji, Syj = Syajaroh, angka = juz, 3J/5J = tuntas 3/5 juz, Blm = belum ada setoran, % = {matriks.labelMaju.toLowerCase()}.{' '}
          </span>
        )}
        {berbasisTarget
          ? <>Persen = {satuan} yang sudah mencapai target kelasnya, dari {satuan} yang kelasnya punya target (yang belum setor terhitung belum mencapai)</>
          : <>Persen {matriks.labelMaju.toLowerCase()} dihitung dari {satuan} yang posisinya sudah tercatat</>}
        {matriks.dariRekap > 0 && (
          <> · {matriks.dariRekap.toLocaleString('id-ID')} siswa dari rekap bulanan guru karena belum ada setoran di aplikasi</>
        )}
        {belum >= 0 && matriks.jumlahKolom[belum] > 0 && (
          <> · <span className="font-medium text-warning">{matriks.jumlahKolom[belum].toLocaleString('id-ID')} {satuan} belum ada setoran</span> (kolom &ldquo;Belum&rdquo;)</>
        )}
        {matriks.baris.some(b => b.rincian) && <> · klik angka untuk melihat daftar siswanya</>}
      </p>
    </div>
  )
}

function LabelBaris({ b }: { b: BarisMatriks }) {
  return (
    <>
      <span className="sm:hidden">{b.tingkat ?? b.label}</span>
      <span className="hidden sm:inline">{b.label}</span>
    </>
  )
}

/** Judul kolom versi layar sempit. */
function singkat(k: string): string {
  if (k === BELUM_TERCATAT) return 'Blm'
  const jilid = /^Jilid (\d)$/.exec(k)
  if (jilid) return `J${jilid[1]}`
  const juz = /^Juz (\d+)$/.exec(k)
  if (juz) return juz[1]
  const peta: Record<string, string> = {
    "Al-Qur'an": 'Qr', Gharib: 'Gh', Ghorib: 'Gh', Tajwid: 'Tj', Lulus: 'Lls', Tashih: 'Tsh',
    'Belum mengaji': 'BM', Syajaroh: 'Syj', Lainnya: 'Lain', 'Khatam 30 juz': 'Kht',
    '3 juz': '3J', '5 juz': '5J',
  }
  return peta[k] ?? k
}

function Sel({ n, total, redup, rincian, judul }: {
  n: number
  total: number
  redup: boolean
  rincian?: SiswaSel[]
  judul: string
}) {
  if (n === 0) {
    return <td className="border-t px-0 py-1.5 sm:px-0.5 text-center text-muted-foreground/40">·</td>
  }
  // Porsi 0–100% dipetakan ke 8–45% warna: sel kecil tetap terlihat berisi,
  // sel terbesar tidak sampai menenggelamkan angkanya.
  const porsi = total > 0 ? n / total : 0
  const kuat = Math.round(8 + porsi * 37)
  const angka = n.toLocaleString('id-ID')
  return (
    <td
      className={cn('border-t px-0 py-1.5 sm:px-0.5 text-center tabular-nums', porsi >= 0.5 && 'font-semibold', redup && 'italic text-warning')}
      style={redup ? undefined : { background: `color-mix(in oklch, var(--primary) ${kuat}%, transparent)` }}
    >
      {rincian ? <RincianSel judul={judul} siswa={rincian}>{angka}</RincianSel> : angka}
    </td>
  )
}

function Persen({ n, dari, warna }: { n: number; dari: number; warna: boolean }) {
  if (dari <= 0) return <span className="text-muted-foreground" title="Target kelas belum diatur">—</span>
  const p = Math.round((n / dari) * 100)
  return (
    <span title={`${n} dari ${dari}`} className={cn(warna && (p >= 75 ? 'text-success' : p >= 50 ? 'text-warning' : 'text-destructive'))}>
      {p}%
      <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">({n})</span>
    </span>
  )
}
