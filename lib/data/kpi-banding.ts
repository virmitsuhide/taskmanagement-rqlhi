import { createServerClient } from '@/lib/supabase/server'
import { MONTH_NAMES } from '@/lib/data/kpi'
import { lewatTenggat } from '@/lib/kpi/alur'
import { KPI_INDIKATOR } from '@/lib/kpi/hitung'
import type { Jenjang, KpiBanding, KpiBandingItem, UserRole } from '@/types'

/**
 * Banding guru atas rapor KPI-nya: pengambilan, kotak masuk pemutus, dan
 * pematangan tenggat putusan.
 *
 * Aturan siapa boleh memutus apa TIDAK ada di sini — itu milik
 * lib/auth/permissions.ts. Yang di sini semata membaca dan menghitung.
 */

/** Bentuk items dari jsonb, dibersihkan dari apa pun yang tidak masuk akal. */
function bacaItems(raw: unknown): KpiBandingItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(r => {
      const o = (r ?? {}) as Record<string, unknown>
      const indikator = Number(o.indikator)
      return {
        indikator,
        nilaiTercatat: Number(o.nilaiTercatat) || 0,
        nilaiDiklaim: Number(o.nilaiDiklaim) || 0,
        alasan: typeof o.alasan === 'string' ? o.alasan : '',
      }
    })
    .filter(i => Number.isInteger(i.indikator) && i.indikator >= 0 && i.indikator < KPI_INDIKATOR.length)
}

function normalisasi(raw: Record<string, unknown>): KpiBanding {
  return {
    ...(raw as unknown as KpiBanding),
    items: bacaItems(raw.items),
    tingkat: Number(raw.tingkat) || 1,
    versi_rapor: Number(raw.versi_rapor) || 1,
  }
}

/**
 * Seluruh banding atas satu lembar rapor, termasuk versi-versi sebelumnya.
 *
 * Riwayat lengkap sengaja ikut. Rapor yang sudah dua kali direvisi karena
 * banding menceritakan sesuatu yang penting tentang penilaian bulan itu, dan
 * hanya menampilkan sanggahan atas versi terakhir menyembunyikannya.
 */
export async function getBandingRapor(kpiId: string): Promise<KpiBanding[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('kpi_banding')
    .select('*')
    .eq('kpi_monthly_id', kpiId)
    .order('diajukan_at', { ascending: true })

  return (data ?? []).map(r => normalisasi(r as Record<string, unknown>))
}

/** Banding yang masih menggantung atas satu rapor, kalau ada. */
export async function getBandingAktif(kpiId: string): Promise<KpiBanding | null> {
  const semua = await getBandingRapor(kpiId)
  return semua.find(b => b.status === 'diajukan') ?? null
}

export interface BarisKotakBanding {
  banding: KpiBanding
  kpiId: string
  teacherId: string
  fullName: string
  unit: Jenjang | null
  periode: string
  year: number
  month: number
  /** Tenggat putusannya sudah lewat — muncul sebagai peringatan, bukan diam. */
  terlambat: boolean
}

/**
 * Kotak masuk pemutus.
 *
 * `tingkat` menentukan isinya: SDM membuka tingkat 1, Kepala RQ tingkat 2.
 * Keduanya bisa memanggil tanpa tingkat untuk melihat seluruhnya — Kepala RQ
 * memerlukannya, sebab tenggat tingkat 1 yang terlewat adalah persoalan yang
 * harus ia lihat justru ketika SDM tidak melaporkannya.
 */
export async function getKotakBanding(opts: {
  tingkat?: number
  /** Hanya yang belum diputus. */
  hanyaMenunggu?: boolean
} = {}): Promise<BarisKotakBanding[]> {
  const supabase = createServerClient()

  let q = supabase.from('kpi_banding').select('*')
  if (opts.tingkat) q = q.eq('tingkat', opts.tingkat)
  if (opts.hanyaMenunggu) q = q.eq('status', 'diajukan')

  const { data } = await q.order('diajukan_at', { ascending: true })
  const rows = (data ?? []).map(r => normalisasi(r as Record<string, unknown>))
  if (rows.length === 0) return []

  const [{ data: rapor }, { data: guru }] = await Promise.all([
    supabase
      .from('kpi_monthly')
      .select('id, year, month, unit')
      .in('id', [...new Set(rows.map(r => r.kpi_monthly_id))]),
    supabase
      .from('teachers')
      .select('id, full_name')
      .in('id', [...new Set(rows.map(r => r.teacher_id))]),
  ])

  const byRapor = new Map((rapor ?? []).map(r => [r.id, r]))
  const byGuru = new Map((guru ?? []).map(g => [g.id, g.full_name as string]))

  return rows.flatMap(b => {
    const r = byRapor.get(b.kpi_monthly_id)
    if (!r) return []
    return [{
      banding: b,
      kpiId: b.kpi_monthly_id,
      teacherId: b.teacher_id,
      fullName: byGuru.get(b.teacher_id) ?? '—',
      unit: (r.unit ?? null) as Jenjang | null,
      periode: `${MONTH_NAMES[(r.month as number) - 1]} ${r.year}`,
      year: r.year as number,
      month: r.month as number,
      terlambat: b.status === 'diajukan' && lewatTenggat(b.putusan_batas),
    }]
  })
}

/**
 * Angka lencana pemutus.
 *
 * Yang sudah lewat tenggat tetap ikut dihitung, tidak dipindahkan ke daftar
 * lain: banding yang terlambat diputus adalah pekerjaan yang belum selesai,
 * bukan pekerjaan yang gugur.
 */
export async function hitungBandingMenunggu(role: UserRole): Promise<number> {
  const tingkat = role === 'sdm' ? 1 : role === 'kepala_rq' ? 2 : null
  if (tingkat === null) return 0

  const supabase = createServerClient()
  const { count } = await supabase
    .from('kpi_banding')
    .select('id', { count: 'exact', head: true })
    .eq('tingkat', tingkat)
    .eq('status', 'diajukan')

  return count ?? 0
}

/**
 * Banding milik seorang guru, untuk portal guru.
 *
 * Dipetakan per rapor supaya halaman daftar bisa menampilkan lencana "dalam
 * banding" tanpa satu kueri per baris.
 */
export async function getBandingGuru(teacherId: string): Promise<Map<string, KpiBanding[]>> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('kpi_banding')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('diajukan_at', { ascending: true })

  const peta = new Map<string, KpiBanding[]>()
  for (const raw of data ?? []) {
    const b = normalisasi(raw as Record<string, unknown>)
    const arr = peta.get(b.kpi_monthly_id) ?? []
    arr.push(b)
    peta.set(b.kpi_monthly_id, arr)
  }
  return peta
}

/** Nama indikator yang disanggah — dipakai di daftar & lembar putusan. */
export function namaIndikator(i: number): string {
  return KPI_INDIKATOR[i] ?? `Indikator ${i + 1}`
}
