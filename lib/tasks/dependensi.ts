import { addDays, daysBetween } from '@/lib/tasks/gantt'
import type { TaskStatus } from '@/types'

/**
 * Aturan dependensi antar tugas — murni, tanpa basis data.
 *
 * Satu jenis relasi saja: tugas A MENUNGGU tugas B, artinya A baru semestinya
 * mulai setelah B selesai (finish-to-start). Lihat drizzle/0071 untuk alasan
 * tidak memakai empat jenis relasi Gantt klasik.
 */

export interface Sisi {
  /** Tugas yang menunggu. */
  task_id: string
  /** Tugas yang ditunggu. */
  depends_on_id: string
}

/**
 * Apakah menambah "taskId menunggu dependsOnId" menutup sebuah lingkaran?
 *
 * Lingkaran berarti tidak ada satu pun tugas di dalamnya yang boleh mulai —
 * A menunggu B, B menunggu A. Diperiksa dengan menelusuri apa saja yang
 * (secara berantai) ditunggu oleh dependsOnId: kalau taskId ada di sana,
 * relasi baru ini akan menutup lingkarannya.
 */
export function membentukLingkaran(sisi: Sisi[], taskId: string, dependsOnId: string): boolean {
  if (taskId === dependsOnId) return true
  const menunggu = new Map<string, string[]>()
  for (const s of sisi) {
    const daftar = menunggu.get(s.task_id)
    if (daftar) daftar.push(s.depends_on_id)
    else menunggu.set(s.task_id, [s.depends_on_id])
  }
  const dikunjungi = new Set<string>()
  const antrean = [dependsOnId]
  while (antrean.length > 0) {
    const kini = antrean.pop()!
    if (kini === taskId) return true
    if (dikunjungi.has(kini)) continue
    dikunjungi.add(kini)
    antrean.push(...(menunggu.get(kini) ?? []))
  }
  return false
}

/**
 * Keadaan satu relasi.
 *
 *   selesai        penghambat sudah selesai — relasinya tinggal sejarah
 *   aman           tugas yang menunggu dijadwalkan mulai setelah penghambat selesai
 *   bentrok        tugas yang menunggu dijadwalkan mulai sebelum/bersamaan dengan
 *                  selesainya penghambat — rencananya tidak mungkin terjadi
 *   tanpa_tenggat  penghambat belum bertenggat, jadi tidak bisa dinilai
 */
export type KeadaanRelasi = 'selesai' | 'aman' | 'bentrok' | 'tanpa_tenggat'

/**
 * Ujung akhir penghambat yang BELUM selesai tidak pernah lebih awal dari hari
 * ini. Tugas bertenggat kemarin yang belum rampung tetap menghalangi hari ini
 * — memakai tenggat aslinya akan menyatakan relasi "aman" tepat saat tugas
 * yang menunggu sedang tertahan.
 */
export function keadaanRelasi(
  menunggu: { mulai: string },
  penghambat: { status: TaskStatus; tenggat: string | null },
  hariIni: string,
): KeadaanRelasi {
  if (penghambat.status === 'done') return 'selesai'
  if (!penghambat.tenggat) return 'tanpa_tenggat'
  const selesaiPaling = penghambat.tenggat > hariIni ? penghambat.tenggat : hariIni
  return menunggu.mulai <= selesaiPaling ? 'bentrok' : 'aman'
}

/**
 * Jadwal baru untuk tugas yang menunggu: mulai sehari setelah penghambat
 * paling cepat selesai. Panjang rentang semula dipertahankan — tugas lima hari
 * tetap lima hari, hanya bergeser.
 *
 * Tidak pernah dijalankan otomatis; ini usulan di balik tombol "Geser mulai",
 * dan orang yang menekannya yang memutuskan. Jira dan Linear memilih cara yang
 * sama: menandai bentrok, bukan diam-diam menggeser rencana orang lain.
 */
export function usulanGeser(
  menunggu: { start_date: string | null; due_date: string | null },
  penghambatTenggat: string,
  hariIni: string,
): { start_date: string; due_date: string | null } {
  const acuan = penghambatTenggat > hariIni ? penghambatTenggat : hariIni
  const mulai = addDays(acuan, 1)
  if (!menunggu.due_date) return { start_date: mulai, due_date: null }
  const durasi = menunggu.start_date ? Math.max(0, daysBetween(menunggu.start_date, menunggu.due_date)) : 0
  const tenggat = menunggu.due_date >= mulai && !menunggu.start_date ? menunggu.due_date : addDays(mulai, durasi)
  return { start_date: mulai, due_date: tenggat < mulai ? mulai : tenggat }
}
