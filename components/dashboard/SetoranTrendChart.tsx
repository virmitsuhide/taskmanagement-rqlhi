import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SetoranTrend, SetoranTrendPoint } from '@/lib/data/analytics'

/**
 * Tren setoran bulanan sebagai SVG inline — tanpa pustaka chart, sejalan
 * dengan ReportCharts.tsx: ikut tercetak, tidak menunggu JavaScript, dan
 * mewarisi token tema lewat var(--...) sehingga mode gelap ikut benar.
 *
 * Garis (bukan batang) karena sumbu X-nya waktu: batang antar-bulan
 * menyiratkan jumlah diskrit yang berdiri sendiri, padahal yang dibaca di sini
 * justru pergerakannya.
 */

const W = 620
const H = 240
const PAD = { top: 14, right: 14, bottom: 30, left: 42 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

/** Batas atas sumbu Y yang bulat supaya labelnya enak dibaca. */
function niceCeil(v: number): number {
  if (v <= 10) return 10
  const mag = 10 ** Math.floor(Math.log10(v))
  const step = mag / 2
  return Math.ceil(v / step) * step
}

/** Tren dari kurang dari enam titik bukan tren (skill dashboard-analitik). */
const MIN_TITIK = 6

/**
 * Buang bulan-bulan kosong di depan, sisakan minimal enam titik.
 *
 * Bulan sebelum data pertama memang tidak digambar (isBeforeData), tapi
 * sumbunya tetap memakan tempat: data yang baru ada sejak Juni terjepit di
 * sepertiga kanan grafik, dengan delapan label bulan kosong di kirinya.
 * Memotongnya melebarkan jarak antartitik tanpa mengubah satu angka pun.
 */
export function potongAwalKosong<T extends { isBeforeData: boolean }>(titik: T[]): T[] {
  const pertama = titik.findIndex(p => !p.isBeforeData)
  if (pertama <= 0) return titik
  return titik.slice(Math.max(0, Math.min(pertama, titik.length - MIN_TITIK)))
}

interface Props {
  trend: SetoranTrend
  /** 'YYYY-MM' bulan yang sedang dipilih di filter — diberi pita sorot. */
  highlightKey?: string
  /** Slicer program: hanya seri ini yang digambar. */
  fokus?: 'semua' | 'tahsin' | 'tahfidz'
}

export function SetoranTrendChart({ trend, highlightKey, fokus = 'semua' }: Props) {
  const { delta, isEmpty } = trend

  if (isEmpty) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        {/* Sumber tiap titik disebut terang-terangan. Bulan tertutup dibaca dari
          rangkuman, bulan berjalan dari setoran harian yang masih ditulis —
          dan pembaca berhak tahu angka terakhir belum setara dengan sebelumnya. */}
      <Heading catatan={
        trend.points.some(p => p.sumber === 'harian')
          ? 'Bulan tertutup dibaca dari rangkuman bulanan; bulan berjalan dari setoran harian yang masih berlangsung.'
          : 'Dibaca dari rangkuman bulanan.'
      } />
        <p className="text-sm text-muted-foreground">
          Belum ada capaian tercatat dalam 12 bulan terakhir.
        </p>
      </section>
    )
  }

  const maxY = niceCeil(trend.max)
  const points = potongAwalKosong(trend.points)
  const visible = points.map((p, i) => ({ ...p, i })).filter(p => !p.isBeforeData)

  const x = (i: number) => PAD.left + (points.length <= 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W)
  const y = (v: number) => PAD.top + PLOT_H - (v / maxY) * PLOT_H

  // Bulan berjalan dipisah dari garis utama: datanya belum lengkap, jadi
  // ruasnya digambar putus-putus supaya tidak dibaca setara bulan penuh.
  const settled = visible.filter(p => !p.isRunning)
  const running = visible.find(p => p.isRunning)

  const path = (pts: typeof visible, pick: (p: SetoranTrendPoint) => number) =>
    pts.map(p => `${x(p.i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')

  const tail = (pick: (p: SetoranTrendPoint) => number) => {
    const from = settled.at(-1)
    if (!from || !running) return null
    return `${x(from.i).toFixed(1)},${y(pick(from)).toFixed(1)} ${x(running.i).toFixed(1)},${y(pick(running)).toFixed(1)}`
  }

  const series = [
    { key: 'tahsin' as const, label: 'Tahsin', color: 'var(--seri-1)', pick: (p: SetoranTrendPoint) => p.tahsin },
    { key: 'tahfidz' as const, label: 'Tahfidz', color: 'var(--seri-2)', pick: (p: SetoranTrendPoint) => p.tahfidz },
  ].filter(s => fokus === 'semua' || s.key === fokus)
  const sorot = points.findIndex(p => p.key === highlightKey)
  const lebarPita = points.length > 1 ? PLOT_W / (points.length - 1) : PLOT_W

  const first = visible[0]
  const last = visible.at(-1)
  const ariaLabel = `Siswa tercatat per bulan, ${first?.full ?? ''} sampai ${last?.full ?? ''}. ` +
    visible.map(p => `${p.full}: tahsin ${p.tahsin}, tahfidz ${p.tahfidz}.`).join(' ')

  return (
    <section className="rounded-2xl border bg-card p-5">
      <Heading />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        {series.map(s => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />
            <span className="font-medium">{s.label}</span>
          </span>
        ))}
        {running && (
          <span className="text-xs text-muted-foreground">
            garis putus-putus = {running.short} masih berjalan
          </span>
        )}
      </div>

      {/* Pada layar sempit grafik digeser, bukan dikecilkan — teks sumbu yang
          ikut mengecil sampai 6px lebih buruk daripada scroll horizontal. */}
      <div className="overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          style={{ minWidth: 520 }}
          role="img"
          aria-label={ariaLabel}
        >
          {/* Pita bulan terpilih — menautkan grafik ke filter bulan di atas. */}
          {sorot >= 0 && (
            <rect
              x={x(sorot) - lebarPita / 2} y={PAD.top - 6} width={lebarPita} height={PLOT_H + 12}
              rx={6} fill="var(--primary-wash)"
            />
          )}

          {/* Kisi + label sumbu Y */}
          {[0, 0.5, 1].map(f => {
            const v = maxY * f
            return (
              <g key={f}>
                <line
                  x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
                  stroke="var(--border)" strokeWidth={1}
                />
                <text
                  x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle"
                  fontSize={11} fill="var(--muted-foreground)"
                >
                  {v.toLocaleString('id-ID')}
                </text>
              </g>
            )
          })}

          {/* Label sumbu X */}
          {points.map((p, i) => (
            <text
              key={p.key}
              x={x(i)} y={H - 10} textAnchor="middle"
              fontSize={11}
              fill={p.isRunning || i === sorot ? 'var(--foreground)' : 'var(--muted-foreground)'}
              fontWeight={p.isRunning || i === sorot ? 600 : 400}
            >
              {p.short}
            </text>
          ))}

          {/* Garis + penanda tiap seri. Bentuk penanda sengaja dibedakan
              (bulat vs kotak) supaya kedua seri tetap terbedakan saat dicetak
              hitam-putih atau dibaca mata yang sulit membedakan warna. */}
          {series.map(s => {
            const tailPts = tail(s.pick)
            return (
              <g key={s.key}>
                {settled.length > 1 && (
                  <polyline
                    points={path(settled, s.pick)}
                    fill="none" stroke={s.color} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round"
                  />
                )}
                {tailPts && (
                  <polyline
                    points={tailPts}
                    fill="none" stroke={s.color} strokeWidth={2}
                    strokeDasharray="4 4" strokeLinecap="round"
                  />
                )}
                {visible.map(p =>
                  s.key === 'tahsin' ? (
                    <circle
                      key={p.key} cx={x(p.i)} cy={y(s.pick(p))} r={3.2}
                      fill={p.isRunning ? 'var(--card)' : s.color}
                      stroke={s.color} strokeWidth={1.6}
                    />
                  ) : (
                    <rect
                      key={p.key} x={x(p.i) - 3} y={y(s.pick(p)) - 3} width={6} height={6}
                      fill={p.isRunning ? 'var(--card)' : s.color}
                      stroke={s.color} strokeWidth={1.6}
                    />
                  ),
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {delta && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 pt-4 border-t">
          {series.map(s => (
            <Delta key={s.key} label={s.label} pct={delta[s.key]} />
          ))}
          <span className="text-xs text-muted-foreground w-full">
            {delta.toLabel} dibanding {delta.fromLabel}. Bulan berjalan tidak ikut dihitung.
          </span>
        </div>
      )}
    </section>
  )
}

/**
 * Judul menyebut SANTRI, bukan setoran. Sejak sumbernya hibrida (0056), yang
 * dihitung tiap bulan adalah berapa anak punya catatan — satu-satunya besaran
 * yang bisa dijawab sama persis oleh setoran harian maupun rangkuman bulanan.
 */
function Heading({ catatan }: { catatan?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-lg font-medium flex items-center gap-2">
        <TrendingUp className="h-4 w-4" /> Siswa Tercatat per Bulan
      </h2>
      {catatan && <p className="mt-1 text-xs text-muted-foreground">{catatan}</p>}
    </div>
  )
}

/** Persentase perubahan; null kalau pembandingnya nol (bagi nol tak bermakna). */
function Delta({ label, pct }: { label: string; pct: number | null }) {
  if (pct === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {label} <span className="font-medium">belum bisa dibandingkan</span>
      </span>
    )
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  const tone = pct > 0 ? 'text-success' : pct < 0 ? 'text-destructive' : 'text-muted-foreground'
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${tone}`}>
        {pct > 0 ? '+' : ''}{pct.toLocaleString('id-ID')}%
      </span>
    </span>
  )
}
