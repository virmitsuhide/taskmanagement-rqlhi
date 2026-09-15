/**
 * Menguji silang lib/rq/batas-juz.ts terhadap dua sumber yang ditulis
 * TERPISAH dari tabel itu:
 *
 *   1. AYAT_PER_JUZ di types/index.ts — sudah ada jauh sebelum tabel batas
 *      disusun, dipakai peta belajar untuk menghitung persentase juz.
 *   2. surat_master di database — 114 baris berisi panjang tiap surah,
 *      otoritas sistem ini soal data surah.
 *
 * Jalankan: npm run uji:batas-juz
 *
 * KENAPA HARUS SUMBER LAIN
 *
 * Kalau panjang tiap juz dihitung dari tabel batas lalu dibandingkan dengan
 * dirinya sendiri, ujinya tidak membuktikan apa pun — ia hanya memastikan
 * penjumlahan bekerja. Yang membuat uji ini berarti adalah bahwa ketiga
 * sumbernya disusun sendiri-sendiri: batas juz dari mushaf, AYAT_PER_JUZ dari
 * rujukan lain, panjang surah dari surat_master. Tiga orang berbeda harus
 * keliru dengan cara yang sama persis supaya kesalahan bisa lolos.
 *
 * Uji ini memang menyentuh database, tidak seperti uji:kpi yang murni.
 * Alternatifnya menyalin 114 panjang surah ke dalam berkas ini — salinan
 * keempat dari data yang sama, yang justru menjadi sumber kekeliruan baru.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { BATAS_JUZ, AKHIR_MUSHAF, bandingPosisi, juzDariAyat, juzSurah } from '../lib/rq/batas-juz'
import { TOTAL_HALAMAN, awalHalaman, halamanDariAyat } from '../lib/rq/batas-halaman'
import {
  AWAL_JUZ_MUSHAF, HALAMAN_JUZ, TOTAL_HALAMAN_MUSHAF, halamanPerJuz, halamanSelesaiDalamJuz,
  capaian, formatCapaian,
} from '../lib/rq/halaman'
import { AYAT_PER_JUZ } from '../types'

config({ path: '.env.local', quiet: true })

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

/**
 * Menutup dengan process.exitCode, BUKAN process.exit().
 *
 * process.exit() memutus proses seketika, dan di Windows koneksi HTTP
 * Supabase yang masih menutup diri membuat libuv gagal asertif —
 * "UV_HANDLE_CLOSING, src\\win\\async.c" — sehingga prosesnya crash dengan
 * kode 127 alih-alih 0 atau 1. Uji yang selalu mengembalikan 127 tidak bisa
 * dibedakan lolos dari gagal oleh pemanggil mana pun.
 */
function selesai() {
  console.log(`\n${gagal === 0 ? '✓ SEMUA LOLOS' : `✗ ${gagal} pemeriksaan GAGAL`}`)
  process.exitCode = gagal === 0 ? 0 : 1
}

/**
 * Halaman awal & akhir tiap surah menurut api.quran.com/api/v4/chapters —
 * PENYEDIA YANG BERBEDA dari indeks halaman di lib/rq/batas-halaman.ts, yang
 * berasal dari Tanzil lewat api.alquran.cloud.
 *
 * Inilah pembanding luar untuk tabel 604 halaman itu. Tanpa data ini, satu
 * baris yang keliru di tengah tabel tidak tertangkap oleh apa pun:
 * urutannya tetap menaik, jumlahnya tetap 604, dan batas juz tetap selaras.
 * Dua penyedia yang menyusun datanya sendiri-sendiri harus keliru dengan
 * cara yang persis sama supaya kesalahan itu lolos.
 *
 * ⚠️ Cakupannya 228 titik sauh (114 surah × awal & akhir), bukan 604. Galat
 * yang jatuh di tengah surah panjang — misalnya awal halaman 3 yang bergeser
 * satu ayat di dalam Al-Baqarah — masih bisa lolos. Untuk menutupnya perlu
 * indeks halaman penuh dari penyedia kedua, 604 baris lagi.
 */
const HALAMAN_SURAH: readonly (readonly [awal: number, akhir: number])[] = [
  [  1,  1], [  2, 49], [ 50, 76], [ 77,106], [106,127], [128,150], [151,176], [177,186],
  [187,207], [208,221], [221,235], [235,248], [249,255], [255,261], [262,267], [267,281],
  [282,293], [293,304], [305,312], [312,321], [322,331], [332,341], [342,349], [350,359],
  [359,366], [367,376], [377,385], [385,396], [396,404], [404,410], [411,414], [415,417],
  [418,427], [428,434], [434,440], [440,445], [446,452], [453,458], [458,467], [467,476],
  [477,482], [483,489], [489,495], [496,498], [499,502], [502,506], [507,510], [511,515],
  [515,517], [518,520], [520,523], [523,525], [526,528], [528,531], [531,534], [534,537],
  [537,541], [542,545], [545,548], [549,551], [551,552], [553,554], [554,555], [556,557],
  [558,559], [560,561], [562,564], [564,566], [566,568], [568,570], [570,571], [572,573],
  [574,575], [575,577], [577,578], [578,580], [580,581], [582,583], [583,584], [585,585],
  [586,586], [587,587], [587,589], [589,589], [590,590], [591,591], [591,592], [592,592],
  [593,594], [594,594], [595,595], [595,596], [596,596], [596,596], [597,597], [597,597],
  [598,598], [598,599], [599,599], [599,600], [600,600], [600,600], [601,601], [601,601],
  [601,601], [602,602], [602,602], [602,602], [603,603], [603,603], [603,603], [604,604],
  [604,604], [604,604],]


async function main() {
  // ── Pemeriksaan bentuk, tanpa database ──────────────────────────────────
  console.log('── Bentuk tabel ──')
  periksa(BATAS_JUZ.length === 30, `30 juz (ada ${BATAS_JUZ.length})`)
  periksa(
    BATAS_JUZ.every((b, i) => b.juz === i + 1),
    'nomor juz berurut 1..30',
  )
  periksa(
    BATAS_JUZ[0].mulai.surat === 1 && BATAS_JUZ[0].mulai.ayat === 1,
    'juz 1 mulai di Al-Fatihah 1',
  )
  periksa(
    BATAS_JUZ[29].selesai.surat === AKHIR_MUSHAF.surat
      && BATAS_JUZ[29].selesai.ayat === AKHIR_MUSHAF.ayat,
    'juz 30 selesai di An-Nas 6',
  )

  // Tidak boleh ada lubang maupun tumpang tindih: akhir sebuah juz harus
  // persis satu ayat sebelum awal juz berikutnya. Yang bisa diperiksa tanpa
  // panjang surah adalah kasus "masih di surah yang sama"; sisanya diuji di
  // bagian database di bawah.
  let sambung = true
  for (let i = 0; i < BATAS_JUZ.length - 1; i++) {
    const akhir = BATAS_JUZ[i].selesai
    const awalBerikut = BATAS_JUZ[i + 1].mulai
    const seSurah = akhir.surat === awalBerikut.surat
    if (seSurah && akhir.ayat + 1 !== awalBerikut.ayat) {
      console.log(`  ✗ juz ${i + 1}→${i + 2}: ${akhir.surat}:${akhir.ayat} lalu ${awalBerikut.ayat}`)
      sambung = false
    }
    if (!seSurah && awalBerikut.surat !== akhir.surat + 1) {
      console.log(`  ✗ juz ${i + 1}→${i + 2}: melompati surah ${akhir.surat}→${awalBerikut.surat}`)
      sambung = false
    }
  }
  periksa(sambung, 'tiap juz bersambung dengan juz berikutnya')

  // ── Uji silang terhadap database ────────────────────────────────────────
  console.log('\n── Silang dengan surat_master & AYAT_PER_JUZ ──')
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('– dilewati: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local')
    selesai()
    return
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await db.from('surat_master').select('id, name_latin, total_ayat').order('id')
  if (error || !data) {
    console.log(`✗ gagal membaca surat_master: ${error?.message ?? 'kosong'}`)
    gagal++
    selesai()
    return
  }

  const surat = new Map<number, { nama: string; ayat: number }>()
  for (const s of data as { id: number; name_latin: string; total_ayat: number }[]) {
    surat.set(s.id, { nama: s.name_latin, ayat: s.total_ayat })
  }
  periksa(surat.size === 114, `surat_master berisi 114 surah (ada ${surat.size})`)

  /** Nomor urut sebuah ayat dihitung dari awal mushaf, mulai 1. */
  const indeks = (pos: { surat: number; ayat: number }): number => {
    let n = 0
    for (let i = 1; i < pos.surat; i++) n += surat.get(i)?.ayat ?? 0
    return n + pos.ayat
  }

  const totalMushaf = indeks(AKHIR_MUSHAF)
  periksa(totalMushaf === 6236, `total ayat mushaf = ${totalMushaf} (harus 6236)`)

  console.log('\nJuz | mulai                  | selesai                | hitung | AYAT_PER_JUZ')
  console.log('----+------------------------+------------------------+--------+-------------')
  const nama = (pos: { surat: number; ayat: number }) =>
    `${surat.get(pos.surat)?.nama ?? `#${pos.surat}`} ${pos.ayat}`.padEnd(22)

  let semuaCocok = true
  for (const b of BATAS_JUZ) {
    const jml = indeks(b.selesai) - indeks(b.mulai) + 1
    const ref = AYAT_PER_JUZ[b.juz]
    const ok = jml === ref
    if (!ok) semuaCocok = false
    console.log(
      `${String(b.juz).padStart(3)} | ${nama(b.mulai)} | ${nama(b.selesai)} | ` +
      `${String(jml).padStart(6)} | ${String(ref).padStart(12)} ${ok ? '' : '  ✗'}`,
    )
  }
  periksa(semuaCocok, 'panjang tiap juz cocok dengan AYAT_PER_JUZ')

  // Setiap ayat harus tercakup tepat sekali — menutup lubang yang lolos dari
  // pemeriksaan bentuk di atas, yaitu saat juz berpindah surah.
  const tercakup = BATAS_JUZ.reduce((n, b) => n + (indeks(b.selesai) - indeks(b.mulai) + 1), 0)
  periksa(tercakup === 6236, `seluruh 6236 ayat tercakup tepat sekali (terhitung ${tercakup})`)

  // Setiap akhir juz harus persis satu ayat sebelum awal juz berikutnya,
  // termasuk saat berpindah surah.
  let rapat = true
  for (let i = 0; i < BATAS_JUZ.length - 1; i++) {
    if (indeks(BATAS_JUZ[i].selesai) + 1 !== indeks(BATAS_JUZ[i + 1].mulai)) {
      console.log(`  ✗ celah antara juz ${i + 1} dan ${i + 2}`)
      rapat = false
    }
  }
  periksa(rapat, 'tidak ada celah maupun tumpang tindih antar juz')

  // Akhir tiap juz yang jatuh di pergantian surah harus benar-benar ayat
  // TERAKHIR surah itu — kalau meleset, angkanya bisa tetap berjumlah benar
  // tapi batasnya salah tempat.
  let ujungBenar = true
  for (const b of BATAS_JUZ) {
    const berikut = BATAS_JUZ.find(x => x.juz === b.juz + 1)
    if (!berikut || berikut.mulai.surat === b.selesai.surat) continue
    const panjang = surat.get(b.selesai.surat)?.ayat
    if (panjang !== b.selesai.ayat) {
      console.log(`  ✗ juz ${b.juz} berakhir di ${nama(b.selesai).trim()}, padahal surah itu punya ${panjang} ayat`)
      ujungBenar = false
    }
  }
  periksa(ujungBenar, 'juz yang berakhir di pergantian surah berhenti di ayat terakhir surah itu')

  // ── Fungsi turunan ──────────────────────────────────────────────────────
  console.log('\n── juzDariAyat() & juzSurah() ──')
  // Contoh yang dipilih karena masing-masing pernah salah dijawab pendekatan
  // lama (surah → juz awal saja).
  const CONTOH: [surat: number, ayat: number, juz: number, ket: string][] = [
    [2, 1, 1, 'Al-Baqarah 1 — awal surah, juz 1'],
    [2, 200, 2, 'Al-Baqarah 200 — surah yang sama, sudah juz 2'],
    [2, 286, 3, 'Al-Baqarah 286 — ayat terakhirnya, sudah juz 3'],
    [3, 92, 4, "Ali Imran 92 — awal juz 4 (lan tanaalul-birra)"],
    [3, 91, 3, 'Ali Imran 91 — satu ayat sebelumnya, masih juz 3'],
    [78, 1, 30, 'An-Naba 1 — awal juz 30'],
    [114, 6, 30, 'An-Nas 6 — ayat terakhir mushaf'],
  ]
  for (const [s, a, harap, ket] of CONTOH) {
    const dapat = juzDariAyat(s, a)
    periksa(dapat === harap, `${ket} → juz ${dapat}`)
  }
  periksa(juzDariAyat(0, 1) === null, 'surah 0 ditolak')
  periksa(juzDariAyat(115, 1) === null, 'surah 115 ditolak')
  periksa(juzDariAyat(1, 0) === null, 'ayat 0 ditolak')

  const bq = juzSurah(2)
  periksa(
    JSON.stringify(bq) === JSON.stringify([1, 2, 3]),
    `Al-Baqarah membentang juz ${bq.join(', ')}`,
  )

  // ── Halaman Mushaf Madinah ──────────────────────────────────────────────
  console.log('\n── Halaman (Mushaf Madinah, lib/rq/halaman.ts) ──')

  periksa(TOTAL_HALAMAN === 604, `indeks halaman berisi ${TOTAL_HALAMAN} halaman`)
  periksa(TOTAL_HALAMAN_MUSHAF === TOTAL_HALAMAN, 'halaman.ts memakai jumlah halaman yang sama')

  // Awal halaman harus menaik tegas — satu saja yang mundur berarti tabelnya
  // tergeser, dan halamanDariAyat() yang memakai pencarian biner akan
  // menjawab ngawur tanpa pernah melempar error.
  let menaik = true
  for (let h = 2; h <= TOTAL_HALAMAN; h++) {
    const a = awalHalaman(h - 1)!
    const b = awalHalaman(h)!
    if (bandingPosisi(a, b) >= 0) {
      console.log(`  ✗ halaman ${h} (${b.surat}:${b.ayat}) tidak sesudah halaman ${h - 1} (${a.surat}:${a.ayat})`)
      menaik = false
    }
  }
  periksa(menaik, 'awal 604 halaman menaik tegas tanpa mundur')
  periksa(
    awalHalaman(1)!.surat === 1 && awalHalaman(1)!.ayat === 1,
    'halaman 1 mulai di Al-Fatihah 1',
  )
  periksa(awalHalaman(2)!.surat === 2, 'halaman 2 sudah masuk Al-Baqarah')

  // Juz utuh harus menjumlah tepat 604 — tidak lebih (halaman terhitung dua
  // kali pada juz yang berbagi halaman) dan tidak kurang (ada yang terlewat).
  const panjangSemua = Array.from({ length: 30 }, (_, i) => halamanPerJuz(i + 1))
  const jumlahHalaman = panjangSemua.reduce((a, b) => a + b, 0)
  periksa(
    jumlahHalaman === TOTAL_HALAMAN,
    `seluruh juz berjumlah ${jumlahHalaman} halaman (mushaf ${TOTAL_HALAMAN})`,
  )

  // Tidak ada halaman yang terlewat maupun dimiliki dua juz.
  let rapatMilik = true
  for (let juz = 2; juz <= 30; juz++) {
    if (HALAMAN_JUZ[juz].mulai !== HALAMAN_JUZ[juz - 1].selesai + 1) {
      console.log(`  ✗ juz ${juz} mulai hlm ${HALAMAN_JUZ[juz].mulai}, juz ${juz - 1} berakhir hlm ${HALAMAN_JUZ[juz - 1].selesai}`)
      rapatMilik = false
    }
  }
  periksa(rapatMilik, 'kepemilikan halaman bersambung, tanpa celah & tanpa tumpang tindih')
  periksa(HALAMAN_JUZ[1].mulai === 1, 'juz 1 mulai di halaman 1')
  periksa(HALAMAN_JUZ[30].selesai === 604, `juz 30 berakhir di halaman ${HALAMAN_JUZ[30].selesai}`)

  // Penyimpangan dari "20 halaman per juz" — semuanya nyata, bukan galat.
  const takGenap = Array.from({ length: 30 }, (_, i) => i + 1)
    .filter(j => halamanPerJuz(j) !== 20)
    .map(j => `juz ${j}=${halamanPerJuz(j)}`)
  periksa(
    takGenap.length === 5,
    `yang bukan 20 halaman: ${takGenap.join(', ')}`,
  )

  // ── Dua tabel batas juz, dan bedanya yang disengaja ─────────────────────
  console.log('\n── Batas klasik vs batas mushaf RQ ──')
  periksa(AWAL_JUZ_MUSHAF.length === 30, `tabel mushaf RQ berisi ${AWAL_JUZ_MUSHAF.length} juz`)

  const bedaTabel: string[] = []
  for (const b of BATAS_JUZ) {
    const [s, a] = AWAL_JUZ_MUSHAF[b.juz - 1]
    if (s !== b.mulai.surat || a !== b.mulai.ayat) {
      bedaTabel.push(`juz ${b.juz} (${surat.get(s)?.nama} ${a} vs klasik ${a === b.mulai.ayat ? '' : `${surat.get(b.mulai.surat)?.nama} ${b.mulai.ayat}`})`)
    }
  }
  periksa(
    bedaTabel.length === 3,
    `tepat 3 juz berbeda: ${bedaTabel.join('; ')}`,
  )

  // Juz 7 & 11 versi mushaf harus jatuh persis di ayat TERATAS halaman —
  // itulah sebabnya keduanya digeser satu ayat dari batas klasik.
  for (const juz of [7, 11]) {
    const [s, a] = AWAL_JUZ_MUSHAF[juz - 1]
    const h = halamanDariAyat(s, a)!
    const atas = awalHalaman(h)!
    periksa(
      atas.surat === s && atas.ayat === a,
      `juz ${juz} mushaf (${surat.get(s)?.nama} ${a}) tepat di ayat teratas halaman ${h}`,
    )
    periksa(
      halamanPerJuz(juz) === 20,
      `juz ${juz} karena itu genap ${halamanPerJuz(juz)} halaman`,
    )
  }

  // Batas klasik TIDAK boleh ikut berubah — AYAT_PER_JUZ & catatan ujian
  // bersandar padanya, dan itu sudah diuji di bagian atas berkas ini.
  periksa(
    BATAS_JUZ[6].mulai.surat === 5 && BATAS_JUZ[6].mulai.ayat === 82,
    'batas klasik juz 7 tetap Al-Maidah 82',
  )
  periksa(
    BATAS_JUZ[26].mulai.surat === 51 && BATAS_JUZ[26].mulai.ayat === 31,
    'batas klasik juz 27 tetap Az-Zariyat 31',
  )

  // Ali Imran 92 adalah titik yang dulu keliru, dan indeks halaman menjadi
  // saksi ketiga: ia jatuh PERSIS di awal halaman 62 — awal juz 4.
  periksa(
    halamanDariAyat(3, 92) === 62 && HALAMAN_JUZ[4].mulai === 62,
    `Ali Imran 92 ada di halaman ${halamanDariAyat(3, 92)}, dan itu awal juz 4`,
  )

  // Pembanding luar: 228 titik sauh dari quran.com (lihat HALAMAN_SURAH).
  periksa(HALAMAN_SURAH.length === 114, `pembanding quran.com berisi ${HALAMAN_SURAH.length} surah`)
  let sauhCocok = 0
  let sauhBeda = 0
  for (let id = 1; id <= 114; id++) {
    const harap = HALAMAN_SURAH[id - 1]
    const panjangSurah = surat.get(id)?.ayat
    if (!panjangSurah) continue
    const awal = halamanDariAyat(id, 1)
    const akhir = halamanDariAyat(id, panjangSurah)
    if (awal === harap[0] && akhir === harap[1]) {
      sauhCocok += 2
    } else {
      sauhBeda++
      console.log(
        `  ✗ surah ${id} ${surat.get(id)?.nama}: tabel ${awal}–${akhir}, quran.com ${harap[0]}–${harap[1]}`,
      )
    }
  }
  periksa(
    sauhBeda === 0,
    `${sauhCocok} titik sauh cocok dengan quran.com (penyedia berbeda dari sumber tabel)`,
  )

  // Halaman terakhir tiap juz: satu ayat sesudahnya harus sudah juz berikutnya.
  console.log('\n── halamanSelesaiDalamJuz() ──')
  // Juz 30 mulai di halaman 582 (An-Naba 1). Hafal sampai akhir halaman 582
  // berarti satu halaman utuh; hafal sampai tengah halaman 583 tetap satu.
  const awal583 = awalHalaman(583)!
  const akhir582 = { surat: awal583.surat, ayat: awal583.ayat - 1 }
  periksa(
    halamanSelesaiDalamJuz(30, akhir582.surat, akhir582.ayat) === 1,
    `hafal sampai ${akhir582.surat}:${akhir582.ayat} (akhir hlm 582) → 1 halaman utuh`,
  )
  periksa(
    halamanSelesaiDalamJuz(30, awal583.surat, awal583.ayat) === 1,
    `hafal sampai ${awal583.surat}:${awal583.ayat} (awal hlm 583) → tetap 1 halaman utuh`,
  )
  periksa(
    halamanSelesaiDalamJuz(30, 78, 1) === 0,
    'baru An-Naba 1 (awal juz 30) → 0 halaman utuh',
  )
  periksa(
    halamanSelesaiDalamJuz(30, 114, 6) === halamanPerJuz(30),
    `hafal sampai An-Nas 6 → ${halamanSelesaiDalamJuz(30, 114, 6)} halaman (seluruh juz 30)`,
  )

  // ── Aturan pembulatan RQ ────────────────────────────────────────────────
  console.log('\n── Pembulatan ke bawah ──')
  // Contoh yang disebut langsung oleh RQ LHI.
  const c1 = capaian(2, 2, 3)
  periksa(
    c1.juz === 2 && c1.halaman === 2,
    `2 juz 2 halaman 3 baris → ${formatCapaian(c1)} (baris dibuang)`,
  )
  const c2 = capaian(0, 0, 19)
  periksa(c2.juz === 0 && c2.halaman === 0, `19 baris saja → ${formatCapaian(c2)}`)
  const c3 = capaian(3, 0)
  periksa(formatCapaian(c3) === '3 juz', `3 juz genap → "${formatCapaian(c3)}" (tanpa "0 halaman")`)
  const c4 = capaian(0, 5)
  periksa(formatCapaian(c4) === '5 halaman', `belum satu juz → "${formatCapaian(c4)}"`)

  // Menggenapi juz harus naik sendiri — dan ambangnya ikut panjang juz yang
  // sedang dijalani, bukan 20 mati. Juz pertama dalam urutan RQ adalah juz 30
  // yang panjangnya 23 halaman.
  const c5 = capaian(0, 22)
  periksa(c5.juz === 0 && c5.halaman === 22, `22 halaman di juz 30 → ${formatCapaian(c5)} (belum genap)`)
  const c6 = capaian(0, 23)
  periksa(c6.juz === 1 && c6.halaman === 0, `23 halaman di juz 30 → ${formatCapaian(c6)} (genap, naik juz)`)
  const c7 = capaian(1, 20)
  periksa(c7.juz === 2 && c7.halaman === 0, `1 juz + 20 halaman di juz 29 → ${formatCapaian(c7)}`)

  selesai()
}

main()
