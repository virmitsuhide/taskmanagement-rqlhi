'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageUjian, canSubmitUjian, getUjianUnits } from '@/lib/auth/permissions'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { totalJuzHafalan } from '@/lib/rq/hafalan'
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
  /** Siswa terpilih dari saran. null hanya untuk anak yang belum terdaftar. */
  student_id: string | null
  nama_siswa: string
  nama_flyer: string
  kelas: string
  is_quls: boolean
  unit?: UjianUnit
}): Promise<Result> {

  const pengaju = await guardPengaju(input.unit)
  if ('error' in pengaju) return pengaju

  const juz = input.juz.trim()
  const namaSiswa = input.nama_siswa.trim()
  const namaFlyer = input.nama_flyer.trim()
  const kelas = input.kelas.trim()

  if (!juz) return { error: 'Nomor atau rentang juz wajib diisi.' }
  if (!namaSiswa) return { error: 'Nama siswa wajib diisi.' }
  if (!namaFlyer) return { error: 'Nama untuk flyer wajib diisi.' }
  if (!kelas) return { error: 'Kelas wajib diisi.' }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahfidz').insert({
      unit: pengaju.unit,
      tipe: input.tipe,
      juz,
      student_id: input.student_id,
      nama_siswa: namaSiswa,
      nama_flyer: namaFlyer,
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
    nama_flyer?: string
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

/**
 * Menambah penguji dari guru yang sudah terdaftar (0054).
 *
 * Menerima id guru, BUKAN nama yang diketik. Sebelas entri pertama daftar ini
 * lahir dari kolom teks bebas, dan hasilnya panggilan sehari-hari yang tidak
 * pernah bisa dicocokkan kembali dengan akun mana pun — termasuk dua yang
 * cocok dengan lebih dari satu guru sekaligus. Salah ketik satu huruf dulu
 * melahirkan penguji baru yang sah tanpa ada yang memberi tahu.
 *
 * Namanya disalin dari full_name saat penambahan, bukan dibaca ulang tiap
 * kali ditampilkan: nama itu yang akan tercetak di rapor ujian, dan rapor
 * lama tidak boleh ikut berubah ketika gelar seorang guru bertambah.
 */
export async function createPengujiAction(teacherId: string): Promise<Result> {
  const izin = await guardPenguji()
  if ('error' in izin) return izin

  if (!teacherId) return { error: 'Pilih dulu gurunya dari daftar.' }

  try {
    const supabase = createServerClient()

    const { data: guru } = await supabase
      .from('teachers')
      .select('full_name')
      .eq('id', teacherId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!guru) return { error: 'Guru itu tidak ditemukan.' }

    const { error } = await supabase
      .from('ujian_pengujis')
      .insert({ nama: (guru.full_name as string).trim(), teacher_id: teacherId })

    if (error) {
      // 23505 = unique_violation — bisa dari nama yang kembar dengan entri
      // warisan, bisa dari guru yang sudah terdaftar lewat indeks teacher_id.
      if (error.code === '23505') return { error: 'Guru itu sudah ada di daftar penguji.' }
      if (error.message.includes('teacher_id')) {
        return { error: 'Penautan penguji belum aktif: jalankan drizzle/0054_kategori_unit_lain_dan_penguji_guru_PASTE_TO_SUPABASE.sql di Supabase.' }
      }
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

// ─── Saran siswa untuk form pengajuan ────────────────────────────────────────

export interface SaranSiswa {
  id: string
  full_name: string
  kelas: string | null
  /** Program siswa; dipakai mencentang QULS otomatis. */
  program: string | null
  /** Posisi juz terjauh yang sudah tercatat. 0 = belum pernah ujian. */
  sudahSampai: number
}

/**
 * Mencari siswa untuk saran nama di form pengajuan.
 *
 * Unit ujian dipetakan ke jenjang, jadi pengaju SD tidak pernah melihat anak
 * SMP — bukan sekadar merapikan daftar, tapi supaya nama anak unit lain tidak
 * bocor ke koordinator yang tidak mengurusnya.
 *
 * Capaian juz ikut dibawa pulang sekalian. Memisahkannya jadi permintaan
 * kedua berarti daftar juz baru menyempit setelah nama dipilih, dan sekejap
 * di antaranya pengaju sempat melihat juz yang sebenarnya sudah lewat.
 */
export async function cariSiswaUjianAction(
  unit: UjianUnit,
  kueri: string,
): Promise<SaranSiswa[]> {
  const pengaju = await guardPengaju(unit)
  if ('error' in pengaju) return []

  const q = kueri.trim()
  if (q.length < 2) return []

  const supabase = createServerClient()
  // 'SD' mencakup SD reguler dan SD Juara; keduanya diuji di antrean yang sama.
  const jenjang = pengaju.unit === 'SD' ? ['sd', 'sd_juara'] : ['smp']

  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas, program')
    .in('jenjang', jenjang)
    .eq('is_active', true)
    .ilike('full_name', `%${q}%`)
    .order('full_name')
    .limit(8)

  if (!siswa || siswa.length === 0) return []

  const { data: ujian } = await supabase
    .from('ujian_tahfidz')
    .select('student_id, juz')
    .in('student_id', siswa.map(s => s.id))

  const perSiswa = new Map<string, string[]>()
  for (const u of ujian ?? []) {
    if (!u.student_id) continue
    const daftar = perSiswa.get(u.student_id) ?? []
    daftar.push(String(u.juz))
    perSiswa.set(u.student_id, daftar)
  }

  return siswa.map(s => ({
    id: s.id,
    full_name: s.full_name,
    kelas: s.kelas,
    program: s.program,
    sudahSampai: totalJuzHafalan(perSiswa.get(s.id) ?? []),
  }))
}

// ─── Pemetaan catatan lama ke siswa ──────────────────────────────────────────

/**
 * Memasangkan catatan ujian lama ke siswa.
 *
 * 36 dari 38 catatan yang ada dibuat sebelum ada tautan ke siswa, dan namanya
 * sudah tersingkat sehingga tidak bisa dicocokkan otomatis. Pemasangannya
 * dikerjakan manusia yang mengenali anaknya — pencocokan tebak-tebakan atas
 * inisial berisiko menaruh capaian juz pada anak yang keliru, dan salah pasang
 * seperti itu baru ketahuan berbulan-bulan kemudian lewat analitik yang aneh.
 *
 * nama_siswa ikut ditimpa nama lengkap dari data siswa. Nilai lamanya sudah
 * pindah ke nama_flyer lewat migrasi 0059, jadi tidak ada yang hilang.
 */
export async function petakanUjianKeSiswaAction(
  ujianId: string,
  studentId: string,
): Promise<Result> {
  const guard = await guardPengelola('ujian_tahfidz', ujianId)
  if ('error' in guard) return guard

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas')
    .eq('id', studentId)
    .maybeSingle()

  if (!siswa) return { error: 'Siswa tidak ditemukan.' }

  const { error } = await supabase
    .from('ujian_tahfidz')
    .update({
      student_id: siswa.id,
      nama_siswa: siswa.full_name,
      kelas: siswa.kelas ?? '',
    })
    .eq('id', ujianId)

  if (error) return { error: error.message }

  segarkan()
  revalidatePath('/ujian/pemetaan')
  revalidatePath(`/siswa/${siswa.id}`)
  return { success: true }
}

/** Melepas tautan yang terlanjur salah pasang. */
export async function lepasPemetaanUjianAction(ujianId: string): Promise<Result> {
  const guard = await guardPengelola('ujian_tahfidz', ujianId)
  if ('error' in guard) return guard

  const supabase = createServerClient()
  const { error } = await supabase
    .from('ujian_tahfidz')
    .update({ student_id: null })
    .eq('id', ujianId)

  if (error) return { error: error.message }

  segarkan()
  revalidatePath('/ujian/pemetaan')
  return { success: true }
}
