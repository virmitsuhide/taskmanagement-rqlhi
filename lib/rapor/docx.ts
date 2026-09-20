import { inflateRawSync } from 'node:zlib'

/**
 * Pembaca .docx — cukup untuk menerjemahkan template rapor menjadi blok.
 *
 * Ditulis sendiri, bukan memakai pustaka: yang dibutuhkan hanyalah satu berkas
 * (word/document.xml) dari dalam ZIP, dan .docx selalu menyimpannya dengan
 * deflate biasa. Menambah pustaka docx penuh berarti menyeret seluruh model
 * OOXML ke dalam bundel demi dua puluh baris yang benar-benar dipakai.
 *
 * Yang SENGAJA tidak dibaca: font, ukuran huruf, warna, posisi kotak, margin.
 * Template dicetak lewat lembar A4 sistem (lihat components/rapor/LembarRapor),
 * jadi yang diambil dari Word adalah ISI dan URUTANNYA — bukan tipografinya.
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
}

export interface BlokTabel {
  jenis: 'tabel'
  baris: string[][]
}

/** Kotak teks Word — di kedua template rapor, inilah kotak DESKRIPSI. */
export interface BlokKotak {
  jenis: 'kotak'
  paragraf: string[]
}

export type Blok = BlokParagraf | BlokTabel | BlokKotak

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

function rataDari(pPr: string): Rata {
  const jc = pPr.match(/<w:jc w:val="(\w+)"/)?.[1]
  if (jc === 'center') return 'tengah'
  if (jc === 'right' || jc === 'end') return 'kanan'
  if (jc === 'both') return 'rata'
  return 'kiri'
}

/**
 * document.xml → daftar blok.
 *
 * mc:Fallback dibuang lebih dulu: Word menyimpan isi kotak teks DUA KALI —
 * sekali untuk pembaca modern (mc:Choice) dan sekali sebagai cadangan — dan
 * tanpa ini setiap kotak deskripsi muncul dobel di lembar rapor.
 */
export function bacaDocument(xml: string): Blok[] {
  const bersih = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '')

  // Gambar (termasuk kotak teks) dikeluarkan LEBIH DULU dan diganti penanda.
  // Tanpa ini, <w:p> di dalam kotak tertangkap oleh pemindai badan dokumen
  // sebelum paragraf pembungkusnya selesai, dan kotak deskripsi terurai
  // menjadi paragraf lepas yang kehilangan bingkainya.
  const kotak: string[][] = []
  const body = (bersih.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? bersih).replace(
    /<w:drawing>[\s\S]*?<\/w:drawing>|<w:pict>[\s\S]*?<\/w:pict>/g,
    gambar => {
      const isi = gambar.match(/<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/)
      if (!isi) return ''
      const paragraf = (isi[1].match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
        .map(p => segmenParagraf(buangPPr(p)).join(' '))
        .filter(Boolean)
      if (paragraf.length === 0) return ''
      kotak.push(paragraf)
      return `<rq:kotak n="${kotak.length - 1}"/>`
    },
  )

  const blok: Blok[] = []

  for (const potong of body.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) ?? []) {
    if (potong.startsWith('<w:tbl')) {
      const baris = (potong.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map(tr =>
        (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map(tc =>
          (tc.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
            .map(p => segmenParagraf(buangPPr(p)).join(' '))
            .filter(Boolean)
            .join(' '),
        ),
      )
      if (baris.length > 0) blok.push({ jenis: 'tabel', baris })
      continue
    }

    // Paragraf pembungkus kotak teks: kotaknya ditulis sebagai blok sendiri.
    // Teks paragraf itu sendiri (kalau ada) tetap ditulis sesudahnya.
    for (const p of potong.matchAll(/<rq:kotak n="(\d+)"\/>/g)) {
      blok.push({ jenis: 'kotak', paragraf: kotak[Number(p[1])] })
    }

    const pPr = potong.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const segmen = segmenParagraf(buangPPr(potong))
    if (segmen.length === 0 || segmen.every(s => s === '')) continue
    blok.push({
      jenis: 'paragraf',
      segmen,
      rata: rataDari(pPr),
      // Tebal bila seluruh paragrafnya tebal — bukan sekadar satu kata di dalamnya.
      tebal: /<w:b\s*\/>|<w:b w:val="(?:1|true)"/.test(potong.replace(pPr, '')),
    })
  }

  return blok
}

function buangPPr(p: string): string {
  return p.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, '')
}

/** Berkas .docx utuh → blok. Mengembalikan null bila bukan .docx yang sah. */
export function bacaDocx(buf: Buffer): Blok[] | null {
  const xml = ambilDariZip(buf, 'word/document.xml')
  if (!xml) return null
  return bacaDocument(xml.toString('utf8'))
}
