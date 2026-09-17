import type { EducationEntry, EducationLevel } from '@/types'

/**
 * Urutan jenjang dari terendah ke tertinggi. Dipakai untuk dua hal:
 * mengurutkan riwayat saat disimpan, dan menentukan jenjang tertinggi
 * yang tetap ditulis ke kolom lama `users.education_level`.
 */
export const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'D3', 'S1', 'S2', 'S3'] as const

/**
 * Jenjang yang punya jurusan/program studi — hanya pendidikan tinggi.
 * Peminatan SMA (IPA/IPS) sengaja tidak dicatat.
 */
const LEVELS_WITH_MAJOR: readonly string[] = ['D3', 'S1', 'S2', 'S3']

export function isEducationLevel(value: string): value is EducationLevel {
  return (EDUCATION_LEVELS as readonly string[]).includes(value)
}

export function hasMajorField(level: string): boolean {
  return LEVELS_WITH_MAJOR.includes(level)
}

/**
 * Kosongkan jurusan pada jenjang yang tidak memilikinya. Form menyembunyikan
 * isiannya, tapi baris lama (mis. SMA "IPA") atau baris yang jenjangnya
 * diturunkan setelah jurusan terisi tetap perlu dibersihkan saat disimpan.
 */
export function dropUnusedMajor(row: EducationEntry): EducationEntry {
  return hasMajorField(row.level) ? row : { ...row, major: '' }
}

/**
 * Label isian nama lembaga menyesuaikan jenjang — "Nama sekolah" untuk
 * SD–SMA, "Nama perguruan tinggi" untuk S1 ke atas.
 */
export function institutionPlaceholder(level: string): string {
  if (level === 'D3' || level === 'S1' || level === 'S2' || level === 'S3') return 'Nama perguruan tinggi'
  if (!level) return 'Nama lembaga'
  return 'Nama sekolah'
}

/**
 * Urutkan riwayat dari jenjang terendah ke tertinggi. Pengurus bebas
 * menambah baris dengan urutan apa pun; yang tersimpan selalu rapi.
 * Baris berjenjang sama mempertahankan urutan input (sort stabil).
 */
export function sortEducation(rows: EducationEntry[]): EducationEntry[] {
  const rank = (l: string) => {
    const i = (EDUCATION_LEVELS as readonly string[]).indexOf(l)
    return i === -1 ? EDUCATION_LEVELS.length : i
  }
  return [...rows].sort((a, b) => rank(a.level) - rank(b.level))
}

/**
 * Jenjang tertinggi dari riwayat. Kolom `education_level` tidak dibuang
 * supaya kueri lama dan rekap kepegawaian yang menyaring "minimal S1"
 * tetap jalan tanpa harus membongkar jsonb.
 */
export function highestLevel(rows: EducationEntry[]): EducationLevel | null {
  let best: EducationLevel | null = null
  let bestRank = -1
  for (const r of rows) {
    const i = (EDUCATION_LEVELS as readonly string[]).indexOf(r.level)
    if (i > bestRank) {
      bestRank = i
      best = r.level as EducationLevel
    }
  }
  return best
}
