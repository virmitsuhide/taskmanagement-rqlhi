import type { AgendaTag, ApprovalStatus, TaskStatus } from '@/types'

/**
 * Aturan status Papan Rapat — fungsi murni, dipakai halaman papan dan server
 * action supaya tombol yang tampil dan pemeriksaan di server tidak berbeda
 * pendapat soal kapan sebuah poin boleh dikeluarkan dari papan.
 *
 * Per tag notulen:
 *   informasi      → tidak masuk papan (tidak ada yang perlu ditindaklanjuti)
 *   approval       → menunggu → disetujui / ditolak; yang disetujui & butuh
 *                    biaya menunggu nominal dari bendahara
 *   tindak_lanjut  → PIC & status diambil dari tugas yang dibuat dari poin itu
 *   perlu_diskusi  → terbuka sampai ditandai selesai
 *   keputusan      → tidak masuk papan aktif; dicatat di tabel keputusan bulanan
 */

export const TAG_PAPAN: AgendaTag[] = ['approval', 'tindak_lanjut', 'perlu_diskusi']

export interface TugasTautan {
  id: string
  title: string
  status: TaskStatus
  pic: string | null
  due_date: string | null
}

export interface PoinStatus {
  tag: AgendaTag
  approval_status: ApprovalStatus | null
  butuh_biaya: boolean
  biaya: number | null
  selesai_at: string | null
}

/** Approval disetujui yang butuh biaya, tetapi nominalnya belum diisi bendahara. */
export function menungguBiaya(p: PoinStatus): boolean {
  return p.tag === 'approval' && p.approval_status === 'disetujui' && p.butuh_biaya && p.biaya === null
}

/**
 * Poin sudah tuntas — boleh dikeluarkan dari papan aktif.
 * Tindak lanjut tanpa tugas sama sekali BELUM tuntas: belum ada PIC-nya.
 */
export function sudahTuntas(p: PoinStatus, tugas: Pick<TugasTautan, 'status'>[] = []): boolean {
  switch (p.tag) {
    case 'approval':
      return p.approval_status === 'ditolak' || (p.approval_status === 'disetujui' && !menungguBiaya(p))
    case 'tindak_lanjut':
      return tugas.length > 0 && tugas.every(t => t.status === 'done')
    case 'perlu_diskusi':
      return p.selesai_at !== null
    default:
      return false
  }
}

export const LABEL_STATUS_TUGAS: Record<TaskStatus, string> = {
  todo: 'Belum mulai',
  in_progress: 'Dikerjakan',
  problem: 'Bermasalah',
  submitted: 'Menunggu review',
  done: 'Selesai',
  returned: 'Dikembalikan',
}

/** Token warna per status tugas — sama dengan warna batang di TaskCard. */
export const WARNA_STATUS_TUGAS: Record<TaskStatus, string> = {
  todo: 'var(--muted-foreground)',
  in_progress: 'var(--info)',
  problem: 'var(--destructive)',
  submitted: 'var(--warning)',
  done: 'var(--success)',
  returned: 'var(--destructive)',
}
