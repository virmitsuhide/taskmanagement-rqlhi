/**
 * Isi indikator KPI bulanan dengan nilai maksimal — Agustus 2026.
 * Jalankan: npm run kpi:maksimal            (kering, tidak menulis)
 *           npm run kpi:maksimal -- --tulis
 *
 * ── APA YANG DIISI, DAN APA YANG TIDAK ──────────────────────
 *
 * Tiga indikator SENGAJA TIDAK DISENTUH karena angkanya harus datang dari
 * pengukuran nyata, bukan dari anggapan sempurna:
 *
 *   • Kedisiplinan Hadir   — late_minutes, sudah diisi dari rekap absensi SDM
 *                            lewat scripts/impor-keterlambatan-kpi.ts
 *   • Hafalan Al-Qur'an    — hafalan_juz & hafalan_pages, dibiarkan apa adanya
 *   • Hafalan Tuhfatul     — tuhfatul_bait, dibiarkan apa adanya
 *
 * Delapan sisanya diisi pada nilai tertinggi yang mungkin menurut rubrik unit
 * (lib/kpi/parameter.ts). Angkanya diturunkan dari parameter, bukan ditulis
 * sebagai bilangan telanjang: kalau unit mengubah jumlah hari penilaian atau
 * poin per pertemuan, skrip ini ikut menyesuaikan tanpa disunting.
 *
 * ── KENAPA INI SAH ──────────────────────────────────────────
 *
 * Ini titik berangkat, bukan penilaian akhir. Rapor tetap berstatus draft dan
 * belum terlihat guru; SDM menurunkan angka yang tidak sesuai kenyataan lewat
 * /kpi/isi sebelum mengajukannya ke koordinator. Mengisi dari atas lebih cepat
 * daripada dari nol karena mayoritas guru memang memenuhi sebagian besar butir.
 *
 * ── YANG DILEWATI ───────────────────────────────────────────
 *
 * Baris di luar status draft/dikembalikan dilewati, sealasan dengan skrip
 * impor keterlambatan: bolehDisuntingSdm() melarang SDM menyuntingnya karena
 * rapornya sudah berjalan di alur pengesahan.
 *
 * Idempoten: menjalankan dua kali menghasilkan keadaan yang sama.
 * Prasyarat migrasi: 0034 (kpi_monthly), 0050 (kolom status).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'node:path'
import { paramFor } from '../lib/kpi/parameter'
import { hitungKpi } from '../lib/kpi/hitung'
import type { Jenjang } from '../types'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const TAHUN = 2026
const BULAN = 8

/** Status yang masih boleh disunting SDM — sepadan bolehDisuntingSdm(). */
const BOLEH_SUNTING = new Set(['draft', 'dikembalikan'])

/** Nilai tertinggi tiap medan menurut rubrik unit guru bersangkutan. */
function maksimal(unit: Jenjang | null) {
  const P = paramFor(unit)
  return {
    db_late_days: '0',                                   // 0 hari telat = 100
    bacaan_score: '100',                                 // sudah berupa nilai 0-100
    buku_pegangan_meetings: String(P.pertemuanBukuPegangan), // 4 + 16x6 = 100
    izin_wa_cases: '0',                                  // tanpa pengurang
    pengganti_cases: '0',                                // tidak pernah izin = 100
    pengganti_found: '0',
    seragam_daily: Array(P.hariPenilaian).fill(P.poinSeragamPerHari),      // 20 x 5
    lapor_ortu_daily: Array(P.hariLaporOrtu).fill(P.poinLaporOrtuPerHari), // 16 x 5 + 20
    halaqoh_hadir: Array(P.pertemuanHalaqoh).fill(P.poinHadirHalaqoh),     // 16 x 3
    halaqoh_akhiri: Array(P.pertemuanHalaqoh).fill(P.poinAkhiriHalaqoh),   // 16 x 3
    // Grid harian menang atas total; totalnya dikosongkan supaya tidak ada
    // dua sumber kebenaran untuk indikator yang sama.
    seragam_total: null,
    lapor_ortu_total: null,
    halaqoh_total: null,
  }
}

const angka = (v: unknown) => Number(v ?? 0)

async function main() {
  const tulis = process.argv.includes('--tulis')
  const db = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log(`\nIsi KPI maksimal — ${BULAN}/${TAHUN}`)
  console.log(tulis ? 'MODE: MENULIS ke database\n' : 'MODE: KERING (tambahkan --tulis untuk menyimpan)\n')
  console.log('TIDAK disentuh: late_minutes, hafalan_juz, hafalan_pages, tuhfatul_bait\n')

  const { data: baris, error } = await db
    .from('kpi_monthly')
    .select('id,status,unit,late_minutes,hafalan_juz,hafalan_pages,tuhfatul_bait,teachers(full_name)')
    .eq('year', TAHUN).eq('month', BULAN)
  if (error) throw error

  const olah = (baris ?? []).filter(r => BOLEH_SUNTING.has(r.status))
  const lewat = (baris ?? []).filter(r => !BOLEH_SUNTING.has(r.status))

  console.log(`Baris diproses : ${olah.length}`)
  console.log(`Baris dilewati : ${lewat.length}`)
  for (const r of lewat) {
    console.log(`   ${(r.teachers as unknown as { full_name: string }).full_name} — status "${r.status}"`)
  }

  console.log('\nPratinjau nilai rapor setelah diisi:')
  const sebaran = new Map<string, number>()
  for (const r of olah) {
    const unit = (r.unit ?? null) as Jenjang | null
    const M = maksimal(unit)
    const hasil = hitungKpi(
      {
        lateMinutes: angka(r.late_minutes),
        dbLateDays: 0,
        hafalanJuz: angka(r.hafalan_juz),
        hafalanPages: angka(r.hafalan_pages),
        tuhfatulBait: angka(r.tuhfatul_bait),
        bacaanScore: 100,
        bukuPeganganMeetings: paramFor(unit).pertemuanBukuPegangan,
        izinWaCases: 0,
        penggantiCases: 0,
        penggantiFound: 0,
      },
      {
        seragamDaily: M.seragam_daily, laporOrtuDaily: M.lapor_ortu_daily,
        halaqohHadir: M.halaqoh_hadir, halaqohAkhiri: M.halaqoh_akhiri,
        seragamTotal: null, laporOrtuTotal: null, halaqohTotal: null,
      },
      unit,
    )
    const nama = (r.teachers as unknown as { full_name: string }).full_name
    console.log(`   ${nama.padEnd(38)} telat ${String(angka(r.late_minutes)).padStart(3)} mnt  ->  rapot ${hasil.rapot.toFixed(1)}  (${hasil.predikat})`)
    sebaran.set(hasil.predikat, (sebaran.get(hasil.predikat) ?? 0) + 1)
  }
  console.log('\nSebaran predikat:', JSON.stringify(Object.fromEntries(sebaran)))

  if (!tulis) {
    console.log('\nTidak ada yang ditulis. Ulangi dengan --tulis bila hasil di atas benar.')
    return
  }

  for (const r of olah) {
    const { error: e } = await db.from('kpi_monthly')
      .update(maksimal((r.unit ?? null) as Jenjang | null)).eq('id', r.id)
    if (e) throw e
  }
  console.log(`\nSelesai. ${olah.length} baris diperbarui.`)
}

main().catch(e => { console.error(e); process.exit(1) })
