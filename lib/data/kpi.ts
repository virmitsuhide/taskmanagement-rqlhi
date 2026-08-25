import { createServerClient } from '@/lib/supabase/server'
import { hitungKpi, type KpiHasil } from '@/lib/kpi/hitung'
import type { KpiMonthly, KpiRow, Jenjang } from '@/types'

/** Bulan tiap semester. Ganjil = Juli–Desember, Genap = Januari–Juni. */
export const SEMESTER_MONTHS: Record<'ganjil' | 'genap', number[]> = {
  ganjil: [7, 8, 9, 10, 11, 12],
  genap: [1, 2, 3, 4, 5, 6],
}

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Unit yang dinilai KPI. PAUD belum masuk rubrik. */
export const KPI_UNITS: { key: Jenjang; label: string }[] = [
  { key: 'sd', label: 'SDIT LHI' },
  { key: 'sd_juara', label: 'SD LHI Juara' },
  { key: 'smp', label: 'SMPIT LHI' },
]

/**
 * Angka dari PostgREST bisa datang sebagai string.
 *
 * Kolom `numeric` Postgres dikirim sebagai string oleh PostgREST supaya
 * ketelitiannya tidak hilang di JSON. Tanpa dipaksa jadi number, penjumlahan
 * di rumus KPI berubah jadi penyambungan teks — "0" + "5" menghasilkan "05",
 * dan salahnya tidak menimbulkan galat apa pun, hanya nilai yang keliru.
 */
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(raw: Record<string, unknown>): KpiMonthly {
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
    seragam_total: raw.seragam_total == null ? null : num(raw.seragam_total),
    lapor_ortu_total: raw.lapor_ortu_total == null ? null : num(raw.lapor_ortu_total),
    halaqoh_total: raw.halaqoh_total == null ? null : num(raw.halaqoh_total),
  }
}

/**
 * Hitung nilai KPI dari satu baris tersimpan.
 *
 * Rubriknya diambil dari `e.unit` — unit guru saat baris itu dibuat — bukan
 * dari unit guru sekarang. Itulah yang membuat nilai lama tidak ikut berubah
 * ketika gurunya pindah unit.
 */
export function nilaiDari(e: KpiMonthly): KpiHasil {
  return hitungKpi(
    {
      lateMinutes: e.late_minutes,
      dbLateDays: e.db_late_days,
      hafalanJuz: e.hafalan_juz,
      hafalanPages: e.hafalan_pages,
      tuhfatulBait: e.tuhfatul_bait,
      bacaanScore: e.bacaan_score,
      bukuPeganganMeetings: e.buku_pegangan_meetings,
      izinWaCases: e.izin_wa_cases,
      penggantiCases: e.pengganti_cases,
      penggantiFound: e.pengganti_found,
    },
    {
      seragamDaily: e.seragam_daily,
      laporOrtuDaily: e.lapor_ortu_daily,
      halaqohHadir: e.halaqoh_hadir,
      halaqohAkhiri: e.halaqoh_akhiri,
      seragamTotal: e.seragam_total,
      laporOrtuTotal: e.lapor_ortu_total,
      halaqohTotal: e.halaqoh_total,
    },
    e.unit,
  )
}

/**
 * Daftar guru satu unit beserta baris KPI periode tersebut.
 *
 * Selalu mengembalikan SEMUA guru aktif unit itu, termasuk yang belum dinilai —
 * daftar yang hanya berisi guru yang sudah diisi menyembunyikan justru hal yang
 * paling perlu dilihat SDM: siapa yang belum.
 *
 * Diurutkan berdasar abjad memakai localeCompare('id'), bukan urutan bawaan
 * database. Urutan ASCII menaruh huruf besar sebelum huruf kecil, sehingga
 * "Ust Nunung" bisa melompat ke tempat yang tidak diduga.
 */
export async function getKpiRows(unit: Jenjang, year: number, month: number): Promise<KpiRow[]> {
  const supabase = createServerClient()

  // Penilaian periode ini yang TERCATAT di unit ini. Inilah sumber kebenaran
  // keanggotaan historis: guru yang sudah pindah tetap muncul di unit lamanya
  // untuk bulan-bulan saat ia memang mengajar di sana.
  const { data: rawEntries } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .eq('unit', unit)

  const entries = (rawEntries ?? []).map(normalize)

  // Guru yang SEKARANG di unit ini — untuk yang belum dinilai periode ini.
  const { data: current } = await supabase
    .from('teachers')
    .select('id, full_name, unit, employment_type')
    .eq('unit', unit)
    .is('deleted_at', null)
    .eq('is_active', true)

  // Nama & unit terkini semua guru yang tersangkut, termasuk yang sudah pindah.
  const idsTersangkut = [...new Set([...entries.map(e => e.teacher_id), ...(current ?? []).map(t => t.id)])]
  const { data: profil } = idsTersangkut.length
    ? await supabase.from('teachers').select('id, full_name, unit, employment_type').in('id', idsTersangkut)
    : { data: [] as { id: string; full_name: string; unit: string | null; employment_type: string | null }[] }

  const byId = new Map((profil ?? []).map(t => [t.id, t]))

  // Guru yang periode ini sudah dinilai DI UNIT LAIN tidak boleh ikut muncul di
  // sini sebagai "belum dinilai" — ia memang bukan tanggung jawab unit ini pada
  // bulan itu, dan menampilkannya membuat hitungan "belum diisi" jadi salah.
  const { data: lain } = idsTersangkut.length
    ? await supabase
        .from('kpi_monthly')
        .select('teacher_id')
        .eq('year', year)
        .eq('month', month)
        .neq('unit', unit)
        .in('teacher_id', idsTersangkut)
    : { data: [] as { teacher_id: string }[] }
  const dinilaiDiUnitLain = new Set((lain ?? []).map(r => r.teacher_id))

  const rows = new Map<string, KpiRow>()

  for (const e of entries) {
    const t = byId.get(e.teacher_id)
    if (!t) continue
    const unitSekarang = (t.unit ?? null) as Jenjang | null
    rows.set(e.teacher_id, {
      teacherId: e.teacher_id,
      fullName: t.full_name,
      unit: unitSekarang,
      employmentType: t.employment_type,
      entry: e,
      pindahKe: unitSekarang && unitSekarang !== unit ? unitSekarang : null,
    })
  }

  for (const t of current ?? []) {
    if (rows.has(t.id) || dinilaiDiUnitLain.has(t.id)) continue
    rows.set(t.id, {
      teacherId: t.id,
      fullName: t.full_name,
      unit: (t.unit ?? null) as Jenjang | null,
      employmentType: t.employment_type,
      entry: null,
      pindahKe: null,
    })
  }

  return [...rows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'))
}

export interface RaporSemesterRow {
  teacherId: string
  fullName: string
  /** Nilai rapot tiap bulan yang sudah terisi; bulan kosong tidak ikut. */
  perBulan: { month: number; rapot: number }[]
  /** Rata-rata dari bulan yang terisi. Null kalau belum ada satupun. */
  rataRata: number | null
}

/**
 * Rapor semester — rata-rata Nilai Rapot KPI bulan-bulan dalam semester itu.
 *
 * Bulan yang belum diisi DIABAIKAN, bukan dihitung sebagai nol. Guru yang baru
 * dinilai dua bulan dari enam tidak sedang berkinerja sepertiga; ia hanya belum
 * dinilai penuh. Berapa bulan yang ikut dihitung dilaporkan lewat `perBulan`
 * supaya pembacanya tahu seberapa lengkap angkanya.
 */
export async function getRaporSemester(
  unit: Jenjang,
  year: number,
  semester: 'ganjil' | 'genap',
): Promise<RaporSemesterRow[]> {
  const supabase = createServerClient()
  const months = SEMESTER_MONTHS[semester]

  // Semua penilaian semester ini yang tercatat di unit ini — termasuk milik
  // guru yang kini sudah pindah, karena bulan-bulan itu memang miliknya di sini.
  const { data: rawEntries } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('year', year)
    .eq('unit', unit)
    .in('month', months)

  const entries = rawEntries ?? []

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, full_name')
    .eq('unit', unit)
    .is('deleted_at', null)
    .eq('is_active', true)

  const ids = [...new Set([...(teachers ?? []).map(t => t.id), ...entries.map(e => e.teacher_id)])]
  if (ids.length === 0) return []

  const { data: profil } = await supabase.from('teachers').select('id, full_name').in('id', ids)
  const list = profil ?? []

  const byTeacher = new Map<string, { month: number; rapot: number }[]>()
  for (const raw of entries ?? []) {
    const e = normalize(raw)
    const arr = byTeacher.get(e.teacher_id) ?? []
    arr.push({ month: e.month, rapot: nilaiDari(e).rapot })
    byTeacher.set(e.teacher_id, arr)
  }

  return list
    .map(t => {
      const perBulan = (byTeacher.get(t.id) ?? []).sort((a, b) => a.month - b.month)
      const rataRata = perBulan.length
        ? perBulan.reduce((s, x) => s + x.rapot, 0) / perBulan.length
        : null
      return { teacherId: t.id, fullName: t.full_name, perBulan, rataRata }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'))
}
