import type { UserRole, MeetingType, TaskStatus, PublicTarget, Jenjang } from '@/types'

// Dashboard access matrix
const DASHBOARD_ACCESS: Record<string, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra'],
  sdm: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra', 'humas', 'div_training', 'new_squad'],
  'koor-sd': ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  'koor-smp': ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  'koor-ekstra': ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra'],
  humas: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra', 'humas'],
  'div-training': ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'div_training'],
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
}

const MEETING_EDIT: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kumik', 'koor_sd', 'koor_smp', 'koor_ekstra'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
}

const MEETING_DELETE: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
}

const MEETING_VIEW: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra'],
  new_squad: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'div_training', 'new_squad'],
  koor_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  koor_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
}

export function canCreateMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_CREATE[type]?.includes(role) ?? false
}

export function canEditMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_EDIT[type]?.includes(role) ?? false
}

export function canDeleteMeeting(role: UserRole, type: MeetingType): boolean {
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
  if (role === 'koor_sd') return ['koor_sd']
  if (role === 'koor_smp') return ['koor_smp']
  if (role === 'koor_ekstra') return ['koor_ekstra', 'humas']
  return []
}

export function canViewDivisiBoard(role: UserRole): boolean {
  return getBoardDivisions(role).length > 0
}

// Analitik RQ — dashboard agregat lintas divisi/halaqoh (manajemen)
export function canViewAnalytics(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'kumik' || role === 'sdm'
}

// Task status change — who can perform which transitions
export function canChangeTaskStatus(
  role: UserRole,
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  isAssignee: boolean,
  isAssigner: boolean
): boolean {
  if (role === 'kepala_rq') return true

  const assigneeTransitions: Partial<Record<TaskStatus, TaskStatus[]>> = {
    todo: ['in_progress'],
    in_progress: ['submitted'],
    returned: ['in_progress'],
  }

  const assignerTransitions: Partial<Record<TaskStatus, TaskStatus[]>> = {
    submitted: ['done', 'returned'],
  }

  if (isAssignee && assigneeTransitions[currentStatus]?.includes(newStatus)) return true
  if (isAssigner && assignerTransitions[currentStatus]?.includes(newStatus)) return true

  return false
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
export function canRequestToHumas(role: UserRole): boolean {
  return role !== 'new_squad'
}

// Private notes — bendahara only
export function canAccessNotes(role: UserRole): boolean {
  return role === 'bendahara'
}

export function canCreateNews(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

export function canEditProgram(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

export function canEditAbout(role: UserRole): boolean {
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
  if (role === 'koor_sd')  return !jenjang || jenjang === 'sd'  || jenjang === 'sd_juara' || jenjang === 'paud'
  if (role === 'koor_smp') return !jenjang || jenjang === 'smp' || jenjang === 'sma'
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
  if (role === 'koor_sd')  return !jenjang || jenjang === 'sd'  || jenjang === 'sd_juara' || jenjang === 'paud'
  if (role === 'koor_smp') return !jenjang || jenjang === 'smp' || jenjang === 'sma'
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
 * Jenjang mana yang bisa di-manage user.
 * Untuk filter UI: koor_sd cuma lihat ['sd','paud'], dst.
 */
export function getManageableJenjang(role: UserRole): Jenjang[] {
  if (role === 'kepala_rq') return ['paud', 'sd', 'sd_juara', 'smp', 'sma']
  if (role === 'koor_sd')   return ['paud', 'sd', 'sd_juara']
  if (role === 'koor_smp')  return ['smp', 'sma']
  return []
}

export const JENJANG_LABELS: Record<Jenjang, string> = {
  paud:     'PAUD',
  sd:       'SD',
  sd_juara: 'SD Juara',
  smp:      'SMP',
  sma:      'SMA',
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

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  manajemen: 'Rapat Manajemen',
  kumik: 'Rapat Kumik',
  new_squad: 'Rapat New Squad',
  koor_sd: 'Rapat Koor SD',
  koor_smp: 'Rapat Koor SMP',
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
}

export const DEFAULT_DASHBOARD: Record<UserRole, string> = {
  kepala_rq: 'manajemen',
  kumik: 'kumik',
  sdm: 'sdm',
  bendahara: 'manajemen',
  koor_sd: 'koor-sd',
  koor_smp: 'koor-smp',
  koor_ekstra: 'koor-ekstra',
  humas: 'humas',
  div_training: 'div-training',
  new_squad: 'sdm',
}
