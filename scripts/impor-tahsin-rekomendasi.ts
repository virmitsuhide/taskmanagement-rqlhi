/**
 * Impor kelompok Tahsin Rekomendasi SDIT LHI dari "Database Tahsin Rekomendasi".
 *
 *   npx tsx scripts/impor-tahsin-rekomendasi.ts "<berkas.xlsx>"              # uji coba, tidak menulis
 *   npx tsx scripts/impor-tahsin-rekomendasi.ts "<berkas.xlsx>" --jalankan   # tulis ke basis data
 *
 * Prasyarat: migrasi 0115.
 *
 * Bentuk berkas: satu sheet per tingkat (Y2…Y6), tajuk di baris 6 (No, Guru,
 * Nama, Kelas, Tempat, Capaian Awal, …), data mulai baris 8. Urutan kolom
 * Kelas/Tempat berbeda antar sheet, jadi dibaca dari tajuknya.
 *
 * Tiap pengampu (kolom Guru) menjadi satu kelompok dengan akun bersama
 * TR1, TR2, … menurut urutan kemunculannya, password `bismillah`. Akun yang
 * username-nya sudah ada dipakai ulang (namanya tidak ditimpa). Siswa
 * dicocokkan ke siswa SDIT aktif (jenjang 'sd') berdasarkan nama; yang tidak
 * cocok dilaporkan dan dilewati — masukkan manual dari halaman koordinator.
 *
 * Idempoten: menjalankan ulang memperbarui kelompok & capaian awal peserta.
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import XLSX from 'xlsx'
import { PASSWORD_AWAL_TR } from '../lib/rq/tahsin-rekomendasi'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const berkas = process.argv[2]
const jalankan = process.argv.includes('--jalankan')

interface Baris { guru: string; nama: string; kelas: string; tempat: string; capaian: string }

const huruf = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

function bacaBerkas(): Baris[] {
  const wb = XLSX.readFile(berkas)
  const hasil: Baris[] = []
  for (const nama of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama], { header: 1, defval: '' })
    const tajuk = (rows[5] ?? []).map(x => String(x).trim().toLowerCase())
    const iGuru = tajuk.indexOf('guru'), iNama = tajuk.indexOf('nama'), iKelas = tajuk.indexOf('kelas')
    const iCapaian = tajuk.indexOf('capaian awal')
    // Satu sheet kehilangan tajuk "Tempat" — kolomnya tetap di antara Nama/Kelas dan Capaian Awal.
    const iTempat = tajuk.indexOf('tempat') >= 0 ? tajuk.indexOf('tempat') : [3, 4].find(i => i !== iKelas)!
    if (iGuru < 0 || iNama < 0 || iKelas < 0) { console.warn(`! sheet ${nama}: tajuk tidak dikenali, dilewati`); continue }
    for (const r of rows.slice(7)) {
      if (typeof r[0] !== 'number' || !String(r[iNama]).trim()) continue
      hasil.push({
        guru: String(r[iGuru]).trim(), nama: String(r[iNama]).trim(), kelas: String(r[iKelas]).trim().toUpperCase(),
        tempat: String(r[iTempat] ?? '').trim(), capaian: String(r[iCapaian] ?? '').replace(/\s+/g, ' ').trim(),
      })
    }
  }
  return hasil
}

/** "Ustadzah Rizky" → P, "Ustadz Fariz" → L, "Ust Erna" → belum tahu. */
function tebakGender(guru: string): 'L' | 'P' | null {
  if (/^ustadzah\b/i.test(guru)) return 'P'
  if (/^ustadz\b/i.test(guru)) return 'L'
  return null
}

async function main() {
  if (!berkas) { console.error('Sebutkan berkas .xlsx-nya.'); process.exit(1) }
  console.log(`Impor Tahsin Rekomendasi — ${jalankan ? 'MENULIS' : 'uji coba (tambahkan --jalankan untuk menulis)'}\n`)

  const baris = bacaBerkas()
  const guruUrut = [...new Set(baris.map(b => b.guru))]
  console.log(`${baris.length} siswa, ${guruUrut.length} pengampu\n`)

  // ── Siswa SDIT aktif ──
  const { data: siswaDb, error: eS } = await sb.from('students').select('id, full_name, kelas').eq('is_active', true).eq('jenjang', 'sd')
  if (eS) throw eS
  const siswa = (siswaDb ?? []) as { id: string; full_name: string; kelas: string | null }[]
  const cocokkan = (b: Baris) => {
    const persis = siswa.filter(s => huruf(s.full_name) === huruf(b.nama))
    if (persis.length === 1) return { s: persis[0], cara: 'persis' }
    // Cadangan: sekelas dan minimal dua kata nama sama (ejaan / gelar berbeda).
    const kata = new Set(huruf(b.nama).split(' '))
    const mirip = siswa.filter(s => s.kelas?.toUpperCase() === b.kelas && huruf(s.full_name).split(' ').filter(k => kata.has(k)).length >= 2)
    return mirip.length === 1 ? { s: mirip[0], cara: 'mirip' } : null
  }

  // ── Akun & kelompok ──
  const idGuru = new Map<string, string>()
  for (const [i, guru] of guruUrut.entries()) {
    const username = `TR${i + 1}`
    const tempat = baris.find(b => b.guru === guru && b.tempat)?.tempat ?? ''
    const { data: ada } = await sb.from('teachers').select('id, full_name').eq('username', username).maybeSingle()
    let id = (ada as { id: string } | null)?.id
    console.log(`${username.padEnd(5)} ${guru.padEnd(20)} ${tempat.padEnd(22)} ${ada ? `= akun ada (${(ada as { full_name: string }).full_name})` : '+ akun baru'}`)
    if (!jalankan) { idGuru.set(guru, id ?? `(baru:${username})`); continue }
    if (!id) {
      const { data, error } = await sb.from('teachers').insert({
        username, password_hash: await bcrypt.hash(PASSWORD_AWAL_TR, 10), full_name: guru, gender: tebakGender(guru), can_change_password: false,
      }).select('id').single()
      if (error || !data) throw new Error(`Gagal membuat ${username}: ${error?.message}`)
      id = (data as { id: string }).id
    }
    const { error } = await sb.from('tr_pengampu').upsert({ teacher_id: id, tempat, urutan: i + 1, updated_at: new Date().toISOString() }, { onConflict: 'teacher_id' })
    if (error) throw new Error(`Gagal menyimpan kelompok ${username}: ${error.message} — sudah menjalankan migrasi 0115?`)
    idGuru.set(guru, id)
  }

  // ── Peserta ──
  console.log('')
  let masuk = 0
  const gagal: Baris[] = []
  for (const b of baris) {
    const c = cocokkan(b)
    if (!c) { gagal.push(b); continue }
    if (c.cara === 'mirip') console.log(`~ ${b.nama} (${b.kelas}) → ${c.s.full_name} (${c.s.kelas})`)
    if (c.s.kelas?.toUpperCase() !== b.kelas) console.log(`! kelas beda: ${b.nama} — berkas ${b.kelas}, data ${c.s.kelas}`)
    masuk++
    if (!jalankan) continue
    const { error } = await sb.from('tr_peserta').upsert({
      student_id: c.s.id, teacher_id: idGuru.get(b.guru)!, capaian_awal: b.capaian.slice(0, 200), updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' })
    if (error) throw new Error(`Gagal memasukkan ${b.nama}: ${error.message}`)
  }

  console.log(`\n${masuk} siswa ${jalankan ? 'dimasukkan' : 'akan dimasukkan'}.`)
  if (gagal.length) {
    console.log(`${gagal.length} siswa TIDAK cocok dengan data siswa SDIT — masukkan manual di /tahsin-rekomendasi:`)
    for (const b of gagal) console.log(`  - ${b.nama} (${b.kelas}, ${b.guru})`)
  }
  if (jalankan) console.log(`\nAkun TR1–TR${guruUrut.length}, password: ${PASSWORD_AWAL_TR}`)
}

main().catch(e => { console.error(e); process.exit(1) })
