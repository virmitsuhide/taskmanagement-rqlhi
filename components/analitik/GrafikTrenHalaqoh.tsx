import { monthName } from '@/lib/finance/period'

export interface TitikGrafik {
  bulan: string
  nilai: number | null
  rata: number | null
}

/**
 * Grafik garis satu halaqoh vs rata-rata pembanding (SVG, tanpa pustaka).
 * Aksesibel: gambar disembunyikan dari pembaca layar, digantikan tabel
 * data tersembunyi (sr-only). Bulan tanpa data tidak digambar.
 */
export function GrafikTrenHalaqoh({ titik, labelSeri, labelRata, format, berjalan, judul }: {
  titik: TitikGrafik[]
  labelSeri: string
  labelRata: string
  format: (v: number | null) => string
  /** Titik terakhir = bulan berjalan → ruas terakhir putus-putus. */
  berjalan: boolean
  judul: string
}) {
  const W = 640, H = 220, kiri = 36, kanan = 16, atas = 12, bawah = 28
  const semua = titik.flatMap(t => [t.nilai, t.rata]).filter((v): v is number => v !== null)
  if (titik.filter(t => t.nilai !== null).length < 2) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Grafik muncul setelah ada data dua bulan.</p>
  }
  let min = Math.min(...semua), max = Math.max(...semua)
  if (max === min) { max += 1; min = Math.max(0, min - 1) }
  const rentang = max - min
  min = Math.max(0, min - rentang * 0.15); max = max + rentang * 0.15
  const x = (i: number) => kiri + (titik.length === 1 ? 0 : (i * (W - kiri - kanan)) / (titik.length - 1))
  const y = (v: number) => atas + (1 - (v - min) / (max - min)) * (H - atas - bawah)
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3)

  const garis = (ambil: (t: TitikGrafik) => number | null) => {
    const ruas: { d: string; putus: boolean }[] = []
    for (let i = 1; i < titik.length; i++) {
      const a = ambil(titik[i - 1]), b = ambil(titik[i])
      if (a === null || b === null) continue
      ruas.push({ d: `M${x(i - 1)},${y(a)}L${x(i)},${y(b)}`, putus: berjalan && i === titik.length - 1 })
    }
    return ruas
  }

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" aria-hidden />{labelSeri}</span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke="var(--accent-warm)" strokeWidth="2" strokeDasharray="3 2" /></svg>
          {labelRata}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={kiri} x2={W - kanan} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={kiri - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
              {t.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        {titik.map((t, i) => (
          <text key={t.bulan} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
            {monthName(t.bulan).slice(0, 3)}
          </text>
        ))}
        {garis(t => t.rata).map((r, i) => (
          <path key={`r${i}`} d={r.d} stroke="var(--accent-warm)" strokeWidth="2" fill="none" strokeDasharray="5 4" />
        ))}
        {titik.map((t, i) => t.rata !== null && <circle key={`rc${i}`} cx={x(i)} cy={y(t.rata)} r="3" fill="var(--accent-warm)" />)}
        {garis(t => t.nilai).map((r, i) => (
          <path key={`n${i}`} d={r.d} stroke="var(--primary)" strokeWidth="2.5" fill="none" strokeDasharray={r.putus ? '6 4' : undefined} />
        ))}
        {titik.map((t, i) => t.nilai !== null && (
          <circle key={`nc${i}`} cx={x(i)} cy={y(t.nilai)} r="4" fill="var(--primary)">
            <title>{`${monthName(t.bulan)}: ${format(t.nilai)}`}</title>
          </circle>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{judul}</caption>
        <thead><tr><th>Bulan</th><th>{labelSeri}</th><th>{labelRata}</th></tr></thead>
        <tbody>
          {titik.map(t => <tr key={t.bulan}><td>{monthName(t.bulan)}</td><td>{format(t.nilai)}</td><td>{format(t.rata)}</td></tr>)}
        </tbody>
      </table>
    </figure>
  )
}
