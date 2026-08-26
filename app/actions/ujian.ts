'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageUjian, canSubmitUjian, getUjianUnits } from '@/lib/auth/permissions'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import type {
  TahfidzTipe,
  UjianPredikat,
  UjianSiswa,
  UjianStatus,
  UjianUnit,
} from '@/types'

type Result = { error?: string; success?: boolean }

/**
 * Halaman yang perlu disegarkan setiap pengajuan berubah.
 *
 * Antrian publik dan rekap ikut di sini karena keduanya di-cache; tanpa ini
 * pengunjung masih melihat antrian lama sampai revalidate berikutnya.
 */
function segarkan() {
  revalidatePath('/ujian')
  revalidatePath('/ujian/rekap')
  revalidatePath('/ujian/kelola')
  revalidatePath('/ujian/riwayat')
  revalidatePath('/guru/ujian')
}

// ─── Penjagaan ───────────────────────────────────────────────────────────────

interface Pengaju {
  unit: UjianUnit
  teacherId: string | null
  userId: string | null
}

/**
 * Siapa yang mengajukan, dan untuk unit mana.
 *
 * Unit TIDAK pernah diambil dari form untuk jalur guru — ia dibaca dari data
 * kepegawaian guru itu. Kalau ikut form, seorang guru SD bisa menyisipkan
 * pengajuan ke antrian SMP hanya dengan mengubah kiriman di peramban.
 *
 * Untuk pengurus, unit memang datang dari form (kepala & kumik memegang dua
 * unit sekaligus), tapi diperiksa balik ke wewenang role-nya.
 */
async function guardPengaju(unitDiminta?: UjianUnit): Promise<Pengaju | { error: string }> {
  const guru = await getTeacherSession()
  if (guru) {
    const unit = await getUnitUjianGuru(guru.teacherId)
    if (!unit) {
      return { error: 'Akun Anda belum punya unit SD/SMP, jadi belum bisa mengajukan ujian. Hubungi koordinator.' }
    }
    return { unit, teacherId: guru.teacherId, userId: null }
  }

  const pengurus = await getSession()
  if (pengurus && canSubmitUjian(pengurus.role)) {
    const units = getUjianUnits(pengurus.role)
    const unit = unitDiminta && units.includes(unitDiminta) ? unitDiminta : units[0]
    if (!unit) return { error: 'Anda tidak berwenang mengajukan ujian.' }
    return { unit, teacherId: null, userId: pengurus.userId }
  }

  return { error: 'Sesi tidak valid atau tidak memiliki izin.' }
}

/**
 * Boleh menjadwalkan/menilai/menghapus baris ini?
 *
 * Unit dibaca ulang dari database, bukan dari kiriman: id pengajuan datang
 * dari peramban, dan hanya baris aslinya yang tahu ia milik unit mana.
 */
async function guardPengelola(
  table: 'ujian_tahfidz' | 'ujian_tahsin',
  id: string,
): Promise<{ unit: UjianUnit } | { error: string }> {
  if (!id) return { error: 'Pengajuan tidak dikenali.' }

  const pengurus = await getSession()
  if (!pengurus) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data } = await supabase.from(table).select('unit').eq('id', id).maybeSingle()
  if (!data) return { error: 'Pengajuan tidak ditemukan.' }

  const unit = data.unit as UjianUnit
  if (!canManageUjian(pengurus.role, unit)) {
    return { error: `Anda tidak berwenang mengelola antrian unit ${unit}.` }
  }
  return { unit }
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

export async function createTahfidzUjianAction(input: {
  tipe: TahfidzTipe
  juz: string
  nama_siswa: string
  nama_ayah: string
  kelas: string
  is_quls: boolean
  unit?: UjianUnit
}): Promise<Result> {
  const pengaju = await guardPengaju(input.unit)
  if ('error' in pengaju) return pengaju

  const juz = input.juz.trim()
  const namaSiswa = input.nama_siswa.trim()
  const namaAyah = input.nama_ayah.trim()
  const kelas = input.kelas.trim()

  if (!juz) return { error: 'Nomor atau rentang juz wajib diisi.' }
  if (!namaSiswa) return { error: 'Nama siswa wajib diisi.' }
  if (!namaAyah) return { error: 'Nama ayah wajib diisi.' }
  if (!kelas) return { error: 'Kelas wajib diisi.' }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahfidz').insert({
      unit: pengaju.unit,
      tipe: input.tipe,
      juz,
      nama_siswa: namaSiswa,
      nama_ayah: namaAyah,
      kelas,
      is_quls: input.is_quls,
      status: 'diajukan',
      created_by_teacher: pengaju.teacherId,
      created_by_user: pengaju.userId,
    })
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan pengajuan.' }
  }

  segarkan()
  return { success: true }
}

export async function updateTahfidzUjianAction(
  id: string,
  data: {
    jadwal?: string | null
    penguji?: string | null
    predikat?: UjianPredikat | null
    catatan?: string | null
    nama_ayah?: string
    status?: UjianStatus
    is_quls?: boolean
  },
): Promise<Result> {
  const guard = await guardPengelola('ujian_tahfidz', id)
  if ('error' in guard) return guard

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahfidz').update(data).eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan perubahan.' }
  }

  segarkan()
  return { success: true }
}

export async function deleteTahfidzUjianAction(id: string): Promise<Result> {
  const izin = await guardHapus('ujian_tahfidz', id)
  if ('error' in izin) return izin

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahfidz').delete().eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghapus pengajuan.' }
  }

  segarkan()
  return { success: true }
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

export async function createTahsinUjianAction(input: {
  nama_kelompok: string
  sesi: string
  level: string
  siswa: UjianSiswa[]
  unit?: UjianUnit
}): Promise<Result> {
  const pengaju = await guardPengaju(input.unit)
  if ('error' in pengaju) return pengaju

  const namaKelompok = input.nama_kelompok.trim()
  const sesi = input.sesi.trim()
  const siswa = input.siswa
    .map(s => ({ nama: s.nama.trim(), predikat: null, level: s.level?.trim() || undefined }))
    .filter(s => s.nama)

  if (!namaKelompok) return { error: 'Nama kelompok wajib diisi.' }
  if (!sesi) return { error: 'Sesi wajib diisi.' }
  if (siswa.length === 0) return { error: 'Tambahkan minimal satu siswa.' }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahsin').insert({
      unit: pengaju.unit,
      nama_kelompok: namaKelompok,
      sesi,
      level: input.level.trim(),
      siswa,
      status: 'diajukan',
      created_by_teacher: pengaju.teacherId,
      created_by_user: pengaju.userId,
    })
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan pengajuan.' }
  }

  segarkan()
  return { success: true }
}

export async function updateTahsinUjianAction(
  id: string,
  data: {
    jadwal?: string | null
    penguji?: string | null
    siswa?: UjianSiswa[]
    catatan?: string | null
    status?: UjianStatus
  },
): Promise<Result> {
  const guard = await guardPengelola('ujian_tahsin', id)
  if ('error' in guard) return guard

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahsin').update(data).eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan perubahan.' }
  }

  segarkan()
  return { success: true }
}

export async function deleteTahsinUjianAction(id: string): Promise<Result> {
  const izin = await guardHapus('ujian_tahsin', id)
  if ('error' in izin) return izin

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahsin').delete().eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghapus pengajuan.' }
  }

  segarkan()
  return { success: true }
}

/**
 * Boleh menghapus pengajuan ini?
 *
 * Dua jalur. Koordinator unitnya boleh kapan saja — itu wewenang pengelolaan
 * biasa. Guru hanya boleh menarik pengajuannya SENDIRI dan hanya selagi masih
 * berstatus 'diajukan': begitu koordinator menjadwalkannya, jadwal itu sudah
 * jadi kesepakatan dengan penguji dan tidak boleh hilang sepihak.
 */
async function guardHapus(
  table: 'ujian_tahfidz' | 'ujian_tahsin',
  id: string,
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: 'Pengajuan tidak dikenali.' }

  const supabase = createServerClient()
  const { data } = await supabase
    .from(table)
    .select('unit, status, created_by_teacher')
    .eq('id', id)
    .maybeSingle()
  if (!data) return { error: 'Pengajuan tidak ditemukan.' }

  const guru = await getTeacherSession()
  if (guru) {
    if (data.created_by_teacher !== guru.teacherId) {
      return { error: 'Anda hanya bisa menarik pengajuan yang Anda buat sendiri.' }
    }
    if (data.status !== 'diajukan') {
      return { error: 'Pengajuan yang sudah dijadwalkan hanya bisa dibatalkan koordinator.' }
    }
    return { ok: true }
  }

  const pengurus = await getSession()
  if (pengurus && canManageUjian(pengurus.role, data.unit as UjianUnit)) return { ok: true }

  return { error: 'Anda tidak berwenang menghapus pengajuan ini.' }
}

// ─── Daftar penguji ──────────────────────────────────────────────────────────

async function guardPenguji(): Promise<{ ok: true } | { error: string }> {
  const pengurus = await getSession()
  if (!pengurus || getUjianUnits(pengurus.role).length === 0) {
    return { error: 'Anda tidak berwenang mengelola daftar penguji.' }
  }
  return { ok: true }
}

export async function createPengujiAction(nama: string): Promise<Result> {
  const izin = await guardPenguji()
  if ('error' in izin) return izin

  const bersih = nama.trim()
  if (bersih.length < 2) return { error: 'Nama penguji minimal 2 karakter.' }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_pengujis').insert({ nama: bersih })
    if (error) {
      // 23505 = unique_violation
      if (error.code === '23505') return { error: 'Nama penguji itu sudah ada di daftar.' }
      return { error: error.message }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menambah penguji.' }
  }

  revalidatePath('/ujian/penguji')
  revalidatePath('/ujian/kelola')
  return { success: true }
}

export async function deletePengujiAction(id: string): Promise<Result> {
  const izin = await guardPenguji()
  if ('error' in izin) return izin

  try {
    const supabase = createServerClient()
    // Ujian lampau menyimpan nama penguji sebagai teks, bukan id, jadi
    // menghapus dari daftar tidak menghilangkan jejaknya di riwayat.
    const { error } = await supabase.from('ujian_pengujis').delete().eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghapus penguji.' }
  }

  revalidatePath('/ujian/penguji')
  revalidatePath('/ujian/kelola')
  return { success: true }
}

// ─── Badge "pengajuan baru" ──────────────────────────────────────────────────

/** Tandai antrian sudah dilihat — dipanggil saat halaman kelola dibuka. */
export async function markUjianSeenAction(): Promise<void> {
  const pengurus = await getSession()
  if (!pengurus || getUjianUnits(pengurus.role).length === 0) return

  try {
    const supabase = createServerClient()
    await supabase
      .from('users')
      .update({ ujian_seen_at: new Date().toISOString() })
      .eq('id', pengurus.userId)
  } catch {
    // Penanda badge, bukan data inti — gagal menyimpannya tidak perlu
    // menggagalkan halaman yang sedang dibuka.
  }
}
