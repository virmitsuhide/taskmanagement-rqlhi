'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { bolehPulihkan } from '@/lib/backup/domain'

/**
 * Pemulihan basis data dari berkas backup — khusus Kepala RQ.
 *
 * Alurnya (lihat drizzle/0114):
 *   mulaiPemulihan  → sesi baru, staging sesi lama yang terbengkalai dibuang
 *   unggahBagian    → peramban mengirim isi berkas potongan demi potongan
 *   simulasi        → pulihkan_backup(sesi, false): angka tanpa mengubah apa pun
 *   terapkan        → pulihkan_backup(sesi, true): satu transaksi, lalu dicatat
 *   batal           → staging sesi dibuang
 *
 * Setiap aksi memeriksa wewenang sendiri — aksi server bisa dipanggil
 * langsung tanpa melewati halaman.
 */

export interface HasilTabel { berkas: number; baru: number; berubah: number; dihapus: number }

export interface HasilPemulihan {
  ok: boolean
  diterapkan: boolean
  galat?: string
  tabel_galat?: string
  tabel?: Record<string, HasilTabel>
  luar?: Record<string, { sebelum: number; sesudah: number }>
  dilewati?: string[]
}

export interface MetaBerkas {
  berkas: string
  bidang: string
  dibuat: string
}

type Hasil<T> = { success: true; data: T } | { success: false; error: string }

const NAMA_TABEL = /^[a-z_][a-z0-9_]*$/
const KONFIRMASI = 'PULIHKAN'

async function wewenang() {
  const session = await getSession()
  return session && bolehPulihkan(session.role) ? session : null
}

export async function mulaiPemulihan(): Promise<Hasil<{ sesi: string }>> {
  if (!(await wewenang())) return { success: false, error: 'Hanya Kepala RQ yang dapat memulihkan data.' }
  const supabase = createServerClient()
  const kemarin = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  await supabase.from('pulih_staging').delete().lt('dibuat', kemarin)
  return { success: true, data: { sesi: crypto.randomUUID() } }
}

export async function unggahBagian(
  sesi: string, tabel: string, bagian: number, baris: unknown[],
): Promise<Hasil<null>> {
  if (!(await wewenang())) return { success: false, error: 'Hanya Kepala RQ yang dapat memulihkan data.' }
  if (!NAMA_TABEL.test(tabel) || !Array.isArray(baris)) return { success: false, error: `Isi tabel ${tabel} tidak sah.` }
  const { error } = await createServerClient()
    .from('pulih_staging')
    .upsert({ sesi, tabel, bagian, baris }, { onConflict: 'sesi,tabel,bagian' })
  if (error) return { success: false, error: `Gagal mengunggah ${tabel}: ${error.message}` }
  return { success: true, data: null }
}

export async function simulasiPemulihan(sesi: string): Promise<Hasil<HasilPemulihan>> {
  if (!(await wewenang())) return { success: false, error: 'Hanya Kepala RQ yang dapat memulihkan data.' }
  const { data, error } = await createServerClient().rpc('pulihkan_backup', { p_sesi: sesi, p_terapkan: false })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as HasilPemulihan }
}

export async function terapkanPemulihan(
  sesi: string, meta: MetaBerkas, konfirmasi: string,
): Promise<Hasil<HasilPemulihan>> {
  const session = await wewenang()
  if (!session) return { success: false, error: 'Hanya Kepala RQ yang dapat memulihkan data.' }
  if (konfirmasi.trim().toUpperCase() !== KONFIRMASI) {
    return { success: false, error: `Ketik ${KONFIRMASI} untuk mengonfirmasi.` }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.rpc('pulihkan_backup', { p_sesi: sesi, p_terapkan: true })
  if (error) return { success: false, error: error.message }
  const hasil = data as HasilPemulihan

  if (hasil.diterapkan) {
    await supabase.from('pulih_riwayat').insert({
      oleh_id: session.userId,
      oleh: session.displayName,
      berkas: meta.berkas,
      bidang: meta.bidang,
      backup_dibuat: meta.dibuat || null,
      hasil,
    })
    // Seluruh halaman membaca data yang baru saja diganti.
    revalidatePath('/', 'layout')
  }
  return { success: true, data: hasil }
}

export async function batalPemulihan(sesi: string): Promise<Hasil<null>> {
  if (!(await wewenang())) return { success: false, error: 'Hanya Kepala RQ yang dapat memulihkan data.' }
  await createServerClient().from('pulih_staging').delete().eq('sesi', sesi)
  return { success: true, data: null }
}
