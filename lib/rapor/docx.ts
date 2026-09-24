import { inflateRawSync } from 'node:zlib'
import {
  bacaBingkai, bacaGaris, bacaGaya, bacaKertas, bacaLatar, tataParagraf, tataTabel, tinggiKosong,
  type Bingkai, type Garis, type Kertas, type Latar, type Tata, type TataTabel,
} from '@/lib/rapor/tata'

/**
 * Pembaca .docx — cukup untuk menerjemahkan template rapor menjadi blok.
 *
 * Ditulis sendiri, bukan memakai pustaka: yang dibutuhkan hanyalah satu berkas
 * (word/document.xml) dari dalam ZIP, dan .docx selalu menyimpannya dengan
 * deflate biasa. Menambah pustaka docx penuh berarti menyeret seluruh model
 * OOXML ke dalam bundel demi dua puluh baris yang benar-benar dipakai.
 *
 * Selain isi dan urutan, tata letaknya ikut dibaca (lib/rapor/tata.ts):
 * jarak, inden, tab-stop, ukuran huruf, ukuran kertas, dan kop surat di
 * belakang teks — supaya rapor tercetak menyerupai berkas Word-nya.
 *
 * Satu pengecualian untuk warna: huruf MERAH. Sekolah menandai bagian yang
 * boleh diganti dengan merah (template ATS SMP 2026/2027), termasuk potongan
 * di tengah kalimat deskripsi. Warna itu bukan tipografi di sini — ia
 * penanda isian, jadi dibaca (lihat Potongan) lalu dibuang saat mencetak.
 */

// ─── ZIP ─────────────────────────────────────────────────────────────────────

/**
 * Ambil satu berkas dari arsip ZIP. Ukuran dibaca dari central directory,
 * bukan local header: berkas yang ditulis mengalir (streaming) menaruh 0 di
 * local header dan ukuran sebenarnya baru menyusul di data descriptor.
 */
export function ambilDariZip(buf: Buffer, namaDicari: string): Buffer | null {
  const eocd = cariEocd(buf)
  if (eocd < 0) return null

  const jumlah = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16) // awal central directory

  for (let i = 0; i < jumlah; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null
    const metode = buf.readUInt16LE(p + 10)
    const ukuranTerkompresi = buf.readUInt32LE(p + 20)
    const panjangNama = buf.readUInt16LE(p + 28)
    const panjangExtra = buf.readUInt16LE(p + 30)
    const panjangKomentar = buf.readUInt16LE(p + 32)
    const offsetLokal = buf.readUInt32LE(p + 42)
    const nama = buf.toString('utf8', p + 46, p + 46 + panjangNama)

    if (nama === namaDicari) {
      if (buf.readUInt32LE(offsetLokal) !== 0x04034b50) return null
      const namaLokal = buf.readUInt16LE(offsetLokal + 26)
      const extraLokal = buf.readUInt16LE(offsetLokal + 28)
      const awal = offsetLokal + 30 + namaLokal + extraLokal
      const data = buf.subarray(awal, awal + ukuranTerkompresi)
      if (metode === 0) return Buffer.from(data)
      if (metode === 8) return inflateRawSync(data)
      return null
    }
    p += 46 + panjangNama + panjangExtra + panjangKomentar
  }
  return null
}

/** EOCD dicari dari belakang: komentar arsip boleh sepanjang 64 KB. */
function cariEocd(buf: Buffer): number {
  const batas = Math.max(0, buf.length - 0x10000 - 22)
  for (let i = buf.length - 22; i >= batas; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

// ─── Blok ────────────────────────────────────────────────────────────────────

export type Rata = 'kiri' | 'tengah' | 'kanan' | 'rata'

/**
 * Paragraf: satu baris teks, sudah terpecah menurut tab-stop Word.
 *
 * Pemecahan per tab inilah yang membuat dua bentuk berbeda di Word terbaca
 * dengan satu aturan: baris identitas ("Nama Lengkap Siswa" ⇥ ": Aliyah") dan
 * blok tanda tangan ("Koordinator" ⇥ "Pengampu") sama-sama menjadi deretan
 * segmen sejajar.
 */
export interface BlokParagraf {
  jenis: 'paragraf'
  segmen: string[]
  rata: Rata
  tebal: boolean
  /**
   * Teks paragraf yang dipecah menurut warna — hanya ada bila paragraf ini
   * memuat huruf merah DAN huruf biasa. Paragraf yang seluruhnya merah atau
   * seluruhnya hitam tidak membutuhkannya: slot segmennya sudah cukup.
   * Template yang diunggah sebelum fitur ini tidak memilikinya.
   */
  potongan?: Potongan[]
  /** Jarak, inden, tab-stop, ukuran huruf. Tidak ada di template lama. */
  tata?: Tata
  /** Tebal/miring/garis bawah tiap segmen (sejajar dengan `segmen`). */
  hias?: (Hias | null)[]
  /** Garis gambar yang berjangkar di paragraf ini. */
  garis?: Garis[]
}

/** Satu rentang teks berwarna seragam. merah = bagian yang boleh diganti. */
export interface Potongan {
  teks: string
  merah?: true
  /** Hiasan seragam potongan ini. Isian merah: juga hiasan data penggantinya. */
  hias?: Hias
  /** Potongan hitam berhias campur ("… Ananda. *Barakallah* sholih …"), berurutan. */
  bagian?: ({ teks: string } & Hias)[]
}

/**
 * Pergantian halaman yang ditulis di template (Ctrl+Enter di Word).
 *
 * Template ATS SMP berisi dua lembar: laporan Al-Qur'an reguler dan laporan
 * Riyadhoh yang hanya berlaku bagi pesertanya. Tanpa penanda ini keduanya
 * menyatu jadi satu lembar panjang, dan halaman kedua tidak bisa dicetak
 * terpisah — atau disembunyikan — sama sekali.
 */
export interface BlokHalaman {
  jenis: 'halaman'
}

export interface BlokTabel {
  jenis: 'tabel'
  baris: string[][]
  /** Lebar kolom, warna sel, garis. Tidak ada di template lama. */
  tata?: TataTabel
}

/** Kotak teks Word — di kedua template rapor, inilah kotak DESKRIPSI. */
export interface BlokKotak {
  jenis: 'kotak'
  paragraf: string[]
  /**
   * Potongan hitam/merah per paragraf, sejajar dengan `paragraf` — null untuk
   * paragraf yang warnanya seragam. Template ATS SMP menaruh deskripsinya di
   * kotak teks, dengan isian merah di tengah kalimatnya.
   */
  potongan?: (Potongan[] | null)[]
  /** Ukuran & letak kotak di halaman. Tidak ada di template lama. */
  bingkai?: Bingkai
  /** Tata tiap paragraf di dalam kotak, sejajar dengan `paragraf`. */
  tataParagraf?: Tata[]
}

/**
 * Paragraf kosong — jeda vertikal yang sengaja ditulis di template.
 *
 * Dulu dibuang, dan itu keliru: empat baris kosong antara "Koordinator
 * Al-Qur'an" dan "Erna, S.Pd" bukan sisa pengetikan, melainkan ruang tanda
 * tangan. Membuangnya membuat nama menempel di bawah jabatan dan tidak
 * menyisakan tempat untuk tanda tangan sama sekali.
 */
export interface BlokJeda {
  jenis: 'jeda'
  /** Berapa paragraf kosong berturut-turut. */
  baris: number
  /** Tinggi sebenarnya (pt) menurut jarak & spasi tiap paragrafnya. */
  tinggi?: number
  /** Garis gambar yang berjangkar di paragraf kosong ini. */
  garis?: Garis[]
}

/**
 * Kertas & kop surat — selalu blok TERAKHIR, dan hanya ada pada template
 * yang dibaca dengan tata letak. Ditaruh di akhir supaya id slot blok lain
 * (p12.1, h20, …) tidak bergeser dari hasil baca sebelumnya.
 */
export interface BlokKertas {
  jenis: 'kertas'
  kertas: Kertas
  /** Latar per halaman: indeks 0 = halaman pertama. null = tanpa latar. */
  latar: (Latar | null)[]
}

export type Blok = BlokParagraf | BlokTabel | BlokKotak | BlokJeda | BlokHalaman | BlokKertas

/** Blok kertas sebuah template, bila template itu dibaca dengan tata letak. */
export function kertasDari(blok: Blok[]): BlokKertas | null {
  const akhir = blok[blok.length - 1]
  return akhir?.jenis === 'kertas' ? akhir : null
}

// ─── Penerjemah ──────────────────────────────────────────────────────────────

const ENTITAS: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
}

function nyata(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, m => ENTITAS[m])
}

/**
 * Teks satu paragraf, terpecah per tab.
 *
 * <w:tab/> di dalam <w:tabs> (pengaturan tab-stop, bukan tab sungguhan) sudah
 * tersingkir sendiri karena pPr dibuang lebih dulu oleh pemanggil.
 */
function segmenParagraf(p: string): string[] {
  const segmen: string[] = ['']
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(p))) {
    if (m[1] !== undefined) segmen[segmen.length - 1] += nyata(m[1])
    else if (m[0].startsWith('<w:tab')) segmen.push('')
    else segmen[segmen.length - 1] += ' '
  }
  return segmen.map(s => s.replace(/\s+/g, ' ').trim()).filter((s, i, a) => s !== '' || (i > 0 && i < a.length - 1))
}

// ─── Hiasan huruf ────────────────────────────────────────────────────────────

/** Tebal / miring / garis bawah sebuah rentang teks. */
export interface Hias {
  b?: true
  i?: true
  u?: true
}

const POLA_RUN = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g
const POLA_TOKEN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g

/** Kunci hiasan satu run: "", "b", "i", "u", "bi", … — mudah dibandingkan. */
function kunciRun(run: string): string {
  const rPr = run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''
  const nyala = (tag: string) => new RegExp(`<w:${tag}\\s*/>|<w:${tag} w:val="(?:1|true|on)"\\s*/>`).test(rPr)
  const u = rPr.match(/<w:u w:val="(\w+)"/)?.[1]
  return (nyala('b') ? 'b' : '') + (nyala('i') ? 'i' : '') + (u && u !== 'none' ? 'u' : '')
}

function hiasDari(kunci: string): Hias | undefined {
  if (!kunci) return undefined
  const h: Hias = {}
  if (kunci.includes('b')) h.b = true
  if (kunci.includes('i')) h.i = true
  if (kunci.includes('u')) h.u = true
  return h
}

/** Kunci hiasan yang dipakai SEMUA huruf (bukan spasi) sebuah rentang, atau undefined. */
function kunciSeragam(kunci: string[]): string | undefined {
  const s = new Set(kunci)
  return s.size === 1 ? [...s][0] : undefined
}

/**
 * Hiasan tiap segmen paragraf (sejajar dengan segmenParagraf), hanya bila
 * segmen itu seragam: nama koordinator bergaris bawah, salam miring.
 * Undefined bila tidak ada segmen berhias sama sekali, atau bila susunannya
 * tidak bisa disejajarkan dengan segmen — lebih baik tanpa hiasan daripada
 * hiasan di kata yang salah.
 */
export function hiasSegmen(p: string, segmen: string[]): (Hias | null)[] | undefined {
  const mentah: { teks: string; kunci: string[] }[] = [{ teks: '', kunci: [] }]
  for (const run of p.match(POLA_RUN) ?? []) {
    const k = kunciRun(run)
    for (const m of run.matchAll(POLA_TOKEN)) {
      if (m[0].startsWith('<w:tab')) { mentah.push({ teks: '', kunci: [] }); continue }
      const teks = m[1] !== undefined ? nyata(m[1]) : ' '
      const akhir = mentah[mentah.length - 1]
      akhir.teks += teks
      for (const c of teks) if (c.trim()) akhir.kunci.push(k)
    }
  }
  const rapi = mentah
    .map(s => ({ ...s, teks: s.teks.replace(/\s+/g, ' ').trim() }))
    .filter((s, i, a) => s.teks !== '' || (i > 0 && i < a.length - 1))
  if (rapi.length !== segmen.length || rapi.some((s, i) => s.teks !== segmen[i])) return undefined
  const hias = rapi.map(s => hiasDari(kunciSeragam(s.kunci) ?? '') ?? null)
  return hias.some(Boolean) ? hias : undefined
}

/** Lebar satu spasi, dalam em — Times New Roman tepat 0,25 em. */
const LEBAR_SPASI = 0.25

/** Jumlah spasi yang diketik di awal paragraf, sebelum huruf atau tab pertama. */
function spasiDepan(p: string): number {
  let n = 0
  for (const m of p.matchAll(POLA_TOKEN)) {
    // Spasi sebelum tab tidak menggeser apa pun: tab melompat ke tab-stop.
    if (m[1] === undefined) return m[0].startsWith('<w:tab') ? 0 : n
    for (const c of nyata(m[1])) {
      if (c === ' ' || c === ' ') n++
      else return n
    }
  }
  return 0
}

/** Hiasan seragam seluruh paragraf — untuk isi sel tabel. */
function hiasParagraf(p: string): Hias | null {
  const kunci: string[] = []
  for (const run of p.match(POLA_RUN) ?? []) {
    const k = kunciRun(run)
    for (const m of run.matchAll(POLA_TOKEN)) {
      if (m[1] !== undefined) for (const c of nyata(m[1])) if (c.trim()) kunci.push(k)
    }
  }
  return hiasDari(kunciSeragam(kunci) ?? '') ?? null
}

/**
 * Merah = kanal merah kuat, hijau & biru lemah. Bukan hanya FF0000: Word
 * menyimpan "merah" dari palet tema sebagai C00000, EE0000, dan sejenisnya,
 * sedangkan 1F1F1F (hitam lembut, dipakai di template yang sama) harus
 * tetap terbaca hitam.
 */
export function warnaMerah(hex: string | undefined): boolean {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return false
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  return r >= 0xb0 && g <= 0x60 && b <= 0x60
}

type Huruf = { c: string; merah: boolean; k: string }

/**
 * Paragraf → potongan hitam/merah, atau undefined bila warnanya seragam.
 *
 * Word memecah satu frasa menjadi banyak run ("Surat Al-" + "Qiyamah ayat
 * 34"), jadi run bersebelahan yang sewarna digabung. Spasi di tepi potongan
 * merah dipindah ke potongan hitam di sebelahnya: mengganti isian tidak boleh
 * ikut memakan spasi pemisah kata di kalimat yang terkunci.
 *
 * Dikerjakan per huruf supaya hiasan tiap huruf (tebal, miring, garis bawah)
 * ikut terbawa. Batas potongan tetap ditentukan warna saja — hiasan tidak
 * boleh memecah satu isian merah menjadi dua slot. Isian merah menyimpan
 * hiasannya ("Surat Al-Qiyamah" tebal-miring), dan data penggantinya
 * tercetak dengan hiasan yang sama. Potongan hitam berhias campur menyimpan
 * rinciannya di `bagian`.
 */
export function potonganParagraf(p: string): Potongan[] | undefined {
  const huruf: Huruf[] = []
  let warnaAkhir: boolean | null = null
  for (const run of p.match(POLA_RUN) ?? []) {
    const teks = [...run.matchAll(POLA_TOKEN)].map(m => (m[1] !== undefined ? nyata(m[1]) : ' ')).join('')
    if (!teks) continue
    let merah = warnaMerah(run.match(/<w:color w:val="([0-9A-Fa-f]{6})"/)?.[1])
    // Spasi saja tidak punya warna yang berarti — ikut potongan sebelumnya.
    if (!teks.trim() && warnaAkhir !== null) merah = warnaAkhir
    warnaAkhir = merah
    const k = kunciRun(run)
    for (const c of teks) huruf.push({ c, merah, k })
  }

  // Spasi di tepi rentang merah menjadi hitam.
  for (let i = 0; i < huruf.length; i++) {
    if (!huruf[i].merah) continue
    let j = i
    while (j < huruf.length && huruf[j].merah) j++
    for (let a = i; a < j && !huruf[a].c.trim(); a++) huruf[a].merah = false
    for (let a = j - 1; a >= i && !huruf[a].c.trim(); a--) huruf[a].merah = false
    i = j - 1
  }

  // Kelompokkan per warna, lalu rapatkan spasi berderet di dalam tiap kelompok.
  const kelompok: Huruf[][] = []
  for (const h of huruf) {
    const akhir = kelompok[kelompok.length - 1]
    if (akhir && akhir[0].merah === h.merah) akhir.push(h)
    else kelompok.push([h])
  }
  const rapat = kelompok
    .map(g => g
      .filter((h, i) => h.c.trim() || i === 0 || g[i - 1].c.trim())
      .map(h => (h.c.trim() ? h : { ...h, c: ' ' })))
    .filter(g => g.length > 0)
  if (rapat.length > 0) {
    const awal = rapat[0]
    while (awal.length > 0 && !awal[0].c.trim()) awal.shift()
    const akhir = rapat[rapat.length - 1]
    while (akhir.length > 0 && !akhir[akhir.length - 1].c.trim()) akhir.pop()
  }

  const rapi = rapat.map(susunPotongan)
  const adaMerah = rapi.some(x => x.merah)
  const adaHitam = rapi.some(x => !x.merah && x.teks.trim())
  return adaMerah && adaHitam ? rapi : undefined
}

function susunPotongan(g: Huruf[]): Potongan {
  const pot: Potongan = { teks: g.map(h => h.c).join('') }
  if (g[0]?.merah) pot.merah = true
  const isi = g.filter(h => h.c.trim())
  const seragam = kunciSeragam(isi.map(h => h.k))
  if (seragam !== undefined || pot.merah) {
    // Isian merah berhias campur memakai hiasan huruf pertamanya.
    const hias = hiasDari(seragam ?? isi[0]?.k ?? '')
    if (hias) pot.hias = hias
    return pot
  }
  const bagian: { teks: string; k: string }[] = []
  for (const h of g) {
    const akhir = bagian[bagian.length - 1]
    // Spasi ikut bagian sebelumnya: spasi miring dan tegak tampak sama.
    if (akhir && (akhir.k === h.k || !h.c.trim())) akhir.teks += h.c
    else bagian.push({ teks: h.c, k: h.k })
  }
  pot.bagian = bagian.map(({ teks, k }) => ({ teks, ...hiasDari(k) }))
  return pot
}

/** Posisi pergantian halaman di paragraf ini: sebelum isinya, sesudahnya, atau tidak ada. */
function letakHalaman(p: string, pPr: string): 'sebelum' | 'sesudah' | null {
  if (/<w:pageBreakBefore(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(pPr)) return 'sebelum'
  const i = p.search(/<w:br\b[^>]*w:type="page"/)
  if (i < 0) return null
  return segmenParagraf(buangPPr(p.slice(0, i))).join('').trim() ? 'sesudah' : 'sebelum'
}

function rataDari(pPr: string): Rata {
  const jc = pPr.match(/<w:jc w:val="(\w+)"/)?.[1]
  if (jc === 'center') return 'tengah'
  if (jc === 'right' || jc === 'end') return 'kanan'
  if (jc === 'both') return 'rata'
  return 'kiri'
}

/**
 * Satu paragraf. Paragraf kosong bertutup sendiri (<w:p …/>) dicocokkan
 * LEBIH DULU: pola paragraf biasa akan mulai darinya dan menelan paragraf
 * sesudahnya — teksnya ikut, tetapi jaraknya salah, dan satu Enter hilang.
 */
const POLA_PARAGRAF = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g

/**
 * document.xml → daftar blok.
 *
 * mc:Fallback dibuang lebih dulu: Word menyimpan isi kotak teks DUA KALI —
 * sekali untuk pembaca modern (mc:Choice) dan sekali sebagai cadangan — dan
 * tanpa ini setiap kotak deskripsi muncul dobel di lembar rapor.
 *
 * `stylesXml` (word/styles.xml) dibutuhkan untuk tata letak yang diwarisi
 * dari gaya paragraf; tanpanya hanya atribut langsung yang terbaca. Latar
 * yang ditemukan menyimpan rId-nya di `src` — bacaDocx menggantinya dengan
 * nama berkas gambarnya.
 */
export function bacaDocument(xml: string, stylesXml?: string | null): Blok[] {
  const bersih = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '')
  const gaya = bacaGaya(stylesXml)
  const badan = bersih.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? bersih
  const kertas = bacaKertas(badan, gaya)

  // Gambar (termasuk kotak teks) dikeluarkan LEBIH DULU dan diganti penanda.
  // Tanpa ini, <w:p> di dalam kotak tertangkap oleh pemindai badan dokumen
  // sebelum paragraf pembungkusnya selesai, dan kotak deskripsi terurai
  // menjadi paragraf lepas yang kehilangan bingkainya.
  const kotak: { isi: { teks: string; potongan: Potongan[] | null; tata: Tata }[]; bingkai?: Bingkai }[] = []
  const latarDitemukan: (Omit<Latar, 'src'> & { rId: string })[] = []
  const garisDitemukan: Garis[] = []
  const body = badan.replace(
    /<w:drawing>[\s\S]*?<\/w:drawing>|<w:pict>[\s\S]*?<\/w:pict>/g,
    gambar => {
      const latar = bacaLatar(gambar, kertas)
      if (latar) {
        latarDitemukan.push(latar)
        return `<rq:latar n="${latarDitemukan.length - 1}"/>`
      }
      const garis = bacaGaris(gambar, kertas)
      if (garis) {
        garisDitemukan.push(garis)
        return `<rq:garis n="${garisDitemukan.length - 1}"/>`
      }
      const isi = gambar.match(/<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/)
      if (!isi) return ''
      const isiP = (isi[1].match(POLA_PARAGRAF) ?? [])
        .map(p => {
          const pPr = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
          return {
            teks: segmenParagraf(buangPPr(p)).join(' '),
            potongan: potonganParagraf(buangPPr(p)) ?? null,
            tata: tataParagraf(pPr, buangPPr(p), gaya).tata,
          }
        })
        .filter(p => p.teks)
      if (isiP.length === 0) return ''
      kotak.push({ isi: isiP, bingkai: bacaBingkai(gambar, kertas) })
      return `<rq:kotak n="${kotak.length - 1}"/>`
    },
  )

  const blok: Blok[] = []
  const latar: (Latar | null)[] = []
  const halamanKe = () => blok.filter(b => b.jenis === 'halaman').length

  for (const potong of body.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? []) {
    if (potong.startsWith('<w:tbl')) {
      const selXml = (potong.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map(tr =>
        (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map(tc => (tc.match(POLA_PARAGRAF) ?? []).map(buangPPr)),
      )
      const paragrafSel = selXml.map(r => r.map(ps => ps.map(p => segmenParagraf(p).join(' '))))
      const hiasSel = selXml.map(r => r.map(ps => ps.map(hiasParagraf)))
      const baris = paragrafSel.map(r => r.map(ps => ps.filter(Boolean).join(' ')))
      if (baris.length > 0) {
        const tata = tataTabel(potong, gaya)
        if (paragrafSel.some(r => r.some(ps => ps.length > 1))) tata.paragrafSel = paragrafSel
        if (hiasSel.some(r => r.some(ps => ps.some(Boolean)))) tata.hiasSel = hiasSel
        blok.push({ jenis: 'tabel', baris, tata })
      }
      continue
    }

    const pPr = potong.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const { tata, tebalGaya } = tataParagraf(pPr, buangPPr(potong), gaya)
    // Spasi yang diketik di awal baris ("     Dikeluarkan di:") dibuang saat
    // teksnya dirapikan; tanpa digantikan inden, teksnya bergeser ke kiri
    // dari garis dan kolom yang di Word sejajar dengannya.
    const spasi = spasiDepan(buangPPr(potong))
    if (spasi > 0) tata.awal = (tata.awal ?? 0) + spasi * LEBAR_SPASI * (tata.ukuran ?? 11)
    const halaman = letakHalaman(potong, pPr)
    if (halaman === 'sebelum') tambahHalaman(blok)

    // Kop surat berlaku untuk halaman tempat jangkarnya berada.
    for (const m of potong.matchAll(/<rq:latar n="(\d+)"\/>/g)) {
      const { rId, ...letak } = latarDitemukan[Number(m[1])]
      latar[halamanKe()] ??= { src: rId, ...letak }
    }

    // Paragraf pembungkus kotak teks: kotaknya ditulis sebagai blok sendiri.
    // Teks paragraf itu sendiri (kalau ada) tetap ditulis sesudahnya.
    const adaKotak = /<rq:kotak n="\d+"\/>/.test(potong)
    for (const p of potong.matchAll(/<rq:kotak n="(\d+)"\/>/g)) {
      const { isi, bingkai } = kotak[Number(p[1])]
      const potongan = isi.map(x => x.potongan)
      blok.push({
        jenis: 'kotak',
        paragraf: isi.map(x => x.teks),
        ...(potongan.some(Boolean) ? { potongan } : {}),
        // Kotak berjangkar diukur dari atas paragraf jangkarnya, yang
        // sendiri didahului jarak "sebelum"-nya.
        ...(bingkai ? { bingkai: { ...bingkai, atas: bingkai.atas + (tata.sebelum ?? 0) } } : {}),
        tataParagraf: isi.map(x => x.tata),
      })
    }

    const segmen = segmenParagraf(buangPPr(potong))
    const garis = [...potong.matchAll(/<rq:garis n="(\d+)"\/>/g)].map(m => garisDitemukan[Number(m[1])])

    // Paragraf kosong berturut-turut digabung jadi satu jeda. Tingginya
    // dijumlah dari jarak & spasi tiap paragraf — kecuali paragraf jangkar
    // kotak teks, yang ruangnya sudah dihitung dalam jarak atas kotaknya.
    if (segmen.length === 0 || segmen.every(s => s === '')) {
      const tinggi = adaKotak ? 0 : tinggiKosong(tata)
      const akhir = blok[blok.length - 1]
      if (akhir?.jenis === 'jeda') {
        // Garis di paragraf kosong berikutnya: turun sejauh paragraf-paragraf
        // kosong sebelumnya.
        for (const g of garis) (akhir.garis ??= []).push({ ...g, atas: g.atas + (akhir.tinggi ?? 0) })
        akhir.baris += 1
        akhir.tinggi = (akhir.tinggi ?? 0) + tinggi
      } else blok.push({ jenis: 'jeda', baris: 1, tinggi, ...(garis.length ? { garis } : {}) })
      if (halaman === 'sesudah') tambahHalaman(blok)
      continue
    }

    const potongan = potonganParagraf(buangPPr(potong))
    const hias = hiasSegmen(buangPPr(potong), segmen)
    const tanpaPPr = potong.replace(pPr, '')
    blok.push({
      jenis: 'paragraf',
      segmen,
      rata: rataDari(pPr),
      // Tebal bila seluruh paragrafnya tebal — bukan sekadar satu kata di
      // dalamnya — atau bila gaya paragrafnya tebal (gaya Title Word).
      tebal: /<w:b\s*\/>|<w:b w:val="(?:1|true)"/.test(tanpaPPr) || (tebalGaya && !/<w:b w:val="(?:0|false|off)"/.test(tanpaPPr)),
      ...(potongan ? { potongan } : {}),
      tata,
      ...(hias ? { hias } : {}),
      ...(garis.length ? { garis } : {}),
    })
    if (halaman === 'sesudah') tambahHalaman(blok)
  }

  // Jeda di ujung halaman tidak bermakna — ia hanya sisa Enter sebelum
  // Ctrl+Enter — dan pergantian halaman di akhir dokumen tidak menghasilkan
  // apa pun selain lembar kosong.
  while (blok.length > 0 && blok[blok.length - 1].jenis === 'halaman') blok.pop()

  const jumlahHalaman = halamanKe() + 1
  blok.push({
    jenis: 'kertas',
    kertas,
    latar: Array.from({ length: jumlahHalaman }, (_, i) => latar[i] ?? null),
  })
  return blok
}


/** Satu penanda halaman saja, dan tidak pernah di awal dokumen. */
function tambahHalaman(blok: Blok[]) {
  if (blok.length === 0 || blok[blok.length - 1].jenis === 'halaman') return
  blok.push({ jenis: 'halaman' })
}

function buangPPr(p: string): string {
  return p.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, '')
}

/** Berkas .docx utuh → blok. Mengembalikan null bila bukan .docx yang sah. */
export function bacaDocx(buf: Buffer): Blok[] | null {
  return bacaDocxLengkap(buf)?.blok ?? null
}

/** Gambar latar yang diambil dari dalam .docx, siap diunggah. */
export interface GambarLatar {
  /** Nama berkas di dalam .docx — sama dengan `Latar.src` sebelum diunggah. */
  nama: string
  data: Buffer
  mime: string
}

const MIME_GAMBAR: Record<string, string> = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
}

/**
 * Berkas .docx utuh → blok, berikut gambar kop surat yang ditemukan.
 * `Latar.src` di blok kertas berisi nama berkas gambarnya di dalam .docx;
 * pemanggil mengunggahnya lalu menggantinya dengan path penyimpanan.
 * Latar yang gambarnya tidak bisa diambil (format tak dikenal, tautan
 * eksternal) dibuang — lembarnya tetap tercetak, hanya tanpa latar.
 */
export function bacaDocxLengkap(buf: Buffer): { blok: Blok[]; gambar: GambarLatar[] } | null {
  const xml = ambilDariZip(buf, 'word/document.xml')
  if (!xml) return null
  const blok = bacaDocument(xml.toString('utf8'), ambilDariZip(buf, 'word/styles.xml')?.toString('utf8'))

  const rels = ambilDariZip(buf, 'word/_rels/document.xml.rels')?.toString('utf8') ?? ''
  const target = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1]
    const t = m[0].match(/\bTarget="([^"]+)"/)?.[1]
    if (id && t && !/TargetMode="External"/.test(m[0])) target.set(id, t.startsWith('/') ? t.slice(1) : `word/${t}`)
  }

  const gambar = new Map<string, GambarLatar>()
  const kertas = kertasDari(blok)
  if (kertas) {
    kertas.latar = kertas.latar.map(l => {
      if (!l) return null
      const nama = target.get(l.src)
      const mime = MIME_GAMBAR[nama?.split('.').pop()?.toLowerCase() ?? '']
      if (!nama || !mime) return null
      if (!gambar.has(nama)) {
        const data = ambilDariZip(buf, nama)
        if (!data) return null
        gambar.set(nama, { nama, data, mime })
      }
      return { ...l, src: nama }
    })
  }
  return { blok, gambar: [...gambar.values()] }
}
