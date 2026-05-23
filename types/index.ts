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

export interface NewsArticle {
  id: string
  title: string
  content: string
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
