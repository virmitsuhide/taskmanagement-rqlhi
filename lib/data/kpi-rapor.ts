import { createServerClient } from '@/lib/supabase/server'
import { nilaiDari, MONTH_NAMES } from '@/lib/data/kpi'
import {
  barisIndikator, catatanDari, bandingkan, masaKerja,
  type BarisIndikator, type Catatan, type Perbandingan, type TitikTren,
} from '@/lib/kpi/rapor-bulanan'
import type { Jenjang, KpiMonthly, UserRole } from '@/types'

/**
 * Bahan lengkap satu lembar rapor KPI bulanan.
 *
 * Semua yang dicetak di kertas dikumpulkan di sini supaya halamannya tidak
 * perlu menembak database sendiri sepotong-sepotong — dan supaya jelas apa
 * saja yang menyusun dokumen yang diserahkan kepada guru.
 */
export interface KpiRapor {
  teacher: {
    id: string
    fullName: string
    nip: string | null
    unit: Jenjang | null
    joinedAt: string | null
    /** Tahun bergabung, mis. 2022. Null bila joined_at kosong. */
    tahunGabung: number | null
    /** Masa kerja dalam tahun penuh sampai akhir periode rapor. */
    masaKerjaTahun: number | null
  }
  /** Koordinator unit — penanda tangan sebelah kiri. */
  koordinator: { nama: string; role: UserRole } | null
  periode: { year: number; month: number; label: string }
  entry: KpiMonthly
  hasil: ReturnType<typeof nilaiDari>
  baris: BarisIndikator[]
  catatan: Catatan
  tren: TitikTren[]
  banding: Perbandingan
}

/** Peran koordinator yang menaungi tiap unit — penanda tangan rapornya. */
const KOOR_UNIT: Record<string, UserRole> = {
  sd: 'koor_sd',
  sd_juara: 'koor_sd',
  smp: 'koor_smp',
}

/** Berapa bulan ke belakang yang digambar sebagai tren kecil di rapor. */
const PANJANG_TREN = 3

/**
 * Susun rapor bulanan seorang guru.
 *
 * Mengembalikan null kalau bulan itu memang belum dinilai — rapor tanpa nilai
 * bukan dokumen yang layak diserahkan, dan halamannya lebih baik mengatakan
 * itu terus terang daripada mencetak lembar berisi nol.
 *
 * `unit` yang dipakai untuk memilih rubrik diambil dari baris kpi_monthly-nya,
 * bukan dari unit guru sekarang — aturan yang sama dengan seluruh modul KPI,
 * supaya rapor bulan lalu tidak berubah isinya ketika gurunya pindah unit.
 */
export async function getKpiRapor(
  teacherId: string,
  unit: Jenjang,
  year: number,
  month: number,
): Promise<KpiRapor | null> {
  const supabase = createServerClient()

  const { data: rawEntry } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('unit', unit)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (!rawEntry) return null

  // PostgREST mengirim kolom numeric sebagai string; nilaiDari() sudah
  // menormalkannya lewat lib/data/kpi, tapi baris mentahnya juga dipakai
  // langsung untuk kolom "capaian riil", jadi angkanya dipaksa di sini pula.
  const entry = normalisasi(rawEntry as Record<string, unknown>)
  const hasil = nilaiDari(entry)

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, full_name, nip, unit, joined_at')
    .eq('id', teacherId)
    .maybeSingle()

  if (!teacher) return null

  // Koordinator unit. Unit tanpa koordinator terdaftar (sd_juara sebelum ada
  // koornya sendiri) memakai koor SD — lihat KOOR_UNIT.
  const roleKoor = KOOR_UNIT[unit]
  const { data: koorRow } = roleKoor
    ? await supabase.from('users').select('display_name, role').eq('role', roleKoor).maybeSingle()
    : { data: null }

  const tren = await ambilTren(teacherId, unit, year, month)

  // Dihitung sekali lalu dipakai dua kali (tabel & catatan); sebelumnya
  // barisIndikator dipanggil dua kali untuk hasil yang sama persis.
  const baris = barisIndikator(entry, hasil, entry.unit)

  const t = teacher as { id: string; full_name: string; nip: string | null; unit: string | null; joined_at: string | null }
  const tahunGabung = t.joined_at ? Number(t.joined_at.slice(0, 4)) : null

  return {
    teacher: {
      id: t.id,
      fullName: t.full_name,
      nip: t.nip,
      unit: (t.unit ?? null) as Jenjang | null,
      joinedAt: t.joined_at,
      tahunGabung: Number.isFinite(tahunGabung) ? tahunGabung : null,
      masaKerjaTahun: masaKerja(t.joined_at, year, month),
    },
    koordinator: koorRow
      ? { nama: (koorRow as { display_name: string }).display_name, role: (koorRow as { role: UserRole }).role }
      : null,
    periode: { year, month, label: `${MONTH_NAMES[month - 1]} ${year}` },
    entry,
    hasil,
    baris,
    catatan: catatanDari(baris, { apresiasi: entry.apresiasi, pengembangan: entry.pengembangan }),
    tren,
    banding: bandingkan(tren),
  }
}

/**
 * Nilai rapot beberapa bulan terakhir, berurutan dan tanpa lompatan.
 *
 * Bulan yang belum dinilai tetap masuk sebagai titik bernilai null, bukan
 * dibuang. Grafik yang hanya memuat bulan terisi akan menyambung Juni ke
 * Agustus sebagai dua titik bersebelahan, dan kenaikannya terbaca seolah
 * terjadi dalam satu bulan.
 */
async function ambilTren(
  teacherId: string,
  unit: Jenjang,
  year: number,
  month: number,
): Promise<TitikTren[]> {
  const supabase = createServerClient()

  const diminta: { year: number; month: number }[] = []
  for (let i = PANJANG_TREN - 1; i >= 0; i--) {
    const m = month - i
    diminta.push(m > 0 ? { year, month: m } : { year: year - 1, month: m + 12 })
  }

  const tahunTerlibat = [...new Set(diminta.map(d => d.year))]
  const { data } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('unit', unit)
    .in('year', tahunTerlibat)

  const byKey = new Map<string, number>()
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const e = normalisasi(raw)
    byKey.set(`${e.year}-${e.month}`, nilaiDari(e).rapot)
  }

  return diminta.map(d => ({
    ...d,
    rapot: byKey.get(`${d.year}-${d.month}`) ?? null,
  }))
}

/** Sama dengan normalize() di lib/data/kpi — kolom numeric datang sebagai string. */
function normalisasi(raw: Record<string, unknown>): KpiMonthly {
  const num = (v: unknown): number => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const opt = (v: unknown) => (v == null ? null : num(v))
  return {
    ...(raw as unknown as KpiMonthly),
    late_minutes: num(raw.late_minutes),
    db_late_days: num(raw.db_late_days),
    hafalan_juz: num(raw.hafalan_juz),
    hafalan_pages: num(raw.hafalan_pages),
    tuhfatul_bait: num(raw.tuhfatul_bait),
    bacaan_score: num(raw.bacaan_score),
    buku_pegangan_meetings: num(raw.buku_pegangan_meetings),
    izin_wa_cases: num(raw.izin_wa_cases),
    pengganti_cases: num(raw.pengganti_cases),
    pengganti_found: num(raw.pengganti_found),
    seragam_total: opt(raw.seragam_total),
    lapor_ortu_total: opt(raw.lapor_ortu_total),
    halaqoh_total: opt(raw.halaqoh_total),
  }
}
