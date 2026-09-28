/**
 * Impor siswa QULS SDIT LHI (1D, 2D, 3D) & SD LHI Juara kelas 1 — TA 2026/2027.
 *
 *     npx tsx scripts/impor-quls-2026.ts --dry   # lihat pembagian, tidak menyimpan
 *     npx tsx scripts/impor-quls-2026.ts         # simpan
 *
 * Sumber: Downloads\Template Data base tahsin tahfidz kelas QULS.xlsx. Tiap
 * anak punya dua baris pengampu (per sesi). Aturan (ditetapkan RQ 2026-09-28):
 *   • walas tiap kelas = pengampu utama, yang menginput capaian anaknya
 *       3D: Aswidia & Lailis · 2D: Sofiatun & Retno · 1D: Isti & Mavitra · SD Juara: Resty
 *   • tepat SATU walas muncul di baris anak → masuk halaqoh walas itu
 *   • dua walas berbeda, atau tanpa walas → tanpa pengampu (halaqoh kosong)
 *
 * Aman diulang: guru, halaqoh, dan siswa yang sudah ada (menurut nama) tidak
 * dibuat dua kali.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import bcrypt from 'bcryptjs'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const BERKAS = 'C:/Users/Acer/Downloads/Template Data base tahsin tahfidz kelas QULS.xlsx'

interface Walas { kunci: string; nama: string; panggilan: string; username?: string; baru?: { unit: string; kategori: string } }

const KELAS: { sheet: string; kelas: string; jenjang: 'sd' | 'sd_juara'; walas: Walas[] }[] = [
  { sheet: 'Angkatan 17', kelas: '3D', jenjang: 'sd', walas: [
    { kunci: 'aswidia', nama: 'Aswidia Halwa Fitriana', panggilan: 'Ustadzah Aswidia' },
    { kunci: 'lailis', nama: 'Lailis Salfah', panggilan: 'Ustadzah Lailis' },
  ] },
  { sheet: 'Angkatan 18', kelas: '2D', jenjang: 'sd', walas: [
    { kunci: 'sofiatun', nama: 'Sofiatun Najjah', panggilan: 'Ustadzah Sofiatun' },
    { kunci: 'retno', nama: 'Retno Wulandari, S.Pd.', panggilan: 'Ustadzah Retno', username: 'retno_wulandari', baru: { unit: 'sd', kategori: 'guru_quls_sd' } },
  ] },
  { sheet: 'Angkatan 19', kelas: '1D', jenjang: 'sd', walas: [
    { kunci: 'isti kamilatun', nama: 'Isti Kamilatun Nisa', panggilan: 'Ustadzah Isti' },
    { kunci: 'mavitra', nama: 'Mavitra Ellanvihara, S.Si., Gr.', panggilan: 'Ustadzah Mavitra', username: 'mavitra_ellanvihara', baru: { unit: 'sd', kategori: 'guru_quls_sd' } },
  ] },
  { sheet: 'Angkatan 1 SD Juara', kelas: '1', jenjang: 'sd_juara', walas: [
    { kunci: 'resty', nama: 'Resty Susanti, S.Pd.', panggilan: 'Ustadzah Resty', username: 'resty_susanti', baru: { unit: 'sd_juara', kategori: 'guru_sd_juara' } },
  ] },
]

const PASSWORD_AWAL = 'bismillah'

/** "Mercia azeema hafidza\n" → "Mercia Azeema Hafidza". */
const rapikanNama = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
  .split(' ').map(w => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
const kunciNama = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

interface SiswaExcel { nama: string; nis: string | null; pengampu: string[] }

function bacaSheet(wb: XLSX.WorkBook, sheet: string): SiswaExcel[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: '' })
  // Lembar SD Juara: [Nama, Pengampu] satu baris per anak.
  if (String(rows[0]?.[0]).trim() === 'Nama') {
    return rows.slice(1).filter(r => rapikanNama(r[0])).map(r => ({ nama: rapikanNama(r[0]), nis: null, pengampu: [String(r[1] ?? '').trim()].filter(Boolean) }))
  }
  // Lembar angkatan: baris ber-nomor = anak baru; baris sesudahnya tanpa nomor & nama = pengampu sesi kedua.
  const hasil: SiswaExcel[] = []
  for (const r of rows.slice(4)) {
    const nama = rapikanNama(r[3])
    const pengampu = String(r[4] ?? '').trim()
    if (nama) {
      const nis = String(r[1] ?? '').replace(/[^0-9]/g, '') || null
      hasil.push({ nama, nis, pengampu: pengampu ? [pengampu] : [] })
    } else if (!String(r[0] ?? '').trim() && hasil.length && pengampu) {
      hasil[hasil.length - 1].pengampu.push(pengampu)
    }
  }
  return hasil
}

async function main() {
  const dry = process.argv.includes('--dry')
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const wb = XLSX.readFile(BERKAS)

  const [{ data: term }, { data: kibar }, { data: guruAda }, { data: siswaAda }] = await Promise.all([
    sb.from('academic_terms').select('id').eq('is_current', true).single(),
    sb.from('tahsin_methods').select('id').eq('name', 'KIBAR').single(),
    sb.from('teachers').select('id, full_name').is('deleted_at', null),
    sb.from('students').select('id, full_name, jenjang, halaqoh_id').in('jenjang', ['sd', 'sd_juara']),
  ])
  if (!term || !kibar) throw new Error('Semester berjalan atau metode KIBAR tidak ditemukan.')
  const sudahAda = new Map((siswaAda ?? []).map(s => [`${s.jenjang}|${kunciNama(s.full_name)}`, s]))

  let jumlahBaru = 0, jumlahAda = 0
  for (const k of KELAS) {
    console.log(`\n══ ${k.sheet} → ${k.jenjang === 'sd' ? 'SDIT' : 'SD Juara'} kelas ${k.kelas} (QULS) ══`)

    // Guru walas: cari yang sudah ada, buat bila belum.
    const idWalas = new Map<string, string>()
    for (const w of k.walas) {
      const ada = (guruAda ?? []).find(g => g.full_name.toLowerCase().includes(w.kunci))
      if (ada) { idWalas.set(w.kunci, ada.id); continue }
      if (!w.baru || !w.username) throw new Error(`Guru ${w.nama} tidak ditemukan.`)
      console.log(`  + akun guru baru: ${w.nama} (username ${w.username}, password ${PASSWORD_AWAL})`)
      if (dry) { idWalas.set(w.kunci, `(baru:${w.kunci})`); continue }
      const { data, error } = await sb.from('teachers').insert({
        username: w.username, password_hash: await bcrypt.hash(PASSWORD_AWAL, 10), full_name: w.nama,
        unit: w.baru.unit, kategori_guru: w.baru.kategori, gender: 'P',
      }).select('id').single()
      if (error || !data) throw new Error(`Gagal membuat akun ${w.nama}: ${error?.message}`)
      idWalas.set(w.kunci, data.id)
    }

    // Halaqoh per walas: "QULS 3D — Ustadzah Aswidia".
    const idHalaqoh = new Map<string, string>()
    for (const w of k.walas) {
      const nama = `${k.jenjang === 'sd' ? 'QULS' : 'SD Juara'} ${k.kelas} — ${w.panggilan}`
      const { data: ada } = await sb.from('halaqoh').select('id').eq('term_id', term.id).eq('name', nama).maybeSingle()
      if (ada) { idHalaqoh.set(w.kunci, ada.id); continue }
      console.log(`  + halaqoh baru: ${nama}`)
      if (dry) { idHalaqoh.set(w.kunci, `(baru:${nama})`); continue }
      const { data, error } = await sb.from('halaqoh').insert({
        name: nama, jenjang: k.jenjang, program: 'quls', term_id: term.id, wali_teacher_id: idWalas.get(w.kunci),
        tempat: `Kelas ${k.kelas}`, is_active: true,
      }).select('id').single()
      if (error || !data) throw new Error(`Gagal membuat halaqoh ${nama}: ${error?.message}`)
      idHalaqoh.set(w.kunci, data.id)
    }

    // Siswa.
    for (const s of bacaSheet(wb, k.sheet)) {
      const walasMuncul = [...new Set(s.pengampu.flatMap(p => k.walas.filter(w => p.toLowerCase().includes(w.kunci)).map(w => w.kunci)))]
      const walas = walasMuncul.length === 1 ? walasMuncul[0] : null
      const alasan = walasMuncul.length > 1 ? 'dua walas berbeda' : 'tanpa walas'
      const panggilan = walas ? k.walas.find(w => w.kunci === walas)!.panggilan : `— (${alasan}: ${s.pengampu.join(' / ') || 'kosong'})`
      const ada = sudahAda.get(`${k.jenjang}|${kunciNama(s.nama)}`)
      const tujuan = walas ? idHalaqoh.get(walas) ?? null : null
      // Siswa yang sudah ada: pengampunya diselaraskan dengan aturan walas
      // terbaru (mis. walas kelas ditambah) — hanya bila memang berbeda.
      const pindah = ada && (ada.halaqoh_id ?? null) !== tujuan
      console.log(`  ${ada ? (pindah ? '↻ pindah   ' : '= tetap    ') : '+ baru     '} ${s.nama.padEnd(34)} → ${panggilan}`)
      if (ada) {
        jumlahAda++
        if (pindah && !dry) {
          const { error } = await sb.from('students').update({ halaqoh_id: tujuan, updated_at: new Date().toISOString() }).eq('id', ada.id)
          if (error) throw new Error(`Gagal memindahkan ${s.nama}: ${error.message}`)
        }
        continue
      }
      jumlahBaru++
      if (dry) continue
      const { error } = await sb.from('students').insert({
        full_name: s.nama, nis: s.nis, jenjang: k.jenjang, kelas: k.kelas, program: 'quls',
        halaqoh_id: walas ? idHalaqoh.get(walas) : null, current_method_id: kibar.id, is_active: true,
      })
      if (error) throw new Error(`Gagal menyimpan ${s.nama}: ${error.message}`)
    }
  }
  console.log(`\n${jumlahBaru} siswa baru, ${jumlahAda} sudah ada${dry ? ' — dry-run, tidak disimpan' : ' — tersimpan'}.`)
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
