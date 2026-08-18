import {
  pgTable, pgEnum, text, uuid, boolean,
  timestamp, integer, date, time, numeric, smallint, primaryKey, jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { FooterLink, FooterUnit, HomeSection } from '@/types'

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
  'kepala_rq', 'kumik', 'sdm', 'bendahara',
  'koor_ekstra', 'koor_sd', 'koor_smp',
  'humas', 'div_training', 'new_squad',
])
export const meetingTypeEnum = pgEnum('meeting_type', [
  'manajemen', 'kumik', 'new_squad', 'koor_sd', 'koor_smp',
  'koor_x_sd', 'koor_x_smp', 'koor_x_boarding', 'rq_x_quls', 'humas_yayasan',
])
export const agendaTagEnum = pgEnum('agenda_tag', [
  'keputusan', 'informasi', 'perlu_diskusi', 'tindak_lanjut', 'approval',
])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'middle', 'high'])
export const taskWeightEnum = pgEnum('task_weight', ['easy', 'medium', 'hard'])
export const taskHorizonEnum = pgEnum('task_horizon', ['pendek', 'panjang'])
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'problem', 'submitted', 'done', 'returned'])
export const taskProblemTypeEnum = pgEnum('task_problem_type', ['bottleneck', 'blocked', 'wip_limit', 'others'])
/** Jenis peristiwa di task_history — memisahkan sunting/hapus dari ubah status. */
export const taskHistoryActionEnum = pgEnum('task_history_action', ['status', 'edited', 'deleted', 'restored'])
export const taskSourceEnum = pgEnum('task_source', ['rapat', 'mandiri', 'home_publik'])
export const contentRequestTypeEnum = pgEnum('content_request_type', [
  'flyer_ujian', 'flyer_lain', 'video', 'lain_lain',
])
export const contentPriorityEnum = pgEnum('content_priority', ['low', 'medium', 'high'])
export const contentStatusEnum = pgEnum('content_status', ['requested', 'on_process', 'finish'])
export const publicPostTypeEnum = pgEnum('public_post_type', ['pengumuman', 'tugas_guru'])
/** Status urgensi pengumuman — ditentukan penulis, bukan disimpulkan dari tanggal. */
export const postPriorityEnum = pgEnum('post_priority', ['penting', 'info', 'pengingat'])
export const publicTargetEnum = pgEnum('public_target', ['all', 'sd', 'smp'])

// ─── Tables ──────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  display_name: text('display_name').notNull(),
  email: text('email'),
  can_change_password: boolean('can_change_password').default(true),
  /** Kapan dropdown notifikasi terakhir dibuka — mengendalikan badge lonceng. */
  notifications_seen_at: timestamp('notifications_seen_at', { withTimezone: true }),

  // ── Profil pengurus (semua role kecuali new_squad) ──────────────
  /** 'ust' | 'usth' — menentukan sapaan "Ust." atau "Usth." */
  sapaan: text('sapaan'),
  nickname: text('nickname'),
  full_name: text('full_name'),
  nip: text('nip'),
  birth_place: text('birth_place'),
  birth_date: date('birth_date'),
  current_amanah: text('current_amanah'),
  /** SD | SMP | SMA | S1 | S2 | S3 */
  education_level: text('education_level'),
  photo_url: text('photo_url'),
  competencies: text('competencies').array(),
  /** [{ name, year, organizer }] */
  trainings: jsonb('trainings'),
  /** [{ position, period }] */
  amanah_history: jsonb('amanah_history'),
  /** [{ name, year }] */
  awards: jsonb('awards'),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: meetingTypeEnum('type').notNull(),
  subject: text('subject').notNull(),
  date: date('date').notNull(),
  start_time: time('start_time'),
  end_time: time('end_time'),
  location: text('location'),
  mc: text('mc'),
  notulis: text('notulis'),
  participants: text('participants').array(),
  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const agendaItems = pgTable('agenda_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  meeting_id: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
  order_num: integer('order_num').notNull(),
  tag: agendaTagEnum('tag').notNull(),
  discussion: text('discussion').notNull(),
  follow_up: text('follow_up'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  source_type: taskSourceEnum('source_type').notNull(),
  source_meeting_id: uuid('source_meeting_id').references(() => meetings.id),
  source_agenda_id: uuid('source_agenda_id').references(() => agendaItems.id),
  assigned_by: uuid('assigned_by').references(() => users.id),
  assigned_to: uuid('assigned_to').references(() => users.id),
  public_target: publicTargetEnum('public_target'),
  priority: taskPriorityEnum('priority').default('middle'),
  weight: taskWeightEnum('weight').default('medium'),
  horizon: taskHorizonEnum('horizon').default('pendek'),
  status: taskStatusEnum('status').default('todo'),
  problem_type: taskProblemTypeEnum('problem_type'),
  problem_notes: text('problem_notes'),
  due_date: date('due_date'),
  return_notes: text('return_notes'),
  verified_by: uuid('verified_by').references(() => users.id),
  verified_at: timestamp('verified_at', { withTimezone: true }),
  /**
   * Penanda hapus. Tugas tidak pernah dibuang secara fisik: riwayatnya
   * ON DELETE CASCADE, dan notifikasi diturunkan dari riwayat itu — hard delete
   * akan menghapus notifikasi "tugas dihapus" bersamaan dengan pembuatannya.
   */
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const taskHistory = pgTable('task_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  changed_by: uuid('changed_by').references(() => users.id),
  old_status: taskStatusEnum('old_status'),
  new_status: taskStatusEnum('new_status').notNull(),
  /**
   * Jenis peristiwa, terpisah dari status. new_status NOT NULL dan bertipe
   * task_status, jadi "disunting"/"dihapus" tidak bisa dititipkan di sana tanpa
   * mengotori kolom kanban — pada kedua aksi itu new_status diisi status tugas
   * saat itu dan kolom inilah yang menerangkan maksudnya.
   */
  action: taskHistoryActionEnum('action').notNull().default('status'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

/**
 * Item notifikasi yang sudah diklik pengguna. Notifikasinya sendiri diturunkan
 * dari task_history, jadi tabel ini hanya menyimpan status bacanya.
 */
export const notificationReads = pgTable('notification_reads', {
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  history_id: uuid('history_id').notNull().references(() => taskHistory.id, { onDelete: 'cascade' }),
  read_at: timestamp('read_at', { withTimezone: true }).defaultNow(),
}, (t) => [primaryKey({ columns: [t.user_id, t.history_id] })])

export const publicPosts = pgTable('public_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: publicPostTypeEnum('type').notNull(),
  target: publicTargetEnum('target').notNull().default('all'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  due_date: date('due_date'),
  priority: postPriorityEnum('priority').notNull().default('info'),
  created_by: uuid('created_by').references(() => users.id),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const contentRequests = pgTable('content_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  request_type: contentRequestTypeEnum('request_type').notNull(),
  description: text('description').notNull(),
  requested_by: uuid('requested_by').references(() => users.id),
  requested_date: date('requested_date').notNull(),
  priority: contentPriorityEnum('priority'),
  status: contentStatusEnum('status').default('requested'),
  finished_by: uuid('finished_by').references(() => users.id),
  finished_at: timestamp('finished_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const privateNotes = pgTable('private_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const newsArticles = pgTable('news_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  thumbnail_url: text('thumbnail_url'),
  category: text('category'),
  type: text('type').default('berita').notNull(),
  author_id: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  created_meetings: many(meetings, { relationName: 'creator' }),
  assigned_tasks: many(tasks, { relationName: 'assignee' }),
  created_tasks: many(tasks, { relationName: 'assigner' }),
  task_history: many(taskHistory),
  public_posts: many(publicPosts),
  content_requests: many(contentRequests),
  private_notes: many(privateNotes),
}))

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  creator: one(users, { fields: [meetings.created_by], references: [users.id], relationName: 'creator' }),
  agenda_items: many(agendaItems),
}))

export const agendaItemsRelations = relations(agendaItems, ({ one }) => ({
  meeting: one(meetings, { fields: [agendaItems.meeting_id], references: [meetings.id] }),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, { fields: [tasks.assigned_to], references: [users.id], relationName: 'assignee' }),
  assigner: one(users, { fields: [tasks.assigned_by], references: [users.id], relationName: 'assigner' }),
  history: many(taskHistory),
}))

export const taskHistoryRelations = relations(taskHistory, ({ one }) => ({
  task: one(tasks, { fields: [taskHistory.task_id], references: [tasks.id] }),
  changer: one(users, { fields: [taskHistory.changed_by], references: [users.id] }),
}))

export const publicPostsRelations = relations(publicPosts, ({ one }) => ({
  creator: one(users, { fields: [publicPosts.created_by], references: [users.id] }),
}))

export const contentRequestsRelations = relations(contentRequests, ({ one }) => ({
  requester: one(users, { fields: [contentRequests.requested_by], references: [users.id] }),
  finisher: one(users, { fields: [contentRequests.finished_by], references: [users.id] }),
}))

export const privateNotesRelations = relations(privateNotes, ({ one }) => ({
  user: one(users, { fields: [privateNotes.user_id], references: [users.id] }),
}))

export const newsArticlesRelations = relations(newsArticles, ({ one }) => ({
  author: one(users, { fields: [newsArticles.author_id], references: [users.id] }),
}))

// ─── task_comments (migration 0005) ──────────────────────────────────────────
export const taskComments = pgTable('task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  mentions: uuid('mentions').array(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.task_id], references: [tasks.id] }),
  author: one(users, { fields: [taskComments.author_id], references: [users.id] }),
}))

// ─── Domain guru / tahsin-tahfidz (migrations 0004, 0006, 0006a, 0007) ───────
// Sebelumnya hanya diakses lewat raw Supabase client (lib/supabase/server.ts),
// tanpa lapisan tipe Drizzle. Ditambahkan di sini murni untuk mencocokkan
// lib/db/schema.ts dengan kondisi live DB — kode aplikasi yang sudah ada
// (app/actions/teachers.ts, students.ts, halaqoh.ts, setoran.ts) TETAP pakai
// Supabase client, tidak diubah. Kolom & FK diverifikasi lewat introspeksi
// OpenAPI Supabase + isi asli file migrasi 0004/0006/0007.
export const genderEnum = pgEnum('gender', ['L', 'P'])
export const jenjangEnum = pgEnum('jenjang', ['paud', 'sd', 'smp', 'sma', 'sd_juara'])
export const tahsinStatusEnum = pgEnum('tahsin_status', ['lulus', 'ulang'])
export const tahfidzKindEnum = pgEnum('tahfidz_kind', [
  'hafalan_baru', 'murojaah', 'ziyadah', 'murojaah_baru', 'murojaah_lama', 'tasmi',
])

export const teachers = pgTable('teachers', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name').notNull(),
  nip: text('nip'),
  email: text('email'),
  phone: text('phone'),
  photo_url: text('photo_url'),
  is_active: boolean('is_active').default(true),
  // Profil publik — dikelola Humas, tampil di /profil-guru
  public_title: text('public_title'),
  public_bio: text('public_bio'),
  is_public: boolean('is_public').default(false),
  display_order: integer('display_order').default(0),
  can_change_password: boolean('can_change_password').default(true),
  joined_at: date('joined_at').defaultNow(),
  linked_user_id: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const halaqoh = pgTable('halaqoh', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  jenjang: jenjangEnum('jenjang').notNull(),
  wali_teacher_id: uuid('wali_teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  schedule_note: text('schedule_note'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const halaqohTeachers = pgTable('halaqoh_teachers', {
  halaqoh_id: uuid('halaqoh_id').notNull().references(() => halaqoh.id, { onDelete: 'cascade' }),
  teacher_id: uuid('teacher_id').notNull().references(() => teachers.id, { onDelete: 'cascade' }),
  role: text('role').default('pengampu'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [primaryKey({ columns: [t.halaqoh_id, t.teacher_id] })])

export const tahsinMethods = pgTable('tahsin_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const jilidLevels = pgTable('jilid_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  method_id: uuid('method_id').notNull().references(() => tahsinMethods.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  order_num: integer('order_num').notNull(),
  total_pages: integer('total_pages'),
  is_quran: boolean('is_quran').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  is_terminal: boolean('is_terminal').default(false).notNull(),
})

export const suratMaster = pgTable('surat_master', {
  id: integer('id').primaryKey(),
  name_arabic: text('name_arabic').notNull(),
  name_latin: text('name_latin').notNull(),
  name_id: text('name_id').notNull(),
  total_ayat: integer('total_ayat').notNull(),
  juz_start: integer('juz_start').notNull(),
  juz_end: integer('juz_end').notNull(),
  is_makkiyah: boolean('is_makkiyah').notNull(),
})

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  nis: text('nis'),
  full_name: text('full_name').notNull(),
  gender: genderEnum('gender'),
  birth_date: date('birth_date'),
  photo_url: text('photo_url'),
  jenjang: jenjangEnum('jenjang').notNull(),
  kelas: text('kelas'),
  program: text('program'),
  halaqoh_id: uuid('halaqoh_id').references(() => halaqoh.id, { onDelete: 'set null' }),
  wali_name: text('wali_name'),
  wali_phone: text('wali_phone'),
  wali_email: text('wali_email'),
  current_method_id: uuid('current_method_id').references(() => tahsinMethods.id, { onDelete: 'set null' }),
  current_jilid_id: uuid('current_jilid_id').references(() => jilidLevels.id, { onDelete: 'set null' }),
  current_jilid_page: integer('current_jilid_page'),
  is_active: boolean('is_active').default(true),
  enrolled_at: date('enrolled_at').defaultNow(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const tahsinLogs = pgTable('tahsin_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  teacher_id: uuid('teacher_id').notNull().references(() => teachers.id, { onDelete: 'restrict' }),
  halaqoh_id: uuid('halaqoh_id').references(() => halaqoh.id, { onDelete: 'set null' }),
  setoran_date: date('setoran_date').defaultNow(),
  method_id: uuid('method_id').references(() => tahsinMethods.id, { onDelete: 'set null' }),
  jilid_id: uuid('jilid_id').references(() => jilidLevels.id, { onDelete: 'set null' }),
  halaman: integer('halaman'),
  baris_dari: integer('baris_dari'),
  baris_ke: integer('baris_ke'),
  nilai_fashohah: numeric('nilai_fashohah', { precision: 2, scale: 1 }),
  nilai_tajwid: numeric('nilai_tajwid', { precision: 2, scale: 1 }),
  nilai_kelancaran: numeric('nilai_kelancaran', { precision: 2, scale: 1 }),
  status: tahsinStatusEnum('status').default('lulus'),
  catatan: text('catatan'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const tahfidzLogs = pgTable('tahfidz_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  teacher_id: uuid('teacher_id').notNull().references(() => teachers.id, { onDelete: 'restrict' }),
  halaqoh_id: uuid('halaqoh_id').references(() => halaqoh.id, { onDelete: 'set null' }),
  setoran_date: date('setoran_date').defaultNow(),
  kind: tahfidzKindEnum('kind').default('hafalan_baru').notNull(),
  surat_id: integer('surat_id').notNull().references(() => suratMaster.id, { onDelete: 'restrict' }),
  ayat_dari: integer('ayat_dari'),
  ayat_ke: integer('ayat_ke'),
  nilai_fashohah: numeric('nilai_fashohah', { precision: 2, scale: 1 }),
  nilai_tajwid: numeric('nilai_tajwid', { precision: 2, scale: 1 }),
  nilai_kelancaran: numeric('nilai_kelancaran', { precision: 2, scale: 1 }),
  catatan: text('catatan'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const tasmiLogs = pgTable('tasmi_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  teacher_id: uuid('teacher_id').notNull().references(() => teachers.id, { onDelete: 'restrict' }),
  halaqoh_id: uuid('halaqoh_id').references(() => halaqoh.id, { onDelete: 'set null' }),
  setoran_date: date('setoran_date').defaultNow(),
  scope_juz: smallint('scope_juz').notNull(),
  juz_from: integer('juz_from').notNull(),
  juz_to: integer('juz_to').notNull(),
  nilai_fashohah: numeric('nilai_fashohah', { precision: 2, scale: 1 }),
  nilai_tajwid: numeric('nilai_tajwid', { precision: 2, scale: 1 }),
  nilai_kelancaran: numeric('nilai_kelancaran', { precision: 2, scale: 1 }),
  status: tahsinStatusEnum('status').default('lulus'),
  catatan: text('catatan'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const juzProgress = pgTable('juz_progress', {
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  juz_number: integer('juz_number').notNull(),
  ayat_hafal: integer('ayat_hafal').default(0).notNull(),
  last_setoran_at: timestamp('last_setoran_at', { withTimezone: true }),
  mutqin: boolean('mutqin').default(false).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [primaryKey({ columns: [t.student_id, t.juz_number] })])

export const jilidPromotions = pgTable('jilid_promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  from_jilid_id: uuid('from_jilid_id').references(() => jilidLevels.id, { onDelete: 'set null' }),
  to_jilid_id: uuid('to_jilid_id').notNull().references(() => jilidLevels.id, { onDelete: 'restrict' }),
  promoted_by: uuid('promoted_by').references(() => teachers.id, { onDelete: 'set null' }),
  promotion_date: date('promotion_date').defaultNow(),
  exam_score: numeric('exam_score'),
  catatan: text('catatan'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const juzPromotions = pgTable('juz_promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  juz_number: integer('juz_number').notNull(),
  promoted_by: uuid('promoted_by').references(() => teachers.id, { onDelete: 'set null' }),
  promotion_date: date('promotion_date').defaultNow(),
  exam_score: numeric('exam_score'),
  catatan: text('catatan'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Halaman publik (Program & Tentang RQ) ───────────────────────────────────

/**
 * Program RQ. Dulu daftar hardcode di app/program/_data.ts + tabel
 * program_details untuk isinya; sekarang satu tabel yang bisa di-CRUD Humas.
 *
 * `icon` & `accent` disimpan sebagai kunci ('BookOpen', 'emerald'), bukan kelas
 * Tailwind — Tailwind memangkas kelas yang tidak muncul literal di kode, jadi
 * kelas lengkapnya dipetakan di lib/programs/theme.ts.
 */
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  /** Ringkasan pendek — dipakai di kartu beranda & daftar program. */
  description: text('description').notNull().default(''),
  /** Foto artikel di beranda. Kosong = jatuh ke gradasi + ikon. */
  photo_url: text('photo_url'),
  icon: text('icon').notNull().default('BookOpen'),
  accent: text('accent').notNull().default('emerald'),
  long_description: text('long_description').notNull().default(''),
  curriculum: text('curriculum').notNull().default(''),
  schedule: text('schedule').notNull().default(''),
  target_audience: text('target_audience').notNull().default(''),
  contact_info: text('contact_info').notNull().default(''),
  display_order: integer('display_order').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  updated_by: uuid('updated_by').references(() => users.id),
})

/** @deprecated digantikan tabel `programs`. Dipertahankan sampai datanya dicek. */
export const programDetails = pgTable('program_details', {
  slug: text('slug').primaryKey(),
  long_description: text('long_description').default(''),
  curriculum: text('curriculum').default(''),
  schedule: text('schedule').default(''),
  target_audience: text('target_audience').default(''),
  contact_info: text('contact_info').default(''),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  updated_by: uuid('updated_by').references(() => users.id),
})

export const aboutRq = pgTable('about_rq', {
  id: integer('id').primaryKey().default(1),
  vision: text('vision').default(''),
  mission: text('mission').default(''),
  history: text('history').default(''),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  updated_by: uuid('updated_by').references(() => users.id),
})

/**
 * Identitas situs + konfigurasi tampilan beranda publik. Tabel singleton
 * (selalu id = 1) dengan pola yang sama seperti about_rq.
 *
 * `sections` disimpan sebagai jsonb karena urutan seksi ikut ditentukan oleh
 * urutan array — menyimpannya sebagai kolom terpisah akan memaksa migrasi
 * setiap kali ada seksi baru di beranda.
 */
export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().default(1),
  header_brand: text('header_brand').default(''),
  header_tagline: text('header_tagline').default(''),
  footer_brand: text('footer_brand').default(''),
  footer_brand_sub: text('footer_brand_sub').default(''),
  footer_tagline: text('footer_tagline').default(''),
  footer_units: jsonb('footer_units').$type<FooterUnit[]>().default([]),
  footer_links: jsonb('footer_links').$type<FooterLink[]>().default([]),
  footer_email: text('footer_email').default(''),
  footer_phone: text('footer_phone').default(''),
  footer_hours: text('footer_hours').default(''),
  footer_copyright: text('footer_copyright').default(''),
  sections: jsonb('sections').$type<HomeSection[]>().default([]),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  updated_by: uuid('updated_by').references(() => users.id),
})
