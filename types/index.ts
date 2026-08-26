export type UserRole =
  | 'kepala_rq'
  | 'kumik'
  | 'sdm'
  | 'bendahara'
  | 'koor_ekstra'
  | 'koor_sd'
  | 'koor_smp'
  | 'humas'
  | 'div_training'
  | 'new_squad'

export type MeetingType =
  | 'manajemen'
  | 'kumik'
  | 'new_squad'
  | 'koor_sd'
  | 'koor_smp'
  /** Rapat Koor x SD — dibuat koor SD */
  | 'koor_x_sd'
  /** Rapat Koor x SMP — dibuat koor SMP */
  | 'koor_x_smp'
  /** Rapat Koor x Boarding — dibuat koor SMP */
  | 'koor_x_boarding'
  /** Rapat RQ x QULS — dibuat kumik, terbatas untuk kumik/kepala/SDM/bendahara */
  | 'rq_x_quls'
  /** Rapat Humas Yayasan — dibuat humas, dipantau manajemen */
  | 'humas_yayasan'

export type AgendaTag = 'keputusan' | 'informasi' | 'perlu_diskusi' | 'tindak_lanjut' | 'approval'

export type TaskPriority = 'low' | 'middle' | 'high'

/** Bobot/berat pengerjaan — terpisah dari mendesak-tidaknya (priority). */
export type TaskWeight = 'easy' | 'medium' | 'hard'

/**
 * Horizon tugas pribadi (jangka pendek vs panjang). Dulu dititipkan pada
 * priority='jangka_panjang'; dipisah saat priority berubah jadi low/middle/high.
 */
export type TaskHorizon = 'pendek' | 'panjang'

export type TaskStatus = 'todo' | 'in_progress' | 'problem' | 'submitted' | 'done' | 'returned'

/** Jenis hambatan saat task berstatus 'problem' — menentukan warna kartu di papan. */
export type TaskProblemType = 'bottleneck' | 'blocked' | 'wip_limit' | 'others'

export type TaskSource = 'rapat' | 'mandiri' | 'home_publik' | 'humas_request'

export type ContentRequestType = 'flyer_ujian' | 'flyer_lain' | 'video' | 'lain_lain'

export type ContentPriority = 'low' | 'medium' | 'high'

export type ContentStatus = 'requested' | 'on_process' | 'finish'

export type PublicPostType = 'pengumuman' | 'tugas_guru'

export type PublicTarget = 'all' | 'sd' | 'smp'

export interface User {
  id: string
  username: string
  role: UserRole
  display_name: string
  email: string | null
  can_change_password: boolean
  created_at: string
}

/** 'ust' → "Ust. Habib", 'usth' → "Usth. Aul" */
export type Sapaan = 'ust' | 'usth'

export type EducationLevel = 'SD' | 'SMP' | 'SMA' | 'S1' | 'S2' | 'S3'

export interface TrainingEntry {
  name: string
  year: string
  organizer: string
}

export interface AmanahEntry {
  position: string
  period: string
}

export interface AwardEntry {
  name: string
  year: string
}

/** Profil lengkap pengurus — semua role kecuali new_squad. */
export interface PengurusProfile extends User {
  sapaan: Sapaan | null
  nickname: string | null
  full_name: string | null
  nip: string | null
  birth_place: string | null
  birth_date: string | null
  current_amanah: string | null
  education_level: EducationLevel | null
  photo_url: string | null
  competencies: string[] | null
  trainings: TrainingEntry[] | null
  amanah_history: AmanahEntry[] | null
  awards: AwardEntry[] | null
}

export interface Meeting {
  id: string
  type: MeetingType
  subject: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  mc: string | null
  notulis: string | null
  participants: string[]
  created_by: string
  created_at: string
  updated_at: string
  creator?: User
}

export interface AgendaItem {
  id: string
  meeting_id: string
  order_num: number
  tag: AgendaTag
  discussion: string
  follow_up: string | null
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  source_type: TaskSource
  source_meeting_id: string | null
  source_agenda_id: string | null
  assigned_by: string
  assigned_to: string
  public_target: PublicTarget | null
  priority: TaskPriority
  weight: TaskWeight
  horizon: TaskHorizon
  status: TaskStatus
  problem_type: TaskProblemType | null
  problem_notes: string | null
  due_date: string | null
  return_notes: string | null
  verified_by: string | null
  verified_at: string | null
  /** Terisi = tugas sudah dihapus (disembunyikan, masih bisa dipulihkan). */
  deleted_at: string | null
  created_at: string
  updated_at: string
  assignee?: User
  assigner?: User
}

/** Jenis peristiwa di riwayat tugas — lihat migrasi 0018. */
export type TaskHistoryAction = 'status' | 'edited' | 'deleted' | 'restored'

export interface TaskHistory {
  id: string
  task_id: string
  changed_by: string
  old_status: TaskStatus | null
  new_status: TaskStatus
  /** Baris lama sebelum migrasi 0018 bisa undefined — perlakukan sebagai 'status'. */
  action?: TaskHistoryAction | null
  notes: string | null
  created_at: string
  changer?: User
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string | null
  body: string
  mentions: string[] | null
  created_at: string
  author?: User
}

// Ringkasan riwayat penyelesaian satu tugas (untuk dashboard Kepala RQ).
export interface CompletedTaskEntry {
  task: Task
  startedAt: string | null   // waktu mulai dikerjakan (entri in_progress pertama)
  completedAt: string        // waktu penyelesaian (verified_at / entri done)
  durationMs: number | null  // lama pengerjaan (completedAt - startedAt)
  comments: TaskComment[]    // history diskusi tugas
}

// Riwayat penyelesaian dikelompokkan per pengurus (assignee).
export interface MemberCompletion {
  user: Pick<User, 'id' | 'display_name' | 'role'>
  tasks: CompletedTaskEntry[]
}

/** Status urgensi pengumuman di beranda. */
export type PostPriority = 'penting' | 'info' | 'pengingat'

/**
 * Ikon yang dipilih penulis untuk sebuah post di beranda.
 *
 * Sumbu terpisah dari PostPriority: prioritas menentukan warnanya (seberapa
 * mendesak), ikon menentukan gambarnya (post ini soal apa). Satu post bisa
 * saja bergambar tugas tapi berstatus penting.
 */
export type PostIcon = 'info' | 'pengumuman' | 'pengingat' | 'tugas'

export interface PublicPost {
  id: string
  type: PublicPostType
  target: PublicTarget
  title: string
  content: string
  due_date: string | null
  /** Post lama sebelum migrasi 0017 bisa undefined — perlakukan sebagai 'info'. */
  priority?: PostPriority | null
  /** Post sebelum migrasi 0030 belum punya ikon — lihat postIconOf(). */
  icon?: PostIcon | null
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
  creator?: User
}

export interface ContentRequest {
  id: string
  request_type: ContentRequestType
  description: string
  requested_by: string
  requested_date: string
  priority: ContentPriority | null
  status: ContentStatus
  finished_by: string | null
  finished_at: string | null
  /** Tugas yang memegang kemajuan request ini. Null untuk request pra-0033. */
  task_id?: string | null
  task?: Pick<Task, 'id' | 'status' | 'priority' | 'problem_type' | 'assigned_to' | 'assigned_by'> | null
  created_at: string
  updated_at: string
  requester?: User
}

export type NewsCategory = 'sdit_lhi' | 'smpit_lhi' | 'sma_lhi' | 'paud_lhi' | 'sd_lhi_juara'
export type NewsType = 'berita' | 'artikel'

export interface NewsArticle {
  id: string
  title: string
  excerpt: string | null
  content: string
  thumbnail_url: string | null
  category: NewsCategory | null
  type: NewsType
  author_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  author?: User
}

export interface PrivateNote {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface SessionData {
  userId: string
  username: string
  role: UserRole
  displayName: string
  isLoggedIn: boolean
}

export interface ActionResult {
  success: boolean
  error?: string
  data?: unknown
}

/**
 * Satu agenda dari kaldikrqlhi.vercel.app (`/api/calendar?year=`).
 *
 * `date` adalah bentuk yang benar-benar dikirim API (YYYY-MM-DD, sehari penuh);
 * `start`/`end`/`location` dipertahankan opsional untuk agenda berjam yang
 * mungkin menyusul.
 */
export interface KaldiEvent {
  id?: string
  title: string
  date?: string
  start?: string
  end?: string
  location?: string
  description?: string | null
  /** Jenjang pemilik agenda: 'SD' | 'SMP' | 'NASIONAL' | … dipakai untuk legenda. */
  unit?: string
  /** 'agenda' | 'libur_nasional' | … */
  type?: string
  color?: string
  year?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface AboutRq {
  id: number
  vision: string
  mission: string
  history: string
  updated_at: string
  updated_by: string | null
}

/** Kunci warna aksen program — dipetakan ke kelas Tailwind di lib/programs/theme.ts */
export type ProgramAccent =
  | 'emerald' | 'teal' | 'blue' | 'violet' | 'amber' | 'sky' | 'rose'

export interface Program {
  id: string
  slug: string
  title: string
  description: string
  photo_url: string | null
  icon: string
  accent: ProgramAccent
  long_description: string
  curriculum: string
  schedule: string
  target_audience: string
  contact_info: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

/** @deprecated digantikan `Program`. */
export interface ProgramDetail {
  slug: string
  long_description: string
  curriculum: string
  schedule: string
  target_audience: string
  contact_info: string
  updated_at: string
  updated_by: string | null
}

export interface KaldiApiResponse {
  events: KaldiEvent[]
  total: number
  meta: {
    from: string
    to: string
    days: number
    limit: number
    unit: string
    source: string
  }
}

// ─── PHASE 0 — Tahsin & Tahfidz ─────────────────────────────────────
export type Gender = 'L' | 'P'
// Jenjang berfungsi sebagai "unit" RQ LHI. 'sd_juara' = SD LHI Juara (metode KIBAR).
export type Jenjang = 'paud' | 'sd' | 'sd_juara' | 'smp' | 'sma'
export type TahsinStatus = 'lulus' | 'ulang'
// Jenis setoran tahfidz (semantik RQ LHI):
//  - ziyadah        : menambah hafalan baru (dihitung ke progress juz)
//  - murojaah_baru  : mengulang hafalan di juz yang sedang berjalan
//  - murojaah_lama  : mengulang hafalan di juz yang sudah diujikan (dijuz'iyahkan)
//  - tasmi          : menyetorkan beberapa juz sekaligus (lihat TasmiLog) — disimpan di tabel tasmi_logs
export type TahfidzKind = 'ziyadah' | 'murojaah_baru' | 'murojaah_lama' | 'tasmi'
// Cakupan tasmi: 3 juz atau 5 juz
export type TasmiScope = 3 | 5

export interface TahsinMethod {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface JilidLevel {
  id: string
  method_id: string
  label: string
  order_num: number
  total_pages: number | null
  is_quran: boolean
  // Tahap terakhir metode = "Lulus Tahsin". Saat siswa naik ke level ini,
  // ia dianggap lulus tahsin untuk metode tersebut.
  is_terminal: boolean
  created_at: string
  method?: TahsinMethod
}

export interface SuratMaster {
  id: number
  name_arabic: string
  name_latin: string
  name_id: string
  total_ayat: number
  juz_start: number
  juz_end: number
  is_makkiyah: boolean
}

export interface Teacher {
  id: string
  username: string
  full_name: string
  nip: string | null
  email: string | null
  phone: string | null
  photo_url: string | null
  is_active: boolean
  /** Terisi kalau akunnya dihapus (hapus lunak). */
  deleted_at: string | null
  /** Unit penempatan. Kosong untuk pengurus yang tidak terikat satu unit. */
  unit: Jenjang | null
  employment_type: TeacherEmployment | null
  contract_start: string | null
  /** Hari terakhir kontrak berlaku. NULL = tidak pernah kedaluwarsa. */
  contract_end: string | null
  can_change_password: boolean
  joined_at: string
  linked_user_id: string | null
  created_at: string
  updated_at: string
}

export interface Halaqoh {
  id: string
  name: string
  jenjang: Jenjang
  wali_teacher_id: string | null
  schedule_note: string | null
  /** Sesi belajar 1–3; jamnya ada di lib/rq/sesi.ts, tidak disimpan per baris. */
  sesi: number | null
  /** Ruang belajar — atribut, bukan bagian dari nama halaqoh. */
  tempat: string
  is_active: boolean
  created_at: string
  updated_at: string
  wali_teacher?: Teacher
}

export interface HalaqohTeacher {
  halaqoh_id: string
  teacher_id: string
  role: string
  created_at: string
  teacher?: Teacher
  halaqoh?: Halaqoh
}

export interface Student {
  id: string
  nis: string | null
  full_name: string
  gender: Gender | null
  birth_date: string | null
  photo_url: string | null
  jenjang: Jenjang
  kelas: string | null
  program: string | null
  halaqoh_id: string | null
  wali_name: string | null
  wali_phone: string | null
  wali_email: string | null
  current_method_id: string | null
  current_jilid_id: string | null
  current_jilid_page: number | null
  is_active: boolean
  enrolled_at: string
  created_at: string
  updated_at: string
  halaqoh?: Halaqoh
  current_method?: TahsinMethod
  current_jilid?: JilidLevel
}

export interface TahsinLog {
  id: string
  student_id: string
  teacher_id: string
  halaqoh_id: string | null
  setoran_date: string
  method_id: string | null
  jilid_id: string | null
  halaman: number | null
  baris_dari: number | null
  baris_ke: number | null
  nilai_fashohah: number | null
  nilai_tajwid: number | null
  nilai_kelancaran: number | null
  status: TahsinStatus
  catatan: string | null
  created_at: string
  student?: Student
  teacher?: Teacher
  method?: TahsinMethod
  jilid?: JilidLevel
}

export interface JilidPromotion {
  id: string
  student_id: string
  from_jilid_id: string | null
  to_jilid_id: string
  promoted_by: string | null
  promotion_date: string
  exam_score: number | null
  catatan: string | null
  created_at: string
  from_jilid?: JilidLevel
  to_jilid?: JilidLevel
  promoter?: Teacher
}

export interface TahfidzLog {
  id: string
  student_id: string
  teacher_id: string
  halaqoh_id: string | null
  setoran_date: string
  kind: TahfidzKind
  surat_id: number
  ayat_dari: number
  ayat_ke: number
  nilai_fashohah: number | null
  nilai_tajwid: number | null
  nilai_kelancaran: number | null
  catatan: string | null
  created_at: string
  student?: Student
  teacher?: Teacher
  surat?: SuratMaster
}

export interface JuzProgress {
  student_id: string
  juz_number: number
  ayat_hafal: number
  last_setoran_at: string | null
  mutqin: boolean
  updated_at: string
}

export interface JuzPromotion {
  id: string
  student_id: string
  juz_number: number
  promoted_by: string | null
  promotion_date: string
  exam_score: number | null
  catatan: string | null
  created_at: string
  promoter?: Teacher
}

// Setoran tasmi' — menyetorkan beberapa juz sekaligus (3 atau 5 juz)
export interface TasmiLog {
  id: string
  student_id: string
  teacher_id: string
  halaqoh_id: string | null
  setoran_date: string
  scope_juz: TasmiScope          // 3 atau 5
  juz_from: number               // juz awal (1-30)
  juz_to: number                 // juz akhir (1-30)
  nilai_fashohah: number | null
  nilai_tajwid: number | null
  nilai_kelancaran: number | null
  status: TahsinStatus           // lulus | ulang
  catatan: string | null
  created_at: string
  student?: Student
  teacher?: Teacher
}

// Teacher session (terpisah dari admin user session)
export interface TeacherSessionData {
  teacherId: string
  username: string
  fullName: string
  isLoggedIn: boolean
  type: 'teacher'
}

// Total ayat per juz — referensi cepat untuk hitung progress
export const AYAT_PER_JUZ: Record<number, number> = {
  1: 148,  2: 111,  3: 125,  4: 132,  5: 124,  6: 110,  7: 149,  8: 142,
  9: 159, 10: 127, 11: 151, 12: 170, 13: 154, 14: 227, 15: 185, 16: 269,
 17: 190, 18: 202, 19: 339, 20: 171, 21: 178, 22: 169, 23: 357, 24: 175,
 25: 246, 26: 195, 27: 399, 28: 137, 29: 431, 30: 564,
}


// ─── Tampilan Beranda & identitas situs (dikelola Humas) ────────────

/** Seksi yang bisa dinyalakan/dimatikan & diurutkan di beranda publik. */
export type HomeSectionKey =
  | 'agenda'
  /** Pengumuman + tugas guru, digabung dalam satu papan. */
  | 'pengumuman'
  | 'news'
  | 'program'
  | 'profil_guru'

export interface HomeSection {
  key: HomeSectionKey
  enabled: boolean
  /** Judul yang tampil di beranda. Kosong = pakai judul bawaan. */
  title: string
  /** Jumlah item maksimum. Diabaikan untuk seksi tanpa daftar. */
  limit: number
}

export interface FooterUnit {
  name: string
  address: string
  phone: string
}

export interface FooterLink {
  label: string
  href: string
}

export interface SiteSettings {
  id: number
  header_brand: string
  header_tagline: string
  footer_brand: string
  footer_brand_sub: string
  footer_tagline: string
  footer_units: FooterUnit[]
  footer_links: FooterLink[]
  footer_email: string
  footer_phone: string
  footer_hours: string
  footer_copyright: string
  sections: HomeSection[]
  updated_at: string
  updated_by: string | null
}

/** Guru yang ditampilkan di halaman Profil Guru publik. */
export interface PublicTeacher {
  id: string
  full_name: string
  photo_url: string | null
  public_title: string | null
  public_bio: string | null
  display_order: number
}

// ─── Keuangan Bendahara ──────────────────────────────────────────────────────

export type FinanceAccountKind = 'pemasukan' | 'pengeluaran'
export type FinancePaymentStatus = 'lunas' | 'piutang'

export interface FinanceAccount {
  id: string
  kind: FinanceAccountKind
  slug: string
  name: string
  hint: string
  display_order: number
  is_active: boolean
}

/** Satu penerimaan / pengeluaran. `period` = bulan tagihan, `paid_at` = kapan
 *  uangnya berpindah; laporan bulanan menjumlah berdasarkan `paid_at`. */
export interface FinanceTransaction {
  id: string
  account_id: string
  period: string
  amount: number
  description: string
  status: FinancePaymentStatus
  paid_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  /** Alokasi dana sumber — hanya terisi untuk transaksi pengeluaran. */
  funding?: FinanceFunding[]
}

export interface FinanceFunding {
  id: string
  transaction_id: string
  source_slug: string
  amount: number
}

export interface FinanceBudget {
  id: string
  account_id: string
  period: string
  amount: number
}

export interface FinanceTrustFund {
  id: string
  slug: string
  name: string
  opening_balance: number
  opening_date: string
  display_order: number
  is_active: boolean
}

export interface FinanceTrustEntry {
  id: string
  fund_id: string
  entry_date: string
  description: string
  /** Bertanda: positif = dana masuk, negatif = dana diambil. */
  amount: number
}

export interface FinanceProgramPlan {
  id: string
  period: string
  name: string
  funding_source: string
  amount: number
}

/** Bagian naratif laporan yang ditulis bendahara sendiri. */
export type FinanceNoteSection =
  | 'catatan_pemasukan'
  | 'catatan_pengeluaran'
  | 'evaluasi_anggaran'
  | 'analisis_kemandirian'

export interface FinanceReportNote {
  id: string
  period: string
  section: FinanceNoteSection
  content: string
  updated_at: string
}

// ─── Tahun ajaran, keanggotaan halaqoh, & sesi mengajar ──────────────────────

export type AcademicSemester = 'ganjil' | 'genap'

/** Jenis kepegawaian guru — menentukan pos gaji dan apakah kontraknya habis. */
export type TeacherEmployment = 'tetap_yayasan' | 'kontrak_yayasan' | 'kontrak_rq'

export const TEACHER_EMPLOYMENT_LABELS: Record<TeacherEmployment, string> = {
  tetap_yayasan: 'Guru Tetap Yayasan',
  kontrak_yayasan: 'Guru Kontrak Yayasan',
  kontrak_rq: 'Guru Kontrak RQ (OS)',
}

export interface AcademicTerm {
  id: string
  /** Label tahun ajaran, mis. '2025/2026'. */
  year_label: string
  semester: AcademicSemester
  start_date: string
  end_date: string
  is_current: boolean
}

export interface HalaqohMember {
  halaqoh_id: string
  student_id: string
  joined_at: string
  left_at: string | null
}

export interface HalaqohSession {
  id: string
  halaqoh_id: string
  /** 1 = Senin … 7 = Ahad, mengikuti ISO-8601. */
  day_of_week: number
  start_time: string
  end_time: string
  note: string
}

/** Nama hari untuk sesi, diindeks 1–7 seperti kolom day_of_week. */
export const DAY_LABELS: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Ahad',
}

// ─── Pembinaan Guru & Karyawan (Gukar) ───────────────────────────────────────

export type GukarKind = 'guru' | 'karyawan'

/** Status kepegawaian peserta — menentukan kelompok tindak lanjut SDM. */
export type GukarStatusPegawai = 'tetap' | 'calon_tetap' | 'kontrak'

export interface GukarGroup {
  id: string
  term_id: string
  name: string
  pengampu_id: string | null
  unit: string
  display_order: number
  is_active: boolean
}

export interface GukarParticipant {
  id: string
  group_id: string
  full_name: string
  unit: string
  kind: GukarKind | null
  level_awal: string
  /** NULL = belum ditetapkan SDM. */
  status_pegawai: GukarStatusPegawai | null
  /** Kunci baris STANDAR_PERAN, mis. 'guru_kelas'. Kosong = pakai ambang inti. */
  kategori_peran: string
  is_active: boolean
}

/** Catatan satu peserta pada satu bulan. */
export interface GukarMonthly {
  id: string
  participant_id: string
  period: string
  capaian_tahsin: string
  capaian_tahfidz: string
  /** Tahap tahsin baku dari TAHAP_TAHSIN. Kosong = capaian_tahsin yang dibaca. */
  tahap_tahsin: string
  /** Juz yang sudah tuntas; NULL = belum diisi terstruktur. */
  juz_tuntas: number | null
  /** Nomor juz yang sedang dihafal. */
  juz_berjalan: number | null
  /** Nilai ujian hafalan 0–100. */
  nilai_tahfidz: number | null
  /** Banyak surat pilihan di luar juz yang dikuasai. */
  surat_pilihan: number
  hadir_1: boolean
  hadir_2: boolean
  hadir_3: boolean
  hadir_4: boolean
  hadir_5: boolean
  jumlah_halaman: number
  catatan: string
}

/** Ambang kehadiran yang dipakai rekap — mengikuti kolom "Kekurangan (75%)". */
export const GUKAR_TARGET_HADIR = 0.75

/** Capaian awal & akhir satu siswa pada satu bulan. */
export interface StudentMonthly {
  id: string
  student_id: string
  period: string
  level: string
  halaman_awal_tahsin: string
  halaman_akhir_tahsin: string
  tahfidz_awal: string
  tahfidz_akhir: string
  capaian_halaman: number
  catatan: string
}

// ── KPI bulanan guru Qur'an ────────────────────────────────────────

/** Satu baris KPI: bahan mentahnya saja, nilainya dihitung lib/kpi/hitung.ts. */
export interface KpiMonthly {
  id: string
  teacher_id: string
  year: number
  month: number
  late_minutes: number
  db_late_days: number
  hafalan_juz: number
  hafalan_pages: number
  tuhfatul_bait: number
  bacaan_score: number
  buku_pegangan_meetings: number
  izin_wa_cases: number
  pengganti_cases: number
  pengganti_found: number
  seragam_daily: number[] | null
  lapor_ortu_daily: number[] | null
  halaqoh_hadir: number[] | null
  halaqoh_akhiri: number[] | null
  seragam_total: number | null
  lapor_ortu_total: number | null
  halaqoh_total: number | null
  /** Unit guru SAAT dinilai. Rubrik SD & SMP berbeda — lihat drizzle/0035. */
  unit: Jenjang | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** Guru + baris KPI-nya (kalau sudah ada) untuk satu periode. */
export interface KpiRow {
  teacherId: string
  fullName: string
  unit: Jenjang | null
  employmentType: string | null
  /** Null = belum pernah diisi untuk periode ini. */
  entry: KpiMonthly | null
  /**
   * Guru ini dinilai di unit ini, tapi sekarang sudah pindah ke unit lain.
   * Barisnya tetap ditampilkan karena penilaiannya memang terjadi di sini.
   */
  pindahKe?: Jenjang | null
}

/** Satu perpindahan unit seorang guru. */
export interface TeacherUnitMove {
  id: string
  teacher_id: string
  from_unit: Jenjang | null
  to_unit: Jenjang
  effective_date: string
  notes: string | null
  moved_by: string | null
  created_at: string
}

// ─── Pengajuan ujian tahsin & tahfidz ────────────────────────────────────────

/**
 * Unit penyelenggara ujian. Sengaja bukan Jenjang: hanya SD & SMP yang
 * menjalankan antrian ujian, jadi tipe lima nilai justru membuka baris yang
 * tidak punya koordinator.
 */
export type UjianUnit = 'SD' | 'SMP'

export type UjianStatus = 'diajukan' | 'dijadwalkan' | 'selesai'

export type UjianPredikat = 'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'maqbul' | 'mengulang'

export type TahfidzTipe = '1_juz' | '3_juz' | '5_juz'

export interface UjianTahfidz {
  id: string
  unit: UjianUnit
  tipe: TahfidzTipe
  juz: string
  nama_siswa: string
  nama_ayah: string
  kelas: string
  is_quls: boolean
  jadwal: string | null
  penguji: string | null
  predikat: UjianPredikat | null
  catatan: string | null
  status: UjianStatus
  created_by_teacher: string | null
  created_by_user: string | null
  created_at: string
  updated_at: string
}

/** Satu anak di dalam pengajuan tahsin. */
export interface UjianSiswa {
  nama: string
  predikat: 'lulus' | 'mengulang' | null
  /**
   * Level anak ini. Opsional demi data lama — kalau kosong, pakai `level`
   * pada pengajuannya.
   */
  level?: string
}

export interface UjianTahsin {
  id: string
  unit: UjianUnit
  nama_kelompok: string
  sesi: string
  level: string
  siswa: UjianSiswa[]
  jadwal: string | null
  penguji: string | null
  catatan: string | null
  status: UjianStatus
  created_by_teacher: string | null
  created_by_user: string | null
  created_at: string
  updated_at: string
}

export interface UjianPenguji {
  id: string
  nama: string
  created_at: string
}

/** Angka ringkas untuk kartu dashboard & badge. */
export interface UjianStats {
  diajukan: number
  dijadwalkan: number
  selesai: number
  total: number
}
