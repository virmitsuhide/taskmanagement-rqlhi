/**
 * Impor roster siswa & pembagian halaqoh TA 2026/2027.
 * Jalankan: npm run seed:siswa
 *
 * Sumber: "Pengelompokan Siswa.xlsx" (SMP) dan "Database Quran SD
 * 2026-2027.xlsx" (SD), disaring jadi scripts/data/siswa-2026.json.
 *
 * Idempoten: halaqoh dicocokkan berdasarkan (semester, nama), siswa
 * berdasarkan (nama, jenjang, kelas). Menjalankan ulang memperbarui
 * penempatan, tidak menggandakan, dan tidak menyentuh setoran yang sudah ada.
 *
 * Prasyarat migrasi: 0021 (academic_terms & halaqoh_members) dan 0024
 * (kolom level_awal).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { sesiOf } from '@/lib/rq/sesi'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

interface Row {
  jenjang: 'sd' | 'smp'
  kelas: string
  gender: string
  nama: string
  tempat: string
  pengampu: string
  level: string
  tahfidz: string
}

/** Data pribadi tidak ikut repositori — lihat .gitignore pada scripts/data/. */
function loadData<T>(file: string): T {
  const path = resolve(process.cwd(), 'scripts/data', file)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    console.error(`Tidak menemukan ${path}.`)
    console.error('Berkas ini tidak ikut di repositori karena memuat nama siswa.')
    process.exit(1)
  }
}

/**
 * Nama halaqoh: sesi + pengampu. Tempat sengaja TIDAK ikut.
 *
 * Ruang bisa berpindah tanpa halaqohnya berubah; kalau tempat masuk nama,
 * begitu ruangnya pindah namanya jadi berbohong — padahal nama itu sudah
 * terlanjur tercetak di rapor dan riwayat setoran.
 */
function halaqohName(row: Row): string {
  const pengampu = row.pengampu.replace(/\s+/g, ' ').trim()
  return `Sesi ${sesiOf(row.jenjang, row.kelas)} — ${pengampu}`
}

/**
 * Kelompok = jenjang + pengampu + sesi.
 *
 * Pengelompokan sebelumnya memakai tempat, sehingga dua sesi berbeda yang
 * kebetulan memakai ruang sama tergabung jadi satu halaqoh — lima kelompok
 * tercampur begitu, salah satunya menyatukan kelas 8 dan kelas 9.
 */
function groupKey(row: Row): string {
  return `${row.jenjang}|${row.pengampu}|${sesiOf(row.jenjang, row.kelas)}`
}

async function main() {
  console.log('Impor roster siswa & halaqoh TA 2026/2027\n')

  const raw = loadData<Row[]>('siswa-2026.json')
  const pengampuMap = loadData<Record<string, string>>('pengampu-siswa-2026.json')

  // Sumbernya memuat 67 baris kembar yang identik di seluruh kolom — data
  // ganda saat pengetikan, bukan anak yang ikut dua kelompok. Dibuang di sini
  // karena membuang baris yang sama persis tidak menghilangkan informasi.
  const seen = new Set<string>()
  const rows: Row[] = []
  for (const row of raw) {
    const key = JSON.stringify(row)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  console.log(`${raw.length} baris → ${rows.length} siswa unik (${raw.length - rows.length} kembar dibuang)\n`)

  const belum = [...new Set(rows.map(r => r.pengampu))].filter(p => !pengampuMap[p])
  if (belum.length) {
    console.error('Pengampu belum terpetakan:', belum.join(', '))
    console.error('Lengkapi scripts/data/pengampu-siswa-2026.json lebih dulu.')
    process.exit(1)
  }

  const { data: term } = await supabase
    .from('academic_terms').select('id, year_label, semester').eq('is_current', true).maybeSingle()
  if (!term) {
    console.error('Belum ada semester berjalan. Tetapkan dulu di /tahun-ajaran.')
    process.exit(1)
  }
  console.log(`Semester berjalan: ${term.year_label} ${term.semester}`)

  // Gagal cepat kalau migrasi 0024 belum jalan, dengan pesan yang menerangkan
  // sebabnya — bukan galat kolom dari PostgREST di tengah ratusan insert.
  const probe = await supabase.from('students').select('level_awal').limit(1)
  if (probe.error) {
    console.error('\nKolom level_awal belum ada — jalankan migrasi 0024 lebih dulu.')
    process.exit(1)
  }

  const { data: teacherRows } = await supabase
    .from('teachers').select('id, username').is('deleted_at', null)
  const teacherId = new Map(
    ((teacherRows ?? []) as { id: string; username: string }[]).map(t => [t.username, t.id]),
  )

  // ── Halaqoh ───────────────────────────────────────────────
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const key = groupKey(row)
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  console.log(`\nMenyiapkan ${groups.size} halaqoh…`)

  const halaqohId = new Map<string, string>()
  let dibuat = 0
  let diperbarui = 0

  for (const [key, members] of groups) {
    const sample = members[0]
    const name = halaqohName(sample)
    const wali = teacherId.get(pengampuMap[sample.pengampu]) ?? null

    // Sebagian kelompok punya ruang cadangan, dipakai kalau ruang utamanya
    // sedang terpakai kegiatan lain. Ruang yang tercatat untuk paling banyak
    // anak dianggap yang utama — urutan baris di spreadsheet tidak berarti
    // apa-apa, jumlah anak berarti. Sisanya jadi catatan, bukan dibuang.
    const tally = new Map<string, number>()
    for (const m of members) {
      if (m.tempat) tally.set(m.tempat, (tally.get(m.tempat) ?? 0) + 1)
    }
    const urut = [...tally.entries()].sort((a, b) => b[1] - a[1])
    const tempat = urut[0]?.[0] ?? ''
    const alternatif = urut.slice(1).map(([ruang]) => ruang)
    const catatan = alternatif.length
      ? `Ruang alternatif bila ${tempat} terpakai: ${alternatif.join(', ')}`
      : null
    if (alternatif.length) console.log(`  · ${name}: ruang alternatif ${alternatif.join(', ')}`)

    const { data: existing } = await supabase
      .from('halaqoh')
      .select('id')
      .eq('term_id', term.id)
      .eq('name', name)
      .eq('jenjang', sample.jenjang)
      .maybeSingle()

    const payload = {
      name,
      jenjang: sample.jenjang,
      wali_teacher_id: wali,
      sesi: sesiOf(sample.jenjang, sample.kelas),
      tempat,
      schedule_note: catatan,
      term_id: term.id,
      is_active: true,
    }

    if (existing) {
      await supabase.from('halaqoh').update(payload).eq('id', existing.id)
      halaqohId.set(key, existing.id)
      diperbarui++
    } else {
      const { data, error } = await supabase.from('halaqoh').insert(payload).select('id').single()
      if (error || !data) {
        console.log(`  ✗ ${name}: ${error?.message}`)
        continue
      }
      halaqohId.set(key, data.id)
      dibuat++
    }
  }
  console.log(`  ${dibuat} dibuat, ${diperbarui} diperbarui`)

  // ── Siswa ─────────────────────────────────────────────────
  console.log('\nMenyimpan siswa…')
  let siswaBaru = 0
  let siswaUpdate = 0
  const gagal: string[] = []

  for (const row of rows) {
    const hid = halaqohId.get(groupKey(row)) ?? null
    const fields = {
      full_name: row.nama,
      jenjang: row.jenjang,
      kelas: row.kelas || null,
      gender: row.gender || null,
      halaqoh_id: hid,
      level_awal: row.level,
      is_active: true,
    }

    // Tanpa NIS, kunci alaminya adalah nama + jenjang + kelas. Cukup untuk
    // 694 siswa ini; NIS bisa dilengkapi belakangan lewat panel.
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('full_name', row.nama)
      .eq('jenjang', row.jenjang)
      .eq('kelas', row.kelas)
      .maybeSingle()

    let studentId = existing?.id as string | undefined
    if (studentId) {
      const { error } = await supabase.from('students').update(fields).eq('id', studentId)
      if (error) { gagal.push(`${row.nama}: ${error.message}`); continue }
      siswaUpdate++
    } else {
      const { data, error } = await supabase.from('students').insert(fields).select('id').single()
      if (error || !data) { gagal.push(`${row.nama}: ${error?.message}`); continue }
      studentId = data.id
      siswaBaru++
    }

    if (hid && studentId) {
      await supabase.from('halaqoh_members').upsert(
        { halaqoh_id: hid, student_id: studentId, joined_at: term.year_label ? '2026-07-01' : undefined },
        { onConflict: 'halaqoh_id,student_id' },
      )
    }
  }

  console.log(`  ${siswaBaru} dibuat, ${siswaUpdate} diperbarui`)
  if (gagal.length) {
    console.log(`  ✗ ${gagal.length} gagal:`)
    gagal.slice(0, 10).forEach(g => console.log(`     ${g}`))
  }

  // ── Verifikasi ────────────────────────────────────────────
  const [{ count: totalSiswa }, { count: totalHalaqoh }, { count: totalAnggota }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('halaqoh').select('*', { count: 'exact', head: true }).eq('term_id', term.id),
    supabase.from('halaqoh_members').select('*', { count: 'exact', head: true }),
  ])
  const { count: tanpaHalaqoh } = await supabase
    .from('students').select('*', { count: 'exact', head: true }).is('halaqoh_id', null)

  console.log(`\nSelesai. Siswa: ${totalSiswa}, halaqoh semester ini: ${totalHalaqoh}, keanggotaan: ${totalAnggota}`)
  console.log(`Siswa tanpa halaqoh: ${tanpaHalaqoh}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
