'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageTahsinRekomendasi } from '@/lib/auth/permissions'
import { bolehTR, type StatusHadirTR } from '@/lib/data/tahsin-rekomendasi'
import { PASSWORD_AWAL_TR, POLA_USERNAME_TR, usernameTrBerikutnya } from '@/lib/rq/tahsin-rekomendasi'

type Hasil = { error?: string; success?: true }

const PESAN_MIGRASI = 'Tabel Tahsin Rekomendasi belum ada. Minta admin menjalankan migrasi 0115 lebih dulu.'

/** Tabel belum ada: 42P01 dari Postgres, PGRST205 dari cache skema PostgREST. */
const tabelHilang = (e: { code?: string }) => e.code === '42P01' || e.code === 'PGRST205'

async function koordinator() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' as const }
  if (!canManageTahsinRekomendasi(session.role)) return { error: 'Tidak memiliki izin.' as const }
  return { session }
}

function segarkan() {
  revalidatePath('/tahsin-rekomendasi', 'layout')
  revalidatePath('/guru/tahsin-rekomendasi', 'layout')
}

const potong = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const genderSah = (g: unknown): 'L' | 'P' | null => (g === 'L' || g === 'P' ? g : null)

/** Akun pengampu TR yang sah — bukan sembarang guru. */
async function akunTR(teacherId: string): Promise<boolean> {
  const { data } = await createServerClient().from('tr_pengampu').select('teacher_id').eq('teacher_id', teacherId).maybeSingle()
  return Boolean(data)
}

// ─── Kelompok / akun pengampu ────────────────────────────────────────────────

/**
 * Buat kelompok baru beserta akun bersamanya: username TR berikutnya,
 * password `bismillah`, tanpa unit (bukan guru Qur'an — tidak masuk KPI).
 * Sandi dikunci (can_change_password = false): akunnya dipakai bergantian,
 * dan satu pengampu yang menggantinya akan mengunci pengampu berikutnya.
 */
export async function tambahKelompokTRAction(input: { nama: string; gender: string | null; tempat: string }): Promise<Hasil & { username?: string }> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const nama = potong(input.nama, 120)
  if (!nama) return { error: 'Nama pengampu wajib diisi.' }

  const supabase = createServerClient()
  const cek = await supabase.from('tr_pengampu').select('teacher_id', { head: true, count: 'exact' })
  if (cek.error) return { error: tabelHilang(cek.error) ? PESAN_MIGRASI : 'Gagal membaca kelompok.' }

  // Username diambil dari SEMUA akun TR, termasuk yang terhapus — username
  // akun terhapus tetap terpakai di tabel teachers.
  const { data: ada } = await supabase.from('teachers').select('username').like('username', 'TR%')
  const username = usernameTrBerikutnya(((ada ?? []) as { username: string }[]).map(r => r.username).filter(u => POLA_USERNAME_TR.test(u)))

  const { data: guru, error } = await supabase.from('teachers').insert({
    username,
    password_hash: await bcrypt.hash(PASSWORD_AWAL_TR, 10),
    full_name: nama,
    gender: genderSah(input.gender),
    can_change_password: false,
  }).select('id').single()
  if (error || !guru) return { error: `Gagal membuat akun ${username}: ${error?.message ?? 'sebab tidak diketahui'}` }

  const { error: e2 } = await supabase.from('tr_pengampu').insert({
    teacher_id: (guru as { id: string }).id,
    tempat: potong(input.tempat, 120),
    urutan: Number(POLA_USERNAME_TR.exec(username)?.[1] ?? 0),
  })
  if (e2) {
    await supabase.from('teachers').delete().eq('id', (guru as { id: string }).id)
    return { error: 'Gagal menyimpan kelompok.' }
  }
  segarkan()
  return { success: true, username }
}

/** Ganti nama pengampu (pergantian wali kelas), jenis kelamin, dan tempat. */
export async function ubahKelompokTRAction(teacherId: string, input: { nama: string; gender: string | null; tempat: string }): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (!(await akunTR(teacherId))) return { error: 'Kelompok tidak ditemukan.' }
  const nama = potong(input.nama, 120)
  if (!nama) return { error: 'Nama pengampu wajib diisi.' }

  const supabase = createServerClient()
  const [g, t] = await Promise.all([
    supabase.from('teachers').update({ full_name: nama, gender: genderSah(input.gender), updated_at: new Date().toISOString() }).eq('id', teacherId),
    supabase.from('tr_pengampu').update({ tempat: potong(input.tempat, 120), updated_at: new Date().toISOString() }).eq('teacher_id', teacherId),
  ])
  if (g.error || t.error) return { error: 'Gagal menyimpan kelompok.' }
  segarkan()
  return { success: true }
}

/** Kembalikan sandi akun TR ke `bismillah` — bila ada yang terlanjur mengubahnya lewat admin. */
export async function resetSandiTRAction(teacherId: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (!(await akunTR(teacherId))) return { error: 'Kelompok tidak ditemukan.' }
  const { error } = await createServerClient().from('teachers')
    .update({ password_hash: await bcrypt.hash(PASSWORD_AWAL_TR, 10), updated_at: new Date().toISOString() }).eq('id', teacherId)
  if (error) return { error: 'Gagal mengatur ulang sandi.' }
  return { success: true }
}

/**
 * Bubarkan kelompok: hanya bila tidak ada pesertanya lagi. Akunnya
 * dinonaktifkan, bukan dihapus — setoran lama tetap menunjuk ke sana.
 */
export async function hapusKelompokTRAction(teacherId: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (!(await akunTR(teacherId))) return { error: 'Kelompok tidak ditemukan.' }
  const supabase = createServerClient()
  const { count } = await supabase.from('tr_peserta').select('student_id', { head: true, count: 'exact' }).eq('teacher_id', teacherId)
  if ((count ?? 0) > 0) return { error: `Masih ada ${count} peserta. Pindahkan atau keluarkan dulu.` }
  const { error } = await supabase.from('tr_pengampu').delete().eq('teacher_id', teacherId)
  if (error) return { error: 'Gagal membubarkan kelompok.' }
  await supabase.from('teachers').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', teacherId)
  segarkan()
  return { success: true }
}

// ─── Peserta ─────────────────────────────────────────────────────────────────

/**
 * Masukkan / pindahkan siswa ke sebuah kelompok; teacherId null = keluarkan.
 * Hanya siswa SDIT LHI (jenjang 'sd') yang aktif — SD Juara punya programnya
 * sendiri.
 */
export async function aturPesertaTRAction(studentId: string, teacherId: string | null, capaianAwal?: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const supabase = createServerClient()

  if (teacherId === null) {
    const { error } = await supabase.from('tr_peserta').delete().eq('student_id', studentId)
    if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal mengeluarkan peserta.' }
    segarkan()
    return { success: true }
  }

  if (!(await akunTR(teacherId))) return { error: 'Kelompok tidak ditemukan.' }
  const { data: s } = await supabase.from('students').select('jenjang, is_active').eq('id', studentId).maybeSingle()
  const siswa = s as { jenjang: string; is_active: boolean | null } | null
  if (!siswa || siswa.is_active === false) return { error: 'Siswa tidak ditemukan atau tidak aktif.' }
  if (siswa.jenjang !== 'sd') return { error: 'Tahsin Rekomendasi hanya untuk siswa SDIT LHI.' }

  const { error } = await supabase.from('tr_peserta').upsert({
    student_id: studentId,
    teacher_id: teacherId,
    ...(capaianAwal !== undefined ? { capaian_awal: potong(capaianAwal, 200) } : {}),
    diubah_oleh: k.session.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id' })
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan peserta.' }
  segarkan()
  return { success: true }
}

export async function ubahCapaianAwalTRAction(studentId: string, capaianAwal: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const { error } = await createServerClient().from('tr_peserta')
    .update({ capaian_awal: potong(capaianAwal, 200), diubah_oleh: k.session.userId, updated_at: new Date().toISOString() })
    .eq('student_id', studentId)
  if (error) return { error: 'Gagal menyimpan capaian awal.' }
  segarkan()
  return { success: true }
}

// ─── Kehadiran Jum'at (pengampu) ─────────────────────────────────────────────

const STATUS: StatusHadirTR[] = ['hadir', 'izin', 'sakit', 'alfa']

/**
 * Kehadiran satu Jum'at, dicatat akun TR. Tiap anak diperiksa lewat aturan
 * yang sama dengan setorannya (bolehTR). null = hapus catatan.
 */
export async function simpanHadirTRAction(tanggal: string, hadir: Record<string, StatusHadirTR | null>): Promise<Hasil & { tersimpan?: number }> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const supabase = createServerClient()
  let tersimpan = 0
  for (const [studentId, status] of Object.entries(hadir)) {
    if (status !== null && !STATUS.includes(status)) return { error: 'Status kehadiran tidak dikenal.' }
    if (!(await bolehTR(session.teacherId, studentId, tanggal))) {
      return { error: 'Ada siswa yang bukan peserta kelompok Anda, atau Jum’at itu tidak bisa dicatat.' }
    }
    const { error } = status === null
      ? await supabase.from('tr_hadir').delete().eq('student_id', studentId).eq('tanggal', tanggal)
      : await supabase.from('tr_hadir').upsert(
          { student_id: studentId, tanggal, status, dicatat_oleh: session.teacherId, updated_at: new Date().toISOString() },
          { onConflict: 'student_id,tanggal' },
        )
    if (error) return { error: 'Gagal menyimpan kehadiran.' }
    tersimpan++
  }
  revalidatePath('/guru/tahsin-rekomendasi', 'layout')
  return { success: true, tersimpan }
}
