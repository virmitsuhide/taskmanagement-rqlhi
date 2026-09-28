'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCatatSetoranGuru } from '@/lib/auth/permissions'
import { terkunci } from '@/lib/kpi/alur'
import { getIsianKpiSetoran, posisiHafalan, type JenisSetoranGuru } from '@/lib/data/setoran-guru'
import type { Jenjang, KpiRaporStatus } from '@/types'

export interface InputSetoranGuru {
  teacher_id: string
  tanggal: string
  jenis: JenisSetoranGuru
  surat_id?: number | null
  ayat_dari?: number | null
  ayat_ke?: number | null
  /** Diabaikan — dihitung dari surat & ayat (urutan hafalan RQ). */
  juz_selesai?: number | null
  bait_dari?: number | null
  bait_ke?: number | null
  nilai?: number | null
  catatan?: string | null
}

type Hasil = { error?: string; success?: boolean; kpiDiperbarui?: number; kpiTerkunci?: number }

const bulat = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Samakan posisi hafalan di kpi_monthly dengan setoran terakhir bulan itu.
 *
 * Hanya menyentuh baris KPI yang SUDAH ada dan belum terkunci. Baris yang
 * belum ada tidak dibuat di sini — membuat baris KPI setengah isi akan
 * membuat guru tampak "sudah dinilai"; formulir KPI yang mengambil angkanya
 * dari setoran saat SDM mengisinya. Rapor terbit/banding tidak diubah.
 */
async function sinkronKpi(teacherId: string, year: number, month: number): Promise<'diperbarui' | 'terkunci' | 'tidak-ada'> {
  const supabase = createServerClient()
  const { data: kpi } = await supabase.from('kpi_monthly').select('id, status, unit')
    .eq('teacher_id', teacherId).eq('year', year).eq('month', month).maybeSingle()
  const baris = kpi as { id: string; status: KpiRaporStatus; unit: Jenjang | null } | null
  if (!baris) return 'tidak-ada'
  if (terkunci(baris.status)) return 'terkunci'
  const isian = await getIsianKpiSetoran(teacherId, year, month, baris.unit)
  const ubah: Record<string, number | string> = {}
  if (isian.hafalan_juz !== undefined) ubah.hafalan_juz = isian.hafalan_juz
  if (isian.hafalan_pages !== undefined) ubah.hafalan_pages = isian.hafalan_pages
  if (isian.tuhfatul_bait !== undefined) ubah.tuhfatul_bait = isian.tuhfatul_bait
  if (Object.keys(ubah).length === 0) return 'diperbarui'
  ubah.updated_at = new Date().toISOString()
  await supabase.from('kpi_monthly').update(ubah).eq('id', baris.id)
  return 'diperbarui'
}

async function sinkronBanyak(pasang: { teacher_id: string; tanggal: string }[]): Promise<Pick<Hasil, 'kpiDiperbarui' | 'kpiTerkunci'>> {
  const unik = [...new Map(pasang.map(p => [`${p.teacher_id}|${p.tanggal.slice(0, 7)}`, p])).values()]
  let kpiDiperbarui = 0, kpiTerkunci = 0
  for (const p of unik) {
    const [y, m] = p.tanggal.split('-').map(Number)
    const r = await sinkronKpi(p.teacher_id, y, m)
    if (r === 'diperbarui') kpiDiperbarui++
    if (r === 'terkunci') kpiTerkunci++
  }
  return { kpiDiperbarui, kpiTerkunci }
}

function segarkan() {
  revalidatePath('/kpi/setoran-guru')
  revalidatePath('/kpi')
  revalidatePath('/kpi/isi')
}

/** Simpan setoran beberapa guru sekaligus (satu sesi simak). */
export async function simpanSetoranGuruAction(baris: InputSetoranGuru[]): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCatatSetoranGuru(session.role)) return { error: 'Hanya SDM yang mencatat setoran guru.' }
  if (!Array.isArray(baris) || baris.length === 0) return { error: 'Tidak ada setoran yang dikirim.' }
  if (baris.length > 200) return { error: 'Terlalu banyak baris sekaligus.' }

  const supabase = createServerClient()
  const { data: suratRaw } = await supabase.from('surat_master').select('id, total_ayat')
  const panjang = new Map(((suratRaw ?? []) as { id: number; total_ayat: number }[]).map(s => [s.id, s.total_ayat]))

  const rows = []
  for (const b of baris) {
    if (!b.teacher_id || !/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal)) return { error: 'Guru atau tanggal tidak sah.' }
    const nilai = b.nilai == null ? null : bulat(b.nilai, 0, 100)
    const dasar = {
      teacher_id: b.teacher_id, tanggal: b.tanggal, jenis: b.jenis, nilai,
      catatan: (b.catatan ?? '').trim().slice(0, 500), dicatat_oleh: session.userId,
    }
    if (b.jenis === 'tahfidz') {
      const surat = bulat(b.surat_id, 1, 114)
      const total = surat ? panjang.get(surat) ?? 286 : 0
      const ke = bulat(b.ayat_ke, 1, total)
      const dari = b.ayat_dari == null ? ke : bulat(b.ayat_dari, 1, total)
      if (!surat || !ke || !dari) return { error: 'Setoran tahfidz perlu surat dan ayat yang sah.' }
      // juz_selesai kini hasil hitungan urutan hafalan RQ, bukan isian SDM.
      const juz = posisiHafalan({ surat_id: surat, ayat_ke: Math.max(dari, ke) }).juz
      rows.push({ ...dasar, surat_id: surat, ayat_dari: Math.min(dari, ke), ayat_ke: Math.max(dari, ke), juz_selesai: juz })
    } else if (b.jenis === 'tuhfatul') {
      const ke = bulat(b.bait_ke, 1, 61)
      const dari = b.bait_dari == null ? ke : bulat(b.bait_dari, 1, 61)
      if (!ke || !dari) return { error: 'Setoran Tuhfatul Athfal perlu nomor bait 1–61.' }
      rows.push({ ...dasar, bait_dari: Math.min(dari, ke), bait_ke: Math.max(dari, ke) })
    } else {
      return { error: 'Jenis setoran tidak dikenal.' }
    }
  }

  const { error } = await supabase.from('setoran_guru').insert(rows)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return { error: 'Tabel setoran guru belum ada. Jalankan drizzle/0096_setoran_guru_PASTE_TO_SUPABASE.sql.' }
    return { error: 'Gagal menyimpan setoran.' }
  }
  const sinkron = await sinkronBanyak(rows)
  segarkan()
  return { success: true, ...sinkron }
}

export async function hapusSetoranGuruAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCatatSetoranGuru(session.role)) return { error: 'Hanya SDM yang mencatat setoran guru.' }
  const supabase = createServerClient()
  const { data } = await supabase.from('setoran_guru').delete().eq('id', id).select('teacher_id, tanggal').maybeSingle()
  if (!data) return { error: 'Setoran tidak ditemukan.' }
  const sinkron = await sinkronBanyak([data as { teacher_id: string; tanggal: string }])
  segarkan()
  return { success: true, ...sinkron }
}
