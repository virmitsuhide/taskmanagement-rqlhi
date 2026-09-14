'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { isCadence, kunciPeriode } from '@/lib/rutin/periode'
import { MAX_ALASAN, isOutcome } from '@/lib/rutin/status'
import type { RoutineCadence, RoutineOutcome } from '@/types'

/**
 * Tugas Rutin — tambah, sunting, hapus, dan melaporkan hasilnya.
 *
 * IZINNYA CUMA SATU: PEMILIK.
 *
 * Tidak ada matriks peran di sini, dan itu disengaja. Tugas rutin adalah
 * daftar kerja pribadi seorang pengurus; tidak ada atasan yang menugaskannya
 * dan tidak ada yang memverifikasinya. Setiap kueri di berkas ini menyaring
 * owner_id = pemanggil, jadi id yang dikirim dari peramban tidak bisa
 * menyentuh milik orang lain sekalipun ditebak dengan benar.
 *
 * Kepala RQ memantau hasilnya lewat /tugas-rutin/papan, tapi hanya membaca —
 * tidak ada satu pun aksi di berkas ini yang bisa dipanggil atas nama orang
 * lain, termasuk olehnya.
 */

const MAX_DESKRIPSI = 300

function refresh() {
  revalidatePath('/tugas-rutin')
  // Papan kepala RQ menampilkan laporan yang sama; tanpa baris ini, laporan
  // yang baru masuk baru terlihat di sana setelah cache-nya kedaluwarsa
  // sendiri — dan itu persis jenis keterlambatan yang membuat orang berhenti
  // memercayai papannya.
  revalidatePath('/tugas-rutin/papan')
}

/** Baca & validasi isian form yang dipakai bersama oleh tambah dan sunting. */
function bacaForm(formData: FormData): { description: string; cadence: RoutineCadence } | { error: string } {
  const description = ((formData.get('description') as string) ?? '').trim()
  if (!description) return { error: 'Deskripsi tugas wajib diisi.' }
  if (description.length > MAX_DESKRIPSI) {
    return { error: `Deskripsi terlalu panjang (maksimal ${MAX_DESKRIPSI} karakter).` }
  }

  const cadence = formData.get('cadence')
  if (!isCadence(cadence)) return { error: 'Pilih dulu irama pengulangannya.' }

  return { description, cadence }
}

export async function createRoutineTaskAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const isi = bacaForm(formData)
  if ('error' in isi) return { error: isi.error }

  const supabase = createServerClient()

  // Tugas baru ditaruh paling bawah dalam kelompok iramanya. Urutannya
  // dihitung dari nilai terbesar yang ada, bukan dari jumlah baris: tugas yang
  // sudah dihapus membuat hitungan jumlah bertabrakan dengan urutan terpakai.
  const { data: terakhir } = await supabase
    .from('routine_tasks')
    .select('order_num')
    .eq('owner_id', session.userId)
    .eq('cadence', isi.cadence)
    .order('order_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('routine_tasks').insert({
    owner_id: session.userId,
    description: isi.description,
    cadence: isi.cadence,
    order_num: ((terakhir?.order_num as number | undefined) ?? -1) + 1,
  })

  if (error) {
    if (error.message?.includes('routine_tasks')) {
      return {
        error:
          'Tugas rutin belum bisa disimpan: jalankan drizzle/0043_tugas_rutin_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    return { error: 'Gagal menyimpan tugas rutin.' }
  }

  refresh()
  redirect('/tugas-rutin')
}

export async function updateRoutineTaskAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const id = formData.get('task_id') as string
  if (!id) return { error: 'Tugas rutin tidak dikenali.' }

  const isi = bacaForm(formData)
  if ('error' in isi) return { error: isi.error }

  const supabase = createServerClient()

  // owner_id ikut jadi syarat, bukan diperiksa lebih dulu lewat query terpisah:
  // pemeriksaan yang menyatu dengan penulisannya tidak bisa terlewat, dan tidak
  // menyisakan celah antara "sudah dicek" dan "jadi ditulis".
  const { data, error } = await supabase
    .from('routine_tasks')
    .update({
      description: isi.description,
      cadence: isi.cadence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', session.userId)
    .select('id')

  if (error) return { error: 'Gagal menyimpan perubahan.' }
  if (!data || data.length === 0) return { error: 'Tugas rutin tidak ditemukan.' }

  refresh()
  return { success: true }
}

export async function deleteRoutineTaskAction(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('routine_tasks')
    .delete()
    .eq('id', id)
    .eq('owner_id', session.userId)

  if (error) return { error: 'Gagal menghapus tugas rutin.' }

  refresh()
  return { success: true }
}

/**
 * Laporkan hasil sebuah tugas rutin untuk periode yang sedang berjalan.
 *
 * Tiga keadaan, satu aksi: 'terlaksana', 'tidak_terlaksana' (wajib beralasan),
 * dan null untuk membatalkan laporan — kembali ke "belum dilaporkan".
 *
 * KENAPA SATU AKSI, BUKAN TIGA
 *
 * Ketiganya menulis ke baris yang sama dan saling meniadakan: melaporkan
 * terlaksana harus menghapus alasan yang mungkin tertinggal dari laporan
 * sebelumnya, dan melaporkan tidak terlaksana harus menghapus jejak
 * "terlaksana"-nya. Dipecah jadi tiga aksi, aturan saling-meniadakan itu
 * harus diulang di tiap aksi dan cukup satu yang lupa untuk meninggalkan
 * baris yang tidak konsisten.
 *
 * Periodenya dihitung di server, bukan dikirim peramban: jam perangkat bisa
 * meleset atau berzona lain, dan laporan yang mendarat di kunci periode yang
 * salah akan terlihat hilang begitu halaman dimuat ulang.
 */
export async function setRoutineOutcomeAction(
  id: string,
  outcome: RoutineOutcome | null,
  reason?: string,
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (outcome !== null && !isOutcome(outcome)) return { error: 'Status tidak dikenali.' }

  // Alasan divalidasi sebelum menyentuh database supaya pengurus mendapat
  // kalimat yang bisa ditindaklanjuti, bukan pesan pelanggaran CHECK dari
  // Postgres. CHECK-nya tetap ada sebagai jaring terakhir (migrasi 0060).
  let alasan: string | null = null
  if (outcome === 'tidak_terlaksana') {
    alasan = (reason ?? '').trim()
    if (!alasan) return { error: 'Tulis dulu alasan kenapa tugas ini tidak terlaksana.' }
    if (alasan.length > MAX_ALASAN) {
      return { error: `Alasan terlalu panjang (maksimal ${MAX_ALASAN} karakter).` }
    }
  }

  const supabase = createServerClient()

  // Kepemilikan diperiksa lewat baris tugasnya — routine_task_checks tidak
  // punya kolom pemilik, dan menambahkannya hanya akan menggandakan fakta yang
  // sudah dijamin tabel induknya.
  const { data: task } = await supabase
    .from('routine_tasks')
    .select('id, cadence')
    .eq('id', id)
    .eq('owner_id', session.userId)
    .maybeSingle()

  if (!task) return { error: 'Tugas rutin tidak ditemukan.' }

  const period = kunciPeriode(task.cadence as RoutineCadence)

  if (outcome === null) {
    const { error } = await supabase
      .from('routine_task_checks')
      .delete()
      .eq('task_id', id)
      .eq('period', period)
    if (error) return { error: 'Gagal membatalkan laporan.' }
  } else {
    // Kunci primer (task_id, period) membuat ini tahan diulang — dua ketukan
    // cepat di HP tidak menghasilkan dua baris. `reason` selalu ikut ditulis,
    // termasuk saat nilainya null, supaya alasan lama tidak bertahan ketika
    // laporannya diralat menjadi terlaksana.
    const { error } = await supabase
      .from('routine_task_checks')
      .upsert(
        {
          task_id: id,
          period,
          outcome,
          reason: alasan,
          checked_by: session.userId,
          checked_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,period' },
      )
    if (error) {
      if (error.message?.includes('outcome') || error.message?.includes('routine_outcome')) {
        return {
          error:
            'Status belum bisa disimpan: jalankan drizzle/0060_tugas_rutin_status_dan_papan_PASTE_TO_SUPABASE.sql di Supabase.',
        }
      }
      return { error: 'Gagal menyimpan laporan.' }
    }
  }

  refresh()
  return { success: true }
}

/**
 * Geser urutan satu tugas rutin di dalam kelompok iramanya, dengan menukar
 * order_num-nya dengan tetangga. Menukar sepasang nilai lebih murah daripada
 * menomori ulang seluruh daftar, dan tidak bisa merusak urutan tugas lain
 * kalau salah satu update gagal di tengah jalan.
 */
export async function moveRoutineTaskAction(id: string, direction: 'up' | 'down') {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('routine_tasks')
    .select('id, cadence')
    .eq('id', id)
    .eq('owner_id', session.userId)
    .maybeSingle()

  if (!task) return { error: 'Tugas rutin tidak ditemukan.' }

  const { data: rows } = await supabase
    .from('routine_tasks')
    .select('id, order_num')
    .eq('owner_id', session.userId)
    .eq('cadence', task.cadence)
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })

  const list = (rows ?? []) as { id: string; order_num: number }[]
  const i = list.findIndex(r => r.id === id)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= list.length) return { success: true } // sudah di ujung

  await Promise.all([
    supabase.from('routine_tasks').update({ order_num: list[j].order_num }).eq('id', list[i].id),
    supabase.from('routine_tasks').update({ order_num: list[i].order_num }).eq('id', list[j].id),
  ])

  refresh()
  return { success: true }
}
