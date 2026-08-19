/**
 * Impor capaian bulanan siswa SD — Juni, Juli, Agustus 2026.
 * Jalankan: npm run seed:capaian
 *
 * Sumber: "Database Quran SD 2026-2027.xlsx", lembar Kelompok Y1–Y6,
 * disaring jadi scripts/data/capaian-sd-2026.json.
 *
 * ── BULAN MANA SAJA & KENAPA ────────────────────────────────
 *
 * Hanya tiga bulan yang datanya benar-benar ada di sumbernya:
 *   Juni 2026    — capaian AKHIR tahun ajaran lalu, 96-98% terisi.
 *                  Bukan bagian Semester Ganjil (yang mulai Juli), tapi
 *                  disimpan karena inilah titik berangkat tiap anak.
 *   Juli 2026    — capaian akhir, 70-75% terisi. Bulan pertama semester.
 *   Agustus 2026 — capaian AWAL saja, 60-62% terisi. Kolom akhirnya belum
 *                  diisi guru karena bulannya memang masih berjalan.
 *
 * Mei dan bulan-bulan lain punya kolom di template tapi tidak pernah diisi,
 * jadi tidak diimpor sama sekali. Membuat baris kosong untuk bulan yang tak
 * pernah dicatat hanya akan membuat rekap kehadiran terlihat bolong padahal
 * memang tidak ada kegiatannya.
 *
 * SMP tidak punya padanan: lembar Pengelompokan Siswa hanya memuat satu
 * kolom "Capaian Terakhir", tanpa rincian bulanan.
 *
 * Idempoten: upsert pada (student_id, period).
 * Prasyarat migrasi: 0024 (tabel student_monthly).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

interface Row {
  nama: string
  kelas: string
  level: string
  juni_tahsin: string
  juni_tahfidz: string
  juli_tahsin: string
  juli_tahfidz: string
  agst_tahsin: string
  agst_tahfidz: string
}

interface MonthlyRow {
  student_id: string
  period: string
  level: string
  halaman_awal_tahsin: string
  halaman_akhir_tahsin: string
  tahfidz_awal: string
  tahfidz_akhir: string
  catatan: string
}

async function main() {
  console.log('Impor capaian bulanan SD — Juni, Juli, Agustus 2026\n')

  const path = resolve(process.cwd(), 'scripts/data/capaian-sd-2026.json')
  let rows: Row[]
  try {
    rows = JSON.parse(readFileSync(path, 'utf8')) as Row[]
  } catch {
    console.error(`Tidak menemukan ${path}.`)
    console.error('Berkas ini tidak ikut di repositori karena memuat nama siswa.')
    process.exit(1)
  }

  const probe = await supabase.from('student_monthly').select('id').limit(1)
  if (probe.error) {
    console.error('Tabel student_monthly belum ada — jalankan migrasi 0024 lebih dulu.')
    process.exit(1)
  }

  const { data: studentRows } = await supabase
    .from('students').select('id, full_name, kelas').eq('jenjang', 'sd')
  const students = (studentRows ?? []) as { id: string; full_name: string; kelas: string | null }[]

  // Kunci alaminya nama + kelas, sama seperti saat roster diimpor.
  const idOf = new Map(students.map(s => [`${s.full_name}|${s.kelas}`, s.id]))

  // Sebagian anak tercatat dua kali di lembar sumber, kadang dengan isi yang
  // berbeda — satu baris terisi capaian Juli, kembarannya tidak. Yang dipakai
  // adalah baris TERLENGKAP, bukan yang terakhir ditemui: membiarkan urutan
  // baris yang menentukan berarti data yang sudah diisi guru bisa tertimpa
  // baris kosong. Tanpa penggabungan ini, upsert juga gagal karena satu
  // (siswa, bulan) muncul dua kali dalam satu perintah.
  const terlengkap = new Map<string, Row>()
  const isiCount = (r: Row) =>
    [r.juni_tahsin, r.juni_tahfidz, r.juli_tahsin, r.juli_tahfidz, r.agst_tahsin, r.agst_tahfidz]
      .filter(Boolean).length

  for (const row of rows) {
    const key = `${row.nama}|${row.kelas}`
    const ada = terlengkap.get(key)
    if (!ada || isiCount(row) > isiCount(ada)) terlengkap.set(key, row)
  }
  const digabung = rows.length - terlengkap.size
  if (digabung > 0) console.log(`${digabung} baris kembar digabung — diambil yang terlengkap\n`)

  const payload: MonthlyRow[] = []
  const tidakKetemu: string[] = []

  for (const row of terlengkap.values()) {
    const id = idOf.get(`${row.nama}|${row.kelas}`)
    if (!id) { tidakKetemu.push(`${row.nama} (${row.kelas})`); continue }

    // Juni: hanya capaian akhir yang tercatat — itu penutup tahun lalu.
    if (row.juni_tahsin || row.juni_tahfidz) {
      payload.push({
        student_id: id, period: '2026-06-01', level: row.level,
        halaman_awal_tahsin: '', halaman_akhir_tahsin: row.juni_tahsin,
        tahfidz_awal: '', tahfidz_akhir: row.juni_tahfidz,
        catatan: 'Capaian akhir TA 2025/2026 — titik berangkat semester ini',
      })
    }

    // Juli: capaian akhir. Awalnya = akhir Juni, jadi ikut diisikan supaya
    // rentang bulan itu terbaca utuh tanpa guru mengetik ulang.
    if (row.juli_tahsin || row.juli_tahfidz) {
      payload.push({
        student_id: id, period: '2026-07-01', level: row.level,
        halaman_awal_tahsin: row.juni_tahsin, halaman_akhir_tahsin: row.juli_tahsin,
        tahfidz_awal: row.juni_tahfidz, tahfidz_akhir: row.juli_tahfidz,
        catatan: '',
      })
    }

    // Agustus: baru capaian awal. Kolom akhir sengaja dibiarkan kosong —
    // bulannya masih berjalan, dan mengisinya dengan tebakan akan tampak
    // seperti sudah dinilai.
    if (row.agst_tahsin || row.agst_tahfidz) {
      payload.push({
        student_id: id, period: '2026-08-01', level: row.level,
        halaman_awal_tahsin: row.agst_tahsin, halaman_akhir_tahsin: '',
        tahfidz_awal: row.agst_tahfidz, tahfidz_akhir: '',
        catatan: '',
      })
    }
  }

  console.log(`Siswa unik        : ${terlengkap.size}`)
  console.log(`Tidak ketemu di DB: ${tidakKetemu.length}`)
  tidakKetemu.slice(0, 8).forEach(n => console.log(`   ⚠ ${n}`))
  if (tidakKetemu.length > 8) console.log(`   …dan ${tidakKetemu.length - 8} lagi`)
  console.log(`Baris bulanan     : ${payload.length}\n`)

  // Ditulis per potongan: satu upsert berisi ribuan baris melampaui batas
  // ukuran permintaan PostgREST.
  let tersimpan = 0
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200)
    const { error } = await supabase
      .from('student_monthly')
      .upsert(chunk, { onConflict: 'student_id,period' })
    if (error) { console.error(`✗ Gagal pada potongan ${i}: ${error.message}`); process.exit(1) }
    tersimpan += chunk.length
  }

  const perBulan: Record<string, number> = {}
  for (const p of payload) perBulan[p.period] = (perBulan[p.period] ?? 0) + 1

  console.log(`Tersimpan: ${tersimpan}`)
  for (const [period, n] of Object.entries(perBulan).sort()) {
    console.log(`  ${period}  ${n} siswa`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
