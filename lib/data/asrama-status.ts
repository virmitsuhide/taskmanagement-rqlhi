import { createServerClient } from '@/lib/supabase/server'
import { hariIniWIB } from '@/lib/data/riyadhoh'
import type { AlasanNonaktif, JenisCuti, StatusPengajuan } from '@/lib/rq/asrama-status'

export * from '@/lib/rq/asrama-status'

/**
 * Cuti/sakit & pengajuan nonaktif anak asrama (0119).
 *
 * Semua pembacaan menoleransi kolom/tabel yang belum ada (migrasi belum
 * dijalankan): hasilnya kosong, bukan galat.
 */

export interface CutiAnggota {
  student_id: string
  jenis: JenisCuti
  sejak: string | null
  kembali: string | null
  catatan: string | null
}

/** Anggota yang sedang cuti/sakit, per student_id. Migrasi belum ada = kosong. */
export async function getCutiAsrama(): Promise<Map<string, CutiAnggota>> {
  const hasil = new Map<string, CutiAnggota>()
  const { data, error } = await createServerClient()
    .from('asrama_anggota')
    .select('student_id, cuti_jenis, cuti_sejak, cuti_kembali, cuti_catatan')
    .not('cuti_jenis', 'is', null)
  if (error) return hasil
  for (const r of (data ?? []) as { student_id: string; cuti_jenis: string; cuti_sejak: string | null; cuti_kembali: string | null; cuti_catatan: string | null }[]) {
    if (r.cuti_jenis !== 'sakit' && r.cuti_jenis !== 'cuti') continue
    hasil.set(r.student_id, { student_id: r.student_id, jenis: r.cuti_jenis, sejak: r.cuti_sejak, kembali: r.cuti_kembali, catatan: r.cuti_catatan })
  }
  return hasil
}

export interface PengajuanNonaktif {
  id: string
  student_id: string
  nama: string
  kelas: string | null
  program: string | null
  kelompok_nama: string | null
  gender: 'L' | 'P'
  alasan: AlasanNonaktif
  tanggal_efektif: string
  catatan: string | null
  status: StatusPengajuan
  diajukan_oleh: string | null
  diajukan_at: string
  diputuskan_oleh: string | null
  diputuskan_at: string | null
  catatan_verifikasi: string | null
  program_baru: string | null
  kelas_baru: string | null
  diterapkan_at: string | null
}

type Row = Omit<PengajuanNonaktif, 'nama' | 'kelas' | 'program' | 'diajukan_oleh' | 'diputuskan_oleh'> & {
  siswa: { full_name: string; kelas: string | null; program: string | null } | null
  pengaju: { display_name: string } | null
  pemutus: { display_name: string } | null
}

const KOLOM = `id, student_id, kelompok_nama, gender, alasan, tanggal_efektif, catatan, status, diajukan_at,
  diputuskan_at, catatan_verifikasi, program_baru, kelas_baru, diterapkan_at,
  siswa:students!asrama_pengajuan_nonaktif_student_id_fkey(full_name, kelas, program),
  pengaju:users!asrama_pengajuan_nonaktif_diajukan_oleh_fkey(display_name),
  pemutus:users!asrama_pengajuan_nonaktif_diputuskan_oleh_fkey(display_name)`

function bentuk(r: Row): PengajuanNonaktif {
  const { siswa, pengaju, pemutus, ...sisa } = r
  return {
    ...sisa,
    nama: siswa?.full_name ?? '—',
    kelas: siswa?.kelas ?? null,
    program: siswa?.program ?? null,
    diajukan_oleh: pengaju?.display_name ?? null,
    diputuskan_oleh: pemutus?.display_name ?? null,
  }
}

/**
 * Daftar pengajuan. `sejakHari` membatasi pengajuan yang sudah diputuskan ke
 * N hari terakhir (yang menunggu selalu ikut). Migrasi belum ada = kosong.
 */
export async function getPengajuanNonaktif(opts: {
  gender?: 'L' | 'P'
  status?: StatusPengajuan
  sejakHari?: number
  batas?: number
} = {}): Promise<PengajuanNonaktif[]> {
  let q = createServerClient().from('asrama_pengajuan_nonaktif').select(KOLOM)
  if (opts.gender) q = q.eq('gender', opts.gender)
  if (opts.status) q = q.eq('status', opts.status)
  else q = q.neq('status', 'dibatalkan')
  if (opts.sejakHari) {
    const batas = new Date(Date.now() - opts.sejakHari * 86_400_000).toISOString()
    q = q.or(`status.eq.menunggu,diputuskan_at.gte.${batas}`)
  }
  const { data, error } = await q.order('diajukan_at', { ascending: false }).limit(opts.batas ?? 200)
  if (error) return []
  return ((data ?? []) as unknown as Row[]).map(bentuk)
}

export async function getPengajuanById(id: string): Promise<PengajuanNonaktif | null> {
  const { data, error } = await createServerClient().from('asrama_pengajuan_nonaktif').select(KOLOM).eq('id', id).maybeSingle()
  if (error || !data) return null
  return bentuk(data as unknown as Row)
}

/** Jumlah per status — untuk tab di halaman verifikasi. */
export async function hitungPengajuan(gender?: 'L' | 'P'): Promise<Record<'menunggu' | 'disetujui' | 'ditolak', number>> {
  const hasil = { menunggu: 0, disetujui: 0, ditolak: 0 }
  let q = createServerClient().from('asrama_pengajuan_nonaktif').select('status').neq('status', 'dibatalkan')
  if (gender) q = q.eq('gender', gender)
  const { data, error } = await q
  if (error) return hasil
  for (const r of (data ?? []) as { status: string }[]) {
    if (r.status in hasil) hasil[r.status as keyof typeof hasil]++
  }
  return hasil
}

/**
 * Jalankan pengajuan yang sudah disetujui dan tanggal efektifnya sudah tiba.
 * Dipanggil saat halaman asrama dibuka dan sesaat setelah Koor menyetujui —
 * anak yang efektifnya bulan depan tetap di kelompoknya sampai hari itu.
 *
 * Mengembalikan jumlah pengajuan yang diterapkan.
 */
export async function terapkanPengajuanJatuhTempo(): Promise<number> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('asrama_pengajuan_nonaktif')
    .select('id, student_id, alasan, program_baru, kelas_baru')
    .eq('status', 'disetujui')
    .is('diterapkan_at', null)
    .lte('tanggal_efektif', hariIniWIB())
  if (error || !data?.length) return 0

  let n = 0
  for (const p of data as { id: string; student_id: string; alasan: AlasanNonaktif; program_baru: string | null; kelas_baru: string | null }[]) {
    if (p.alasan === 'fullday' && p.program_baru) {
      const ubah: Record<string, string> = { program: p.program_baru }
      if (p.kelas_baru) ubah.kelas = p.kelas_baru
      const { error: e } = await supabase.from('students').update(ubah).eq('id', p.student_id)
      if (e) continue
    } else if (p.alasan === 'pindah_sekolah') {
      const { error: e } = await supabase.from('students').update({ is_active: false }).eq('id', p.student_id)
      if (e) continue
    }
    await supabase.from('asrama_anggota').delete().eq('student_id', p.student_id)
    await supabase.from('asrama_pengajuan_nonaktif').update({ diterapkan_at: new Date().toISOString() }).eq('id', p.id)
    n++
  }
  return n
}
