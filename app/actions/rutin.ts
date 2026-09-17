'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { isCadence, kunciPeriode } from '@/lib/rutin/periode'
import { MAX_ALASAN, isOutcome } from '@/lib/rutin/status'
import { MAX_ANGGOTA, pengurusDisebut, statusKonfirmasi } from '@/lib/rutin/bersama'
import { getPengurusMention } from '@/lib/data/rutin'
import type { KonfirmasiRutin, RoutineCadence, RoutineOutcome, StatusAnggotaRutin } from '@/types'

/**
 * Tugas Rutin — tambah, sunting, hapus, melaporkan hasilnya, dan (sejak 0073)
 * mengerjakannya bersama pengurus lain.
 *
 * DUA TINGKAT IZIN, TIDAK LEBIH
 *
 *   • PEMILIK (pembuat) — menyunting, menghapus, mengurutkan, dan menentukan
 *     siapa yang diajak lewat @ di deskripsinya.
 *   • PESERTA (pemilik + anggota yang sudah menerima ajakan) — melaporkan
 *     hasil dan mengonfirmasi laporan rekannya.
 *
 * Tidak ada matriks peran: tidak ada atasan yang menugaskan tugas rutin.
 * Setiap kueri menyaring berdasarkan pemanggil, jadi id yang dikirim dari
 * peramban tidak bisa menyentuh tugas orang yang tidak mengajaknya.
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

const PESAN_MIGRASI_BERSAMA =
  'Tugas rutin bersama belum aktif: jalankan drizzle/0073_tugas_rutin_bersama_PASTE_TO_SUPABASE.sql di Supabase.'

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

/**
 * Pengurus yang disebut dengan @ di deskripsi, selain pembuatnya sendiri.
 *
 * Diturunkan dari TEKS di server, bukan dari daftar yang dikirim peramban:
 * yang tertulis di deskripsi dan yang benar-benar diajak tidak boleh berbeda.
 */
async function rekanDariDeskripsi(description: string, pemilikId: string): Promise<{ ids: string[] } | { error: string }> {
  const disebut = pengurusDisebut(description, await getPengurusMention()).filter(p => p.userId !== pemilikId)
  if (disebut.length > MAX_ANGGOTA) return { error: `Paling banyak ${MAX_ANGGOTA} rekan dalam satu tugas rutin.` }
  return { ids: disebut.map(p => p.userId) }
}

export async function createRoutineTaskAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const isi = bacaForm(formData)
  if ('error' in isi) return { error: isi.error }

  const rekan = await rekanDariDeskripsi(isi.description, session.userId)
  if ('error' in rekan) return { error: rekan.error }

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

  const { data: baru, error } = await supabase.from('routine_tasks').insert({
    owner_id: session.userId,
    description: isi.description,
    cadence: isi.cadence,
    order_num: ((terakhir?.order_num as number | undefined) ?? -1) + 1,
  }).select('id').single()

  if (error || !baru) {
    if (error?.message?.includes('routine_tasks')) {
      return {
        error:
          'Tugas rutin belum bisa disimpan: jalankan drizzle/0043_tugas_rutin_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    return { error: 'Gagal menyimpan tugas rutin.' }
  }

  if (rekan.ids.length > 0) {
    const { error: galat } = await supabase.from('routine_task_members').insert(
      rekan.ids.map(user_id => ({ task_id: baru.id, user_id, status: 'menunggu', invited_by: session.userId })),
    )
    if (galat) {
      // Tugasnya sudah tersimpan sebagai tugas pribadi; ajakannya yang gagal.
      // Lebih baik dibatalkan utuh daripada meninggalkan tugas "bersama @SDM"
      // yang tidak pernah sampai ke SDM.
      await supabase.from('routine_tasks').delete().eq('id', baru.id)
      return { error: galat.message.includes('routine_task_members') ? PESAN_MIGRASI_BERSAMA : 'Gagal mengirim ajakan tugas bersama.' }
    }
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

  const rekan = await rekanDariDeskripsi(isi.description, session.userId)
  if ('error' in rekan) return { error: rekan.error }

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

  // Selaraskan rekan dengan @ di deskripsi baru: yang baru disebut diajak,
  // yang tidak lagi disebut dilepas. Yang tetap disebut tidak disentuh — orang
  // yang sudah menerima tidak perlu menerima ulang hanya karena kalimatnya
  // dirapikan.
  const { data: lama, error: galatBaca } = await supabase
    .from('routine_task_members').select('user_id').eq('task_id', id)
  if (!galatBaca) {
    const adaIds = new Set(((lama ?? []) as { user_id: string }[]).map(r => r.user_id))
    const tambah = rekan.ids.filter(u => !adaIds.has(u))
    const lepas = [...adaIds].filter(u => !rekan.ids.includes(u))
    if (tambah.length > 0) {
      await supabase.from('routine_task_members').insert(
        tambah.map(user_id => ({ task_id: id, user_id, status: 'menunggu', invited_by: session.userId })),
      )
    }
    if (lepas.length > 0) {
      await supabase.from('routine_task_members').delete().eq('task_id', id).in('user_id', lepas)
      await hitungUlangKonfirmasi(id)
    }
  } else if (rekan.ids.length > 0) {
    return { error: PESAN_MIGRASI_BERSAMA }
  }

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

// ─── Peserta & konfirmasi ────────────────────────────────────────────────────

interface AksesTugas {
  task: { id: string; cadence: RoutineCadence; owner_id: string }
  /** Pemilik + anggota yang sudah menerima. */
  peserta: string[]
  /** false = migrasi 0073 belum dijalankan. */
  tabelBersama: boolean
}

/** Tugas yang boleh dilaporkan pemanggil: miliknya, atau yang ajakannya ia terima. */
async function aksesTugas(id: string, userId: string): Promise<AksesTugas | null> {
  const supabase = createServerClient()
  const { data: task } = await supabase.from('routine_tasks').select('id, cadence, owner_id').eq('id', id).maybeSingle()
  if (!task) return null

  const { data: anggota, error } = await supabase
    .from('routine_task_members').select('user_id').eq('task_id', id).eq('status', 'diterima')
  const peserta = [task.owner_id as string, ...((anggota ?? []) as { user_id: string }[]).map(a => a.user_id)]
  if (!peserta.includes(userId)) return null
  return { task: task as AksesTugas['task'], peserta, tabelBersama: !error }
}

/**
 * Hitung ulang status konfirmasi laporan periode berjalan — dipanggil setiap
 * kali daftar peserta berubah. Rekan yang keluar tidak boleh membuat laporan
 * menunggu selamanya keputusan dari orang yang sudah tidak ikut.
 */
async function hitungUlangKonfirmasi(taskId: string) {
  const supabase = createServerClient()
  const { data: task } = await supabase.from('routine_tasks').select('id, cadence, owner_id').eq('id', taskId).maybeSingle()
  if (!task) return
  const period = kunciPeriode(task.cadence as RoutineCadence)
  const { data: row } = await supabase
    .from('routine_task_checks').select('outcome, konfirmasi, checked_by').eq('task_id', taskId).eq('period', period).maybeSingle()
  if (!row || row.outcome !== 'terlaksana' || row.konfirmasi === 'selesai') return

  const [{ data: anggota }, { data: keputusan }] = await Promise.all([
    supabase.from('routine_task_members').select('user_id').eq('task_id', taskId).eq('status', 'diterima'),
    supabase.from('routine_check_konfirmasi').select('user_id, keputusan').eq('task_id', taskId).eq('period', period),
  ])
  const peserta = [task.owner_id as string, ...((anggota ?? []) as { user_id: string }[]).map(a => a.user_id)]
  const status = statusKonfirmasi(
    peserta,
    (row.checked_by as string | null) ?? (task.owner_id as string),
    ((keputusan ?? []) as { user_id: string; keputusan: 'setuju' | 'tolak' }[]).map(k => ({ userId: k.user_id, keputusan: k.keputusan })),
  )
  if (status !== row.konfirmasi) {
    await supabase.from('routine_task_checks').update({ konfirmasi: status }).eq('task_id', taskId).eq('period', period)
  }
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
 * TUGAS BERSAMA (0073)
 *
 * Laporan terlaksana dari satu peserta berstatus 'menunggu' sampai semua rekan
 * setuju. Peserta yang menekan "terlaksana" pada laporan rekannya yang masih
 * menunggu dihitung menyetujuinya — keduanya berarti hal yang sama.
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

  const akses = await aksesTugas(id, session.userId)
  if (!akses) return { error: 'Tugas rutin tidak ditemukan.' }

  const supabase = createServerClient()
  const period = kunciPeriode(akses.task.cadence)
  const bersama = akses.peserta.length > 1

  const { data: lama } = akses.tabelBersama
    ? await supabase.from('routine_task_checks').select('outcome, konfirmasi, checked_by')
        .eq('task_id', id).eq('period', period).maybeSingle()
    : { data: null }
  const laporanRekanMenunggu =
    lama?.outcome === 'terlaksana' && lama.konfirmasi !== 'selesai' && lama.checked_by !== session.userId

  if (outcome === null) {
    if (laporanRekanMenunggu) {
      return { error: 'Laporan ini dibuat rekan Anda — pakai tombol konfirmasi untuk menyetujui atau menolaknya.' }
    }
    const { error } = await supabase
      .from('routine_task_checks')
      .delete()
      .eq('task_id', id)
      .eq('period', period)
    if (error) return { error: 'Gagal membatalkan laporan.' }
    refresh()
    return { success: true }
  }

  if (outcome === 'terlaksana' && laporanRekanMenunggu) {
    return konfirmasiSelesaiRutinAction(id, true)
  }

  const konfirmasi: KonfirmasiRutin = outcome === 'terlaksana' && bersama
    ? statusKonfirmasi(akses.peserta, session.userId, [])
    : 'selesai'

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
        // Kolomnya baru ada sejak 0073; sebelum itu semua laporan memang selesai.
        ...(akses.tabelBersama ? { konfirmasi } : {}),
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

  // Laporan baru berarti keputusan rekan atas laporan sebelumnya tidak berlaku
  // lagi — mereka harus melihat dan mengiyakan yang sekarang.
  if (akses.tabelBersama) {
    await supabase.from('routine_check_konfirmasi').delete().eq('task_id', id).eq('period', period)
  }

  refresh()
  return { success: true }
}

/**
 * Setujui atau tolak laporan terlaksana rekan pada tugas bersama.
 * Pelapor sendiri tidak mengonfirmasi laporannya.
 */
export async function konfirmasiSelesaiRutinAction(id: string, setuju: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const akses = await aksesTugas(id, session.userId)
  if (!akses) return { error: 'Tugas rutin tidak ditemukan.' }
  if (!akses.tabelBersama) return { error: PESAN_MIGRASI_BERSAMA }

  const supabase = createServerClient()
  const period = kunciPeriode(akses.task.cadence)
  const { data: row } = await supabase
    .from('routine_task_checks').select('outcome, konfirmasi, checked_by')
    .eq('task_id', id).eq('period', period).maybeSingle()
  if (!row || row.outcome !== 'terlaksana' || row.konfirmasi === 'selesai') {
    return { error: 'Tidak ada laporan yang menunggu konfirmasi pada periode ini.' }
  }
  if (row.checked_by === session.userId) return { error: 'Laporan Anda sendiri dikonfirmasi oleh rekan, bukan oleh Anda.' }

  const { error } = await supabase.from('routine_check_konfirmasi').upsert(
    { task_id: id, period, user_id: session.userId, keputusan: setuju ? 'setuju' : 'tolak', decided_at: new Date().toISOString() },
    { onConflict: 'task_id,period,user_id' },
  )
  if (error) return { error: 'Gagal menyimpan konfirmasi.' }

  await hitungUlangKonfirmasi(id)
  refresh()
  return { success: true }
}

/** Jawab ajakan tugas rutin bersama. */
export async function jawabAjakanRutinAction(id: string, terima: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const status: StatusAnggotaRutin = terima ? 'diterima' : 'ditolak'
  const { data, error } = await createServerClient()
    .from('routine_task_members')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('task_id', id)
    .eq('user_id', session.userId)
    .eq('status', 'menunggu')
    .select('task_id')
  if (error) return { error: PESAN_MIGRASI_BERSAMA }
  if (!data || data.length === 0) return { error: 'Ajakan ini sudah tidak menunggu jawaban.' }

  // Menerima di tengah periode menambah peserta; laporan yang sedang menunggu
  // ikut memerlukan persetujuannya.
  await hitungUlangKonfirmasi(id)
  refresh()
  return { success: true }
}

/** Keluar dari tugas rutin bersama yang pernah diterima. Pemilik tidak bisa keluar — ia menghapus. */
export async function keluarTugasRutinBersamaAction(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const { data, error } = await createServerClient()
    .from('routine_task_members')
    .delete()
    .eq('task_id', id)
    .eq('user_id', session.userId)
    .select('task_id')
  if (error) return { error: PESAN_MIGRASI_BERSAMA }
  if (!data || data.length === 0) return { error: 'Anda bukan rekan pada tugas ini.' }

  await hitungUlangKonfirmasi(id)
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
