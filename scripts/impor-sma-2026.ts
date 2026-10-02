/**
 * Siswa & pengampu Al-Qur'an SMA LHI — TA 2026/2027.
 *
 *     npx tsx scripts/impor-sma-2026.ts --dry   # lihat rencana, tidak menyimpan
 *     npx tsx scripts/impor-sma-2026.ts         # simpan
 *
 * Sumber: Downloads\Data Siswa dan pengampu Al-Qur'an SMA LHI.xlsx (Sheet1):
 * No · Nama Siswa · Kelas · Pengampu Tahfidz · Pengampu Tahsin. Kolom tahsin
 * memakai sel gabung — satu guru untuk semua anak.
 *
 * SMA LHI unik: DUA guru tahfidz (masing-masing satu halaqoh) dan SATU guru
 * tahsin untuk semuanya. Maka:
 *   - satu halaqoh per guru tahfidz; wali = guru tahfidznya;
 *   - halaqoh_teachers.role membatasi jenis setoran: guru tahfidz 'tahfidz',
 *     guru tahsin 'tahsin' dan dipasang di kedua halaqoh
 *     (lihat getTeacherHalaqohPeran di lib/data/teacher.ts);
 *   - siswa bermetode Syajaroh tanpa jilid — jilid awal ditetapkan guru tahsin
 *     pada setoran pertama di layar Sesi Tahsin.
 *
 * Akun guru yang belum ada dibuat (password awal dicetak di akhir). Aman
 * diulang: guru dicari menurut username, halaqoh menurut nama, siswa menurut
 * nama di jenjang SMA.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import XLSX from 'xlsx'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { syncHalaqohMemberships } from '@/lib/data/halaqoh-membership'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const BERKAS = "C:/Users/Acer/Downloads/Data Siswa dan pengampu Al-Qur'an SMA LHI.xlsx"
const dry = process.argv.includes('--dry')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** Guru menurut tulisan di berkas → akun. Muhammad Fajar sudah punya akun. */
const GURU: Record<string, { username: string; full_name: string; panggilan: string }> = {
  'Ustadz Muhammad Fajar': { username: 'muhammad_fajar', full_name: 'Muhammad Fajar', panggilan: 'Fajar' },
  'Ustadz Rizal Haq': { username: 'rizal_haq', full_name: 'Rizal Haq', panggilan: 'Rizal' },
  'Ustadz Samsul Zali': { username: 'samsul_zali', full_name: 'Samsul Zali', panggilan: 'Samsul' },
}

/** Berkas memuat nama huruf besar semua / kecil semua — dirapikan ke huruf awal kapital. */
function rapikanNama(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
}

function kataSandi(): string {
  const huruf = 'abcdefghijkmnpqrstuvwxyz'
  const angka = '23456789'
  let p = 'Guru@'
  for (let i = 0; i < 3; i++) p += huruf[Math.floor(Math.random() * huruf.length)]
  for (let i = 0; i < 4; i++) p += angka[Math.floor(Math.random() * angka.length)]
  return p
}

async function pastikanGuru(kunci: string, sandiBaru: Map<string, string>): Promise<string> {
  const g = GURU[kunci]
  if (!g) throw new Error(`Guru "${kunci}" tidak dikenal — tambahkan ke GURU.`)
  const { data: ada } = await sb.from('teachers').select('id').eq('username', g.username).maybeSingle()
  if (ada) return ada.id as string
  console.log(`  + akun guru ${g.username} (${g.full_name})`)
  if (dry) return `(baru:${g.username})`
  const sandi = kataSandi()
  const { data, error } = await sb.from('teachers').insert({
    username: g.username, full_name: g.full_name, password_hash: await bcrypt.hash(sandi, 10),
    is_active: true, can_change_password: true, gender: 'L',
    unit: 'sma', kategori_guru: 'guru_sma', lingkup_penugasan: 'unit',
  }).select('id').single()
  if (error || !data) throw new Error(`Gagal membuat akun ${g.username}: ${error?.message}`)
  sandiBaru.set(g.username, sandi)
  return data.id as string
}

async function main() {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(XLSX.readFile(BERKAS).Sheets.Sheet1, { header: 1, defval: '' })
  // Baris 0 judul, 1 kepala kolom. Kolom tahsin bersel gabung: isi turun ke bawah.
  let tahsinTerakhir = ''
  const siswa = rows.slice(2).filter(r => String(r[1]).trim()).map(r => {
    tahsinTerakhir = String(r[4]).trim() || tahsinTerakhir
    return { nama: rapikanNama(String(r[1])), mentah: String(r[1]).trim(), kelas: String(r[2]).trim(), tahfidz: String(r[3]).trim(), tahsin: tahsinTerakhir }
  })
  console.log(`${siswa.length} siswa di berkas.\n`)

  const [{ data: term }, { data: metode }] = await Promise.all([
    sb.from('academic_terms').select('id').eq('is_current', true).maybeSingle(),
    sb.from('tahsin_methods').select('id').eq('name', 'Syajaroh').single(),
  ])
  if (!term) throw new Error('Tidak ada tahun ajaran berjalan (academic_terms.is_current).')
  if (!metode) throw new Error('Metode Syajaroh tidak ditemukan.')

  const sandiBaru = new Map<string, string>()
  console.log('Guru:')
  const idGuru = new Map<string, string>()
  for (const k of new Set(siswa.flatMap(s => [s.tahfidz, s.tahsin]))) idGuru.set(k, await pastikanGuru(k, sandiBaru))
  const guruTahsin = [...new Set(siswa.map(s => s.tahsin))]
  if (guruTahsin.length !== 1) throw new Error(`Berkas menyebut ${guruTahsin.length} guru tahsin; skrip ini mengandaikan satu.`)

  // Satu halaqoh per guru tahfidz.
  console.log('\nHalaqoh:')
  const idHalaqoh = new Map<string, string>()
  for (const kunciTahfidz of new Set(siswa.map(s => s.tahfidz))) {
    const nama = `SMA — Ustadz ${GURU[kunciTahfidz].panggilan}`
    const { data: ada } = await sb.from('halaqoh').select('id').eq('name', nama).eq('jenjang', 'sma').maybeSingle()
    let id = ada?.id as string | undefined
    console.log(`  ${ada ? '=' : '+'} ${nama}`)
    if (!id && !dry) {
      const { data, error } = await sb.from('halaqoh').insert({
        name: nama, jenjang: 'sma', wali_teacher_id: idGuru.get(kunciTahfidz), term_id: term.id, is_active: true,
      }).select('id').single()
      if (error || !data) throw new Error(`Gagal membuat halaqoh ${nama}: ${error?.message}`)
      id = data.id as string
    }
    if (!id) { idHalaqoh.set(kunciTahfidz, `(baru:${nama})`); continue }
    idHalaqoh.set(kunciTahfidz, id)
    if (!dry) {
      // Peran khusus: inilah yang membatasi jenis setoran tiap guru.
      const { error } = await sb.from('halaqoh_teachers').upsert([
        { halaqoh_id: id, teacher_id: idGuru.get(kunciTahfidz), role: 'tahfidz' },
        { halaqoh_id: id, teacher_id: idGuru.get(guruTahsin[0]), role: 'tahsin' },
      ], { onConflict: 'halaqoh_id,teacher_id' })
      if (error) throw new Error(`Gagal memasang pengampu ${nama}: ${error.message}`)
    }
  }

  console.log('\nSiswa:')
  const { data: smaAda } = await sb.from('students').select('id, full_name, halaqoh_id').eq('jenjang', 'sma')
  const kunciNama = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const pindah: { student_id: string; ke: string | null; dari: string | null }[] = []
  let baru = 0
  for (const s of siswa) {
    const tujuan = idHalaqoh.get(s.tahfidz)!
    const ada = (smaAda ?? []).find(x => kunciNama(x.full_name) === kunciNama(s.nama))
    const ejaan = s.nama !== s.mentah ? `   (berkas: "${s.mentah}")` : ''
    console.log(`  ${ada ? '=' : '+'} ${s.kelas}  ${s.nama.padEnd(34)} → ${GURU[s.tahfidz].full_name}${ejaan}`)
    if (dry) continue
    if (ada) {
      if (ada.halaqoh_id !== tujuan) {
        await sb.from('students').update({ halaqoh_id: tujuan, updated_at: new Date().toISOString() }).eq('id', ada.id)
        pindah.push({ student_id: ada.id, ke: tujuan, dari: ada.halaqoh_id })
      }
      continue
    }
    const { data, error } = await sb.from('students').insert({
      full_name: s.nama, gender: 'L', jenjang: 'sma', kelas: s.kelas, halaqoh_id: tujuan,
      current_method_id: metode.id, is_active: true,
    }).select('id').single()
    if (error || !data) throw new Error(`Gagal menambah ${s.nama}: ${error?.message}`)
    pindah.push({ student_id: data.id as string, ke: tujuan, dari: null })
    baru++
  }
  if (!dry && pindah.length) await syncHalaqohMemberships(sb as never, pindah)

  console.log(`\n${baru} siswa baru${dry ? ' — DRY-RUN, tidak disimpan' : ' — tersimpan'}.`)
  if (sandiBaru.size) {
    console.log('\nPassword awal akun guru baru (sampaikan langsung ke gurunya):')
    for (const [u, p] of sandiBaru) console.log(`  ${u.padEnd(16)} ${p}`)
  }
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
