/**
 * Jenis laporan Qur'an dalam satu semester (0086). Modul murni — dipakai
 * server dan komponen klien sekaligus, jadi tidak boleh menarik Supabase.
 *
 * ATS (Asesmen Tengah Semester) dibagikan di pertengahan semester, rapor di
 * akhirnya. Keduanya punya template dan tulisan guru sendiri-sendiri.
 */
export type JenisRapor = 'ats' | 'semester'

export const JENIS_RAPOR: JenisRapor[] = ['ats', 'semester']

export const LABEL_JENIS_RAPOR: Record<JenisRapor, string> = {
  ats: 'ATS (tengah semester)',
  semester: 'Rapor semester',
}

export function bacaJenisRapor(v: string | undefined | null): JenisRapor {
  return v === 'ats' ? 'ats' : 'semester'
}
