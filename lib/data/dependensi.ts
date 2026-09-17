import { createServerClient } from '@/lib/supabase/server'
import { keadaanRelasi, type KeadaanRelasi } from '@/lib/tasks/dependensi'
import { today, toDay } from '@/lib/tasks/gantt'
import type { SessionData, TaskStatus, UserRole } from '@/types'

/**
 * Pembacaan relasi "menunggu" antar tugas (migrasi 0071).
 *
 * APA YANG BOLEH TERLIHAT
 *
 * Judul, jabatan pemegang, status, dan tenggat tugas yang terkait selalu
 * ditampilkan — termasuk milik orang yang papannya tidak boleh dibuka
 * pemirsa. Itu keputusan RQ: orang yang menunggu berhak tahu apa yang ia
 * tunggu dan sudah sampai mana. Yang TIDAK dibuka adalah halaman tugasnya;
 * `bisaDibuka` mengikuti aturan halaman detail (pelaksana, pemberi, Kepala RQ).
 *
 * Nama orang sengaja tidak dibawa, sejalan dengan Gantt: yang dipantau
 * amanahnya, bukan orangnya.
 */

export interface TugasTerkait {
  id: string
  title: string
  status: TaskStatus
  start_date: string | null
  due_date: string | null
  /** Jabatan pelaksana; null bila akunnya sudah tidak ada. */
  jabatan: UserRole | null
  bisaDibuka: boolean
}

export interface Relasi {
  /** id baris task_dependencies. */
  id: string
  /** Tugas yang menunggu. */
  menungguId: string
  /** Tugas yang ditunggu. */
  ditungguId: string
  keadaan: KeadaanRelasi
}

export interface PetaDependensi {
  relasi: Relasi[]
  tugas: Record<string, TugasTerkait>
  /** false = migrasi 0071 belum dijalankan. */
  tabelAda: boolean
}

interface BarisTugas {
  id: string
  title: string
  status: TaskStatus
  start_date: string | null
  due_date: string | null
  created_at: string
  deleted_at: string | null
  assigned_to: string | null
  assigned_by: string | null
  assignee: { role: UserRole } | null
}

/** Titik mulai untuk menilai bentrok — sama dengan ujung kiri batang Gantt tanpa rincian. */
function mulaiEfektif(t: Pick<BarisTugas, 'start_date' | 'due_date' | 'created_at'>): string {
  return t.start_date ?? t.due_date ?? toDay(t.created_at)
}

const KOSONG: PetaDependensi = { relasi: [], tugas: {}, tabelAda: true }

/**
 * Semua relasi yang menyentuh sekumpulan tugas — ke arah mana pun — beserta
 * data ringkas setiap tugas di kedua ujungnya.
 *
 * Relasi yang salah satu ujungnya sudah dihapus lunak tidak dikembalikan:
 * menunggu tugas yang tidak ada lagi tidak menghalangi siapa pun.
 *
 * `session` null = hanya untuk hitungan (ringkasan); bisaDibuka selalu false.
 */
export async function getPetaDependensi(taskIds: string[], session: Pick<SessionData, 'userId' | 'role'> | null): Promise<PetaDependensi> {
  if (taskIds.length === 0) return KOSONG
  const supabase = createServerClient()
  // Daftar id masuk ke URL PostgREST. Papan divisi Kepala RQ memuat ratusan
  // tugas, dan URL sepanjang itu ditolak server; di atas ambang ini seluruh
  // relasi diambil lalu disaring di memori — tabelnya jauh lebih kecil dari
  // tabel tugas, jadi itu tetap murah.
  const BATAS_URL = 120
  const kunci = new Set(taskIds)
  const q = supabase.from('task_dependencies').select('id, task_id, depends_on_id')
  const { data, error } = taskIds.length > BATAS_URL
    ? await q
    : await q.or(`task_id.in.(${taskIds.join(',')}),depends_on_id.in.(${taskIds.join(',')})`)
  if (error) return { ...KOSONG, tabelAda: false }

  const sisi = ((data ?? []) as { id: string; task_id: string; depends_on_id: string }[])
    .filter(s => kunci.has(s.task_id) || kunci.has(s.depends_on_id))
  if (sisi.length === 0) return KOSONG

  const ids = [...new Set(sisi.flatMap(s => [s.task_id, s.depends_on_id]))]
  const { data: tugasData } = await supabase
    .from('tasks')
    .select('id, title, status, start_date, due_date, created_at, deleted_at, assigned_to, assigned_by, assignee:users!assigned_to(role)')
    .in('id', ids)
  const baris = new Map(((tugasData ?? []) as unknown as BarisTugas[]).map(t => [t.id, t]))

  const hariIni = today()
  const tugas: Record<string, TugasTerkait> = {}
  const relasi: Relasi[] = []
  for (const s of sisi) {
    const menunggu = baris.get(s.task_id)
    const ditunggu = baris.get(s.depends_on_id)
    if (!menunggu || !ditunggu || menunggu.deleted_at || ditunggu.deleted_at) continue
    for (const t of [menunggu, ditunggu]) {
      tugas[t.id] ??= {
        id: t.id, title: t.title, status: t.status, start_date: t.start_date, due_date: t.due_date,
        jabatan: t.assignee?.role ?? null,
        bisaDibuka: !!session && (t.assigned_to === session.userId || t.assigned_by === session.userId || session.role === 'kepala_rq'),
      }
    }
    relasi.push({
      id: s.id,
      menungguId: s.task_id,
      ditungguId: s.depends_on_id,
      keadaan: keadaanRelasi({ mulai: mulaiEfektif(menunggu) }, { status: ditunggu.status, tenggat: ditunggu.due_date }, hariIni),
    })
  }
  return { relasi, tugas, tabelAda: true }
}

/** Ringkasan per tugas untuk kartu papan & label Gantt. */
export interface RingkasDependensi {
  /** Penghambat yang belum selesai. */
  menunggu: number
  /** Tugas lain yang belum selesai dan sedang menunggu tugas ini. */
  ditunggu: number
  bentrok: boolean
}

export function ringkasDependensi(peta: PetaDependensi): Record<string, RingkasDependensi> {
  const hasil: Record<string, RingkasDependensi> = {}
  const ambil = (id: string) => (hasil[id] ??= { menunggu: 0, ditunggu: 0, bentrok: false })
  for (const r of peta.relasi) {
    if (r.keadaan === 'selesai') continue
    const a = ambil(r.menungguId)
    a.menunggu++
    if (r.keadaan === 'bentrok') a.bentrok = true
    if (peta.tugas[r.menungguId]?.status !== 'done') ambil(r.ditungguId).ditunggu++
  }
  return hasil
}

// ─── Bahan gambar untuk Gantt ─────────────────────────────────────────────────

export interface DependensiGantt {
  /** Garis dari tugas yang ditunggu ke tugas yang menunggu — relasi yang belum selesai saja. */
  sisi: { dari: string; ke: string; bentrok: boolean }[]
  /**
   * Tugas yang ditunggu tapi tidak ada di baris Gantt ini — biasanya milik
   * jabatan lain. Digambar putus-putus di atas supaya panahnya punya pangkal.
   */
  hantu: { id: string; title: string; jabatan: string; status: TaskStatus; range: { start: string; end: string; inferred: boolean }; bisaDibuka: boolean }[]
  /** taskId → "judul (jabatan)" tugas yang sedang menunggunya. */
  ditunggu: Record<string, string[]>
}

/**
 * Susun bahan panah Gantt untuk sekumpulan baris.
 *
 * Tugas yang ditunggu tanpa tanggal sama sekali tidak bisa ditempatkan di
 * sumbu waktu, jadi ia tidak digambar sebagai hantu — relasinya tetap terlihat
 * di halaman detail tugas.
 */
export function dependensiUntukGantt(peta: PetaDependensi, idBaris: Set<string>, labelJabatan: (r: UserRole) => string): DependensiGantt {
  const sisi: DependensiGantt['sisi'] = []
  const hantu = new Map<string, DependensiGantt['hantu'][number]>()
  const ditunggu: Record<string, string[]> = {}

  for (const r of peta.relasi) {
    if (r.keadaan === 'selesai') continue
    const penunggu = peta.tugas[r.menungguId]
    const penghambat = peta.tugas[r.ditungguId]
    if (!penunggu || !penghambat) continue

    if (idBaris.has(r.ditungguId) && penunggu.status !== 'done') {
      const label = `${penunggu.title} (${penunggu.jabatan ? labelJabatan(penunggu.jabatan) : '—'})`
      ;(ditunggu[r.ditungguId] ??= []).push(label)
    }
    if (!idBaris.has(r.menungguId)) continue

    if (!idBaris.has(r.ditungguId)) {
      const start = penghambat.start_date ?? penghambat.due_date
      const end = penghambat.due_date ?? penghambat.start_date
      if (!start || !end) continue
      hantu.set(penghambat.id, {
        id: penghambat.id, title: penghambat.title, status: penghambat.status, bisaDibuka: penghambat.bisaDibuka,
        jabatan: penghambat.jabatan ? labelJabatan(penghambat.jabatan) : '—',
        range: { start, end: end < start ? start : end, inferred: false },
      })
    }
    sisi.push({ dari: r.ditungguId, ke: r.menungguId, bentrok: r.keadaan === 'bentrok' })
  }
  return { sisi, hantu: [...hantu.values()], ditunggu }
}
