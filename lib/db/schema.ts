import {
  pgTable, pgEnum, text, uuid, boolean,
  timestamp, integer, date, time,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
  'kepala_rq', 'kumik', 'sdm', 'bendahara',
  'koor_ekstra', 'koor_sd', 'koor_smp',
  'humas', 'div_training', 'new_squad',
])
export const meetingTypeEnum = pgEnum('meeting_type', [
  'manajemen', 'kumik', 'new_squad', 'koor_sd', 'koor_smp',
])
export const agendaTagEnum = pgEnum('agenda_tag', [
  'keputusan', 'informasi', 'hasil_diskusi', 'tindak_lanjut',
])
export const taskPriorityEnum = pgEnum('task_priority', ['normal', 'mendesak', 'jangka_panjang'])
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'submitted', 'done', 'returned'])
export const taskSourceEnum = pgEnum('task_source', ['rapat', 'mandiri', 'home_publik'])
export const contentRequestTypeEnum = pgEnum('content_request_type', [
  'flyer_ujian', 'flyer_lain', 'video', 'lain_lain',
])
export const contentPriorityEnum = pgEnum('content_priority', ['low', 'medium', 'high'])
export const contentStatusEnum = pgEnum('content_status', ['requested', 'on_process', 'finish'])
export const publicPostTypeEnum = pgEnum('public_post_type', ['pengumuman', 'tugas_guru'])
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
  priority: taskPriorityEnum('priority').default('normal'),
  status: taskStatusEnum('status').default('todo'),
  due_date: date('due_date'),
  return_notes: text('return_notes'),
  verified_by: uuid('verified_by').references(() => users.id),
  verified_at: timestamp('verified_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const taskHistory = pgTable('task_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  changed_by: uuid('changed_by').references(() => users.id),
  old_status: taskStatusEnum('old_status'),
  new_status: taskStatusEnum('new_status').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const publicPosts = pgTable('public_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: publicPostTypeEnum('type').notNull(),
  target: publicTargetEnum('target').notNull().default('all'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  due_date: date('due_date'),
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
