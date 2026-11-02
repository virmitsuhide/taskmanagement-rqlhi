/**
 * Diagram batang bertumpuk per kelas untuk laporan Bab 02 — menggantikan
 * "Diagram 1–6" yang dulu dibuat manual.
 *
 * Satu SVG string dipakai di dua tempat: halaman pratinjau (disisipkan
 * langsung) dan berkas .docx (dirasterkan jadi PNG oleh sharp). Karena itu
 * warnanya literal, bukan token CSS — Word tidak mengenal var(--primary).
 *
 * Tingkat jilid/juz itu ordinal, jadi warnanya satu hue dari terang ke gelap
 * (bukan warna kategori yang saling bersaing); "Belum" abu-abu netral. Hue-nya
 * biru → navy, mengikuti diagram Bab 02 laporan BPH Agustus 2026.
 */

export interface SeriGrafik {
  label: string
  /** Satu nilai per baris (kelas), sejajar dengan GrafikBatang.baris. */
  nilai: number[]
  belum?: boolean
}

export interface GrafikBatang {
  judul: string
  baris: string[]
  seri: SeriGrafik[]
}

/**
 * Titik warna biru → navy dari diagram Bab 02 Agustus. Interpolasi lurus
 * antara biru muda dan navy saja melewati abu-abu kusam di tengah, jadi
 * gradasinya diambil per ruas antar titik yang tetap jenuh.
 */
const TITIK = [[0xdc, 0xeb, 0xfb], [0x8d, 0xbb, 0xf0], [0x3f, 0x8b, 0xd9], [0x1e, 0x52, 0x99], [0x06, 0x1a, 0x38]]
const ABU = '#d6d3cc'

function ramp(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (n === 1 ? 1 : i / (n - 1)) * (TITIK.length - 1)
    const k = Math.min(Math.floor(t), TITIK.length - 2), f = t - k
    return '#' + TITIK[k].map((v, c) => Math.round(v + (TITIK[k + 1][c] - v) * f).toString(16).padStart(2, '0')).join('')
  })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Teks gelap di atas warna gelap tak terbaca — pilih putih bila latarnya gelap. */
function warnaTeksDi(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#ffffff' : '#1f2a28'
}

/** Lebar minimum potongan supaya angkanya muat di dalam (font 11, ~6,5 px per digit). */
const lebarMinimum = (v: number) => 8 + String(v).length * 6.5

/**
 * Bagi `panjang` piksel ke potongan-potongan sebanding nilainya, tetapi tiap
 * potongan bernilai paling sempit selebar angkanya. Potongan kecil (1–3 anak
 * di samping 80) jadi sedikit lebih lebar dari proporsinya dan potongan besar
 * sedikit menyusut — di laporan, angka yang tertulis lebih penting daripada
 * proporsi piksel yang persis. Bila semua potongan minimum pun tidak muat,
 * batang dibiarkan sedikit lebih panjang.
 */
function bagiLebar(nilai: number[], panjang: number): number[] {
  const hasil = nilai.map(() => 0)
  const terkunci = new Set<number>()
  for (;;) {
    const sisaPanjang = panjang - [...terkunci].reduce((n, i) => n + hasil[i], 0)
    const bebas = nilai.map((v, i) => i).filter(i => nilai[i] > 0 && !terkunci.has(i))
    const sisaNilai = bebas.reduce((n, i) => n + nilai[i], 0)
    let berubah = false
    for (const i of bebas) {
      const w = sisaNilai > 0 ? (nilai[i] / sisaNilai) * Math.max(sisaPanjang, 0) : 0
      if (w < lebarMinimum(nilai[i])) { hasil[i] = lebarMinimum(nilai[i]); terkunci.add(i); berubah = true }
      else hasil[i] = w
    }
    if (!berubah) return hasil
  }
}

export function svgBatang(g: GrafikBatang, opsi: { lebar?: number; teks?: string } = {}): string {
  const lebar = opsi.lebar ?? 680
  // currentColor: di halaman ikut warna teks (tema gelap); .docx menggantinya sebelum dirasterkan.
  const teks = opsi.teks ?? 'currentColor'
  const seri = g.seri.filter(s => s.nilai.some(v => v > 0))
  const warnaLevel = ramp(seri.filter(s => !s.belum).length)
  let iw = 0
  const warna = seri.map(s => (s.belum ? ABU : warnaLevel[iw++]))

  const kiri = 64, kanan = 44, atas = 30, tinggiBaris = 26, jarak = 8
  const lebarBatang = lebar - kiri - kanan
  const total = g.baris.map((_, r) => seri.reduce((n, s) => n + (s.nilai[r] ?? 0), 0))
  const maks = Math.max(1, ...total)

  // Legenda dibungkus beberapa baris bila tidak muat satu baris.
  const legenda: { x: number; y: number; w: string; label: string }[] = []
  let lx = 0, ly = 0
  seri.forEach((s, i) => {
    const w = 16 + s.label.length * 6.4
    if (lx + w > lebar - 8 && lx > 0) { lx = 0; ly += 18 }
    legenda.push({ x: lx, y: ly, w: warna[i], label: s.label })
    lx += w + 10
  })
  const tinggiLegenda = ly + 18
  const yBatang = atas
  const tinggi = yBatang + g.baris.length * (tinggiBaris + jarak) + 10 + tinggiLegenda

  const bagian: string[] = []
  bagian.push(`<text x="0" y="16" font-size="13" font-weight="600" fill="${teks}">${esc(g.judul)}</text>`)
  g.baris.forEach((label, r) => {
    const y = yBatang + r * (tinggiBaris + jarak)
    bagian.push(`<text x="0" y="${y + tinggiBaris / 2 + 4}" font-size="12" fill="${teks}">${esc(label)}</text>`)
    const nilai = seri.map(s => s.nilai[r] ?? 0)
    const lebarSeg = bagiLebar(nilai, (total[r] / maks) * lebarBatang)
    let x = kiri
    seri.forEach((s, i) => {
      const v = nilai[i]
      if (v <= 0) return
      const w = lebarSeg[i]
      bagian.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(w - 1, 0.5).toFixed(1)}" height="${tinggiBaris}" rx="2" fill="${warna[i]}"><title>${esc(`${label} · ${s.label}: ${v}`)}</title></rect>`)
      // Setiap potongan bernilai selalu bertuliskan angkanya (lihat bagiLebar).
      bagian.push(`<text x="${(x + w / 2).toFixed(1)}" y="${y + tinggiBaris / 2 + 4}" font-size="11" text-anchor="middle" fill="${warnaTeksDi(warna[i])}">${v}</text>`)
      x += w
    })
    bagian.push(`<text x="${(x + 6).toFixed(1)}" y="${y + tinggiBaris / 2 + 4}" font-size="11" fill="${teks}" fill-opacity="0.7">${total[r]}</text>`)
  })
  const yLeg = yBatang + g.baris.length * (tinggiBaris + jarak) + 10
  for (const l of legenda) {
    bagian.push(`<rect x="${l.x}" y="${yLeg + l.y}" width="11" height="11" rx="2" fill="${l.w}"/>`)
    bagian.push(`<text x="${l.x + 15}" y="${yLeg + l.y + 10}" font-size="11" fill="${teks}">${esc(l.label)}</text>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}" font-family="Plus Jakarta Sans, Arial, sans-serif" role="img" aria-label="${esc(g.judul)}">${bagian.join('')}</svg>`
}
