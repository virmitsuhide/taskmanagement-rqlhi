import { inflateRawSync } from 'node:zlib'

/**
 * Pembaca .docx — cukup untuk menerjemahkan template rapor menjadi blok.
 *
 * Ditulis sendiri, bukan memakai pustaka: yang dibutuhkan hanyalah satu berkas
 * (word/document.xml) dari dalam ZIP, dan .docx selalu menyimpannya dengan
 * deflate biasa. Menambah pustaka docx penuh berarti menyeret seluruh model
 * OOXML ke dalam bundel demi dua puluh baris yang benar-benar dipakai.
 *
 * Yang SENGAJA tidak dibaca: font, ukuran huruf, posisi kotak, margin.
 * Template dicetak lewat lembar A4 sistem (lihat components/rapor/LembarRapor),
 * jadi yang diambil dari Word adalah ISI dan URUTANNYA — bukan tipografinya.
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
}

/** Satu rentang teks berwarna seragam. merah = bagian yang boleh diganti. */
export interface Potongan {
  teks: string
  merah?: true
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
}

export type Blok = BlokParagraf | BlokTabel | BlokKotak | BlokJeda | BlokHalaman

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

/**
 * Paragraf → potongan hitam/merah, atau undefined bila warnanya seragam.
 *
 * Word memecah satu frasa menjadi banyak run ("Surat Al-" + "Qiyamah ayat
 * 34"), jadi run bersebelahan yang sewarna digabung. Spasi di tepi potongan
 * merah dipindah ke potongan hitam di sebelahnya: mengganti isian tidak boleh
 * ikut memakan spasi pemisah kata di kalimat yang terkunci.
 */
export function potonganParagraf(p: string): Potongan[] | undefined {
  const mentah: Potongan[] = []
  for (const run of p.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) ?? []) {
    const teks = [...run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)]
      .map(m => (m[1] !== undefined ? nyata(m[1]) : ' '))
      .join('')
    if (!teks) continue
    const merah = warnaMerah(run.match(/<w:color w:val="([0-9A-Fa-f]{6})"/)?.[1])
    // Spasi saja tidak punya warna yang berarti — ikut potongan sebelumnya.
    const akhir = mentah[mentah.length - 1]
    if (akhir && (Boolean(akhir.merah) === merah || !teks.trim())) akhir.teks += teks
    else mentah.push(merah ? { teks, merah: true } : { teks })
  }

  const hasil: Potongan[] = []
  const tambahHitam = (teks: string) => {
    if (!teks) return
    const akhir = hasil[hasil.length - 1]
    if (akhir && !akhir.merah) akhir.teks += teks
    else hasil.push({ teks })
  }
  for (const pot of mentah) {
    if (!pot.merah) { tambahHitam(pot.teks); continue }
    const [, depan, inti, belakang] = pot.teks.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    tambahHitam(depan)
    if (inti) hasil.push({ teks: inti, merah: true })
    tambahHitam(belakang)
  }

  const rapi = hasil
    .map(x => ({ ...x, teks: x.teks.replace(/\s+/g, ' ') }))
    .filter(x => x.teks !== '')
  if (rapi.length > 0) {
    rapi[0].teks = rapi[0].teks.trimStart()
    rapi[rapi.length - 1].teks = rapi[rapi.length - 1].teks.trimEnd()
  }
  const adaMerah = rapi.some(x => x.merah)
  const adaHitam = rapi.some(x => !x.merah && x.teks.trim())
  return adaMerah && adaHitam ? rapi : undefined
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
  const kotak: { teks: string; potongan: Potongan[] | null }[][] = []
  const body = (bersih.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? bersih).replace(
    /<w:drawing>[\s\S]*?<\/w:drawing>|<w:pict>[\s\S]*?<\/w:pict>/g,
    gambar => {
      const isi = gambar.match(/<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/)
      if (!isi) return ''
      const isiP = (isi[1].match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
        .map(p => ({ teks: segmenParagraf(buangPPr(p)).join(' '), potongan: potonganParagraf(buangPPr(p)) ?? null }))
        .filter(p => p.teks)
      if (isiP.length === 0) return ''
      kotak.push(isiP)
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
      const isi = kotak[Number(p[1])]
      const potongan = isi.map(x => x.potongan)
      blok.push({
        jenis: 'kotak',
        paragraf: isi.map(x => x.teks),
        ...(potongan.some(Boolean) ? { potongan } : {}),
      })
    }

    const pPr = potong.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const segmen = segmenParagraf(buangPPr(potong))
    const halaman = letakHalaman(potong, pPr)
    if (halaman === 'sebelum') tambahHalaman(blok)

    // Paragraf kosong berturut-turut digabung jadi satu jeda: yang penting
    // tingginya, bukan berapa kali tombol Enter ditekan.
    if (segmen.length === 0 || segmen.every(s => s === '')) {
      const akhir = blok[blok.length - 1]
      if (akhir?.jenis === 'jeda') akhir.baris += 1
      else blok.push({ jenis: 'jeda', baris: 1 })
      if (halaman === 'sesudah') tambahHalaman(blok)
      continue
    }

    const potongan = potonganParagraf(buangPPr(potong))
    blok.push({
      jenis: 'paragraf',
      segmen,
      rata: rataDari(pPr),
      // Tebal bila seluruh paragrafnya tebal — bukan sekadar satu kata di dalamnya.
      tebal: /<w:b\s*\/>|<w:b w:val="(?:1|true)"/.test(potong.replace(pPr, '')),
      ...(potongan ? { potongan } : {}),
    })
    if (halaman === 'sesudah') tambahHalaman(blok)
  }

  // Jeda di ujung halaman tidak bermakna — ia hanya sisa Enter sebelum
  // Ctrl+Enter — dan pergantian halaman di akhir dokumen tidak menghasilkan
  // apa pun selain lembar kosong.
  while (blok.length > 0 && blok[blok.length - 1].jenis === 'halaman') blok.pop()

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
  const xml = ambilDariZip(buf, 'word/document.xml')
  if (!xml) return null
  return bacaDocument(xml.toString('utf8'))
}
