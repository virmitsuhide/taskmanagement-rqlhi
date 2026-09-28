import type { Jenjang } from '@/types'

export interface ProgramOption {
  code: string
  label: string
}

/**
 * Taksonomi program pembelajaran per unit RQ LHI.
 * - paud (TPAIT LHI): tanpa program (hanya tahsin & tahfidz).
 * - Program di-scope per jenjang; kode boleh sama antar unit (mis. 'quls').
 */
export const PROGRAMS_BY_JENJANG: Record<Jenjang, ProgramOption[]> = {
  paud: [],
  sd: [
    { code: 'clil', label: 'CLIL Program' },
    { code: 'quls', label: 'QULS' },
    { code: 'quls_takhassus', label: 'QULS Takhassus' },
  ],
  sd_juara: [
    { code: 'reguler', label: 'Reguler' },
    { code: 'quls', label: 'QULS' },
  ],
  smp: [
    { code: 'reguler_fd', label: 'Reguler Fullday (FD)' },
    { code: 'reguler_bd', label: 'Reguler Boarding (BD)' },
    { code: 'fullday_quls', label: 'Fullday QULS' },
    { code: 'boarding_quls', label: 'Boarding QULS' },
  ],
  sma: [
    { code: 'boarding', label: 'Boarding' },
  ],
}

/** Label unit (jenjang) versi lengkap RQ LHI. */
export const UNIT_LABELS: Record<Jenjang, string> = {
  paud: 'PAUD/TPAIT',
  sd: 'SDIT LHI',
  sd_juara: 'SD LHI Juara',
  smp: 'SMPIT LHI',
  sma: 'SMA LHI',
}

export const UNIT_ORDER: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

/**
 * Program SD yang menjadi wewenang Koor QULS SD.
 *
 * QULS SD bukan unit tersendiri — anaknya tetap siswa SDIT LHI di kelas dan
 * sesi yang sama. Yang memisahkannya cuma program, jadi daftar inilah yang
 * dipakai lib/auth/permissions.ts untuk menyempitkan wewenang koor QULS SD
 * dan lib/tahsin.ts untuk mengunci metodenya ke KIBAR.
 */
export const QULS_SD_PROGRAMS = ['quls', 'quls_takhassus'] as const

/**
 * Apakah pasangan (jenjang, program) ini masuk lingkup QULS SD?
 *
 * program null diperlakukan sebagai BUKAN QULS — 493 siswa SD yang programnya
 * belum ditandai tetap menjadi wewenang koor SD, bukan berpindah diam-diam ke
 * koor QULS SD hanya karena kolomnya kosong.
 */
export function isQulsSdProgram(jenjang: Jenjang, program: string | null | undefined): boolean {
  if (jenjang !== 'sd' || !program) return false
  return (QULS_SD_PROGRAMS as readonly string[]).includes(program)
}

/**
 * Cocokkah program sebuah baris dengan penyempitan program analitik
 * (getAnalyticsProgramScope)? `scope` null = tanpa penyempitan; program
 * kosong tidak pernah cocok dengan penyempitan apa pun — alasannya sama
 * dengan isQulsSdProgram.
 */
export function cocokProgram(scope: readonly string[] | null | undefined, program: string | null | undefined): boolean {
  return !scope || (!!program && scope.includes(program))
}

/** Kunci string sebuah penyempitan program — untuk cache() yang membandingkan argumen dengan ===. */
export function kunciProgram(scope: readonly string[] | null | undefined): string {
  return scope ? [...scope].sort().join('|') : ''
}

export function dariKunciProgram(kunci: string): readonly string[] | null {
  return kunci ? kunci.split('|') : null
}

export function getProgramsForJenjang(jenjang: Jenjang): ProgramOption[] {
  return PROGRAMS_BY_JENJANG[jenjang] ?? []
}

/** Label program untuk kombinasi (jenjang, code). null → belum ditandai. */
export function programLabel(jenjang: Jenjang, code: string | null): string {
  if (!code) return 'Belum ditandai'
  return getProgramsForJenjang(jenjang).find(p => p.code === code)?.label ?? code
}
