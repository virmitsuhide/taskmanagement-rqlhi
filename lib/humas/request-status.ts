import type { ContentRequest, ContentPriority, ContentStatus, TaskPriority, TaskStatus } from '@/types'

/**
 * Status request diturunkan dari status tugasnya, tidak disimpan terpisah.
 *
 * Sejak 0033 tugaslah pemegang kemajuan. Kolom `content_requests.status` tetap
 * ada untuk request lama yang belum punya tugas, tapi tidak lagi ditulis untuk
 * request baru — dua kolom status yang ditulis terpisah cepat atau lambat akan
 * berbeda isi, dan tidak ada cara memutuskan mana yang benar.
 *
 * 'returned' (ditolak saat review) sengaja dipetakan kembali ke 'on_process',
 * bukan ke 'requested': pekerjaannya sudah pernah dimulai, dan menurunkannya
 * kembali ke "Diminta" menghapus kenyataan itu dari mata pemohon.
 */
const FROM_TASK: Record<TaskStatus, ContentStatus> = {
  todo: 'requested',
  in_progress: 'on_process',
  problem: 'on_process',
  submitted: 'on_process',
  returned: 'on_process',
  done: 'finish',
}

export function requestStatus(req: Pick<ContentRequest, 'status' | 'task'>): ContentStatus {
  return req.task ? FROM_TASK[req.task.status] : req.status
}

/**
 * Keterangan sebaris tentang keadaan tugasnya, untuk ditampilkan di kartu.
 *
 * Lencana status saja tidak cukup: 'problem' dan 'submitted' sama-sama jatuh ke
 * "Diproses", padahal artinya jauh berbeda bagi pemohon — yang satu tertahan
 * dan butuh perhatian, yang satu justru menunggu konfirmasinya.
 */
export function requestProgressNote(req: Pick<ContentRequest, 'task'>): string | null {
  if (!req.task) return null
  switch (req.task.status) {
    case 'todo':        return 'Menunggu dikerjakan Humas'
    case 'in_progress': return 'Sedang dikerjakan Humas'
    case 'problem':     return 'Tertahan — Humas menandai ada kendala'
    case 'submitted':   return 'Humas menyatakan selesai, menunggu konfirmasi pemohon'
    case 'returned':    return 'Dikembalikan ke Humas untuk diperbaiki'
    case 'done':        return 'Selesai dan sudah dikonfirmasi'
  }
}

/**
 * Prioritas request — dari tugasnya kalau ada.
 *
 * Enum keduanya nyaris sama tapi tidak persis: tugas memakai 'middle',
 * request memakai 'medium'. Pemetaan ini ada supaya perbedaan sepele itu
 * tidak merembes ke komponen tampilan.
 */
const PRIORITY_FROM_TASK: Record<TaskPriority, ContentPriority> = {
  low: 'low',
  middle: 'medium',
  high: 'high',
}

export function requestPriority(
  req: Pick<ContentRequest, 'priority' | 'task'>,
): ContentPriority | null {
  if (req.task?.priority) return PRIORITY_FROM_TASK[req.task.priority]
  return req.priority
}
