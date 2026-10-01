'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageAsrama } from '@/lib/auth/permissions'
import { levelSah } from '@/lib/rq/asrama'
import { PROGRAM_BOARDING } from '@/lib/data/asrama'

type Hasil = { error?: string; success?: boolean }

/**
 * Pengelolaan halaqoh asrama (0110): kelompok, pengampu, anggota, level.
 *
 * Setiap tindakan diperiksa terhadap GENDER kelompok yang disentuh — BPA
 * hanya asrama putra, BPI hanya putri — bukan sekadar role. Tombol yang
 * disembunyikan di halaman tidak menghentikan FormData yang disusun sendiri.
 */

async function gerbang(gender: 'L' | 'P' | null | undefined): Promise<{ userId: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!gender || !canManageAsrama(session.role, gender)) {
    return { error: gender === 'L' ? 'Hanya pengelola asrama putra yang boleh mengubah ini.' : gender === 'P' ? 'Hanya pengelola asrama putri yang boleh mengubah ini.' : 'Anda tidak berwenang.' }
  }
  return { userId: session.userId }
}

async function genderKelompok(id: string): Promise<'L' | 'P' | null> {
  const { data } = await createServerClient().from('asrama_kelompok').select('gender').eq('id', id).maybeSingle()
  return (data as { gender: 'L' | 'P' } | null)?.gender ?? null
}

function segarkan() {
  revalidatePath('/asrama')
  revalidatePath('/guru/asrama')
}

// ── Kelompok ─────────────────────────────────────────────────────────────────

export async function simpanKelompokAction(input: {
  id?: string
  nama: string
  gender: 'L' | 'P'
  pengampu_id: string | null
}): Promise<Hasil> {
  const nama = input.nama.trim()
  if (!nama) return { error: 'Nama kelompok wajib diisi.' }
  // Gender kelompok lama yang menentukan wewenang, bukan isian baru — kalau
  // tidak, BPA bisa "memindahkan" kelompok putri dengan mengganti gendernya.
  const gender = input.id ? await genderKelompok(input.id) : input.gender
  const izin = await gerbang(gender)
  if ('error' in izin) return izin

  const supabase = createServerClient()
  const baris = { nama, pengampu_id: input.pengampu_id || null, updated_at: new Date().toISOString() }
  const { error } = input.id
    ? await supabase.from('asrama_kelompok').update(baris).eq('id', input.id)
    : await supabase.from('asrama_kelompok').insert({ ...baris, gender })
  if (error) return { error: error.message || 'Gagal menyimpan kelompok.' }
  segarkan()
  return { success: true }
}

/** Hapus kelompok; anggotanya kembali "belum berkelompok". Setoran tidak tersentuh. */
export async function hapusKelompokAction(id: string): Promise<Hasil> {
  const izin = await gerbang(await genderKelompok(id))
  if ('error' in izin) return izin
  const { error } = await createServerClient().from('asrama_kelompok').delete().eq('id', id)
  if (error) return { error: error.message || 'Gagal menghapus kelompok.' }
  segarkan()
  return { success: true }
}

// ── Anggota & level ──────────────────────────────────────────────────────────

/**
 * Masukkan anak ke kelompok (atau pindahkan dari kelompok lain), dengan
 * levelnya. Hanya anak boarding SMP aktif yang gendernya sama dengan
 * asramanya.
 */
export async function aturAnggotaAction(kelompokId: string, studentId: string, level: string | null): Promise<Hasil> {
  const gender = await genderKelompok(kelompokId)
  const izin = await gerbang(gender)
  if ('error' in izin) return izin

  const supabase = createServerClient()
  const [{ data: siswa }, { data: lama }] = await Promise.all([
    supabase.from('students').select('gender, jenjang, program, is_active').eq('id', studentId).maybeSingle(),
    supabase.from('asrama_anggota').select('kelompok:asrama_kelompok!asrama_anggota_kelompok_id_fkey(gender)').eq('student_id', studentId).maybeSingle(),
  ])
  const s = siswa as { gender: string | null; jenjang: string; program: string | null; is_active: boolean } | null
  if (!s?.is_active) return { error: 'Siswa tidak ditemukan atau tidak aktif.' }
  if (s.jenjang !== 'smp' || !PROGRAM_BOARDING.includes(s.program as typeof PROGRAM_BOARDING[number])) {
    return { error: 'Hanya siswa boarding SMP yang bisa masuk kelompok asrama.' }
  }
  if (s.gender !== gender) return { error: 'Gender siswa tidak sesuai dengan asrama kelompok ini.' }
  // Memindahkan anak dari kelompok asrama lain juga mengubah kelompok itu.
  const genderLama = (lama as unknown as { kelompok: { gender: 'L' | 'P' } | null } | null)?.kelompok?.gender
  if (genderLama && genderLama !== gender) {
    const izinLama = await gerbang(genderLama)
    if ('error' in izinLama) return izinLama
  }

  const { error } = await supabase.from('asrama_anggota').upsert({
    student_id: studentId,
    kelompok_id: kelompokId,
    level: levelSah(level),
    diubah_oleh: izin.userId,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message || 'Gagal menyimpan anggota.' }
  segarkan()
  return { success: true }
}

async function genderAnggota(studentId: string): Promise<'L' | 'P' | null> {
  const { data } = await createServerClient()
    .from('asrama_anggota')
    .select('kelompok:asrama_kelompok!asrama_anggota_kelompok_id_fkey(gender)')
    .eq('student_id', studentId)
    .maybeSingle()
  return (data as unknown as { kelompok: { gender: 'L' | 'P' } | null } | null)?.kelompok?.gender ?? null
}

export async function ubahLevelAction(studentId: string, level: string | null): Promise<Hasil> {
  const izin = await gerbang(await genderAnggota(studentId))
  if ('error' in izin) return izin
  const { error } = await createServerClient()
    .from('asrama_anggota')
    .update({ level: levelSah(level), diubah_oleh: izin.userId, updated_at: new Date().toISOString() })
    .eq('student_id', studentId)
  if (error) return { error: error.message || 'Gagal mengubah level.' }
  segarkan()
  return { success: true }
}

export async function keluarkanAnggotaAction(studentId: string): Promise<Hasil> {
  const izin = await gerbang(await genderAnggota(studentId))
  if ('error' in izin) return izin
  const { error } = await createServerClient().from('asrama_anggota').delete().eq('student_id', studentId)
  if (error) return { error: error.message || 'Gagal mengeluarkan anggota.' }
  segarkan()
  return { success: true }
}
