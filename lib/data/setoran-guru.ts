import { createServerClient } from '@/lib/supabase/server'
import { posisiHafalan, type SetoranGuru } from '@/lib/rq/setoran-guru'
import { paramFor } from '@/lib/kpi/parameter'
import type { Jenjang, KpiRaporStatus } from '@/types'

export { labelPosisi, posisiHafalan } from '@/lib/rq/setoran-guru'
export type { JenisSetoranGuru, PosisiHafalanGuru, SetoranGuru } from '@/lib/rq/setoran-guru'

/**
 * Setoran guru Qur'an yang disimak SDM (0096).
 *
 * Aturannya satu: setoran TERAKHIR tiap jenis dalam satu bulan adalah posisi
 * hafalan guru bulan itu, dan posisi itulah isian KPI —
 *   • tahfidz  → hafalan_juz + hafalan_pages
 *   • tuhfatul → tuhfatul_bait
 * Rumus rubrik KPI tetap yang menghitung nilainya. Bintang kualitas hanya
 * catatan mutu; adab tidak dinilai.
 */

const TABEL_HILANG = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')

function batasBulan(year: number, month: number): { dari: string; sampai: string } {
  const akhir = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return { dari: `${year}-${mm}-01`, sampai: `${year}-${mm}-${String(akhir).padStart(2, '0')}` }
}

/** Urutan "terakhir": tanggal, lalu waktu dicatat. */
const lebihBaru = (a: SetoranGuru, b: SetoranGuru) => b.tanggal.localeCompare(a.tanggal) || b.created_at.localeCompare(a.created_at)

/** Isian KPI dari setoran bulan itu; bidang tanpa setoran dibiarkan undefined. */
export interface IsianKpiSetoran {
  hafalan_juz?: number
  hafalan_pages?: number
  tuhfatul_bait?: number
  tahfidz?: SetoranGuru
  tuhfatul?: SetoranGuru
}

export function isianDariSetoran(setoranBulan: SetoranGuru[], unit: Jenjang | null): IsianKpiSetoran {
  const P = paramFor(unit)
  const urut = [...setoranBulan].sort(lebihBaru)
  const tahfidz = urut.find(s => s.jenis === 'tahfidz')
  const tuhfatul = urut.find(s => s.jenis === 'tuhfatul')
  const hasil: IsianKpiSetoran = { tahfidz, tuhfatul }
  if (tahfidz) {
    const p = posisiHafalan(tahfidz)
    hasil.hafalan_juz = p.juz
    // Batas isian KPI mengikuti rubrik (20 halaman), sama dengan formulir KPI.
    hasil.hafalan_pages = Math.min(p.halaman, P.halamanPerJuz)
  }
  if (tuhfatul?.bait_ke) hasil.tuhfatul_bait = Math.min(tuhfatul.bait_ke, P.totalBait)
  return hasil
}

/** Isian KPI satu guru untuk satu bulan — dipakai formulir & aksi KPI. */
export async function getIsianKpiSetoran(teacherId: string, year: number, month: number, unit: Jenjang | null): Promise<IsianKpiSetoran> {
  const { dari, sampai } = batasBulan(year, month)
  const { data, error } = await createServerClient().from('setoran_guru').select('*')
    .eq('teacher_id', teacherId).gte('tanggal', dari).lte('tanggal', sampai)
  if (error) return {}
  return isianDariSetoran((data ?? []) as SetoranGuru[], unit)
}

// ─── Halaman setoran guru per unit ──────────────────────────────────────────

export interface BarisGuruSetoran {
  id: string
  nama: string
  /** Setoran bulan terpilih, terbaru dulu. */
  bulanIni: SetoranGuru[]
  /** Setoran terakhir sepanjang waktu — bekal isian lanjutan. */
  terakhirTahfidz: SetoranGuru | null
  terakhirTuhfatul: SetoranGuru | null
  isian: IsianKpiSetoran
  /** Status KPI bulan itu: null = belum ada baris KPI. */
  statusKpi: KpiRaporStatus | null
}

export interface DataSetoranGuru {
  tabelAda: boolean
  guru: BarisGuruSetoran[]
}

export async function getSetoranGuruUnit(unit: Jenjang, year: number, month: number): Promise<DataSetoranGuru> {
  const supabase = createServerClient()
  const { data: guruRaw } = await supabase.from('teachers').select('id, full_name')
    .eq('unit', unit).eq('is_active', true).is('deleted_at', null)
  const guru = ((guruRaw ?? []) as { id: string; full_name: string }[])
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'))
  const ids = guru.map(g => g.id)
  if (ids.length === 0) return { tabelAda: true, guru: [] }

  const { dari, sampai } = batasBulan(year, month)
  const [setoranRes, kpiRes] = await Promise.all([
    // Semua setoran sampai akhir bulan terpilih: yang bulan ini untuk rekap,
    // yang terakhir sebelumnya untuk melanjutkan isian.
    supabase.from('setoran_guru').select('*').in('teacher_id', ids).lte('tanggal', sampai)
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('kpi_monthly').select('teacher_id, status').in('teacher_id', ids).eq('year', year).eq('month', month),
  ])
  if (TABEL_HILANG(setoranRes.error)) return { tabelAda: false, guru: [] }
  const semua = (setoranRes.data ?? []) as SetoranGuru[]
  const status = new Map(((kpiRes.data ?? []) as { teacher_id: string; status: KpiRaporStatus | null }[])
    .map(r => [r.teacher_id, r.status ?? 'draft' as KpiRaporStatus]))

  return {
    tabelAda: true,
    guru: guru.map(g => {
      const milik = semua.filter(s => s.teacher_id === g.id)
      const bulanIni = milik.filter(s => s.tanggal >= dari)
      return {
        id: g.id,
        nama: g.full_name,
        bulanIni,
        terakhirTahfidz: milik.find(s => s.jenis === 'tahfidz') ?? null,
        terakhirTuhfatul: milik.find(s => s.jenis === 'tuhfatul') ?? null,
        isian: isianDariSetoran(bulanIni, unit),
        statusKpi: status.get(g.id) ?? null,
      }
    }),
  }
}
