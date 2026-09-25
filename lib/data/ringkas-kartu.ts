import { createServerClient } from '@/lib/supabase/server'

/** Angka kecil di kaki kartu Papan Tugas. */
export interface RingkasKartu {
  subSelesai: number
  subTotal: number
  komentar: number
}

/**
 * Id dikirim sebagai daftar di URL PostgREST; papan seluruh divisi bisa memuat
 * ratusan kartu, jadi dipotong supaya URL-nya tidak melewati batas server.
 */
const POTONGAN = 200

function potong<T>(xs: T[]): T[][] {
  const hasil: T[][] = []
  for (let i = 0; i < xs.length; i += POTONGAN) hasil.push(xs.slice(i, i + POTONGAN))
  return hasil
}

/**
 * Progres rincian & jumlah komentar untuk semua kartu papan sekaligus.
 * Hanya kolom task_id/status yang diambil — isi komentar tidak dibutuhkan kartu.
 */
export async function getRingkasKartu(taskIds: string[]): Promise<Record<string, RingkasKartu>> {
  const hasil: Record<string, RingkasKartu> = {}
  if (taskIds.length === 0) return hasil
  const ambil = (id: string) => (hasil[id] ??= { subSelesai: 0, subTotal: 0, komentar: 0 })

  const supabase = createServerClient()
  const bagian = potong(taskIds)
  const [subRes, komRes] = await Promise.all([
    Promise.all(bagian.map(ids => supabase.from('task_subtasks').select('task_id, status').in('task_id', ids))),
    Promise.all(bagian.map(ids => supabase.from('task_comments').select('task_id').in('task_id', ids))),
  ])
  for (const { data } of subRes) {
    for (const s of (data ?? []) as { task_id: string; status: string }[]) {
      const r = ambil(s.task_id)
      r.subTotal++
      if (s.status === 'done') r.subSelesai++
    }
  }
  for (const { data } of komRes) {
    for (const k of (data ?? []) as { task_id: string }[]) ambil(k.task_id).komentar++
  }
  return hasil
}
