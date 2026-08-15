import type { Task } from '@/types'

/** Task jatuh tempo dalam 3 hari ke depan (termasuk hari ini), dan belum selesai. */
export function isDueSoon(t: Task): boolean {
  if (!t.due_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const soon = new Date(today)
  soon.setDate(soon.getDate() + 3)
  const due = new Date(t.due_date)
  return due >= today && due <= soon
}
