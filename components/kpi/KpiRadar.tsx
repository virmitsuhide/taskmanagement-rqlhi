import type { BarisIndikator } from '@/lib/kpi/rapor-bulanan'

/**
 * Grafik radar 11 indikator KPI.
 *
 * SVG mentah, tanpa pustaka grafik. Bukan penghematan dependensi semata:
 * lembar ini dicetak, dan pustaka grafik berbasis canvas menghasilkan gambar
 * raster yang pecah di 300 dpi. SVG dicetak sebagai vektor, jadi garis dan
 * angkanya setajam teks di sebelahnya.
 *
 * Komponen server murni — tidak ada state, tidak ada hook, tidak ada efek.
 *
 * KENAPA SKALANYA 0–100, BUKAN 1–5
 *
 * Contoh rancangan yang jadi acuan memakai skala 1–5. Mesin KPI di aplikasi ini
 * menghasilkan 0–100 untuk tiap indikator; memampatkannya ke 1–5 hanya untuk
 * grafik akan membuat dua angka berbeda untuk hal yang sama muncul di satu
 * halaman — 84 di tabel, 4,2 di grafik — dan pembacanya harus menebak mana
 * yang benar. Level 1–5 tetap dicetak di tabel sebagai kolom tersendiri,
 * memakai ambang KPI_LEVELS yang sudah dipakai rubrik.
 */

interface Props {
  baris: BarisIndikator[]
  /** Sisi kotak gambar dalam piksel. */
  size?: number
}

const CINCIN = [20, 40, 60, 80, 100]

export function KpiRadar({ baris, size = 340 }: Props) {
  const n = baris.length
  if (n === 0) return null

  // Ruang untuk label di keempat sisi; jari-jarinya sisa setelah itu.
  const pad = 62
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - pad

  /** Sudut sumbu ke-i — dimulai dari atas, searah jarum jam. */
  const sudut = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / n

  const titik = (i: number, nilai: number) => {
    const r = (R * Math.max(0, Math.min(100, nilai))) / 100
    return [cx + r * Math.cos(sudut(i)), cy + r * Math.sin(sudut(i))] as const
  }

  /** Segi-11 pada radius tertentu — dipakai untuk cincin skala. */
  const cincin = (nilai: number) =>
    baris.map((_, i) => titik(i, nilai).join(',')).join(' ')

  const dataPoly = baris.map((b, i) => titik(i, b.nilai).join(',')).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: size }}
      role="img"
      aria-label={`Grafik radar 11 indikator KPI: ${baris.map(b => `${b.nama} ${b.nilai}`).join(', ')}`}
    >
      {/* Cincin skala */}
      {CINCIN.map(v => (
        <polygon
          key={v}
          points={cincin(v)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={v === 100 ? 1.2 : 0.7}
        />
      ))}

      {/* Sumbu tiap indikator */}
      {baris.map((b, i) => {
        const [x, y] = titik(i, 100)
        return <line key={b.no} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={0.7} />
      })}

      {/* Angka skala, ditulis sekali saja di sumbu vertikal atas */}
      {CINCIN.map(v => {
        const [, y] = titik(0, v)
        return (
          <text
            key={v}
            x={cx + 4}
            y={y + 3}
            fontSize={7}
            fill="var(--muted-foreground)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {v}
          </text>
        )
      })}

      {/* Bidang nilai */}
      <polygon
        points={dataPoly}
        fill="var(--primary)"
        fillOpacity={0.18}
        stroke="var(--primary)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />

      {/* Simpul tiap indikator */}
      {baris.map((b, i) => {
        const [x, y] = titik(i, b.nilai)
        return <circle key={b.no} cx={x} cy={y} r={2.6} fill="var(--primary)" />
      })}

      {/* Label + nilai di luar cincin terluar */}
      {baris.map((b, i) => {
        const a = sudut(i)
        const lx = cx + (R + 16) * Math.cos(a)
        const ly = cy + (R + 16) * Math.sin(a)
        const cos = Math.cos(a)
        // Label di sisi kanan dibaca dari kiri ke kanan, di sisi kiri sebaliknya;
        // yang tepat di atas/bawah dipusatkan agar tidak menabrak sumbunya.
        const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle'
        const dy = Math.sin(a) > 0.6 ? 6 : Math.sin(a) < -0.6 ? -2 : 2
        return (
          <text key={b.no} x={lx} y={ly + dy} textAnchor={anchor} fontSize={7.5} fill="var(--foreground)">
            <tspan>{b.no}. {b.singkat}</tspan>
            <tspan
              x={lx}
              dy={9}
              fontWeight={700}
              fill={b.nilai >= 81 ? 'var(--success)' : b.nilai >= 61 ? 'var(--primary)' : 'var(--destructive)'}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {b.nilai}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}

/**
 * Tren nilai rapot beberapa bulan terakhir — garis kecil di blok ringkasan.
 *
 * Bulan yang belum dinilai digambar sebagai jeda, bukan disambung: garis yang
 * menyambung Juni langsung ke Agustus membuat kenaikan dua bulan terbaca
 * seolah terjadi dalam satu bulan.
 */
export function KpiSparkline({
  titik, width = 190, height = 62,
}: {
  titik: { label: string; rapot: number | null }[]
  width?: number
  height?: number
}) {
  const isi = titik.filter(t => t.rapot !== null)
  if (isi.length === 0) return null

  const padX = 18
  const padTop = 16
  const padBottom = 16
  const nilai = isi.map(t => t.rapot!)
  const min = Math.min(...nilai)
  const max = Math.max(...nilai)
  // Rentang minimal 10 poin supaya perbedaan kecil tidak tergambar sebagai
  // lonjakan yang dramatis — dan supaya garis datar tetap datar, bukan membagi nol.
  const bawah = Math.min(min - 2, max - 10)
  const atas = max + 2

  const x = (i: number) => padX + (i * (width - padX * 2)) / Math.max(1, titik.length - 1)
  const y = (v: number) => padTop + (1 - (v - bawah) / (atas - bawah)) * (height - padTop - padBottom)

  // Ruas hanya digambar antara dua bulan yang sama-sama punya nilai.
  const ruas: string[] = []
  for (let i = 1; i < titik.length; i++) {
    const a = titik[i - 1].rapot
    const b = titik[i].rapot
    if (a === null || b === null) continue
    ruas.push(`M ${x(i - 1)} ${y(a)} L ${x(i)} ${y(b)}`)
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }} role="img"
      aria-label={`Tren nilai rapot: ${titik.map(t => `${t.label} ${t.rapot ?? 'belum dinilai'}`).join(', ')}`}>
      {ruas.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--foreground)" strokeWidth={1.4} />
      ))}
      {titik.map((t, i) => (
        <g key={t.label}>
          {t.rapot !== null && (
            <>
              <circle
                cx={x(i)}
                cy={y(t.rapot)}
                r={i === titik.length - 1 ? 4 : 3}
                fill={i === titik.length - 1 ? 'var(--primary)' : 'var(--foreground)'}
              />
              <text
                x={x(i)}
                y={y(t.rapot) - 7}
                textAnchor="middle"
                fontSize={7.5}
                fontWeight={i === titik.length - 1 ? 700 : 400}
                fill="var(--foreground)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {t.rapot.toFixed(1)}
              </text>
            </>
          )}
          <text
            x={x(i)}
            y={height - 3}
            textAnchor="middle"
            fontSize={7.5}
            fontWeight={i === titik.length - 1 ? 700 : 400}
            fill="var(--muted-foreground)"
          >
            {t.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
