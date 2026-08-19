/**
 * Impor kelompok pembinaan guru & karyawan TA 2026/2027.
 * Jalankan: npm run seed:gukar
 *
 * Sumber: "Rekapan Tahsin dan Tahfidz Gukar SIT LHI (2026).xlsx" — 15 lembar
 * per pengampu, disaring jadi scripts/data/gukar-2026.json.
 *
 * Idempoten: kelompok di-upsert berdasarkan (term, nama), peserta berdasarkan
 * (kelompok, nama). Menjalankan ulang tidak menggandakan dan tidak menyentuh
 * catatan bulanan yang sudah diisi pengampu.
 *
 * Prasyarat migrasi: 0021 (academic_terms) dan 0023 (gukar).
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
  group: string
  name: string
  unit: string
  kind: string
  level: string
}

/**
 * Pengampu tiap kelompok, dipetakan ke username akun guru.
 *
 * Nama lembar di workbook memakai panggilan ("Ust Aul", "Ust Fariz"), jadi
 * pemetaannya ditulis eksplisit di sini — menebaknya dari kemiripan nama
 * pernah salah sasaran, dan salah pengampu berarti orang yang keliru bisa
 * mengisi capaian kelompok orang lain.
 */
const PENGAMPU: Record<string, string | null> = {
  'Ust. Habiburrahman': 'muhammad_habiburrahman',
  'Ust Habib Musyrifah': 'muhammad_habiburrahman',
  'Ust Maulana': 'maulana_achmad',
  'Ust Maulana Musyrif': 'maulana_achmad',
  'Ust Fariz': 'mohammad_fariz',
  'Ust Hendra Kusuma': 'hendra_kusuma',
  'Ust Hendra LHI Juara': 'hendra_kusuma',
  'Ust Akhid Akhmad Efendi': 'akhid_akhmad',
  'Ust Erna': 'erna',
  'Ust Herlina Wati': 'herlina_wati',
  'Ust Rima Grup Persiapan': 'rima_indah',
  'Ust Nisa Shalihah': 'nisa_shalihah',
  'Ust Sella': 'sella_andriani',
  'Ust Aul': 'luluk_aulia',
  'Ust Khanifah (PAUD)': 'khanifah_inabah',
}

/** Unit kelompok, untuk kelompok yang pesertanya tidak membawa unit dari rekap. */
const GROUP_UNIT: Record<string, string> = {
  'Ust. Habiburrahman': 'BPH & Kepala',
  'Ust Habib Musyrifah': 'Musyrifah',
  'Ust Maulana': 'SMPIT LHI',
  'Ust Maulana Musyrif': 'Musyrif',
  'Ust Fariz': 'SDIT LHI',
  'Ust Hendra Kusuma': 'SDIT LHI',
  'Ust Hendra LHI Juara': 'SD LHI Juara',
  'Ust Akhid Akhmad Efendi': 'SDIT LHI',
  'Ust Erna': 'SDIT LHI',
  'Ust Herlina Wati': 'SDIT LHI',
  'Ust Rima Grup Persiapan': 'SDIT LHI',
  'Ust Nisa Shalihah': 'SDIT LHI',
  'Ust Sella': 'SMPIT LHI',
  'Ust Aul': 'SMPIT LHI',
  'Ust Khanifah (PAUD)': 'PAUD',
}

/**
 * Khanifah Inabah mengampu kelompok PAUD tapi belum ada di daftar MPP RQ,
 * jadi akunnya dibuat di sini. Statusnya sengaja dikosongkan — biar SDM yang
 * menetapkan jenis kepegawaian dan masa kontraknya lewat panel.
 */
const PENGAMPU_BARU = [
  { username: 'khanifah_inabah', full_name: 'Khanifah Inabah, S.Pd.I', unit: 'paud' },
]

function normalizeKind(raw: string): 'guru' | 'karyawan' | null {
  const value = raw.trim().toLowerCase()
  if (value === 'guru') return 'guru'
  if (value === 'karyawan') return 'karyawan'
  return null
}

async function main() {
  console.log('Impor kelompok pembinaan guru & karyawan\n')

  const rows = JSON.parse(
    readFileSync(resolve(process.cwd(), 'scripts/data/gukar-2026.json'), 'utf8'),
  ) as Row[]

  const { data: term } = await supabase
    .from('academic_terms').select('id, year_label, semester').eq('is_current', true).maybeSingle()
  if (!term) {
    console.error('Belum ada semester berjalan. Tetapkan dulu di /tahun-ajaran.')
    process.exit(1)
  }
  console.log(`Semester berjalan: ${term.year_label} ${term.semester}\n`)

  // ── Akun pengampu yang belum ada ──────────────────────────
  for (const teacher of PENGAMPU_BARU) {
    const { data: existing } = await supabase
      .from('teachers').select('id').eq('username', teacher.username).maybeSingle()
    if (existing) {
      console.log(`  · ${teacher.username} sudah ada`)
      continue
    }
    // Password disamakan dengan guru lain; hash-nya diambil dari akun yang
    // sudah ada supaya tidak perlu menuliskan sandinya di berkas ini.
    const { data: sample } = await supabase
      .from('teachers').select('password_hash').eq('username', 'erna').maybeSingle()
    if (!sample) {
      console.error('  ✗ tidak menemukan akun rujukan untuk menyalin password.')
      process.exit(1)
    }
    const { error } = await supabase.from('teachers').insert({
      username: teacher.username,
      full_name: teacher.full_name,
      unit: teacher.unit,
      password_hash: sample.password_hash,
      is_active: true,
    })
    console.log(error ? `  ✗ ${teacher.username}: ${error.message}` : `  + ${teacher.username} dibuat`)
  }

  const { data: teacherRows } = await supabase.from('teachers').select('id, username')
  const teacherId = new Map(
    ((teacherRows ?? []) as { id: string; username: string }[]).map(t => [t.username, t.id]),
  )

  // ── Kelompok ──────────────────────────────────────────────
  console.log('\nKelompok:')
  const groupNames = [...new Set(rows.map(r => r.group))].sort()
  const groupId = new Map<string, string>()

  for (const [index, name] of groupNames.entries()) {
    const username = PENGAMPU[name] ?? null
    const pengampu = username ? teacherId.get(username) ?? null : null
    if (username && !pengampu) console.log(`  ! pengampu '${username}' tidak ditemukan untuk ${name}`)

    const payload = {
      term_id: term.id,
      name,
      pengampu_id: pengampu,
      unit: GROUP_UNIT[name] ?? '',
      display_order: index + 1,
      is_active: true,
    }

    const { data, error } = await supabase
      .from('gukar_groups')
      .upsert(payload, { onConflict: 'term_id,name' })
      .select('id')
      .single()

    if (error || !data) {
      console.log(`  ✗ ${name}: ${error?.message}`)
      continue
    }
    groupId.set(name, data.id)
    console.log(`  · ${name.padEnd(28)} → ${username ?? 'tanpa pengampu'}`)
  }

  // ── Peserta ───────────────────────────────────────────────
  const participants = rows.flatMap(row => {
    const gid = groupId.get(row.group)
    if (!gid) return []
    return [{
      group_id: gid,
      full_name: row.name,
      unit: row.unit || GROUP_UNIT[row.group] || '',
      kind: normalizeKind(row.kind),
      level_awal: row.level,
      is_active: true,
    }]
  })

  const { error: pError } = await supabase
    .from('gukar_participants')
    .upsert(participants, { onConflict: 'group_id,full_name' })

  if (pError) {
    console.error(`\n✗ Gagal menyimpan peserta: ${pError.message}`)
    process.exit(1)
  }

  // ── Verifikasi ────────────────────────────────────────────
  const { data: check } = await supabase
    .from('gukar_participants')
    .select('group_id, kind, level_awal')
  const all = (check ?? []) as { group_id: string; kind: string | null; level_awal: string }[]

  console.log(`\nSelesai: ${groupId.size} kelompok, ${all.length} peserta.`)
  console.log(`  jenis terisi : ${all.filter(p => p.kind).length}`)
  console.log(`  level terisi : ${all.filter(p => p.level_awal).length}`)
  console.log('\nPengampu mengisi di /guru/gukar; SDM melihat rekapnya di /dashboard/sdm/gukar.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
