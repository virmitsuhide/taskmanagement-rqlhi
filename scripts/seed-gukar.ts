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

interface GroupConfig {
  name: string
  /** Username akun guru pengampu, atau null kalau belum ditetapkan. */
  pengampu: string | null
  unit: string
  /** Pengampu yang belum punya akun guru — dibuatkan saat impor. */
  buatAkun?: { full_name: string; unit: string }
}

/**
 * Daftar peserta dan susunan kelompok dibaca dari berkas data, bukan ditulis
 * di dalam kode.
 *
 * Repositori ini publik, sedangkan keduanya memuat nama orang. Memisahkannya
 * membuat logika impor tetap bisa dibagikan dan ditinjau, sementara datanya
 * tinggal di komputer yang menjalankannya — scripts/data/ masuk .gitignore.
 */
function loadData<T>(file: string): T[] {
  const path = resolve(process.cwd(), 'scripts/data', file)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T[]
  } catch {
    console.error(`Tidak menemukan ${path}.`)
    console.error('Berkas ini tidak ikut di repositori karena memuat nama pegawai.')
    console.error('Salin dari sumber rekapan, atau minta ke pengurus yang punya salinannya.')
    process.exit(1)
  }
}

function normalizeKind(raw: string): 'guru' | 'karyawan' | null {
  const value = raw.trim().toLowerCase()
  if (value === 'guru') return 'guru'
  if (value === 'karyawan') return 'karyawan'
  return null
}

async function main() {
  console.log('Impor kelompok pembinaan guru & karyawan\n')

  const rows = loadData<Row>('gukar-2026.json')
  const groups = loadData<GroupConfig>('gukar-groups-2026.json')
  const configOf = new Map(groups.map(g => [g.name, g]))

  const { data: term } = await supabase
    .from('academic_terms').select('id, year_label, semester').eq('is_current', true).maybeSingle()
  if (!term) {
    console.error('Belum ada semester berjalan. Tetapkan dulu di /tahun-ajaran.')
    process.exit(1)
  }
  console.log(`Semester berjalan: ${term.year_label} ${term.semester}\n`)

  // ── Akun pengampu yang belum ada ──────────────────────────
  const perluAkun = groups
    .filter(g => g.pengampu && g.buatAkun)
    .map(g => ({ username: g.pengampu!, ...g.buatAkun! }))

  for (const teacher of perluAkun) {
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
    const username = configOf.get(name)?.pengampu ?? null
    const pengampu = username ? teacherId.get(username) ?? null : null
    if (username && !pengampu) console.log(`  ! pengampu '${username}' tidak ditemukan untuk ${name}`)

    const payload = {
      term_id: term.id,
      name,
      pengampu_id: pengampu,
      unit: configOf.get(name)?.unit ?? '',
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
      unit: row.unit || configOf.get(row.group)?.unit || '',
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
  console.log('\nPengampu mengisi di /guru/gukar; SDM melihat rekapnya di /dashboard/analitik/gukar.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
