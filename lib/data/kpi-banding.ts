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

/** Sepotong banding yang menggantung — cukup untuk menyusun keterangan. */
export interface RingkasBandingAktif {
  tingkat: number
  putusanBatas: string | null
  /** Tenggat putusannya sudah lewat. */
  terlambat: boolean
}

/**
 * Banding yang belum diputus atas sekumpulan rapor sekaligus.
 *
 * SATU kueri untuk seluruh daftar, bukan satu per baris: /kpi menampilkan tiga
 * puluh guru, dan getBandingAktif() yang dipanggil per baris akan menjadi tiga
 * puluh perjalanan ke database untuk menghiasi paling banyak satu-dua baris.
 *
 * Sengaja dipanggil dari HALAMAN, bukan dari dalam getKpiRows(). Modul ini
 * membaca MONTH_NAMES dari lib/data/kpi, jadi kalau kpi.ts balik memanggil
 * modul ini keduanya saling mengimpor — lingkaran yang hari ini tidak
 * meledak (pemakaiannya ada di dalam badan fungsi) tapi akan meledak pada hari
 * seseorang memindahkan pemakaiannya ke tingkat modul. Halaman yang merangkai
 * keduanya tidak punya persoalan itu, dan sekaligus membuat kueri tambahan ini
 * bersifat pilihan: yang tidak menampilkan tenggat putusan tidak membayarnya.
 *
 * Yang tingkatnya lebih tinggi menang bila entah bagaimana ada dua yang
 * menggantung. Perkara yang sudah naik ke Kepala RQ adalah keadaan rapor yang
 * sebenarnya; menampilkan tingkat 1 akan menunjuk pemutus yang sudah selesai
 * dengan bagiannya.
 */
export async function getBandingAktifPer(
  kpiIds: string[],
): Promise<Map<string, RingkasBandingAktif>> {
  const peta = new Map<string, RingkasBandingAktif>()
  const ids = [...new Set(kpiIds)].filter(Boolean)
  if (ids.length === 0) return peta

  const supabase = createServerClient()
  const { data } = await supabase
    .from('kpi_banding')
    .select('kpi_monthly_id, tingkat, putusan_batas')
    .in('kpi_monthly_id', ids)
    .eq('status', 'diajukan')
    .order('tingkat', { ascending: true })

  for (const raw of data ?? []) {
    const r = raw as { kpi_monthly_id: string | null; tingkat: unknown; putusan_batas: string | null }
    if (!r.kpi_monthly_id) continue
    peta.set(r.kpi_monthly_id, {
      tingkat: Number(r.tingkat) || 1,
      putusanBatas: r.putusan_batas,
      terlambat: lewatTenggat(r.putusan_batas),
    })
  }
  return peta
}

export interface BarisKotakBanding {
  banding: KpiBanding
  /** Null bila rapornya sudah dihapus lewat reset Kepala RQ. */
  kpiId: string | null
  teacherId: string
  fullName: string
  unit: Jenjang | null
  periode: string
  year: number
  month: number
  /** Rapornya sudah dihapus; putusan atasnya tidak mengubah apa pun lagi. */
  raporHilang: boolean
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
      .in('id', [...new Set(rows.map(r => r.kpi_monthly_id).filter(Boolean))] as string[]),
    supabase
      .from('teachers')
      .select('id, full_name')
      .in('id', [...new Set(rows.map(r => r.teacher_id))]),
  ])

  const byRapor = new Map((rapor ?? []).map(r => [r.id, r]))
  const byGuru = new Map((guru ?? []).map(g => [g.id, g.full_name as string]))

  return rows.map(b => {
    // Barisnya bisa sudah tidak ada — Kepala RQ menghapus penilaian, dan kunci
    // asingnya menjadi NULL (0051). Periode diambil dari salinan di baris
    // banding itu sendiri, dengan rapornya cuma sebagai pelengkap. Kalau
    // bandingnya ikut menghilang dari daftar, sanggahan yang belum diputus
    // lenyap tanpa jejak justru ketika penilaiannya dibatalkan.
    const r = b.kpi_monthly_id ? byRapor.get(b.kpi_monthly_id) : undefined
    const year = (b.year ?? (r?.year as number | undefined)) ?? 0
    const month = (b.month ?? (r?.month as number | undefined)) ?? 0

    return {
      banding: b,
      kpiId: b.kpi_monthly_id,
      teacherId: b.teacher_id,
      fullName: byGuru.get(b.teacher_id) ?? '—',
      unit: (r?.unit ?? null) as Jenjang | null,
      periode: month >= 1 && month <= 12 ? `${MONTH_NAMES[month - 1]} ${year}` : '—',
      year,
      month,
      /** Rapornya sudah dihapus — putusan atasnya tidak lagi bisa mengubah apa pun. */
      raporHilang: !r,
      terlambat: b.status === 'diajukan' && lewatTenggat(b.putusan_batas),
    }
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
    // Banding yatim — rapornya sudah dihapus — dilewati di sini saja. Petanya
    // dipakai untuk menempelkan lencana pada baris rapor yang ADA di daftar
    // guru, dan baris itu tidak ada lagi. Catatannya sendiri tetap hidup di
    // kotak masuk pemutus, yang memang bertugas menampilkannya.
    if (!b.kpi_monthly_id) continue
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
