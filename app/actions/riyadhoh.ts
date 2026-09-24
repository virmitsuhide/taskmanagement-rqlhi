'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageRiyadhoh } from '@/lib/auth/permissions'
import { hariSabtu, type KelompokRiyadhoh } from '@/lib/rq/riyadhoh'
import { bolehRiyadhoh, type StatusHadir } from '@/lib/data/riyadhoh'

type Hasil = { error?: string; success?: true }

const PESAN_MIGRASI = 'Tabel Riyadhoh belum ada. Minta admin menjalankan migrasi 0087 lebih dulu.'
const KELOMPOK: KelompokRiyadhoh[] = ['L', 'P']
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/** Tabel belum ada: 42P01 dari Postgres, PGRST205 dari cache skema PostgREST. */
const tabelHilang = (e: { code?: string }) => e.code === '42P01' || e.code === 'PGRST205'

async function koordinator() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' as const }
  if (!canManageRiyadhoh(session.role)) return { error: 'Tidak memiliki izin.' as const }
  return { session }
}

function segarkan() {
  revalidatePath('/riyadhoh')
  revalidatePath('/guru/riyadhoh')
}

/**
 * Simpan jadwal Sabtu sebulan sekaligus: tanggal → 'L' | 'P' | null (libur).
 * Dikirim per bulan, bukan per Sabtu, karena koordinator menyusunnya sekali
 * duduk; menyimpan satu per satu membuat setengah bulan tersimpan bila satu
 * permintaan gagal di tengah jalan.
 */
export async function simpanJadwalRiyadhohAction(jadwal: Record<string, KelompokRiyadhoh | null>): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }

  const isi: { tanggal: string; gender: KelompokRiyadhoh; dibuat_oleh: string; updated_at: string }[] = []
  const libur: string[] = []
  for (const [tanggal, gender] of Object.entries(jadwal)) {
    if (!TANGGAL.test(tanggal) || !hariSabtu(tanggal)) return { error: `${tanggal} bukan hari Sabtu.` }
    if (gender === null) libur.push(tanggal)
    else if (KELOMPOK.includes(gender)) isi.push({ tanggal, gender, dibuat_oleh: k.session.userId, updated_at: new Date().toISOString() })
    else return { error: 'Kelompok tidak dikenal.' }
  }

  const supabase = createServerClient()
  if (isi.length > 0) {
    const { error } = await supabase.from('riyadhoh_jadwal').upsert(isi, { onConflict: 'tanggal' })
    if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan jadwal.' }
  }
  if (libur.length > 0) {
    const { error } = await supabase.from('riyadhoh_jadwal').delete().in('tanggal', libur)
    if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan jadwal.' }
  }
  segarkan()
  return { success: true }
}

/** Tetapkan kelompok yang diampu seorang guru; kosong = bukan pengampu lagi. */
export async function simpanPengampuRiyadhohAction(teacherId: string, kelompok: KelompokRiyadhoh[]): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (!teacherId) return { error: 'Guru belum dipilih.' }
  if (kelompok.some(g => !KELOMPOK.includes(g))) return { error: 'Kelompok tidak dikenal.' }

  const supabase = createServerClient()
  const { error: galatHapus } = await supabase.from('riyadhoh_pengampu').delete().eq('teacher_id', teacherId)
  if (galatHapus) return { error: tabelHilang(galatHapus) ? PESAN_MIGRASI : 'Gagal menyimpan pengampu.' }
  if (kelompok.length > 0) {
    const { error } = await supabase.from('riyadhoh_pengampu').insert([...new Set(kelompok)].map(gender => ({ teacher_id: teacherId, gender })))
    if (error) return { error: 'Gagal menyimpan pengampu.' }
  }
  segarkan()
  return { success: true }
}

/**
 * Pengecualian peserta: true = masukkan, false = keluarkan, null = kembali
 * ke aturan bawaan (kelas 9, atau 7–8 QuLS). Baris pengecualian yang sudah
 * sama dengan aturannya dihapus — supaya anak yang kelak naik kelas tidak
 * tertahan oleh pengecualian lama yang sudah tidak berarti.
 */
export async function ubahPesertaRiyadhohAction(studentId: string, ikut: boolean | null): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const supabase = createServerClient()
  const { error } = ikut === null
    ? await supabase.from('riyadhoh_peserta').delete().eq('student_id', studentId)
    : await supabase.from('riyadhoh_peserta').upsert(
        { student_id: studentId, ikut, diubah_oleh: k.session.userId, updated_at: new Date().toISOString() },
        { onConflict: 'student_id' },
      )
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan peserta.' }
  segarkan()
  return { success: true }
}

const STATUS: StatusHadir[] = ['hadir', 'izin', 'sakit', 'alfa']

/**
 * Kehadiran satu Sabtu, dicatat pengampu. Tiap anak diperiksa sendiri lewat
 * aturan yang sama dengan setoran (bolehRiyadhoh): pengampu kelompok itu,
 * pada Sabtu kelompok itu, dan anaknya peserta. null = hapus catatan.
 */
export async function simpanHadirRiyadhohAction(tanggal: string, hadir: Record<string, StatusHadir | null>): Promise<Hasil & { tersimpan?: number }> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }
  if (!TANGGAL.test(tanggal)) return { error: 'Tanggal tidak sah.' }

  const supabase = createServerClient()
  let tersimpan = 0
  for (const [studentId, status] of Object.entries(hadir)) {
    if (status !== null && !STATUS.includes(status)) return { error: 'Status kehadiran tidak dikenal.' }
    if (!(await bolehRiyadhoh(session.teacherId, studentId, tanggal))) {
      return { error: 'Ada siswa yang bukan peserta kelompok Anda di Sabtu ini.' }
    }
    const { error } = status === null
      ? await supabase.from('riyadhoh_hadir').delete().eq('student_id', studentId).eq('tanggal', tanggal)
      : await supabase.from('riyadhoh_hadir').upsert(
          { student_id: studentId, tanggal, status, dicatat_oleh: session.teacherId, updated_at: new Date().toISOString() },
          { onConflict: 'student_id,tanggal' },
        )
    if (error) return { error: 'Gagal menyimpan kehadiran.' }
    tersimpan++
  }
  revalidatePath('/guru/riyadhoh')
  return { success: true, tersimpan }
}
