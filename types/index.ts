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

export type MeetingType = 'manajemen' | 'kumik' | 'new_squad' | 'koor_sd' | 'koor_smp'

export type AgendaTag = 'keputusan' | 'informasi' | 'hasil_diskusi' | 'tindak_lanjut'

export type TaskPriority = 'normal' | 'mendesak' | 'jangka_panjang'

export type TaskStatus = 'todo' | 'in_progress' | 'submitted' | 'done' | 'returned'

export type TaskSource = 'rapat' | 'mandiri' | 'home_publik'

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
  status: TaskStatus
  due_date: string | null
  return_notes: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
  assignee?: User
  assigner?: User
}

export interface TaskHistory {
  id: string
  task_id: string
  changed_by: string
  old_status: TaskStatus | null
  new_status: TaskStatus
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

export interface PublicPost {
  id: string
  type: PublicPostType
  target: PublicTarget
  title: string
  content: string
  due_date: string | null
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

export interface KaldiEvent {
  id?: string
  title: string
  start?: string
  date?: string
  end?: string
  location?: string
  description?: string
  color?: string
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
export type Jenjang = 'paud' | 'sd' | 'smp' | 'sma'
export type TahsinStatus = 'lulus' | 'ulang'
export type TahfidzKind = 'hafalan_baru' | 'murojaah'

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
  nilai_makhraj: number | null
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
  nilai_makhraj: number | null
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

