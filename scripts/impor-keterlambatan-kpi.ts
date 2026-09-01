/**
 * Impor keterlambatan hadir guru ke KPI bulanan — Agustus 2026.
 * Jalankan: npm run impor:keterlambatan          (kering, tidak menulis)
 *           npm run impor:keterlambatan -- --tulis
 *
 * Sumber: rekap absensi Agustus 2026 dari SDM, 33 baris. Kolom "HARI MASUK"
 * ikut dicatat di sini sebagai konteks meski TIDAK disimpan — kpi_monthly tidak
 * punya medan untuk itu, dan angkanya hanya dipakai untuk memverifikasi bahwa
 * menitnya memang akumulasi sebulan, bukan rata-rata harian.
 *
 * ── KENAPA TOTAL, BUKAN RATA-RATA ───────────────────────────
 *
 * Rubriknya (lib/kpi/hitung.ts) memberi 100 untuk ≤20 menit. Dibaca sebagai
 * rata-rata per hari, keterlambatan terberat di rekap ini pun hanya 4,9 menit
 * — ke-33 guru akan bernilai 100 dan indikatornya berhenti membedakan siapa
 * pun. Dibaca sebagai total sebulan, sebarannya 100×23 · 80×5 · 60×2 · 40×2 ·
 * 20×1. Yang kedua yang dimaksud SDM.
 *
 * ── YANG SENGAJA TIDAK DISENTUH ─────────────────────────────
 *
 * Baris yang statusnya di luar draft/dikembalikan DILEWATI, bukan ditimpa.
 * bolehDisuntingSdm() melarang SDM menyuntingnya lewat aplikasi karena rapornya
 * sudah berjalan di alur pengesahan; skrip yang menembus itu lewat service role
 * akan diam-diam mengubah angka yang sudah diajukan ke koordinator. Yang
 * dilewati dilaporkan di akhir supaya bisa ditindaklanjuti lewat alur resmi.
 *
 * Idempoten: baris draft di-update di tempat, guru tanpa baris dibuatkan draft
 * baru. Menjalankan dua kali menghasilkan keadaan yang sama.
 * Prasyarat migrasi: 0034 (kpi_monthly), 0050 (kolom status).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'node:path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const TAHUN = 2026
const BULAN = 8

/** [nama sesuai rekap SDM, hari masuk, total keterlambatan (menit)] */
const REKAP: [string, number, number][] = [
  ['Rima Indah Puspa', 20, 47],
  ['Nisa Shalihah', 23, 4],
  ['Akhid Akhmad Efendi', 22, 34],
  ['Hendra Kusuma', 23, 0],
  ['Herlina Wati', 22, 80],
  ['Sella Andriani', 23, 113],
  ['Luluk Aulia', 22, 0],
  ['Dewi Maghfiroh', 23, 0],
  ['Maulana Achmad', 20, 19],
  ['M.Habiburrahman Al Fatih', 23, 48],
  ['Rizka Widiastuti', 0, 0],
  ['Erna', 21, 37],
  ['Mohammad Fariz Setyawan', 22, 20],
  ['Afifah Nurlaila, S.E', 21, 1],
  ['Nardiani', 20, 9],
  ['Hairiennisa Rohaya, SEI., MSI', 21, 4],
  ['Rafiqoh Hulwa Mahfudah', 21, 9],
  ['Siti Hanifah', 21, 4],
  ['Dzikrina Nur Faizah', 20, 27],
  ['Shabira Harum Kusumanafisa, S.I.Kom', 21, 0],
  ['Ayolla Tri Andani, S.Pd.', 21, 0],
  ['Bani Afnidar Hidayah, S.P', 21, 0],
  ['Mujibullah Latif, S.E.', 20, 12],
  ['Muhammad Fawwaz Alifiyanto', 16, 63],
  ['Hamdan, SH.', 20, 0],
  ['Nunung Khasanah', 16, 0],
  ['Dian Tri Kusuma Dewi, S.Pd.', 23, 0],
  ['Minkhatul Maula Sofa, S.S.I', 21, 14],
  ['Dhea Aulia Azizah', 21, 3],
  ['Maulana Rizky Amrullah, S.Sos.', 22, 78],
  ['Zaky Zakaria, S.Pd.', 22, 8],
  ['Achmad Naufal, S.H', 22, 67],
  ['Dewi Ayu Lestari', 17, 4],
]

/** Status yang masih boleh disunting SDM — sepadan bolehDisuntingSdm(). */
const BOLEH_SUNTING = new Set(['draft', 'dikembalikan'])

/**
 * Normalisasi nama untuk pencocokan.
 *
 * Rekap SDM dan tabel teachers menulis nama yang sama dengan cara berbeda:
 * gelar kadang ada kadang tidak, "Akhmad"/"Ahmad" dan "M."/"Muhammad"
 * bertukar, dan satu nama di database memakai garis bawah (Nunung_Khasanah).
 * Semua itu diratakan di sini, bukan diperbaiki di sumbernya, supaya rekap
 * bulan berikutnya bisa ditempel apa adanya.
 */
function normal(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[._,]/g, ' ')
    .replace(/\b(s|m)\s+(pd|ag|si|hum|e|sos|h|pi|kom|a|sei|msi)\b/g, ' ')
    .replace(/\b(muhammad|mohammad|m)\b/g, 'muh')
    .replace(/akhmad/g, 'ahmad')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Guru { id: string; full_name: string; unit: string | null; n: string }

/** Persis dulu, lalu awalan, lalu (nama depan + nama belakang) yang sama. */
function cari(nama: string, daftar: Guru[]): Guru | undefined {
  const n = normal(nama)
  const persis = daftar.find(g => g.n === n)
  if (persis) return persis
  const awalan = daftar.find(g => g.n.startsWith(n) || n.startsWith(g.n))
  if (awalan) return awalan
  const a = n.split(' ')
  return daftar.find(g => {
    const b = g.n.split(' ')
    return a[0] === b[0] && a[a.length - 1] === b[b.length - 1]
  })
}

async function main() {
  const tulis = process.argv.includes('--tulis')
  const db = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log(`\nImpor keterlambatan KPI — ${BULAN}/${TAHUN}`)
  console.log(tulis ? 'MODE: MENULIS ke database\n' : 'MODE: KERING (tambahkan --tulis untuk menyimpan)\n')

  // Guru yang sudah dihapus lunak DIKECUALIKAN dari pencocokan. Tanpa ini,
  // nama sisa akun percobaan bisa menyerap satu baris rekap dan membuatkannya
  // rapor KPI — rapor untuk orang yang sudah tidak ada di aplikasi.
  const { data: guruRaw, error: e1 } = await db
    .from('teachers').select('id,full_name,unit').is('deleted_at', null)
  if (e1) throw e1
  const daftar: Guru[] = (guruRaw ?? []).map(g => ({ ...g, n: normal(g.full_name) }))

  const { data: adaRaw, error: e2 } = await db
    .from('kpi_monthly').select('id,teacher_id,status,late_minutes')
    .eq('year', TAHUN).eq('month', BULAN)
  if (e2) throw e2
  const ada = new Map((adaRaw ?? []).map(r => [r.teacher_id, r]))

  const baru: { teacher_id: string; year: number; month: number; late_minutes: string; unit: string | null }[] = []
  const ubah: { id: string; late_minutes: string; nama: string; dari: number }[] = []
  const lewat: string[] = []
  const gagal: string[] = []

  for (const [nama, hari, menit] of REKAP) {
    const guru = cari(nama, daftar)
    if (!guru) {
      gagal.push(`${nama} (hari=${hari}, menit=${menit})`)
      continue
    }
    const baris = ada.get(guru.id)
    if (!baris) {
      baru.push({
        teacher_id: guru.id, year: TAHUN, month: BULAN,
        late_minutes: String(menit), unit: guru.unit,
      })
    } else if (BOLEH_SUNTING.has(baris.status)) {
      ubah.push({ id: baris.id, late_minutes: String(menit), nama: guru.full_name, dari: Number(baris.late_minutes) })
    } else {
      lewat.push(`${guru.full_name} — status "${baris.status}", tersimpan ${baris.late_minutes} menit, rekap ${menit} menit`)
    }
  }

  console.log(`Baris draft BARU dibuat      : ${baru.length}`)
  console.log(`Baris draft DIPERBARUI       : ${ubah.length}`)
  for (const u of ubah) console.log(`   ${u.nama}: ${u.dari} -> ${u.late_minutes} menit`)
  console.log(`DILEWATI (di luar draft)     : ${lewat.length}`)
  for (const l of lewat) console.log(`   ${l}`)
  console.log(`NAMA TIDAK DIKENALI          : ${gagal.length}`)
  for (const g of gagal) console.log(`   ${g}`)

  if (!tulis) {
    console.log('\nTidak ada yang ditulis. Ulangi dengan --tulis bila hasil di atas benar.')
    return
  }

  if (baru.length > 0) {
    const { error } = await db.from('kpi_monthly').insert(baru)
    if (error) throw error
  }
  for (const u of ubah) {
    const { error } = await db.from('kpi_monthly')
      .update({ late_minutes: u.late_minutes }).eq('id', u.id)
    if (error) throw error
  }
  console.log(`\nSelesai. ${baru.length} baris dibuat, ${ubah.length} diperbarui.`)
}

main().catch(e => { console.error(e); process.exit(1) })
