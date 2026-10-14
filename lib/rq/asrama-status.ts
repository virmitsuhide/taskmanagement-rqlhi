/**
 * Cuti/sakit & pengajuan nonaktif anak asrama (0119) — bagian murni (tanpa
 * server), supaya label dan aturan kelas bisa dipakai komponen klien.
 */

export type JenisCuti = 'sakit' | 'cuti'
export type AlasanNonaktif = 'fullday' | 'pindah_sekolah' | 'lainnya'
export type StatusPengajuan = 'menunggu' | 'disetujui' | 'ditolak' | 'dibatalkan'

export const LABEL_CUTI: Record<JenisCuti, string> = { sakit: 'Sakit', cuti: 'Cuti / izin keluarga' }
export const LABEL_ALASAN: Record<AlasanNonaktif, string> = {
  fullday: 'Pindah ke fullday',
  pindah_sekolah: 'Pindah sekolah',
  lainnya: 'Lainnya',
}
export const LABEL_STATUS_PENGAJUAN: Record<StatusPengajuan, string> = {
  menunggu: 'Menunggu verifikasi',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
}

/**
 * Kelas setelah pindah ke fullday: huruf rombel boarding (A putra, B putri)
 * menjadi fullday (C putra, D putri) di tingkat yang sama. Kelas di luar pola
 * itu dibiarkan.
 */
export function kelasFullday(kelas: string | null, gender: 'L' | 'P'): string | null {
  if (!kelas) return null
  const m = kelas.trim().toUpperCase().match(/^([789])\s*([AB])$/)
  if (!m) return kelas
  return `${m[1]}${gender === 'L' ? 'C' : 'D'}`
}


/** '2026-10-02' → '2 Okt' (tanggal tanpa jam dibaca apa adanya). */
export function tglPendek(d: string | null | undefined, tahun = false): string {
  if (!d) return '—'
  const t = d.length === 10 ? new Date(`${d}T00:00:00Z`) : new Date(d)
  return t.toLocaleDateString('id-ID', {
    day: 'numeric', month: tahun ? 'long' : 'short', ...(tahun ? { year: 'numeric' } : {}),
    timeZone: d.length === 10 ? 'UTC' : 'Asia/Jakarta',
  })
}
