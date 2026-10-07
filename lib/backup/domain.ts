import type { UserRole } from '@/types'

/**
 * Backup basis data per bidang — siapa boleh mengunduh tabel apa.
 *
 *   kumik      : unit (tahsin, tahfidz, ujian, siswa, halaqoh…) & ekstra
 *   sdm        : KPI & mentoring gukar
 *   bendahara  : keuangan
 *   kepala_rq  : semua
 *   admin      : semua
 *
 * "semua" tidak memakai daftar: tabelnya dibaca langsung dari skema yang
 * diterbitkan PostgREST, jadi tabel baru otomatis ikut tanpa ada yang perlu
 * ingat menambahkannya di sini. Daftar per bidang di bawah sebaliknya
 * sengaja tertulis — bidang adalah keputusan wewenang, bukan tebakan nama.
 */

export type DomainBackup = 'unit' | 'ekstra' | 'kpi' | 'keuangan' | 'semua'

export interface InfoDomain {
  judul: string
  keterangan: string
  /** null = seluruh tabel publik. */
  tabel: string[] | null
}

export const DOMAIN_BACKUP: Record<DomainBackup, InfoDomain> = {
  unit: {
    judul: 'Data unit',
    keterangan: 'Siswa, halaqoh, setoran tahsin & tahfidz, ujian, drill, asrama, riyadhoh, target, rapor, kalender, dan absensi siswa seluruh unit.',
    tabel: [
      'academic_terms', 'students', 'kenaikan_riwayat', 'teachers',
      'halaqoh', 'halaqoh_teachers', 'halaqoh_members', 'halaqoh_sessions',
      'kelompok_klasikal', 'kelompok_klasikal_anggota',
      'tahsin_methods', 'jilid_levels', 'tahsin_materi', 'surat_master', 'batas_juz',
      'tahsin_logs', 'tahsin_log_materi', 'tahfidz_logs', 'tasmi_logs', 'setoran_arsip',
      'juz_progress', 'jilid_promotions', 'juz_promotions', 'tahfidz_juz_drill',
      'ujian_pengujis', 'ujian_tahfidz', 'ujian_tahsin', 'verifikasi_riwayat_tahfidz',
      'student_monthly', 'absensi_harian',
      'kurikulum_targets', 'target_bulanan', 'target_bulanan_ambang', 'laporan_kurikulum',
      'kalender_pekan_efektif', 'kalender_jadwal', 'kalender_kosong', 'kaldik_events',
      'asrama_kelompok', 'asrama_anggota',
      'riyadhoh_jadwal', 'riyadhoh_kelompok_siswa', 'riyadhoh_pengampu', 'riyadhoh_peserta', 'riyadhoh_hadir',
      'rapor_templates', 'rapor_isian',
    ],
  },
  ekstra: {
    judul: 'Data ekstra',
    keterangan: 'Jenis ekstra, slot, pengampu, booking, dan kehadiran pertemuan ekstra.',
    tabel: ['ekstra_jenis', 'ekstra_slot', 'ekstra_guru', 'ekstra_booking', 'ekstra_hadir'],
  },
  kpi: {
    judul: 'KPI & mentoring gukar',
    keterangan: 'KPI bulanan guru, rapor & banding KPI, perpindahan unit guru, data karyawan, serta kelompok, peserta, dan setoran mentoring gukar.',
    tabel: [
      'teachers', 'employees', 'teacher_unit_moves',
      'kpi_monthly', 'kpi_rapor_riwayat', 'kpi_banding',
      'gukar_groups', 'gukar_participants', 'gukar_monthly', 'setoran_guru',
    ],
  },
  keuangan: {
    judul: 'Data keuangan',
    keterangan: 'Akun, transaksi, pendanaan, anggaran, dana titipan, rencana program, dan catatan laporan keuangan.',
    tabel: [
      'finance_accounts', 'finance_transactions', 'finance_funding', 'finance_budgets',
      'finance_trust_funds', 'finance_trust_entries', 'finance_program_plans', 'finance_report_notes',
    ],
  },
  semua: {
    judul: 'Seluruh basis data',
    keterangan: 'Semua tabel — termasuk tugas, rapat, konten humas, dan pengaturan. Kata sandi tidak ikut.',
    tabel: null,
  },
}

const SEMUA: DomainBackup[] = ['unit', 'ekstra', 'kpi', 'keuangan', 'semua']

const PER_ROLE: Partial<Record<UserRole, DomainBackup[]>> = {
  kumik: ['unit', 'ekstra'],
  sdm: ['kpi'],
  bendahara: ['keuangan'],
  kepala_rq: SEMUA,
  admin: SEMUA,
}

export function domainBackupUntuk(role: UserRole): DomainBackup[] {
  return PER_ROLE[role] ?? []
}

export function bolehBackup(role: UserRole, domain: string): domain is DomainBackup {
  return (domainBackupUntuk(role) as string[]).includes(domain)
}

/**
 * Kolom yang TIDAK pernah ikut ke berkas backup. Berkasnya diunduh ke laptop
 * dan bisa berpindah tangan; hash kata sandi di dalamnya membuka jalan
 * menebak sandi tanpa batas percobaan.
 */
export const KOLOM_RAHASIA = /^(password_hash|.*_secret|.*_token)$/i
