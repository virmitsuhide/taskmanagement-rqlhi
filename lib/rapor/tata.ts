/**
 * Tata letak template Word — jarak, inden, tab-stop, ukuran huruf, kertas,
 * dan gambar latar (kop surat). Semua satuan dalam pt.
 *
 * Dulu penerjemah hanya mengambil ISI dan URUTAN template, dan lembar rapor
 * memakai tipografi sistem. Hasilnya terbaca, tetapi tidak menyerupai berkas
 * aslinya: kop surat hilang, judul yang di Word digeser dengan inden jadi
 * rata kiri, dan jarak antarbaris seragam. Koordinator ingin rapor yang
 * dicetak sama dengan yang ia susun di Word — maka tata letaknya ikut dibaca.
 *
 * Semua medan di sini OPSIONAL. Template yang diunggah sebelum modul ini ada
 * tidak memilikinya dan tetap dicetak dengan tata letak sistem seperti dulu,
 * sampai koordinator menekan "Baca ulang berkas".
 *
 * Yang dibaca hanya yang dipakai template rapor sungguhan: gaya paragraf
 * (styles.xml) beserta turunannya, lalu atribut langsung di paragraf. Gaya
 * karakter, tema, dan kolom tidak dibaca.
 */

/** Tata satu paragraf. */
export interface Tata {
  /** Jarak sebelum & sesudah paragraf. */
  sebelum?: number
  sesudah?: number
  /** Spasi baris kelipatan (1 = tunggal, 1.5, 2 …). */
  baris?: number
  /** Spasi baris pasti ("Exactly"). */
  barisPt?: number
  /** Spasi baris minimum ("At least"). */
  barisMin?: number
  /** Inden kiri & kanan dari margin. */
  kiri?: number
  kanan?: number
  /** Inden baris pertama; negatif = gantung (hanging). */
  awal?: number
  /** Tab-stop pertama, diukur dari margin kiri — lebar kolom label "Nama ⇥ : …". */
  tab?: number
  /** Ukuran huruf. */
  ukuran?: number
}

/** Posisi & ukuran kotak teks di halaman. */
export interface Bingkai {
  lebar: number
  /** Tinggi kotak di Word — dipakai sebagai tinggi minimum. */
  tinggi: number
  /** Geser dari margin kiri. */
  kiri: number
  /** Jarak dari atas paragraf jangkarnya. */
  atas: number
  /** Tebal garis tepi; 0 = tanpa garis. */
  garis: number
  /** Jarak teks ke garis tepi: atas, kanan, bawah, kiri. */
  isi: [number, number, number, number]
}

/** Gambar di belakang teks yang menutupi (hampir) seluruh halaman — kop surat. */
export interface Latar {
  /**
   * Saat dibaca: nama berkas di dalam .docx (word/media/image1.jpeg).
   * Setelah diunggah: path objek di bucket rapor-templates.
   */
  src: string
  /** Letak & ukuran relatif terhadap pojok kiri atas halaman. */
  x: number
  y: number
  lebar: number
  tinggi: number
}

/** Ukuran & margin kertas dari sectPr. */
export interface Kertas {
  lebar: number
  tinggi: number
  /** atas, kanan, bawah, kiri */
  margin: [number, number, number, number]
  /** Huruf bawaan dokumen (gaya Normal), mis. "Times New Roman". */
  huruf?: string
}

// ─── Atribut XML ─────────────────────────────────────────────────────────────

/** Semua atribut w:* satu tag, tanpa awalan. */
function atribut(tag: string | undefined): Record<string, string> {
  const hasil: Record<string, string> = {}
  if (!tag) return hasil
  for (const m of tag.matchAll(/\bw:(\w+)="([^"]*)"/g)) hasil[m[1]] = m[2]
  return hasil
}

const angka = (s: string | undefined): number | undefined => {
  if (s === undefined || s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** twip (1/20 pt) → pt */
const twip = (s: string | undefined) => {
  const n = angka(s)
  return n === undefined ? undefined : n / 20
}

/** EMU (1/12700 pt) → pt */
export const emu = (s: string | undefined) => {
  const n = angka(s)
  return n === undefined ? undefined : n / 12700
}

// ─── Gaya ────────────────────────────────────────────────────────────────────

interface GayaParagraf {
  spacing: Record<string, string>
  ind: Record<string, string>
  /** Posisi tab-stop (twip), diurutkan. */
  tabs: number[]
  /** Setengah-pt, seperti w:sz. */
  sz?: number
  tebal?: boolean
  huruf?: string
  basedOn?: string
}

export interface Gaya {
  paragraf: Map<string, GayaParagraf>
  /** Gaya paragraf bawaan (biasanya "Normal"). */
  bawaan?: string
  /** docDefaults — dasar semua gaya. */
  dasar: GayaParagraf
}

function kosong(): GayaParagraf {
  return { spacing: {}, ind: {}, tabs: [] }
}

/** pPr + rPr satu gaya atau satu paragraf → GayaParagraf (belum digabung). */
function bacaSifat(pPr: string, rPr: string): GayaParagraf {
  const g = kosong()
  g.spacing = atribut(pPr.match(/<w:spacing\b[^>]*>/)?.[0])
  g.ind = atribut(pPr.match(/<w:ind\b[^>]*>/)?.[0])
  g.tabs = [...pPr.matchAll(/<w:tab\b[^>]*>/g)]
    .map(m => atribut(m[0]))
    .filter(a => a.val !== 'clear' && a.val !== 'bar')
    .map(a => angka(a.pos))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b)
  g.sz = angka(atribut(rPr.match(/<w:sz\b[^>]*>/)?.[0]).val)
  const b = rPr.match(/<w:b\b[^>]*\/>/)?.[0]
  if (b) g.tebal = !/w:val="(?:0|false|off)"/.test(b)
  g.huruf = atribut(rPr.match(/<w:rFonts\b[^>]*>/)?.[0]).ascii
  return g
}

/** Gabung: `atas` menimpa `bawah` per atribut, sebagaimana Word mewariskan gaya. */
function gabung(bawah: GayaParagraf, atas: GayaParagraf): GayaParagraf {
  const ind = { ...bawah.ind, ...atas.ind }
  // Baris pertama & gantung saling meniadakan: yang ditulis belakangan menang.
  if ('firstLine' in atas.ind) delete ind.hanging
  if ('hanging' in atas.ind) delete ind.firstLine
  return {
    spacing: { ...bawah.spacing, ...atas.spacing },
    ind,
    tabs: [...new Set([...bawah.tabs, ...atas.tabs])].sort((a, b) => a - b),
    sz: atas.sz ?? bawah.sz,
    tebal: atas.tebal ?? bawah.tebal,
    huruf: atas.huruf ?? bawah.huruf,
  }
}

/** styles.xml → daftar gaya paragraf. Tanpa styles.xml semua gaya kosong. */
export function bacaGaya(stylesXml: string | null | undefined): Gaya {
  const gaya: Gaya = { paragraf: new Map(), dasar: kosong() }
  if (!stylesXml) return gaya

  const def = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? ''
  gaya.dasar = bacaSifat(
    def.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)?.[0] ?? '',
    def.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/)?.[0] ?? '',
  )

  for (const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const a = atribut(m[1])
    if (a.type !== 'paragraph' || !a.styleId) continue
    const isi = m[2]
    const g = bacaSifat(
      isi.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? '',
      isi.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? '',
    )
    g.basedOn = atribut(isi.match(/<w:basedOn\b[^>]*>/)?.[0]).val
    gaya.paragraf.set(a.styleId, g)
    if (a.default === '1' || a.default === 'true') gaya.bawaan = a.styleId
  }
  return gaya
}

/** Sifat lengkap satu gaya, turunan basedOn sudah digabung. */
function sifatGaya(gaya: Gaya, id: string | undefined, jejak = new Set<string>()): GayaParagraf {
  const g = id ? gaya.paragraf.get(id) : undefined
  if (!id || !g || jejak.has(id)) return gaya.dasar
  jejak.add(id)
  return gabung(sifatGaya(gaya, g.basedOn, jejak), g)
}

/** Huruf dokumen: dari gaya bawaan, atau docDefaults. Huruf tema tidak dibaca. */
export function hurufDokumen(gaya: Gaya): string | undefined {
  return sifatGaya(gaya, gaya.bawaan).huruf
}

// ─── Paragraf ────────────────────────────────────────────────────────────────

/**
 * Tata satu paragraf: gaya (pStyle, atau gaya bawaan) lalu atribut langsung.
 * `isi` = paragraf tanpa pPr — ukuran huruf diambil dari run pertamanya,
 * sebab ukuran di rPr milik pPr hanya berlaku untuk tanda paragrafnya.
 */
export function tataParagraf(pPr: string, isi: string, gaya: Gaya): { tata: Tata; tebalGaya: boolean } {
  const id = atribut(pPr.match(/<w:pStyle\b[^>]*>/)?.[0]).val ?? gaya.bawaan
  const langsung = bacaSifat(pPr.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, ''), '')
  const s = gabung(sifatGaya(gaya, id), langsung)

  const tata: Tata = {}
  const sebelum = twip(s.spacing.before)
  const sesudah = twip(s.spacing.after)
  if (sebelum) tata.sebelum = sebelum
  if (sesudah) tata.sesudah = sesudah

  const line = angka(s.spacing.line)
  if (line) {
    if (s.spacing.lineRule === 'exact') tata.barisPt = line / 20
    else if (s.spacing.lineRule === 'atLeast') tata.barisMin = line / 20
    else tata.baris = line / 240
  }

  const kiri = twip(s.ind.left ?? s.ind.start)
  const kanan = twip(s.ind.right ?? s.ind.end)
  if (kiri) tata.kiri = kiri
  if (kanan) tata.kanan = kanan
  const awal = s.ind.hanging !== undefined ? -(twip(s.ind.hanging) ?? 0) : twip(s.ind.firstLine)
  if (awal) tata.awal = awal

  // Tab-stop pertama yang berada di kanan inden: di situlah titik dua baris
  // identitas berdiri. Tab di kiri inden tidak pernah tercapai.
  const batas = (angka(s.ind.left ?? s.ind.start) ?? 0)
  const tab = s.tabs.find(t => t > batas)
  if (tab !== undefined) tata.tab = tab / 20

  const szRun = angka(atribut(isi.match(/<w:sz\b[^>]*>/)?.[0]).val)
  const sz = szRun ?? s.sz
  if (sz) tata.ukuran = sz / 2

  return { tata, tebalGaya: Boolean(s.tebal) }
}

/** Spasi tunggal Word ≈ 1,15 × ukuran huruf untuk huruf serif/sans umum. */
export const TUNGGAL = 1.15

/** Tinggi paragraf kosong — satu tekanan Enter — menurut tatanya. */
export function tinggiKosong(t: Tata): number {
  const ukuran = t.ukuran ?? 11
  const garis = t.barisPt ?? Math.max(t.barisMin ?? 0, (t.baris ?? 1) * TUNGGAL * ukuran)
  return (t.sebelum ?? 0) + garis + (t.sesudah ?? 0)
}

// ─── Kertas ──────────────────────────────────────────────────────────────────

/** sectPr terakhir badan dokumen → ukuran & margin kertas. A4 bila tidak tertulis. */
export function bacaKertas(body: string, gaya: Gaya): Kertas {
  const sect = [...body.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)].pop()?.[0] ?? ''
  const sz = atribut(sect.match(/<w:pgSz\b[^>]*>/)?.[0])
  const mar = atribut(sect.match(/<w:pgMar\b[^>]*>/)?.[0])
  const kertas: Kertas = {
    lebar: twip(sz.w) ?? 595.3,
    tinggi: twip(sz.h) ?? 841.9,
    margin: [twip(mar.top) ?? 72, twip(mar.right) ?? 72, twip(mar.bottom) ?? 72, twip(mar.left) ?? 72].map(Math.abs) as Kertas['margin'],
  }
  const huruf = hurufDokumen(gaya)
  if (huruf) kertas.huruf = huruf
  return kertas
}

// ─── Gambar & kotak ──────────────────────────────────────────────────────────

/** Posisi mendatar gambar berjangkar, dalam pt dari tepi kiri halaman. */
function posisiX(gambar: string, lebar: number, kertas: Kertas): number {
  const h = gambar.match(/<wp:positionH relativeFrom="(\w+)">([\s\S]*?)<\/wp:positionH>/)
  if (!h) return kertas.margin[3]
  const dariHalaman = h[1] === 'page'
  const offset = emu(h[2].match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/)?.[1])
  if (offset !== undefined) return (dariHalaman ? 0 : kertas.margin[3]) + offset
  const rata = h[2].match(/<wp:align>(\w+)<\/wp:align>/)?.[1]
  const ruang = dariHalaman ? kertas.lebar : kertas.lebar - kertas.margin[1] - kertas.margin[3]
  const awal = dariHalaman ? 0 : kertas.margin[3]
  if (rata === 'right') return awal + ruang - lebar
  if (rata === 'center') return awal + (ruang - lebar) / 2
  return awal
}

/**
 * Posisi tegak, dalam pt dari tepi atas halaman. Jangkar paragraf dianggap
 * berada di margin atas — benar untuk kop surat, yang selalu ditaruh di
 * paragraf pertama halamannya.
 */
function posisiY(gambar: string, kertas: Kertas): number {
  const v = gambar.match(/<wp:positionV relativeFrom="(\w+)">([\s\S]*?)<\/wp:positionV>/)
  if (!v) return kertas.margin[0]
  const offset = emu(v[2].match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/)?.[1]) ?? 0
  return (v[1] === 'page' ? 0 : kertas.margin[0]) + offset
}

/**
 * Gambar di belakang teks yang menutupi sebagian besar halaman → latar.
 * Logo kecil, garis, dan gambar sebaris bukan latar dan diabaikan.
 * `rId` dikembalikan untuk dicari berkasnya di document.xml.rels.
 */
export function bacaLatar(gambar: string, kertas: Kertas): (Omit<Latar, 'src'> & { rId: string }) | null {
  const anchor = gambar.match(/<wp:anchor\b[^>]*>/)?.[0]
  if (!anchor || !/behindDoc="1"/.test(anchor)) return null
  const rId = gambar.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1]
  if (!rId) return null
  const ext = gambar.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)
  const lebar = emu(ext?.[1]) ?? 0
  const tinggi = emu(ext?.[2]) ?? 0
  if (lebar < kertas.lebar * 0.6 || tinggi < kertas.tinggi * 0.6) return null
  return { rId, x: posisiX(gambar, lebar, kertas), y: posisiY(gambar, kertas), lebar, tinggi }
}

/** Bingkai kotak teks: ukuran, geser dari margin, garis tepi, dan jarak isi. */
export function bacaBingkai(gambar: string, kertas: Kertas): Bingkai | undefined {
  const ext = gambar.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)
  const lebar = emu(ext?.[1])
  const tinggi = emu(ext?.[2])
  if (!lebar || !tinggi) return undefined

  const berjangkar = /<wp:anchor\b/.test(gambar)
  const kiri = berjangkar ? posisiX(gambar, lebar, kertas) - kertas.margin[3] : 0
  const atas = berjangkar
    ? (emu(gambar.match(/<wp:positionV relativeFrom="(?:paragraph|line)">\s*<wp:posOffset>(-?\d+)/)?.[1]) ?? 0)
    : 0

  const ln = gambar.match(/<a:ln\b([^>]*)(?:\/>|>([\s\S]*?)<\/a:ln>)/)
  const garis = !ln ? 0.75 : /<a:noFill\/>/.test(ln[2] ?? '') ? 0 : (emu(ln[1].match(/\bw="(\d+)"/)?.[1]) ?? 0.75)

  const bodyPr = gambar.match(/<wps:bodyPr\b[^>]*>/)?.[0] ?? ''
  const sisip = (nama: string, bawaan: number) => emu(bodyPr.match(new RegExp(`\\b${nama}="(\\d+)"`))?.[1]) ?? bawaan

  return {
    lebar, tinggi, kiri: Math.max(0, kiri), atas: Math.max(0, atas), garis,
    isi: [sisip('tIns', 3.6), sisip('rIns', 7.2), sisip('bIns', 3.6), sisip('lIns', 7.2)],
  }
}

// ─── Tabel ───────────────────────────────────────────────────────────────────

export interface TataTabel {
  kolom?: number[]
  geser?: number
  latar?: (string | null)[][]
  tebal?: boolean[][]
  tinggiBaris?: number[]
  tanpaGaris?: true
  ukuran?: number
  /**
   * Paragraf tiap sel apa adanya (termasuk yang kosong) — hanya bila ada sel
   * berparagraf lebih dari satu. Teks sel di `baris` menggabungkannya jadi
   * satu kalimat; di sini baris "nama" dan "NIY" tetap dua baris, dan tiga
   * Enter kosong tetap menjadi ruang tanda tangan.
   */
  paragrafSel?: string[][][]
  /** Jarak "sebelum" paragraf tiap sel. */
  jarakSel?: number[][]
}

/** Warna isi sel (w:shd fill), atau null untuk sel tanpa warna. */
function isiSel(tc: string): string | null {
  const fill = atribut(tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0].match(/<w:shd\b[^>]*>/)?.[0]).fill
  return fill && /^[0-9a-f]{6}$/i.test(fill) ? `#${fill.toUpperCase()}` : null
}

const TEPI = ['top', 'left', 'bottom', 'right']

function selTanpaGaris(tc: string): boolean {
  const b = tc.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0]
  if (!b) return false
  return TEPI.every(t => new RegExp(`<w:${t}\\b[^>]*w:val="(?:nil|none)"`).test(b))
}

export function tataTabel(tbl: string, gaya: Gaya): TataTabel {
  const tata: TataTabel = {}
  const tblPr = tbl.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? ''

  const kolom = [...(tbl.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '').matchAll(/<w:gridCol\b[^>]*>/g)]
    .map(m => twip(atribut(m[0]).w) ?? 0)
  if (kolom.length > 0 && kolom.every(k => k > 0)) tata.kolom = kolom

  const geser = twip(atribut(tblPr.match(/<w:tblInd\b[^>]*>/)?.[0]).w)
  if (geser) tata.geser = geser

  const baris = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []
  const sel = baris.map(tr => tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [])

  const latar = sel.map(r => r.map(isiSel))
  if (latar.some(r => r.some(Boolean))) tata.latar = latar

  tata.tebal = sel.map(r => r.map(tc => {
    const runs = (tc.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, '').match(/<w:r\b[\s\S]*?<\/w:r>/g) ?? []).filter(r => /<w:t\b/.test(r))
    return runs.length > 0 && runs.every(r => /<w:b\s*\/>|<w:b w:val="(?:1|true|on)"/.test(r))
  }))

  const tinggi = baris.map(tr => twip(atribut(tr.match(/<w:trHeight\b[^>]*>/)?.[0]).val) ?? 0)
  if (tinggi.some(Boolean)) tata.tinggiBaris = tinggi

  // Tanpa garis bila tabel tidak mendefinisikan garis sama sekali, atau
  // setiap selnya menghapus garisnya — tabel tanda tangan di template ATS.
  const adaGarisTabel = /<w:tblBorders>/.test(tblPr) || /<w:tblStyle\b/.test(tblPr)
  const semuaNil = sel.flat().length > 0 && sel.flat().every(selTanpaGaris)
  if (!adaGarisTabel || semuaNil) tata.tanpaGaris = true

  const tataPertama = (xml: string) => {
    const p = xml.match(/<w:p\b[^>]*(?<!\/)>[\s\S]*?<\/w:p>/)?.[0]
    if (!p) return undefined
    const pPr = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    return tataParagraf(pPr, p.replace(pPr, ''), gaya).tata
  }
  const u = tataPertama(tbl)?.ukuran
  if (u) tata.ukuran = u

  const jarak = sel.map(r => r.map(tc => tataPertama(tc)?.sebelum ?? 0))
  if (jarak.some(r => r.some(Boolean))) tata.jarakSel = jarak
  return tata
}
