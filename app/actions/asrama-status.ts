'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageAsrama, canVerifikasiAsrama } from '@/lib/auth/permissions'
import { kelasFullday, terapkanPengajuanJatuhTempo, type AlasanNonaktif, type JenisCuti } from '@/lib/data/asrama-status'
import { PROGRAMS_BY_JENJANG } from '@/lib/rq/programs'

type Hasil = { error?: string; success?: boolean }

/**
 * Cuti/sakit & pengajuan nonaktif anak asrama (0119).
 *
 * Cuti/sakit: Div Qur'an BPA/BPI langsung menandai, anak tetap di kelompok.
 * Nonaktif: Div mengajukan, Koor SMP (atau Kepala RQ/Kumik) memutuskan
 * setelah mengonfirmasi ke kesiswaan SMP.
 */

const BELUM_MIGRASI = 'Fitur ini belum aktif — migrasi 0119 belum dijalankan di Supabase.'
const PROGRAM_FULLDAY = ['reguler_fd', 'fullday_quls']

function pesan(error: { message?: string; code?: string } | null, cadangan: string): string {
  if (!error) return cadangan
  // 42703 kolom tidak ada, 42P01 / PGRST205 tabel tidak ada.
  if (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') return BELUM_MIGRASI
  return error.message || cadangan
}

function tanggalSah(v: string | null | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

function segarkan() {
  revalidatePath('/asrama')
  revalidatePath('/asrama/pengajuan')
  revalidatePath('/guru/asrama')
}

/** Anggota asrama beserta gender kelompoknya; null = bukan anggota. */
async function anggota(studentId: string) {
  const { data } = await createServerClient()
    .from('asrama_anggota')
    .select('kelompok_id, kelompok:asrama_kelompok!asrama_anggota_kelompok_id_fkey(nama, gender)')
    .eq('student_id', studentId)
    .maybeSingle()
  const r = data as unknown as { kelompok_id: string; kelompok: { nama: string; gender: 'L' | 'P' } | null } | null
  return r?.kelompok ? { kelompok_id: r.kelompok_id, nama: r.kelompok.nama, gender: r.kelompok.gender } : null
}

async function gerbangKelola(studentId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' } as const
  const a = await anggota(studentId)
  if (!a) return { error: 'Anak ini bukan anggota kelompok asrama.' } as const
  if (!canManageAsrama(session.role, a.gender)) {
    return { error: a.gender === 'L' ? 'Hanya pengelola asrama putra yang boleh mengubah ini.' : 'Hanya pengelola asrama putri yang boleh mengubah ini.' } as const
  }
  return { userId: session.userId, anggota: a } as const
}

// ── Cuti / sakit ─────────────────────────────────────────────────────────────

export async function tandaiCutiAction(input: {
  studentId: string
  jenis: JenisCuti
  sejak: string
  kembali?: string | null
  catatan?: string | null
}): Promise<Hasil> {
  const izin = await gerbangKelola(input.studentId)
  if ('error' in izin) return { error: izin.error }
  if (input.jenis !== 'sakit' && input.jenis !== 'cuti') return { error: 'Pilih sakit atau cuti.' }
  const sejak = tanggalSah(input.sejak)
  if (!sejak) return { error: 'Tanggal mulai wajib diisi.' }
  const kembali = tanggalSah(input.kembali)
  if (kembali && kembali < sejak) return { error: 'Perkiraan kembali tidak boleh sebelum tanggal mulai.' }

  const { error } = await createServerClient().from('asrama_anggota').update({
    cuti_jenis: input.jenis,
    cuti_sejak: sejak,
    cuti_kembali: kembali,
    cuti_catatan: input.catatan?.trim() || null,
    diubah_oleh: izin.userId,
    updated_at: new Date().toISOString(),
  }).eq('student_id', input.studentId)
  if (error) return { error: pesan(error, 'Gagal menyimpan cuti.') }
  segarkan()
  return { success: true }
}

export async function akhiriCutiAction(studentId: string): Promise<Hasil> {
  const izin = await gerbangKelola(studentId)
  if ('error' in izin) return { error: izin.error }
  const { error } = await createServerClient().from('asrama_anggota').update({
    cuti_jenis: null, cuti_sejak: null, cuti_kembali: null, cuti_catatan: null,
    diubah_oleh: izin.userId, updated_at: new Date().toISOString(),
  }).eq('student_id', studentId)
  if (error) return { error: pesan(error, 'Gagal mengakhiri cuti.') }
  segarkan()
  return { success: true }
}

// ── Pengajuan nonaktif ───────────────────────────────────────────────────────

export async function ajukanNonaktifAction(input: {
  studentId: string
  alasan: AlasanNonaktif
  tanggalEfektif: string
  catatan?: string | null
}): Promise<Hasil> {
  const izin = await gerbangKelola(input.studentId)
  if ('error' in izin) return { error: izin.error }
  if (!['fullday', 'pindah_sekolah', 'lainnya'].includes(input.alasan)) return { error: 'Pilih alasan.' }
  const tanggal = tanggalSah(input.tanggalEfektif)
  if (!tanggal) return { error: 'Tanggal efektif wajib diisi.' }
  const catatan = input.catatan?.trim() || null
  if (input.alasan === 'lainnya' && !catatan) return { error: 'Tuliskan alasannya di catatan.' }

  const { error } = await createServerClient().from('asrama_pengajuan_nonaktif').insert({
    student_id: input.studentId,
    kelompok_id: izin.anggota.kelompok_id,
    kelompok_nama: izin.anggota.nama,
    gender: izin.anggota.gender,
    alasan: input.alasan,
    tanggal_efektif: tanggal,
    catatan,
    diajukan_oleh: izin.userId,
  })
  if (error?.code === '23505') return { error: 'Anak ini sudah punya pengajuan yang menunggu verifikasi.' }
  if (error) return { error: pesan(error, 'Gagal mengirim pengajuan.') }
  segarkan()
  return { success: true }
}

/** Pengaju (atau pengelola asrama yang sama) membatalkan pengajuan yang masih menunggu. */
export async function batalkanPengajuanAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  const supabase = createServerClient()
  const { data } = await supabase.from('asrama_pengajuan_nonaktif').select('gender, status').eq('id', id).maybeSingle()
  const p = data as { gender: 'L' | 'P'; status: string } | null
  if (!p) return { error: 'Pengajuan tidak ditemukan.' }
  if (!canManageAsrama(session.role, p.gender)) return { error: 'Anda tidak berwenang membatalkan pengajuan ini.' }
  if (p.status !== 'menunggu') return { error: 'Pengajuan ini sudah diputuskan.' }
  const { error } = await supabase.from('asrama_pengajuan_nonaktif')
    .update({ status: 'dibatalkan', diputuskan_oleh: session.userId, diputuskan_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'menunggu')
  if (error) return { error: pesan(error, 'Gagal membatalkan.') }
  segarkan()
  return { success: true }
}

/**
 * Koor SMP memutuskan. Setujui wajib sudah dikonfirmasi ke kesiswaan SMP;
 * pindah ke fullday wajib memilih program tujuan. Tolak wajib bercatatan.
 */
export async function putuskanPengajuanAction(input: {
  id: string
  setujui: boolean
  sudahKonfirmasi: boolean
  catatan?: string | null
  programBaru?: string | null
}): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canVerifikasiAsrama(session.role)) return { error: 'Hanya Koor SMP yang memverifikasi pengajuan ini.' }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('asrama_pengajuan_nonaktif')
    .select('status, alasan, gender, siswa:students!asrama_pengajuan_nonaktif_student_id_fkey(kelas)')
    .eq('id', input.id).maybeSingle()
  const p = data as unknown as { status: string; alasan: AlasanNonaktif; gender: 'L' | 'P'; siswa: { kelas: string | null } | null } | null
  if (!p) return { error: 'Pengajuan tidak ditemukan.' }
  if (p.status !== 'menunggu') return { error: 'Pengajuan ini sudah diputuskan.' }

  const catatan = input.catatan?.trim() || null
  const ubah: Record<string, unknown> = {
    diputuskan_oleh: session.userId,
    diputuskan_at: new Date().toISOString(),
    catatan_verifikasi: catatan,
  }
  if (input.setujui) {
    if (!input.sudahKonfirmasi) return { error: 'Centang dulu bahwa sudah dikonfirmasi ke kesiswaan SMP.' }
    if (p.alasan === 'fullday') {
      const program = input.programBaru ?? ''
      const sah = PROGRAMS_BY_JENJANG.smp.some(x => x.code === program) && PROGRAM_FULLDAY.includes(program)
      if (!sah) return { error: 'Pilih program fullday tujuan.' }
      ubah.program_baru = program
      ubah.kelas_baru = kelasFullday(p.siswa?.kelas ?? null, p.gender)
    }
    ubah.status = 'disetujui'
  } else {
    if (!catatan) return { error: 'Tuliskan catatan alasan penolakan.' }
    ubah.status = 'ditolak'
  }

  const { error } = await supabase.from('asrama_pengajuan_nonaktif').update(ubah).eq('id', input.id).eq('status', 'menunggu')
  if (error) return { error: pesan(error, 'Gagal menyimpan keputusan.') }
  if (input.setujui) await terapkanPengajuanJatuhTempo()
  segarkan()
  revalidatePath('/siswa')
  return { success: true }
}
