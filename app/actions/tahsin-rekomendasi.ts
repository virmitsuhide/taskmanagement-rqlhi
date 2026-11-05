'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageTahsinRekomendasi } from '@/lib/auth/permissions'
import { bolehTR, type StatusHadirTR } from '@/lib/data/tahsin-rekomendasi'
import { PASSWORD_AWAL_TR, POLA_USERNAME_TR } from '@/lib/rq/tahsin-rekomendasi'

type Hasil = { error?: string; success?: true }

const PESAN_MIGRASI = 'Tabel Tahsin Rekomendasi belum ada. Minta admin menjalankan migrasi 0115 lebih dulu.'

/** Tabel belum ada: 42P01 dari Postgres, PGRST205 dari cache skema PostgREST. */
const tabelHilang = (e: { code?: string }) => e.code === '42P01' || e.code === 'PGRST205'

async function koordinator() {
  const session = await getSession()
  if (!session) return { error: 'Sesi Anda sudah berakhir. Silakan masuk lagi.' as const }
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

/** Guru aktif yang sah dijadikan pengampu: bukan akun bersama TR, belum memegang kelompok. */
async function guruSah(teacherId: string): Promise<string | null> {
  const supabase = createServerClient()
  const [{ data: g }, { data: sudah }] = await Promise.all([
    supabase.from('teachers').select('username, is_active').eq('id', teacherId).maybeSingle(),
    supabase.from('tr_pengampu').select('teacher_id').eq('teacher_id', teacherId).maybeSingle(),
  ])
  const guru = g as { username: string; is_active: boolean | null } | null
  if (!guru || guru.is_active === false) return 'Guru tidak ditemukan atau tidak aktif.'
  if (POLA_USERNAME_TR.test(guru.username)) return 'Pilih akun guru, bukan akun bersama TR.'
  if (sudah) return 'Guru ini sudah memegang kelompok TR lain.'
  return null
}

/**
 * Buat kelompok baru dengan memilih guru yang sudah punya akun. Guru itu
 * mendapat menu Tahsin Rekomendasi di Portal Guru-nya dan mencatat setoran
 * peserta kelompoknya tiap Jum'at — tanpa akun tambahan.
 */
export async function tambahKelompokTRAction(input: { teacherId: string; tempat: string }): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }

  const supabase = createServerClient()
  const cek = await supabase.from('tr_pengampu').select('urutan')
  if (cek.error) return { error: tabelHilang(cek.error) ? PESAN_MIGRASI : 'Gagal membaca kelompok.' }
  const galat = await guruSah(input.teacherId)
  if (galat) return { error: galat }

  const urutan = Math.max(0, ...((cek.data ?? []) as { urutan: number }[]).map(r => r.urutan)) + 1
  const { error } = await supabase.from('tr_pengampu').insert({
    teacher_id: input.teacherId, tempat: potong(input.tempat, 120), urutan,
  })
  if (error) return { error: 'Gagal menyimpan kelompok.' }
  segarkan()
  return { success: true }
}

/**
 * Alihkan kelompok ke guru lain — dipakai memindahkan kelompok akun bersama
 * (TR1, TR2, …) ke akun guru asli, atau saat pengampunya berganti.
 *
 * Peserta, tempat, dan urutan ikut pindah. Riwayat setoran & kehadiran tidak
 * disentuh: tetap tercatat atas nama yang dulu mencatatnya. Akun bersama yang
 * ditinggalkan dinonaktifkan supaya tidak bisa lagi dipakai masuk.
 */
export async function alihkanKelompokTRAction(dariId: string, keId: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (dariId === keId) return { error: 'Pilih guru yang berbeda.' }

  const supabase = createServerClient()
  const { data: lama } = await supabase.from('tr_pengampu').select('tempat, urutan').eq('teacher_id', dariId).maybeSingle()
  if (!lama) return { error: 'Kelompok tidak ditemukan.' }
  const galat = await guruSah(keId)
  if (galat) return { error: galat }

  const { tempat, urutan } = lama as { tempat: string; urutan: number }
  const { error: e1 } = await supabase.from('tr_pengampu').insert({ teacher_id: keId, tempat, urutan })
  if (e1) return { error: 'Gagal mengalihkan kelompok.' }
  // tr_peserta menunjuk tr_pengampu (tanpa ON UPDATE CASCADE): baris baru dulu,
  // pesertanya dipindah, baru baris lama dihapus.
  const { error: e2 } = await supabase.from('tr_peserta')
    .update({ teacher_id: keId, diubah_oleh: k.session.userId, updated_at: new Date().toISOString() })
    .eq('teacher_id', dariId)
  if (e2) {
    await supabase.from('tr_pengampu').delete().eq('teacher_id', keId)
    return { error: 'Gagal memindahkan peserta.' }
  }
  await supabase.from('tr_pengampu').delete().eq('teacher_id', dariId)

  const { data: akun } = await supabase.from('teachers').select('username').eq('id', dariId).maybeSingle()
  if (POLA_USERNAME_TR.test((akun as { username: string } | null)?.username ?? '')) {
    await supabase.from('teachers').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', dariId)
  }
  segarkan()
  return { success: true }
}

/** Akun bersama TR (TR1, TR2, …) — hanya akun ini yang nama/sandinya diatur dari sini. */
async function akunBersama(teacherId: string): Promise<boolean> {
  const { data } = await createServerClient().from('teachers').select('username').eq('id', teacherId).maybeSingle()
  return POLA_USERNAME_TR.test((data as { username: string } | null)?.username ?? '')
}

/**
 * Ubah tempat kelompok. Nama & jenis kelamin hanya bisa diubah untuk akun
 * bersama — profil guru asli bukan wewenang koordinator TR.
 */
export async function ubahKelompokTRAction(teacherId: string, input: { nama?: string; gender?: string | null; tempat: string }): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (!(await akunTR(teacherId))) return { error: 'Kelompok tidak ditemukan.' }
  const bersama = await akunBersama(teacherId)
  const nama = potong(input.nama, 120)
  if (bersama && !nama) return { error: 'Nama pengampu wajib diisi.' }

  const supabase = createServerClient()
  const [g, t] = await Promise.all([
    bersama
      ? supabase.from('teachers').update({ full_name: nama, gender: genderSah(input.gender), updated_at: new Date().toISOString() }).eq('id', teacherId)
      : Promise.resolve({ error: null }),
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
  if (!(await akunTR(teacherId)) || !(await akunBersama(teacherId))) return { error: 'Hanya sandi akun bersama TR yang bisa diatur ulang di sini.' }
  const { error } = await createServerClient().from('teachers')
    .update({ password_hash: await bcrypt.hash(PASSWORD_AWAL_TR, 10), updated_at: new Date().toISOString() }).eq('id', teacherId)
  if (error) return { error: 'Gagal mengatur ulang sandi.' }
  return { success: true }
}

/**
 * Bubarkan kelompok: hanya bila tidak ada pesertanya lagi. Akun bersama
 * dinonaktifkan, bukan dihapus — setoran lama tetap menunjuk ke sana. Akun
 * guru asli tetap aktif; ia hanya kehilangan menu TR.
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
  if (await akunBersama(teacherId)) {
    await supabase.from('teachers').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', teacherId)
  }
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
  if (!session) return { error: 'Sesi Anda sudah berakhir. Silakan masuk lagi.' }

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
