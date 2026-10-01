import type { Jenjang } from '@/types'

/**
 * Bentuk kelas yang utuh untuk SD & SMP: tingkat di depan, rombel menyusul —
 * '1A', '7B', '4 Ikhwan'.
 *
 * Pola yang sama dipakai kenaikan kelas untuk memutuskan siapa yang bisa
 * dinaikkan ('5C' → '6C'). Keduanya sengaja membaca satu berkas: kalau
 * halaman pembenahan menyatakan sebuah kelas sudah beres sementara kenaikan
 * masih melewatinya, anak itu tertinggal satu angkatan tanpa ada yang tahu.
 */
export const POLA_KELAS = /^(\d+)([A-Za-z].*)$/

/**
 * Unit yang kelasnya TIDAK berombel — daftar kelas sahnya tetap dan urut
 * (ditetapkan RQ 2026-09-28):
 *   TPAIT    : KB, TKA, TKB
 *   SD Juara : 1–6 (satu rombel per tingkat, tanpa huruf)
 *   SMA      : 10, 11, 12
 */
export const KELAS_TETAP: Partial<Record<Jenjang, string[]>> = {
  paud: ['KB', 'TKA', 'TKB'],
  sd_juara: ['1', '2', '3', '4', '5', '6'],
  sma: ['10', '11', '12'],
}

/** Tingkat terakhir unit berombel. Anak di tingkat ini tidak naik — ia lulus. */
const TINGKAT_AKHIR: Partial<Record<Jenjang, number>> = { sd: 6, smp: 9 }

/**
 * Bentuk baku sebuah isian kelas: 'TK A' / 'tk-a' → 'TKA', ' 10 ' → '10'.
 * Bentuk yang tak dikenal dikembalikan apa adanya (dirapikan spasinya) —
 * kelasJelas lah yang memutuskan sah atau tidaknya.
 */
export function bakukanKelas(jenjang: Jenjang, kelas: string | null | undefined): string {
  const k = (kelas ?? '').trim().replace(/\s+/g, ' ')
  const tetap = KELAS_TETAP[jenjang]
  if (!tetap) return k
  const rapat = k.toUpperCase().replace(/[\s.\-_]/g, '')
  return tetap.find(t => t === rapat) ?? k
}

/**
 * Apakah kelas anak ini sudah cukup jelas untuk dipakai bekerja?
 *
 * Yang dijawab bukan "apakah tulisannya rapi", melainkan "apakah kelas ini
 * masih menyembunyikan keputusan yang belum pernah diambil siapa pun".
 * '4.0' menyimpan tingkatnya tapi kehilangan rombelnya: mesin tidak boleh
 * menebak anak itu 4A atau 4D, dan selama tak ada yang memutuskan, ia
 * dilewati kenaikan kelas serta menempel pada tab kelas yang tidak nyata.
 * Di unit tanpa rombel sebaliknya: '1A' di SD Juara adalah kelas yang tidak
 * ada.
 *
 * Kelas kosong dihitung belum jelas dengan alasan yang sama.
 */
export function kelasJelas(jenjang: Jenjang, kelas: string | null | undefined): boolean {
  const k = kelas?.trim()
  if (!k) return false
  const tetap = KELAS_TETAP[jenjang]
  return tetap ? tetap.includes(k) : POLA_KELAS.test(k)
}

/** Contoh isian untuk formulir — mengikuti bentuk kelas unitnya. */
export function contohKelas(jenjang: Jenjang | null | undefined): string {
  const tetap = jenjang ? KELAS_TETAP[jenjang] : undefined
  return tetap ? tetap.join(', ') : 'contoh: 4A'
}

/**
 * Kelas tahun depan: `{ naik }`, 'lulus', atau null bila kelasnya belum
 * jelas (dilewati, tidak ditebak).
 *
 *   SD / SMP : 1A → 2A … 6A (SD) / 9A (SMP) lulus — rombel dipertahankan
 *   TPAIT    : KB → TKA → TKB → lulus
 *   SD Juara : 1 → 2 … 6 lulus
 *   SMA      : 10 → 11 → 12 lulus
 */
export function kelasBerikutnya(jenjang: Jenjang, kelas: string | null | undefined): { naik: string } | 'lulus' | null {
  const k = kelas?.trim() ?? ''
  const tetap = KELAS_TETAP[jenjang]
  if (tetap) {
    const i = tetap.indexOf(k)
    if (i === -1) return null
    return i === tetap.length - 1 ? 'lulus' : { naik: tetap[i + 1] }
  }
  const cocok = k.match(POLA_KELAS)
  if (!cocok) return null
  const tingkat = Number(cocok[1])
  const akhir = TINGKAT_AKHIR[jenjang]
  if (akhir !== undefined && tingkat >= akhir) return 'lulus'
  return { naik: `${tingkat + 1}${cocok[2]}` }
}

// ─── Rombel SMP: huruf = asrama/fullday × putra/putri ───────────────────────

/**
 * Arti huruf rombel SMPIT LHI (ditetapkan RQ 2026-10-01):
 *   A — boarding putra   B — boarding putri
 *   C — fullday putra    D — fullday putri
 *
 * Kelas dan program diisi terpisah di formulir, jadi "9D, Reguler BD" bisa
 * tercipta tanpa ada yang menyadarinya — dan anak itu tetap dianggap boarding
 * (ikut daftar calon kelompok asrama). Aturan ini menolaknya di setiap pintu
 * masuk: formulir, impor, dan pindah kelas.
 */
export const ROMBEL_SMP: Record<string, { boarding: boolean; gender: 'L' | 'P' }> = {
  A: { boarding: true, gender: 'L' },
  B: { boarding: true, gender: 'P' },
  C: { boarding: false, gender: 'L' },
  D: { boarding: false, gender: 'P' },
}

const PROGRAM_SMP_BOARDING = ['reguler_bd', 'boarding_quls']
const PROGRAM_SMP_FULLDAY = ['reguler_fd', 'fullday_quls']

function teksRombel(r: { boarding: boolean; gender: 'L' | 'P' }): string {
  return `${r.boarding ? 'boarding' : 'fullday'} ${r.gender === 'L' ? 'putra' : 'putri'}`
}

/**
 * Pesan galat bila huruf kelas SMP tidak cocok dengan program/gender anak;
 * null bila cocok atau tidak bisa dinilai (kelas di luar pola 7–9 + A–D,
 * program/gender kosong — kolom yang kosong tidak bisa dituduh bertentangan).
 */
export function galatRombelSmp(
  jenjang: Jenjang,
  kelas: string | null,
  program: string | null,
  gender: 'L' | 'P' | null,
): string | null {
  if (jenjang !== 'smp' || !kelas) return null
  const m = kelas.trim().toUpperCase().match(/^([789])\s*([A-D])$/)
  if (!m) return null
  const r = ROMBEL_SMP[m[2]]
  if (program && (PROGRAM_SMP_BOARDING.includes(program) || PROGRAM_SMP_FULLDAY.includes(program))) {
    const boarding = PROGRAM_SMP_BOARDING.includes(program)
    if (boarding !== r.boarding) {
      return `Kelas ${kelas} adalah rombel ${teksRombel(r)}, tapi programnya ${boarding ? 'boarding' : 'fullday'}. Samakan kelas dan programnya.`
    }
  }
  if (gender && gender !== r.gender) {
    return `Kelas ${kelas} adalah rombel ${teksRombel(r)}, tapi siswa ini ${gender === 'L' ? 'putra' : 'putri'}.`
  }
  return null
}
