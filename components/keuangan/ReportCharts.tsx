import { formatJuta, percentOf } from '@/lib/finance/period'

/**
 * Diagram laporan (1.2.2, 1.3.2, dan 1.9) sebagai SVG inline.
 *
 * Tanpa pustaka grafik: SVG statis ikut tercetak apa adanya, tidak perlu
 * menunggu JavaScript, dan tetap tajam di kertas — tiga hal yang justru
 * sering bermasalah pada pustaka chart berbasis canvas.
 *
 * Paletnya mengikuti template docx: navy, biru, dan emas.
 */

const SLICE_COLORS = [
  '#1b2a4a', '#2e75b6', '#8eaadb', '#c8952a',
  '#0f6e56', '#bdd6ee', '#d0cece',
]

interface Slice {
  label: string
  value: number
}

/**
 * Donat + legenda. Pos bernilai nol dilewati supaya legendanya tidak penuh
 * baris kosong — di laporan, pos nihil sudah terlihat di tabel di atasnya.
 */
export function DonutChart({ slices, title }: { slices: Slice[]; title: string }) {
  const data = slices.filter(s => s.value > 0)
  const total = data.reduce((sum, s) => sum + s.value, 0)
  if (!total) return null

  const radius = 54
  const stroke = 26
  const circumference = 2 * Math.PI * radius

  // Tiap potongan digambar sebagai satu lingkaran ber-dash: panjang garisnya
  // sepanjang potongan, lalu digeser sejauh potongan-potongan sebelumnya.
  const arcs: { length: number; offset: number; color: string; slice: Slice }[] = []
  for (const [i, slice] of data.entries()) {
    const previous = arcs[i - 1]
    const consumed = previous ? -previous.offset + previous.length : 0
    arcs.push({
      length: (slice.value / total) * circumference,
      offset: -consumed,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      slice,
    })
  }

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={150} height={150} viewBox="0 0 150 150" role="img" aria-label={title}>
        {/* Rotasi -90° supaya potongan pertama mulai dari jam 12. */}
        <g transform="rotate(-90 75 75)">
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={75} cy={75} r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={arc.offset}
            />
          ))}
        </g>
        <text
          x={75} y={73} textAnchor="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: '#1b2a4a' }}
        >
          {formatJuta(total).replace('Rp ', '')}
        </text>
        <text
          x={75} y={86} textAnchor="middle"
          style={{ fontSize: 8, fill: '#6b7280' }}
        >
          total
        </text>
      </svg>

      <ul style={{ fontSize: 11, listStyle: 'none', margin: 0, padding: 0, minWidth: 190 }}>
        {arcs.map((arc, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
            <span style={{ width: 9, height: 9, background: arc.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{arc.slice.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {percentOf(arc.slice.value, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface MonthBar {
  label: string
  income: number
  expense: number
  subsidi: number
}

/**
 * Diagram cashflow 1.9 — batang berpasangan pemasukan vs pengeluaran per
 * bulan, dengan porsi subsidi Yayasan diarsir lebih gelap di dalam batang
 * pemasukan. Itu pembacaan pokok bab kemandirian: berapa bagian pemasukan
 * yang sebenarnya bukan hasil sendiri.
 */
export function CashflowChart({ months }: { months: MonthBar[] }) {
  if (months.length === 0) return null

  const width = 560
  const height = 190
  const padLeft = 46
  const padBottom = 26
  const padTop = 12
  const plotWidth = width - padLeft - 12
  const plotHeight = height - padBottom - padTop

  const peak = Math.max(...months.flatMap(m => [m.income, m.expense]), 1)
  // Bulatkan skala ke atas ke kelipatan 25 juta supaya garis bantu jatuh di
  // angka yang enak dibaca, bukan di nilai puncak yang ganjil.
  const step = 25_000_000
  const scaleMax = Math.ceil(peak / step) * step
  const gridLines = Array.from({ length: scaleMax / step + 1 }, (_, i) => i * step)

  const slotWidth = plotWidth / months.length
  const barWidth = Math.min(20, slotWidth / 3.2)
  const y = (value: number) => padTop + plotHeight - (value / scaleMax) * plotHeight

  return (
    <svg
      width="100%" viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label="Diagram cashflow bulanan"
      style={{ maxWidth: width }}
    >
      {gridLines.map(value => (
        <g key={value}>
          <line
            x1={padLeft} x2={width - 12} y1={y(value)} y2={y(value)}
            stroke="#e5e7eb" strokeWidth={1}
          />
          <text
            x={padLeft - 6} y={y(value) + 3} textAnchor="end"
            style={{ fontSize: 8, fill: '#6b7280' }}
          >
            {value / 1_000_000}
          </text>
        </g>
      ))}
      <text
        x={4} y={padTop - 3}
        style={{ fontSize: 8, fill: '#6b7280' }}
      >
        Juta Rp
      </text>

      {months.map((month, i) => {
        const slotX = padLeft + i * slotWidth
        const incomeX = slotX + slotWidth / 2 - barWidth - 2
        const expenseX = slotX + slotWidth / 2 + 2

        return (
          <g key={month.label}>
            {/* Batang pemasukan: bagian mandiri (biru) + subsidi (navy). */}
            <rect
              x={incomeX} y={y(month.income)} width={barWidth}
              height={Math.max(padTop + plotHeight - y(month.income), 0)}
              fill="#8eaadb"
            />
            {month.subsidi > 0 && (
              <rect
                x={incomeX} y={y(month.subsidi)} width={barWidth}
                height={Math.max(padTop + plotHeight - y(month.subsidi), 0)}
                fill="#1b2a4a"
              />
            )}
            <rect
              x={expenseX} y={y(month.expense)} width={barWidth}
              height={Math.max(padTop + plotHeight - y(month.expense), 0)}
              fill="#c8952a"
            />
            <text
              x={slotX + slotWidth / 2} y={height - 12} textAnchor="middle"
              style={{ fontSize: 8.5, fill: '#1b2a4a' }}
            >
              {month.label}
            </text>
          </g>
        )
      })}

      <line
        x1={padLeft} x2={width - 12} y1={padTop + plotHeight} y2={padTop + plotHeight}
        stroke="#1b2a4a" strokeWidth={1}
      />

      {/* Legenda ditempel di dalam SVG supaya ikut terbawa saat dicetak. */}
      <g transform={`translate(${padLeft}, ${height - 3})`}>
        {[
          { color: '#8eaadb', label: 'Pemasukan mandiri' },
          { color: '#1b2a4a', label: 'Subsidi Yayasan' },
          { color: '#c8952a', label: 'Pengeluaran' },
        ].map((item, i) => (
          <g key={item.label} transform={`translate(${i * 145}, 0)`}>
            <rect width={8} height={8} y={-8} fill={item.color} />
            <text x={12} y={-1} style={{ fontSize: 8.5, fill: '#1b2a4a' }}>{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
