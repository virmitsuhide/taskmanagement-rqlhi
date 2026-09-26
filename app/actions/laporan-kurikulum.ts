'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { canSetujuiLaporanKurikulum, canSusunLaporanKurikulum } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  drafNarasi, getEdisi, hitungIsiLaporan, periodeSah,
  type BarisMasalah, type NarasiLaporan,
} from '@/lib/data/laporan-kurikulum'

type Hasil = { error?: string; success?: string }

const PATH = '/laporan-kurikulum'
const PESAN_MIGRASI = 'Tabel laporan belum ada. Jalankan drizzle/0092_laporan_kurikulum_PASTE_TO_SUPABASE.sql di Supabase.'

function segarkan(periode: string) {
  revalidatePath(PATH)
  revalidatePath(`${PATH}/${periode}`)
}

/** Bulan laporan tidak boleh di masa depan. */
function bulanIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date())
}

export async function buatLaporanAction(periode: string): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canSusunLaporanKurikulum(session.role)) return { error: 'Tidak memiliki izin.' }
  if (!periodeSah(periode) || periode > bulanIniWIB()) return { error: 'Bulan laporan tidak sah.' }

  const ada = await getEdisi(periode).catch(() => null)
  if (ada) return { error: 'Laporan bulan ini sudah ada.' }

  const isi = await hitungIsiLaporan(periode)
  const { error } = await createServerClient().from('laporan_kurikulum').insert({
    periode: `${periode}-01`, status: 'draf', data: isi, narasi: drafNarasi(isi),
    dihitung_at: isi.dihitung, dibuat_oleh: session.userId,
  })
  if (error) return { error: error.code === '42P01' || error.code === 'PGRST205' ? PESAN_MIGRASI : `Gagal membuat laporan: ${error.message}` }
  segarkan(periode)
  return { success: 'Laporan dibuat.' }
}

/**
 * Hitung ulang angka — hanya selama draf. Narasi yang sudah ditulis tidak
 * disentuh; hanya kotak analisis yang masih kosong yang diisi draf baru.
 */
export async function hitungUlangLaporanAction(periode: string): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canSusunLaporanKurikulum(session.role)) return { error: 'Tidak memiliki izin.' }
  const edisi = await getEdisi(periode)
  if (!edisi) return { error: 'Laporan tidak ditemukan.' }
  if (edisi.status !== 'draf') return { error: 'Hanya laporan berstatus draf yang bisa dihitung ulang.' }

  const isi = await hitungIsiLaporan(periode)
  const draf = drafNarasi(isi)
  const narasi: NarasiLaporan = { ...edisi.narasi, analisis: { ...draf.analisis } }
  for (const [k, v] of Object.entries(edisi.narasi.analisis ?? {})) {
    const kosong = !v.analisis.trim() && !v.masalah.trim() && !v.rekomendasi.trim()
    if (!kosong) narasi.analisis[k] = v
  }
  const { error } = await createServerClient().from('laporan_kurikulum')
    .update({ data: isi, narasi, dihitung_at: isi.dihitung, updated_at: new Date().toISOString() })
    .eq('id', edisi.id).eq('status', 'draf')
  if (error) return { error: `Gagal menghitung ulang: ${error.message}` }
  segarkan(periode)
  return { success: 'Angka dihitung ulang.' }
}

const PRIORITAS = new Set(['Tinggi', 'Sedang', 'Rendah'])
const potong = (s: unknown, n: number) => String(s ?? '').slice(0, n)

/** Narasi dari formulir — dibersihkan dan dibatasi panjangnya di server. */
function bersihkanNarasi(n: NarasiLaporan): NarasiLaporan {
  const analisis: NarasiLaporan['analisis'] = {}
  for (const [k, v] of Object.entries(n.analisis ?? {})) {
    if (!/^2\.\d(\.\d)?$/.test(k)) continue
    analisis[k] = { analisis: potong(v?.analisis, 4000), masalah: potong(v?.masalah, 4000), rekomendasi: potong(v?.rekomendasi, 4000) }
  }
  const masalah: BarisMasalah[] = (Array.isArray(n.masalah) ? n.masalah : []).slice(0, 30).map(m => ({
    area: potong(m?.area, 200), masalah: potong(m?.masalah, 1000), rekomendasi: potong(m?.rekomendasi, 1000),
    prioritas: PRIORITAS.has(m?.prioritas) ? m.prioritas : 'Sedang',
  }))
  return { sorotan: potong(n.sorotan, 4000), perhatian: potong(n.perhatian, 4000), analisis, masalah, kesimpulan: potong(n.kesimpulan, 6000) }
}

export async function simpanNarasiLaporanAction(periode: string, narasi: NarasiLaporan): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canSusunLaporanKurikulum(session.role)) return { error: 'Tidak memiliki izin.' }
  const edisi = await getEdisi(periode)
  if (!edisi) return { error: 'Laporan tidak ditemukan.' }
  if (edisi.status !== 'draf') return { error: 'Laporan sudah diajukan; kembalikan ke draf dulu untuk mengubah narasi.' }

  const { error } = await createServerClient().from('laporan_kurikulum')
    .update({ narasi: bersihkanNarasi(narasi), updated_at: new Date().toISOString() })
    .eq('id', edisi.id).eq('status', 'draf')
  if (error) return { error: `Gagal menyimpan: ${error.message}` }
  segarkan(periode)
  return { success: 'Narasi tersimpan.' }
}

async function ubahStatus(
  periode: string, dari: string, ke: string, izin: (r: Parameters<typeof canSusunLaporanKurikulum>[0]) => boolean,
  tambahan: (userId: string) => Record<string, unknown>, pesan: string,
): Promise<Hasil> {
  const session = await getSession()
  if (!session || !izin(session.role)) return { error: 'Tidak memiliki izin.' }
  const edisi = await getEdisi(periode)
  if (!edisi) return { error: 'Laporan tidak ditemukan.' }
  if (edisi.status !== dari) return { error: 'Status laporan sudah berubah. Muat ulang halaman.' }
  const { error } = await createServerClient().from('laporan_kurikulum')
    .update({ status: ke, updated_at: new Date().toISOString(), ...tambahan(session.userId) })
    .eq('id', edisi.id).eq('status', dari)
  if (error) return { error: `Gagal: ${error.message}` }
  segarkan(periode)
  return { success: pesan }
}

export async function ajukanLaporanAction(periode: string): Promise<Hasil> {
  return ubahStatus(periode, 'draf', 'diajukan', canSusunLaporanKurikulum,
    () => ({ diajukan_at: new Date().toISOString() }), 'Laporan diajukan ke Kepala RQ.')
}

export async function setujuiLaporanAction(periode: string, catatan: string): Promise<Hasil> {
  return ubahStatus(periode, 'diajukan', 'disetujui', canSetujuiLaporanKurikulum,
    userId => ({ disetujui_oleh: userId, disetujui_at: new Date().toISOString(), catatan_kepala: potong(catatan, 2000) }),
    'Laporan disetujui.')
}

export async function kembalikanLaporanAction(periode: string, catatan: string): Promise<Hasil> {
  if (!catatan.trim()) return { error: 'Tuliskan catatan apa yang perlu diperbaiki.' }
  return ubahStatus(periode, 'diajukan', 'draf', canSetujuiLaporanKurikulum,
    () => ({ diajukan_at: null, catatan_kepala: potong(catatan, 2000) }), 'Laporan dikembalikan ke Kumik.')
}

/** Membuka kembali edisi yang sudah disetujui — Kepala RQ saja, mis. ada angka yang salah. */
export async function bukaKembaliLaporanAction(periode: string): Promise<Hasil> {
  return ubahStatus(periode, 'disetujui', 'draf', canSetujuiLaporanKurikulum,
    () => ({ disetujui_oleh: null, disetujui_at: null, diajukan_at: null }), 'Laporan dibuka kembali sebagai draf.')
}
