/**
 * Diagram laporan keuangan BPH (1.2.2, 1.3.2, 1.8) sebagai SVG inline —
 * tercetak tanpa JavaScript, tetap tajam di kertas. Palet & bentuknya
 * mengikuti laporan September 2026: satu pos selalu satu warna di semua
 * diagram, angka (juta, satu desimal) tertulis di dalam potongan.
 */

/** Warna tetap per pos. */
const WARNA_POS: Record<string, string> = {
  // pemasukan
  subsidi_yayasan: '#c9a227', proposal_yayasan: '#8e7cc3', sd: '#2a7d65',
  sd_quls_takhassus: '#5bb399', smp: '#2e5d8f', ekstra: '#e08a1e', lain_lain: '#9aa3ad',
  // pengeluaran
  gaji_yys: '#2a7d65', gaji_os_sd: '#2e5d8f', gaji_os_smp: '#5b9bd5', gaji_ekstra: '#c9a227',
  biaya_operasional: '#a6a6a6', program: '#e08a1e', 'lain_lain:keluar': '#9b72cf',
}

export const warnaPos = (slug: string, kind: 'pemasukan' | 'pengeluaran') =>
  WARNA_POS[kind === 'pengeluaran' && slug === 'lain_lain' ? 'lain_lain:keluar' : slug] ?? '#9aa3ad'

const NAVY = '#1f3864'
const jtTeks = (n: number) => (n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })
const persenTeks = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`

export interface Seri { label: string; warna: string; nilai: number[] }

/** Skala sumbu Y yang "bulat" (juta): kelipatan 2, 5, 10, atau 20. */
function skala(maks: number): { atas: number; langkah: number } {
  const jt = Math.max(maks / 1_000_000, 1)
  const langkah = jt <= 12 ? 2 : jt <= 30 ? 5 : jt <= 60 ? 10 : 20
  return { atas: Math.ceil((jt * 1.08) / langkah) * langkah * 1_000_000, langkah: langkah * 1_000_000 }
}

/** Donat komposisi satu bulan, total di tengah, persen di dalam potongan. */
export function DonatKomposisi({ judul, potongan }: { judul: string; potongan: { label: string; warna: string; nilai: number }[] }) {
  const data = potongan.filter(p => p.nilai > 0)
  const total = data.reduce((n, p) => n + p.nilai, 0)
  if (!total) return <p style={{ fontSize: 11, opacity: 0.6 }}>Belum ada data bulan ini.</p>
  const cx = 150, cy = 150, R = 118, r = 70
  // Sudut awal tiap potongan = jumlah potongan sebelumnya (dihitung, bukan variabel berjalan).
  const awalSudut = data.map((_, i) => -Math.PI / 2 + (data.slice(0, i).reduce((n, q) => n + q.nilai, 0) / total) * Math.PI * 2)
  const busur = data.map((p, i) => {
    const a0 = awalSudut[i], a1 = a0 + (p.nilai / total) * Math.PI * 2
    const besar = a1 - a0 > Math.PI ? 1 : 0
    const titik = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`
    // Satu potongan penuh (100%) tidak bisa digambar sebagai busur tunggal.
    const d = data.length === 1
      ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`
      : `M ${titik(R, a0)} A ${R} ${R} 0 ${besar} 1 ${titik(R, a1)} L ${titik(r, a1)} A ${r} ${r} 0 ${besar} 0 ${titik(r, a0)} Z`
    const tengah = (a0 + a1) / 2
    return { ...p, d, lx: cx + ((R + r) / 2) * Math.cos(tengah), ly: cy + ((R + r) / 2) * Math.sin(tengah), persen: (p.nilai / total) * 100 }
  })
  return (
    <svg width="100%" viewBox="0 0 560 310" role="img" aria-label={judul} style={{ maxWidth: 560, display: 'block', margin: '0 auto' }}>
      <text x={280} y={14} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: '#111', fontFamily: 'Georgia, serif' }}>{judul}</text>
      <g transform="translate(0 6)">
        {busur.map(b => (
          <g key={b.label}>
            <path d={b.d} fill={b.warna} stroke="#fff" strokeWidth={2}><title>{`${b.label}: Rp ${b.nilai.toLocaleString('id-ID')}`}</title></path>
            {b.persen >= 4 && <text x={b.lx} y={b.ly + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#fff', fontFamily: 'Georgia, serif' }}>{`${Math.round(b.persen)}%`}</text>}
          </g>
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: NAVY, fontFamily: 'Georgia, serif' }}>{`Rp ${jtTeks(total).replace(',', '.')} Jt`}</text>
        {busur.map((b, i) => (
          <g key={b.label} transform={`translate(330 ${cy - busur.length * 9 + i * 18})`}>
            <rect width={18} height={7} y={-7} fill={b.warna} />
            <text x={26} y={0} style={{ fontSize: 10.5, fill: '#222', fontFamily: 'Georgia, serif' }}>{b.label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/**
 * Batang bertumpuk per bulan (1.8.1, 1.8.2, 1.8.4). Angka di dalam potongan
 * bila cukup tinggi; total di atas batang.
 */
export function BatangBertumpuk({ judul, bulan, seri, persenDalam, total: labelTotal = t => `Rp ${jtTeks(t)} Jt` }: {
  judul: string
  bulan: string[]
  seri: Seri[]
  /** Tulis juga persen potongan terhadap batangnya, mis. "42,4 (54,5%)". */
  persenDalam?: boolean
  total?: (t: number) => string
}) {
  const aktif = seri.filter(s => s.nilai.some(v => v > 0))
  if (bulan.length === 0 || aktif.length === 0) return null
  const W = 620, H = 310, kiri = 48, kanan = 12, atasP = 34, bawah = 60
  const total = bulan.map((_, i) => aktif.reduce((n, s) => n + (s.nilai[i] ?? 0), 0))
  const { atas, langkah } = skala(Math.max(...total))
  const tinggi = H - atasP - bawah, lebar = W - kiri - kanan
  const slot = lebar / bulan.length, bw = Math.min(120, slot * 0.55)
  const y = (v: number) => atasP + tinggi - (v / atas) * tinggi
  const garis = Array.from({ length: Math.round(atas / langkah) + 1 }, (_, i) => i * langkah)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={judul} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <text x={W / 2} y={14} textAnchor="middle" style={{ fontSize: 11.5, fontWeight: 700, fill: '#111', fontFamily: 'Georgia, serif' }}>{judul}</text>
      {garis.map(v => (
        <g key={v}>
          <line x1={kiri} x2={W - kanan} y1={y(v)} y2={y(v)} stroke="#eef0f3" />
          <text x={kiri - 6} y={y(v) + 3} textAnchor="end" style={{ fontSize: 8.5, fill: '#555' }}>{v / 1_000_000}</text>
        </g>
      ))}
      <text transform={`translate(13 ${atasP + tinggi / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 8.5, fill: '#555' }}>Juta Rp</text>
      {bulan.map((b, i) => {
        const x = kiri + slot * i + (slot - bw) / 2
        let dasar = 0
        return (
          <g key={b}>
            {aktif.map(s => {
              const v = s.nilai[i] ?? 0
              if (v <= 0) return null
              const y0 = y(dasar + v), h = y(dasar) - y0
              dasar += v
              const teks = persenDalam && total[i] ? `${jtTeks(v)} (${persenTeks((v / total[i]) * 100)})` : jtTeks(v)
              return (
                <g key={s.label}>
                  <rect x={x} y={y0} width={bw} height={Math.max(h - 0.8, 0.5)} fill={s.warna}><title>{`${b} · ${s.label}: Rp ${v.toLocaleString('id-ID')}`}</title></rect>
                  {h >= 12 && <text x={x + bw / 2} y={y0 + h / 2 + 3} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: '#fff' }}>{teks}</text>}
                </g>
              )
            })}
            <text x={x + bw / 2} y={y(total[i]) - 5} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: NAVY }}>{labelTotal(total[i])}</text>
            <text x={x + bw / 2} y={atasP + tinggi + 13} textAnchor="middle" style={{ fontSize: 9.5, fill: '#222' }}>{b}</text>
          </g>
        )
      })}
      <line x1={kiri} x2={W - kanan} y1={atasP + tinggi} y2={atasP + tinggi} stroke="#333" />
      <Legenda seri={aktif} y={H - 28} lebar={W} />
    </svg>
  )
}

/** Batang berkelompok: kategori = sumber, satu batang per bulan (1.8.3). */
export function BatangBerkelompok({ judul, kategori, bulan }: {
  judul: string
  kategori: { label: string; nilai: number[] }[]
  bulan: string[]
}) {
  const kat = kategori.filter(k => k.nilai.some(v => v > 0))
  if (kat.length === 0 || bulan.length === 0) return null
  const W = 620, H = 300, kiri = 44, kanan = 12, atasP = 42, bawah = 40
  const { atas, langkah } = skala(Math.max(...kat.flatMap(k => k.nilai)))
  const tinggi = H - atasP - bawah, lebar = W - kiri - kanan
  const slot = lebar / kat.length, bw = Math.min(30, (slot * 0.82) / bulan.length)
  const y = (v: number) => atasP + tinggi - (v / atas) * tinggi
  // Bulan lama pucat, bulan terbaru paling gelap.
  const nada = ['#c9d6ea', '#a8bbdb', '#7d9bd0', '#2e5d8f', NAVY]
  const warna = bulan.map((_, i) => nada[Math.max(0, nada.length - bulan.length + i)])
  const garis = Array.from({ length: Math.round(atas / langkah) + 1 }, (_, i) => i * langkah)
  const lebarLeg = 74
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={judul} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <text x={W / 2} y={14} textAnchor="middle" style={{ fontSize: 11.5, fontWeight: 700, fill: '#111', fontFamily: 'Georgia, serif' }}>{judul}</text>
      {garis.map(v => (
        <g key={v}>
          <line x1={kiri} x2={W - kanan} y1={y(v)} y2={y(v)} stroke="#eef0f3" />
          <text x={kiri - 6} y={y(v) + 3} textAnchor="end" style={{ fontSize: 8.5, fill: '#555' }}>{v / 1_000_000}</text>
        </g>
      ))}
      <text transform={`translate(12 ${atasP + tinggi / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 8.5, fill: '#555' }}>Juta Rp</text>
      {kat.map((k, i) => {
        const x0 = kiri + slot * i + (slot - bw * bulan.length) / 2
        return (
          <g key={k.label}>
            {k.nilai.map((v, j) => v > 0 && (
              <g key={j}>
                <rect x={x0 + j * bw} y={y(v)} width={bw - 1} height={y(0) - y(v)} fill={warna[j]}><title>{`${k.label} · ${bulan[j]}: Rp ${v.toLocaleString('id-ID')}`}</title></rect>
                <text x={x0 + j * bw + bw / 2} y={y(v) - 3} textAnchor="middle" style={{ fontSize: 7.5, fill: '#333' }}>{jtTeks(v)}</text>
              </g>
            ))}
            {k.label.split('\n').map((t, n) => (
              <text key={n} x={x0 + (bw * bulan.length) / 2} y={atasP + tinggi + 13 + n * 10} textAnchor="middle" style={{ fontSize: 8.5, fill: '#222' }}>{t}</text>
            ))}
          </g>
        )
      })}
      <line x1={kiri} x2={W - kanan} y1={atasP + tinggi} y2={atasP + tinggi} stroke="#333" />
      <g transform={`translate(${W - kanan - bulan.length * lebarLeg}, 30)`}>
        {bulan.map((b, j) => (
          <g key={b} transform={`translate(${j * lebarLeg}, 0)`}>
            <rect width={16} height={8} y={-7} fill={warna[j]} />
            <text x={20} y={0} style={{ fontSize: 8.5, fill: '#222' }}>{b}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/** Dua grafik garis KPI berdampingan dengan garis target putus-putus (1.8.5). */
export function GarisKpi({ bulan, kemandirian, porsiGaji, targetMandiri, targetGaji }: {
  bulan: string[]
  kemandirian: number[]
  porsiGaji: number[]
  targetMandiri: number
  targetGaji: number
}) {
  if (bulan.length === 0) return null
  const panel = (judul: string, nilai: number[], target: number, label: string, warna: string, x0: number, diAtasBaik: boolean) => {
    const w = 290, h = 224, kiri = 30, atasP = 26, bawah = 22
    const lo = Math.max(0, Math.floor((Math.min(...nilai, target) - 10) / 10) * 10)
    const hi = Math.min(100, Math.ceil((Math.max(...nilai, target) + 8) / 10) * 10)
    const ty = (v: number) => atasP + (h - atasP - bawah) * (1 - (v - lo) / Math.max(hi - lo, 1))
    const tx = (i: number) => x0 + kiri + 16 + (bulan.length === 1 ? (w - kiri - 32) / 2 : (i * (w - kiri - 32)) / (bulan.length - 1))
    return (
      <g key={judul}>
        <text x={x0 + w / 2} y={12} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#111', fontFamily: 'Georgia, serif' }}>{judul}</text>
        {Array.from({ length: Math.round((hi - lo) / 10) + 1 }, (_, i) => lo + i * 10).map(v => (
          <text key={v} x={x0 + kiri - 4} y={ty(v) + 3} textAnchor="end" style={{ fontSize: 8, fill: '#555' }}>{v}</text>
        ))}
        <line x1={x0 + kiri} x2={x0 + w} y1={ty(target)} y2={ty(target)} stroke="#d0453c" strokeDasharray="5 3" />
        <text x={x0 + w - 4} y={ty(target) - 4} textAnchor="end" style={{ fontSize: 8, fill: '#d0453c' }}>{label}</text>
        <line x1={x0 + kiri} x2={x0 + kiri} y1={atasP} y2={h - bawah} stroke="#333" />
        <line x1={x0 + kiri} x2={x0 + w} y1={h - bawah} y2={h - bawah} stroke="#333" />
        <polyline points={nilai.map((v, i) => `${tx(i)},${ty(v)}`).join(' ')} fill="none" stroke={warna} strokeWidth={2} />
        {nilai.map((v, i) => {
          // Label di sisi yang menjauhi garis target supaya tidak bertumpuk.
          const atasLabel = diAtasBaik ? v >= target : v > target
          return (
            <g key={i}>
              <circle cx={tx(i)} cy={ty(v)} r={3.5} fill={warna} />
              <text x={tx(i)} y={ty(v) + (atasLabel ? -7 : 13)} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: warna }}>{persenTeks(v)}</text>
              <text x={tx(i)} y={h - bawah + 12} textAnchor="middle" style={{ fontSize: 8, fill: '#222' }}>{bulan[i]}</text>
            </g>
          )
        })}
      </g>
    )
  }
  return (
    <svg width="100%" viewBox="0 0 620 228" role="img" aria-label="Tren KPI kemandirian" style={{ maxWidth: 620, display: 'block', margin: '0 auto' }}>
      {panel('Rasio Kemandirian', kemandirian, targetMandiri, `Target ≥ ${targetMandiri}%`, '#2a7d65', 0, true)}
      {panel('Porsi Gaji YYS thd Pengeluaran', porsiGaji, targetGaji, `Target < ${targetGaji}%`, '#2e5d8f', 325, false)}
    </svg>
  )
}

function Legenda({ seri, y, lebar }: { seri: Seri[]; y: number; lebar: number }) {
  // Dibungkus beberapa baris bila tidak muat.
  const lebarItem = (s: Seri) => 22 + s.label.length * 5.2
  const item: { s: Seri; x: number; baris: number }[] = []
  let x = 0, baris = 0
  for (const s of seri) {
    if (x + lebarItem(s) > lebar - 60 && x > 0) { x = 0; baris++ }
    item.push({ s, x, baris })
    x += lebarItem(s) + 14
  }
  const lebarBaris = (b: number) => Math.max(...item.filter(i => i.baris === b).map(i => i.x + lebarItem(i.s)))
  return (
    <g>
      {item.map(({ s, x: xi, baris: b }) => (
        <g key={s.label} transform={`translate(${(lebar - lebarBaris(b)) / 2 + xi}, ${y + b * 13})`}>
          <rect width={14} height={8} y={-7} fill={s.warna} />
          <text x={18} y={0} style={{ fontSize: 8.5, fill: '#222' }}>{s.label}</text>
        </g>
      ))}
    </g>
  )
}
