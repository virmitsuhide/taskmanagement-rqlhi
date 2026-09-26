'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canInputKpi } from '@/lib/auth/permissions'
import { terkunci } from '@/lib/kpi/alur'
import type { Jenjang, KpiRaporStatus } from '@/types'
import { paramFor } from '@/lib/kpi/parameter'
import { getIsianKpiSetoran } from '@/lib/data/setoran-guru'

/** Kolom nilai langsung (0097). Terisi = menggantikan hitungan rincian indikatornya. */
const KOLOM_NILAI_LANGSUNG = ['nilai_hadir', 'nilai_database', 'nilai_buku_pegangan', 'nilai_perizinan', 'nilai_pengganti'] as const

/** Angka dari form: kosong/aneh dijadikan 0, lalu dijepit ke rentang wajar. */
function angka(fd: FormData, key: string, max = Number.MAX_SAFE_INTEGER): number {
  const raw = (fd.get(key) as string | null)?.trim()
  if (!raw) return 0
  const n = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(max, n))
}

/**
 * Membaca satu grid harian dari FormData.
 *
 * Nama medannya `<prefix>_<i>`. Kalau TIDAK ADA satu pun medan berawalan itu,
 * yang dikembalikan null — artinya SDM memakai jalan pintas "isi total
 * langsung" dan grid hariannya memang tidak dikirim. Ini beda dari grid yang
 * dikirim tapi seluruhnya nol, yang berarti guru itu benar-benar nol.
 */
function grid(fd: FormData, prefix: string, len: number, max: number): number[] | null {
  let ada = false
  const out: number[] = []
  for (let i = 0; i < len; i++) {
    const raw = fd.get(`${prefix}_${i}`)
    if (raw !== null) ada = true
    const n = parseFloat(String(raw ?? '0').replace(',', '.'))
    out.push(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0)
  }
  return ada ? out : null
}

/**
 * Textarea berbutir → text[].
 *
 * Baris kosong dan spasi di ujung dibuang di sini, bukan saat mencetak: baris
 * kosong yang lolos ke database akan muncul sebagai butir bernomor tanpa isi
 * di rapor yang sudah terlanjur diserahkan kepada guru. Daftar yang seluruhnya
 * kosong disimpan sebagai null, yang berarti "pakai kalimat turunan".
 */
function butir(fd: FormData, key: string): string[] | null {
  const raw = (fd.get(key) as string | null) ?? ''
  const list = raw.split('\n').map(t => t.trim()).filter(Boolean)
  return list.length ? list : null
}

/** Nilai total opsional: kosong berarti pakai grid harian. */
function totalOpsional(fd: FormData, key: string): number | null {
  const raw = (fd.get(key) as string | null)?.trim()
  if (!raw) return null
  const n = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

export async function simpanKpiAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canInputKpi(session.role)) return { error: 'Tidak memiliki izin mengisi KPI.' }

  const teacherId = formData.get('teacher_id') as string
  const year = angka(formData, 'year')
  const month = angka(formData, 'month')
  if (!teacherId || !year || month < 1 || month > 12) {
    return { error: 'Periode atau guru tidak sah.' }
  }

  // Batas isian mengikuti rubrik unit guru, dan unit itu ikut DISIMPAN pada
  // barisnya. Yang dipakai adalah unit guru saat ini, karena inilah saat
  // penilaiannya dibuat — kalau nanti ia pindah, baris ini tetap terbaca
  // dengan rubrik yang berlaku hari ini.
  const supabase = createServerClient()

  // Rapor yang sudah diserahkan kepada guru tidak boleh berubah angkanya.
  // Trigger di drizzle/0050 menegakkan hal yang sama di database; yang di sini
  // ada supaya SDM mendapat kalimat yang bisa ditindaklanjuti, bukan galat
  // Postgres, setelah mengetik satu formulir penuh.
  const { data: adaRapor } = await supabase
    .from('kpi_monthly')
    .select('status')
    .eq('teacher_id', teacherId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const statusRapor = (adaRapor as { status?: KpiRaporStatus } | null)?.status
  if (statusRapor && terkunci(statusRapor)) {
    return {
      error: statusRapor === 'banding'
        ? 'Rapor ini sedang dalam banding dan terkunci. Nilainya baru bisa diubah setelah bandingnya diputus.'
        : 'Rapor ini sudah diterbitkan kepada guru dan terkunci. Minta Kepala RQ mereset rapornya lebih dulu.',
    }
  }

  const { data: guru } = await supabase
    .from('teachers')
    .select('unit')
    .eq('id', teacherId)
    .maybeSingle()

  const unit = (guru?.unit ?? null) as Jenjang | null
  const P = paramFor(unit)
  const row = {
    teacher_id: teacherId,
    year,
    month,
    unit,
    late_minutes: angka(formData, 'late_minutes'),
    db_late_days: angka(formData, 'db_late_days'),
    hafalan_juz: angka(formData, 'hafalan_juz'),
    hafalan_pages: angka(formData, 'hafalan_pages', P.halamanPerJuz),
    tuhfatul_bait: angka(formData, 'tuhfatul_bait', P.totalBait),
    bacaan_score: angka(formData, 'bacaan_score', 100),
    buku_pegangan_meetings: angka(formData, 'buku_pegangan_meetings', P.pertemuanBukuPegangan),
    izin_wa_cases: angka(formData, 'izin_wa_cases'),
    pengganti_cases: angka(formData, 'pengganti_cases'),
    pengganti_found: angka(formData, 'pengganti_found'),
    seragam_daily: grid(formData, 'seragam', P.hariPenilaian, P.poinSeragamPerHari),
    lapor_ortu_daily: grid(formData, 'lapor_ortu', P.hariLaporOrtu, P.poinLaporOrtuPerHari),
    halaqoh_hadir: grid(formData, 'halaqoh_hadir', P.pertemuanHalaqoh, P.poinHadirHalaqoh),
    halaqoh_akhiri: grid(formData, 'halaqoh_akhiri', P.pertemuanHalaqoh, P.poinAkhiriHalaqoh),
    seragam_total: totalOpsional(formData, 'seragam_total'),
    lapor_ortu_total: totalOpsional(formData, 'lapor_ortu_total'),
    halaqoh_total: totalOpsional(formData, 'halaqoh_total'),
    apresiasi: butir(formData, 'apresiasi'),
    pengembangan: butir(formData, 'pengembangan'),
    notes: ((formData.get('notes') as string) || '').trim() || null,
    updated_by: session.userId,
    updated_at: new Date().toISOString(),
  }

  // Posisi hafalan dari Setoran Guru (0096) menang atas angka ketikan:
  // setoran terakhir bulan ini adalah sumber kebenarannya.
  const isian = await getIsianKpiSetoran(teacherId, year, month, unit)
  if (isian.hafalan_juz !== undefined) row.hafalan_juz = isian.hafalan_juz
  if (isian.hafalan_pages !== undefined) row.hafalan_pages = isian.hafalan_pages
  if (isian.tuhfatul_bait !== undefined) row.tuhfatul_bait = isian.tuhfatul_bait

  // Nilai langsung (0097) tidak dikirim formulir ini, jadi upsert tidak
  // menyentuhnya — kecuali SDM menekan "Pakai rincian" untuk indikator itu.
  const lepas = new Set(formData.getAll('hapus_langsung').map(String))
  const kosongkan = Object.fromEntries(KOLOM_NILAI_LANGSUNG.filter(k => lepas.has(k)).map(k => [k, null]))

  // Upsert lewat kunci unik (guru, tahun, bulan) — dua penyimpanan berturut-turut
  // untuk periode yang sama menimpa, bukan menumpuk baris ganda.
  const { error } = await supabase
    .from('kpi_monthly')
    .upsert({ ...row, ...kosongkan, created_by: session.userId }, { onConflict: 'teacher_id,year,month' })

  if (error) {
    // Kolom catatan rapor baru ada setelah 0044 — sebutkan migrasinya alih-alih
    // membuang penilaian yang barusan diketik SDM tanpa penjelasan.
    if (error.message?.includes('apresiasi') || error.message?.includes('pengembangan')) {
      return {
        error:
          'Catatan rapor belum bisa disimpan: jalankan drizzle/0044_profil_guru_dan_catatan_kpi_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    return { error: 'Gagal menyimpan KPI.' }
  }

  revalidatePath('/kpi')
  revalidatePath('/kpi/cetak')
  return { success: true }
}

/** Kolom yang boleh diisi dari tabel isi cepat — nilai akhir 0–100 per indikator. */
const KOLOM_ISI_CEPAT = [
  'nilai_hadir', 'nilai_database', 'bacaan_score', 'seragam_total', 'lapor_ortu_total',
  'halaqoh_total', 'nilai_buku_pegangan', 'nilai_perizinan', 'nilai_pengganti',
] as const
export type KolomIsiCepat = typeof KOLOM_ISI_CEPAT[number]

export interface BarisIsiCepat {
  teacher_id: string
  /** null = kosongkan (pakai rincian); tidak ada kunci = tidak diubah. */
  nilai: Partial<Record<KolomIsiCepat, number | null>>
}

/**
 * Isi cepat KPI: nilai akhir tiap indikator untuk banyak guru sekaligus,
 * tanpa membuka formulir rinci satu per satu.
 *
 * Baris yang sudah ada hanya diubah kolom nilainya — rincian harian & isian
 * mentah tetap tersimpan, jadi mengosongkan sel kembali memakai rincian.
 * Baris baru dibuat bila ada minimal satu nilai; posisi hafalannya diambil
 * dari Setoran Guru. Rapor yang terbit/banding dilewati, bukan ditimpa.
 */
export async function simpanIsiCepatKpiAction(
  year: number, month: number, baris: BarisIsiCepat[],
): Promise<{ error?: string; success?: boolean; disimpan?: number; terkunci?: number }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canInputKpi(session.role)) return { error: 'Tidak memiliki izin mengisi KPI.' }
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return { error: 'Periode tidak sah.' }
  if (!Array.isArray(baris) || baris.length === 0) return { error: 'Tidak ada perubahan untuk disimpan.' }

  const supabase = createServerClient()
  const ids = baris.map(b => b.teacher_id)
  const [adaRes, guruRes] = await Promise.all([
    supabase.from('kpi_monthly').select('id, teacher_id, status').eq('year', year).eq('month', month).in('teacher_id', ids),
    supabase.from('teachers').select('id, unit').in('id', ids),
  ])
  const ada = new Map(((adaRes.data ?? []) as { id: string; teacher_id: string; status: KpiRaporStatus }[]).map(r => [r.teacher_id, r]))
  const unitGuru = new Map(((guruRes.data ?? []) as { id: string; unit: Jenjang | null }[]).map(g => [g.id, g.unit]))
  const galatMigrasi = (m?: string) => m?.includes('nilai_')
    ? 'Jalankan drizzle/0097_kpi_nilai_langsung_PASTE_TO_SUPABASE.sql lebih dulu.'
    : 'Gagal menyimpan sebagian nilai.'

  let disimpan = 0, jumlahTerkunci = 0
  for (const b of baris) {
    // Hanya kolom yang dikenal, dijepit ke 0–100.
    const nilai: Record<string, number | null> = {}
    for (const k of KOLOM_ISI_CEPAT) {
      if (!(k in b.nilai)) continue
      const v = b.nilai[k]
      if (v === null || v === undefined) {
        // bacaan_score tidak boleh NULL: kosong berarti tidak diubah.
        if (k !== 'bacaan_score') nilai[k] = null
        continue
      }
      const n = Number(v)
      if (Number.isFinite(n)) nilai[k] = Math.max(0, Math.min(100, n))
    }
    if (Object.keys(nilai).length === 0) continue

    const lama = ada.get(b.teacher_id)
    const stempel = { updated_by: session.userId, updated_at: new Date().toISOString() }
    if (lama) {
      if (terkunci(lama.status)) { jumlahTerkunci++; continue }
      const { error } = await supabase.from('kpi_monthly').update({ ...nilai, ...stempel }).eq('id', lama.id)
      if (error) return { error: galatMigrasi(error.message) }
    } else {
      if (Object.values(nilai).every(v => v === null)) continue
      const unit = unitGuru.get(b.teacher_id) ?? null
      const isian = await getIsianKpiSetoran(b.teacher_id, year, month, unit)
      const { error } = await supabase.from('kpi_monthly').insert({
        teacher_id: b.teacher_id, year, month, unit, ...nilai, ...stempel, created_by: session.userId,
        ...(isian.hafalan_juz !== undefined ? { hafalan_juz: isian.hafalan_juz, hafalan_pages: isian.hafalan_pages ?? 0 } : {}),
        ...(isian.tuhfatul_bait !== undefined ? { tuhfatul_bait: isian.tuhfatul_bait } : {}),
      })
      if (error) return { error: galatMigrasi(error.message) }
    }
    disimpan++
  }

  revalidatePath('/kpi')
  revalidatePath('/kpi/isi-cepat')
  revalidatePath('/kpi/cetak')
  return { success: true, disimpan, terkunci: jumlahTerkunci }
}
