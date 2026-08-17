import type {
  UserRole, MeetingType, AgendaTag, TaskStatus, TaskPriority, TaskWeight,
  TaskProblemType, PublicTarget, Jenjang,
} from '@/types'

// Dashboard access matrix.
// Isolasi penuh: tiap role hanya boleh membuka dashboard-nya sendiri.
// Kepala RQ punya dashboard manajemen khusus (berisi task lintas divisi timnya).
// Bendahara & New Squad memakai dashboard "pribadi" ringkas.
const DASHBOARD_ACCESS: Record<string, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  sdm: ['sdm'],
  'koor-sd': ['koor_sd'],
  'koor-smp': ['koor_smp'],
  'koor-ekstra': ['koor_ekstra'],
  humas: ['humas'],
  'div-training': ['div_training'],
  pribadi: ['bendahara', 'new_squad'],
}

export function canViewDashboard(role: UserRole, dashboardSlug: string): boolean {
  return DASHBOARD_ACCESS[dashboardSlug]?.includes(role) ?? false
}

export function getAccessibleDashboards(role: UserRole): string[] {
  return Object.entries(DASHBOARD_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([slug]) => slug)
}

// Meeting permissions
const MEETING_CREATE: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_x_sd: ['koor_sd'],
  koor_x_smp: ['koor_smp'],
  koor_x_boarding: ['koor_smp'],
  rq_x_quls: ['kumik'],
}

const MEETING_EDIT: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kumik', 'koor_sd', 'koor_smp', 'koor_ekstra'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_x_sd: ['koor_sd'],
  koor_x_smp: ['koor_smp'],
  koor_x_boarding: ['koor_smp'],
  rq_x_quls: ['kumik'],
}

const MEETING_DELETE: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_x_sd: ['koor_sd'],
  koor_x_smp: ['koor_smp'],
  koor_x_boarding: ['koor_smp'],
  rq_x_quls: ['kumik'],
}

const MEETING_VIEW: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra'],
  // Para koor ikut memantau notulen New Squad.
  new_squad: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'div_training', 'new_squad', 'koor_sd', 'koor_smp', 'koor_ekstra'],
  koor_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  koor_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  koor_x_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  koor_x_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  koor_x_boarding: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  // Rapat RQ x QULS sengaja dibatasi — koor & divisi lain tidak melihatnya.
  rq_x_quls: ['kumik', 'kepala_rq', 'sdm', 'bendahara'],
}

export function canCreateMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_CREATE[type]?.includes(role) ?? false
}

export function canEditMeeting(role: UserRole, type: MeetingType): boolean {
  if (role === 'kepala_rq') return true // Kepala RQ: kelola semua rapat
  return MEETING_EDIT[type]?.includes(role) ?? false
}

export function canDeleteMeeting(role: UserRole, type: MeetingType): boolean {
  if (role === 'kepala_rq') return true // Kepala RQ: kelola semua rapat
  return MEETING_DELETE[type]?.includes(role) ?? false
}

export function canViewMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_VIEW[type]?.includes(role) ?? false
}

export function getViewableMeetingTypes(role: UserRole): MeetingType[] {
  return (Object.entries(MEETING_VIEW) as [MeetingType, UserRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([type]) => type)
}

// Task assignment — who can assign to whom
const TASK_ASSIGN_TO: Record<UserRole, UserRole[]> = {
  kepala_rq: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra', 'koor_sd', 'koor_smp', 'humas', 'div_training', 'new_squad'],
  kumik: ['koor_sd', 'koor_smp', 'koor_ekstra', 'humas', 'bendahara'],
  sdm: ['new_squad', 'div_training', 'humas', 'bendahara'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_ekstra: ['humas'],
  bendahara: [],
  humas: [],
  div_training: [],
  new_squad: [],
}

export function canAssignTask(role: UserRole, targetRole: UserRole): boolean {
  return TASK_ASSIGN_TO[role]?.includes(targetRole) ?? false
}

export function getAssignableRoles(role: UserRole): UserRole[] {
  return TASK_ASSIGN_TO[role] ?? []
}

export function canAssignAnyTask(role: UserRole): boolean {
  return (TASK_ASSIGN_TO[role]?.length ?? 0) > 0
}

// Kanban board — divisi mana yang bisa user lihat di papan.
// Divisi sebuah task = role penerima (assignee).
const ALL_ROLES: UserRole[] = [
  'kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp',
  'koor_ekstra', 'humas', 'div_training', 'new_squad',
]

export function getBoardDivisions(role: UserRole): UserRole[] {
  if (role === 'kepala_rq' || role === 'kumik' || role === 'sdm') return ALL_ROLES
  // Para koor memantau divisinya sendiri plus New Squad & Humas.
  if (role === 'koor_sd') return ['koor_sd', 'new_squad', 'humas']
  if (role === 'koor_smp') return ['koor_smp', 'new_squad', 'humas']
  if (role === 'koor_ekstra') return ['koor_ekstra', 'new_squad', 'humas']
  return []
}

export function canViewDivisiBoard(role: UserRole): boolean {
  return getBoardDivisions(role).length > 0
}

// Analitik RQ — dashboard agregat lintas divisi/halaqoh (manajemen)
export function canViewAnalytics(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'kumik' || role === 'sdm'
}

/**
 * Boleh membuka Analitik per Unit. Lebih luas dari canViewAnalytics: koor SD &
 * koor SMP ikut masuk, tapi datanya dipersempit ke unit masing-masing lewat
 * getAnalyticsJenjang(). Halaman "Analitik RQ" umum (agregat seluruh RQ) tetap
 * tertutup untuk koor.
 */
export function canViewUnitAnalytics(role: UserRole): boolean {
  return canViewAnalytics(role) || role === 'koor_sd' || role === 'koor_smp'
}

/**
 * Unit (jenjang) mana yang boleh dilihat di Analitik per Unit.
 *
 * Untuk koor, cakupannya sama persis dengan getManageableJenjang() — satu unit
 * saja. Bedanya di manajemen: kumik & SDM tidak mengelola jenjang apa pun tapi
 * tetap boleh melihat analitik seluruh unit.
 */
export function getAnalyticsJenjang(role: UserRole): Jenjang[] {
  if (canViewAnalytics(role)) return ['paud', 'sd', 'sd_juara', 'smp', 'sma']
  return getManageableJenjang(role)
}

// Task status change — who can perform which transitions
//
// Pelaksana (assignee) menggerakkan tugasnya sendiri sampai kolom Review.
// Pemberi tugas (assigner) hanya berwenang menutup review: Review → Selesai
// atau Review → dikembalikan. Kepala RQ boleh semuanya.
const ASSIGNEE_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  todo:        ['in_progress', 'problem'],
  in_progress: ['submitted', 'problem', 'todo'],
  problem:     ['in_progress', 'submitted', 'todo'],
  submitted:   ['in_progress'],           // tarik kembali sebelum direview
  returned:    ['in_progress', 'problem'],
}

const ASSIGNER_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  submitted: ['done', 'returned'],
}

export function canChangeTaskStatus(
  role: UserRole,
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  isAssignee: boolean,
  isAssigner: boolean
): boolean {
  if (role === 'kepala_rq') return true
  if (isAssignee && ASSIGNEE_TRANSITIONS[currentStatus]?.includes(newStatus)) return true
  if (isAssigner && ASSIGNER_TRANSITIONS[currentStatus]?.includes(newStatus)) return true
  return false
}

/**
 * Boleh menyeret kartu di papan kanban? Hanya orang yang bersangkutan
 * (pelaksana atau pemberi tugas) dan Kepala RQ. Ini gerbang UI — server tetap
 * memvalidasi transisinya lewat canChangeTaskStatus.
 */
export function canMoveTaskOnBoard(role: UserRole, isAssignee: boolean, isAssigner: boolean): boolean {
  return role === 'kepala_rq' || isAssignee || isAssigner
}

/** Task yang menunggu review orang ini (antrean review pemberi tugas). */
export function isAwaitingMyReview(
  task: { status: TaskStatus; assigned_by: string },
  userId: string,
  role: UserRole
): boolean {
  if (task.status !== 'submitted') return false
  return task.assigned_by === userId || role === 'kepala_rq'
}

// Home publik post permissions
const HOME_POST_ROLES: Record<string, UserRole[]> = {
  pengumuman: ['kepala_rq', 'sdm', 'bendahara'],
  tugas_guru_sd: ['koor_sd'],
  tugas_guru_smp: ['koor_smp'],
}

export function canPostToHome(role: UserRole): boolean {
  return Object.values(HOME_POST_ROLES).some(roles => roles.includes(role))
}

export function canPostPengumuman(role: UserRole): boolean {
  return HOME_POST_ROLES.pengumuman.includes(role)
}

export function canPostTugasGuru(role: UserRole): PublicTarget | null {
  if (role === 'kepala_rq') return 'all'
  if (HOME_POST_ROLES.tugas_guru_sd.includes(role)) return 'sd'
  if (HOME_POST_ROLES.tugas_guru_smp.includes(role)) return 'smp'
  return null
}

// Humas request
//
// Humas adalah penerima request, bukan pemohon — dia tidak request ke dirinya
// sendiri. Jadi humas tidak boleh membuat request, tapi tetap harus bisa
// membuka daftarnya untuk memproses request yang masuk.
export function canRequestToHumas(role: UserRole): boolean {
  return role !== 'new_squad' && role !== 'humas'
}

/** Siapa yang boleh membuka halaman daftar request: pemohon + humas & kepala RQ. */
export function canViewHumasRequests(role: UserRole): boolean {
  return canRequestToHumas(role) || role === 'humas' || role === 'kepala_rq'
}

// Catatan Keuangan Bendahara
//
// Buku catatan ini milik fungsi keuangan, bukan catatan pribadi per-user:
// bendahara yang menulis, kepala RQ boleh ikut membacanya (read-only).
/** Boleh menulis/mengubah/menghapus catatan keuangan. */
export function canManageFinanceNotes(role: UserRole): boolean {
  return role === 'bendahara'
}

/** Boleh membuka & membaca catatan keuangan. */
export function canViewFinanceNotes(role: UserRole): boolean {
  return canManageFinanceNotes(role) || role === 'kepala_rq'
}

/**
 * Kelola berita (buat, ubah, hapus) — sepenuhnya wewenang Humas.
 *
 * Kepala RQ sengaja tidak termasuk: penulisan berita digeser ke Humas. Kepala
 * RQ tetap bisa membaca berita lewat halaman publik /news yang terbuka untuk
 * semua, jadi yang hilang hanya hak menyuntingnya.
 */
export function canCreateNews(role: UserRole): boolean {
  return role === 'humas'
}

export function canEditProgram(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

/**
 * Menu "Program RQ" di sidebar/mobile nav — hanya pengelola program.
 * Halaman /program sendiri tetap publik (dilink dari header beranda).
 */
export function canAccessProgramMenu(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

export function canEditAbout(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

/**
 * Kelola tampilan beranda publik: teks header/footer, seksi mana yang tampil
 * beserta urutannya, dan kurasi Profil Guru.
 */
export function canManageHomepage(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

// ─── PHASE 1B — Manajemen siswa, halaqoh, ustadz ────────────────────

/**
 * Bisa manage siswa untuk jenjang tertentu (atau semua jika jenjang null).
 * - kepala_rq: semua jenjang
 * - koor_sd:   hanya jenjang 'sd' atau 'paud'
 * - koor_smp:  hanya jenjang 'smp' atau 'sma'
 */
export function canManageStudents(role: UserRole, jenjang?: Jenjang | null): boolean {
  if (role === 'kepala_rq') return true
  if (role === 'koor_sd')  return !jenjang || jenjang === 'sd'
  if (role === 'koor_smp') return !jenjang || jenjang === 'smp'
  return false
}

/**
 * Bisa lihat list siswa (read-only). Lebih luas dari manage.
 * - kepala_rq, kumik, sdm, bendahara: lihat semua
 * - koor_sd/smp: lihat jenjang masing-masing
 */
export function canViewStudents(role: UserRole, jenjang?: Jenjang | null): boolean {
  if (['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(role)) return true
  return canManageStudents(role, jenjang)
}

/**
 * Bisa manage halaqoh untuk jenjang tertentu.
 * Pattern sama dengan students.
 */
export function canManageHalaqoh(role: UserRole, jenjang?: Jenjang | null): boolean {
  if (role === 'kepala_rq') return true
  if (role === 'koor_sd')  return !jenjang || jenjang === 'sd'
  if (role === 'koor_smp') return !jenjang || jenjang === 'smp'
  return false
}

export function canViewHalaqoh(role: UserRole, jenjang?: Jenjang | null): boolean {
  if (['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(role)) return true
  return canManageHalaqoh(role, jenjang)
}

/**
 * Manage akun guru: bikin akun, reset password, deaktivasi.
 * - kepala_rq: full
 * - sdm:       full (sumber daya manusia)
 */
export function canManageTeachers(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'sdm'
}

/**
 * View list guru (read-only). Lebih luas: kumik & koor juga butuh lihat
 * untuk assign ke halaqoh.
 */
export function canViewTeachers(role: UserRole): boolean {
  return ['kepala_rq', 'sdm', 'kumik', 'koor_sd', 'koor_smp'].includes(role)
}

/**
 * Jenjang mana yang bisa di-manage user — dipakai untuk filter UI di Siswa,
 * Halaqoh, dan Ustadz/Guru.
 *
 * Koor dibatasi ke satu unit saja: koor SD hanya SD (bukan TPAIT/PAUD atau
 * SD Juara), koor SMP hanya SMP (bukan SMA) — sama dengan cakupan analitiknya.
 */
export function getManageableJenjang(role: UserRole): Jenjang[] {
  if (role === 'kepala_rq') return ['paud', 'sd', 'sd_juara', 'smp', 'sma']
  if (role === 'koor_sd')   return ['sd']
  if (role === 'koor_smp')  return ['smp']
  return []
}

export const JENJANG_LABELS: Record<Jenjang, string> = {
  paud:     'PAUD',
  sd:       'SD',
  sd_juara: 'SD Juara',
  smp:      'SMP',
  sma:      'SMA',
}

/**
 * Punya profil pengurus lengkap (data diri, pendidikan, kompetensi, riwayat).
 * New Squad dikecualikan — mereka hanya punya pengaturan akun dasar.
 */
export function canHavePengurusProfile(role: UserRole): boolean {
  return role !== 'new_squad'
}

/**
 * Nama sapaan untuk header: "Ust. Habib" / "Usth. Aul".
 * Jatuh kembali ke display_name kalau profil belum diisi.
 */
export function sapaanName(
  sapaan: string | null | undefined,
  nickname: string | null | undefined,
  displayName: string,
): string {
  const name = nickname?.trim() || displayName
  if (sapaan === 'ust') return `Ust. ${name}`
  if (sapaan === 'usth') return `Usth. ${name}`
  return name
}

// Display labels
export const ROLE_LABELS: Record<UserRole, string> = {
  kepala_rq: 'Kepala RQ',
  kumik: 'Kumik',
  sdm: 'SDM',
  bendahara: 'Bendahara',
  koor_ekstra: 'Koor Ekstra',
  koor_sd: 'Koor SD',
  koor_smp: 'Koor SMP',
  humas: 'Humas',
  div_training: 'Div Training',
  new_squad: 'New Squad',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high:   'High',
  middle: 'Middle',
  low:    'Low',
}

export const TASK_WEIGHT_LABELS: Record<TaskWeight, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
}

export const TASK_PROBLEM_LABELS: Record<TaskProblemType, string> = {
  bottleneck: 'Bottleneck',
  blocked:    'Blocked',
  wip_limit:  'WIP Limit',
  others:     'Lainnya',
}

export const AGENDA_TAG_LABELS: Record<AgendaTag, string> = {
  keputusan:     'Keputusan',
  informasi:     'Informasi',
  perlu_diskusi: 'Perlu Diskusi Lanjut',
  tindak_lanjut: 'Tindak Lanjut',
  approval:      'Approval',
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  manajemen: 'Rapat Manajemen',
  kumik: 'Rapat Kumik',
  new_squad: 'Rapat New Squad',
  koor_sd: 'Rapat Koor SD',
  koor_smp: 'Rapat Koor SMP',
  koor_x_sd: 'Rapat Koor x SD',
  koor_x_smp: 'Rapat Koor x SMP',
  koor_x_boarding: 'Rapat Koor x Boarding',
  rq_x_quls: 'Rapat RQ x QULS',
}

export const DASHBOARD_LABELS: Record<string, string> = {
  manajemen: 'Manajemen',
  kumik: 'Kumik',
  sdm: 'SDM',
  'koor-sd': 'Koor SD',
  'koor-smp': 'Koor SMP',
  'koor-ekstra': 'Koor Ekstra',
  humas: 'Humas',
  'div-training': 'Div Training',
  pribadi: 'Dashboard Saya',
}

export const DEFAULT_DASHBOARD: Record<UserRole, string> = {
  kepala_rq: 'manajemen',
  kumik: 'kumik',
  sdm: 'sdm',
  bendahara: 'pribadi',
  koor_sd: 'koor-sd',
  koor_smp: 'koor-smp',
  koor_ekstra: 'koor-ekstra',
  humas: 'humas',
  div_training: 'div-training',
  new_squad: 'pribadi',
}
