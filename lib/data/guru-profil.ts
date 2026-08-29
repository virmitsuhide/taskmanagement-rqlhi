import { createServerClient } from '@/lib/supabase/server'
import { nilaiDari, MONTH_NAMES } from '@/lib/data/kpi'
import type { GuruProfile, Jenjang, KpiMonthly } from '@/types'

/**
 * Lapisan data menu "Profil Guru" (SDM) dan riwayat KPI seorang guru.
 *
 * SEMUA URUTAN NAMA MEMAKAI localeCompare('id'), BUKAN ORDER BY
 *
 * Urutan bawaan Postgres mengikuti byte: huruf besar mendahului huruf kecil,
 * sehingga "Ust Nunung" bisa melompat jauh dari tempat yang diharapkan dan
 * nama berawalan tanda baca terlempar ke ujung. Dropdown dan panah maju-mundur
 * di halaman profil dibangun dari daftar yang SAMA, jadi kalau urutannya tidak
 * sama persis, panah "berikutnya" akan melompat ke nama yang bukan tetangganya
 * di dropdown. Satu sumber urutan menutup kedua celah itu sekaligus.
 */

/** Kolom profil lengkap — ada setelah migrasi 0044. */
export const KOLOM_PROFIL_GURU =
  'id, full_name, nip, unit, employment_type, joined_at, photo_url, photo_focus,' +
  ' sapaan, nickname, birth_place, birth_date, education_level, education_history,' +
  ' quran_competencies, other_competencies, ijazah_sanad, trainings, amanah_history, awards'

/** Kolom yang pasti ada walau 0044 belum dijalankan. */
export const KOLOM_PROFIL_DASAR =
  'id, full_name, nip, unit, employment_type, joined_at, photo_url'

const urutNama = <T extends { full_name: string }>(a: T, b: T) =>
  a.full_name.localeCompare(b.full_name, 'id')

export interface GuruRingkas {
  id: string
  full_name: string
  nip: string | null
  joined_at: string | null
  /** Sudah punya isian profil di luar kolom kepegawaian? */
  profilTerisi: boolean
}

/**
 * Daftar guru aktif satu unit, terurut abjad.
 *
 * `profilTerisi` dipakai dropdown untuk menandai siapa yang datanya masih
 * kosong — pertanyaan yang paling sering dibawa SDM ke halaman ini.
 */
export async function getGuruUnit(unit: Jenjang): Promise<GuruRingkas[]> {
  const supabase = createServerClient()

  const penuh = await supabase
    .from('teachers')
    .select('id, full_name, nip, joined_at, education_history, quran_competencies')
    .eq('unit', unit)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (!penuh.error && penuh.data) {
    return (penuh.data as Record<string, unknown>[])
      .map(t => ({
        id: t.id as string,
        full_name: t.full_name as string,
        nip: (t.nip ?? null) as string | null,
        joined_at: (t.joined_at ?? null) as string | null,
        profilTerisi:
          (Array.isArray(t.education_history) && t.education_history.length > 0) ||
          (Array.isArray(t.quran_competencies) && t.quran_competencies.length > 0),
      }))
      .sort(urutNama)
  }

  // Migrasi 0044 belum jalan — daftarnya tetap tampil, hanya tanpa penanda.
  const dasar = await supabase
    .from('teachers')
    .select('id, full_name, nip, joined_at')
    .eq('unit', unit)
    .is('deleted_at', null)
    .eq('is_active', true)

  return ((dasar.data ?? []) as Record<string, unknown>[])
    .map(t => ({
      id: t.id as string,
      full_name: t.full_name as string,
      nip: (t.nip ?? null) as string | null,
      joined_at: (t.joined_at ?? null) as string | null,
      profilTerisi: false,
    }))
    .sort(urutNama)
}

/** Profil satu guru; `perluMigrasi` menandai 0044 belum dijalankan. */
export async function getGuruProfile(
  id: string,
): Promise<{ profile: GuruProfile | null; perluMigrasi: boolean }> {
  const supabase = createServerClient()

  const penuh = await supabase.from('teachers').select(KOLOM_PROFIL_GURU).eq('id', id).maybeSingle()
  if (penuh.data) return { profile: penuh.data as unknown as GuruProfile, perluMigrasi: false }

  const dasar = await supabase.from('teachers').select(KOLOM_PROFIL_DASAR).eq('id', id).maybeSingle()
  return { profile: (dasar.data as unknown as GuruProfile) ?? null, perluMigrasi: true }
}

// ─── Riwayat KPI ────────────────────────────────────────────────────────────

export interface RiwayatKpiBulan {
  year: number
  month: number
  label: string
  unit: Jenjang | null
  /** Nilai 0–100 tiap indikator, urut sesuai KPI_INDIKATOR. */
  nilai: number[]
  rapot: number
  level: number
  predikat: string
  apresiasi: string[]
  pengembangan: string[]
  notes: string | null
  updatedAt: string
}

/**
 * Seluruh penilaian KPI seorang guru, terbaru di atas.
 *
 * Tidak dibatasi satu unit: guru yang pindah unit tetap punya satu riwayat
 * kerja yang utuh, dan memotongnya per unit akan membuat rapornya seolah
 * terputus di bulan kepindahan. Unit tiap baris ikut dibawa supaya rubrik yang
 * dipakai bulan itu tetap bisa ditelusuri.
 */
export async function getRiwayatKpi(teacherId: string): Promise<RiwayatKpiBulan[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('teacher_id', teacherId)

  if (error || !data) return []

  const num = (v: unknown): number => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const opt = (v: unknown) => (v == null ? null : num(v))

  return (data as Record<string, unknown>[])
    .map(raw => {
      const e: KpiMonthly = {
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
      const h = nilaiDari(e)
      return {
        year: e.year,
        month: e.month,
        label: `${MONTH_NAMES[e.month - 1]} ${e.year}`,
        unit: e.unit,
        nilai: h.nilai,
        rapot: h.rapot,
        level: h.level,
        predikat: h.predikat,
        // Kolom catatan baru ada setelah 0044; baris lama mengirim undefined.
        apresiasi: (e.apresiasi ?? []).filter(Boolean),
        pengembangan: (e.pengembangan ?? []).filter(Boolean),
        notes: e.notes ?? null,
        updatedAt: e.updated_at,
      }
    })
    .sort((a, b) => b.year - a.year || b.month - a.month)
}
