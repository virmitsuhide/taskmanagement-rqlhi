/**
 * Selaraskan data siswa SMPIT LHI dengan berkas sekolah TA 2026/2027.
 *
 *     npx tsx scripts/impor-siswa-smp-2026.ts --dry   # lihat rencana, tidak menyimpan
 *     npx tsx scripts/impor-siswa-smp-2026.ts         # simpan
 *
 * Sumber: Downloads\Data Siswa SMPIT LHI TP 2026-2027 (RQ).xlsx — satu sheet
 * per rombel ("Kelas 9A" …). Kolom berbeda antarangkatan (kelas 9 memisah
 * tempat & tanggal lahir; kelas 7–8 menggabungkannya), jadi kolom dicari
 * menurut judulnya.
 *
 * Yang dilakukan:
 *   - siswa yang sudah ada: nama disamakan dengan ejaan berkas, NIS, tanggal
 *     lahir, nama ayah (wali_name), dan tanda alumni SD LHI (hanya
 *     false → true) diisi. Kelas/program/halaqoh TIDAK
 *     disentuh — berkas hanya menyebut Boarding/Fullday, tidak QULS/reguler.
 *   - siswa yang belum ada: dibuat dengan kelas = NAMA SHEET (kolom Kelas di
 *     berkas ada yang salah ketik), program reguler menurut huruf rombel,
 *     metode Syajaroh, tanpa jilid & halaqoh.
 *   - siswa di sistem yang tidak ada di berkas: dibiarkan aktif.
 *
 * Semua yang masih perlu dicek manusia ditulis ke CATATAN (berkas .txt).
 * Aman diulang: pencocokan memakai NIS dulu, lalu nama.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const BERKAS = 'C:/Users/Acer/Downloads/Data Siswa SMPIT LHI TP 2026-2027 (RQ).xlsx'
const CATATAN = 'C:/Users/Acer/Downloads/Catatan verifikasi data siswa SMP 2026-2027.txt'
const dry = process.argv.includes('--dry')

/**
 * Nama di sistem → nama di berkas, untuk ejaan yang berbeda. Ditetapkan
 * dengan mata, bukan kemiripan otomatis: "Naufal Pramudya Aryasatya" dan
 * "Naufal Alexi Pratama" terlalu mirip untuk ditebak mesin.
 */
const PADANAN: Record<string, string> = {
  'M. Jibril Wiko Marchelo': 'Muhammad Jibril Wiko Marchelo',
  'Muhammmad Lucky Ahsan': 'Muhammad Lucky Ahsan',
  'Fadhlan Hasbi Asryil': 'Fadhlan Hasbi Arsyil',
  'Ammara Rosyada Atiqah': 'Ammara Rosyda Atiqah',
  'Azkiya Qurrota A.': "Azkiya Yasmin Qurrota'aini",
  'Fauqiyyah Faqihah': 'Fauqiyya Faqihah',
  'Naufal Pramudya Aryasatya': 'R. Naufal Pramudya Aryasatya',
  'M. Kaisan Haidar Afham': 'Muhammad Kaisan Haidar Afham',
  "M. Rafa Al-Syafi'i Pratama": "Muhammad Rafa Al-Syafi'i Pratama",
  'Hilman Abdurrahman Al Fatih': 'Hilman Abdurrahman Alfatih',
  'M. Hanan Hamizan Nurdyan': 'Muhammad Hanan Hamizan Nurdyan',
  'M. Ridwan Pradipta': 'Muhammad Ridwan Pradipta',
  'Naufal Alexi Ptatama': 'Naufal Alexi Pratama',
  'Muhammad Artanabilal Faresky A.': 'Muhammad Artanabilal Faresky Aynme',
  'Haikal Asshiddiqie Adhipermata': 'Haikal Asshidiqie Adhipermata',
}

/** Dicocokkan dengan tiga huruf awal — berkas memuat "Febuari", "Janjari". */
const BULAN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7,
  agu: 8, sep: 9, okt: 10, nov: 11, nop: 11, des: 12,
}

const kunci = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
const rapikan = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

interface Baris {
  sheet: string; nama: string; nis: string | null; jk: string; kelasKolom: string
  program: string; lahirMentah: string; lahir: string | null; ayah: string | null; asal: string
}

/** Tanggal lahir dari tiga bentuk di berkas: nomor seri Excel, "19/03/2011", "Ngawi, 02 Agustus 2012". */
function tanggal(nilai: unknown): string | null {
  if (typeof nilai === 'number') {
    const d = XLSX.SSF.parse_date_code(nilai)
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null
  }
  const t = rapikan(nilai)
  let m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?!\d)/)
  const bulan = m && BULAN[m[2].slice(0, 3).toLowerCase()]
  if (m && bulan) return `${m[3]}-${String(bulan).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

function bacaBerkas(): Baris[] {
  const wb = XLSX.readFile(BERKAS)
  const hasil: Baris[] = []
  for (const nama of wb.SheetNames) {
    const sheet = nama.replace(/^Kelas\s+/i, '').trim()
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama], { header: 1, defval: '' })
    const judul = rows[0].map(c => rapikan(c).toLowerCase())
    const kol = (uji: (j: string) => boolean) => judul.findIndex(uji)
    const iNama = kol(j => j.startsWith('nama') && !j.includes('panggilan') && !j.includes('ayah'))
    const iNis = kol(j => j === 'nis' || j === 'nomor')
    const iJk = kol(j => j.includes('kelamin'))
    const iKelas = kol(j => j === 'kelas')
    const iProg = kol(j => j.includes('program'))
    const iLahir = kol(j => j.includes('tanggal'))
    const iAyah = kol(j => j.includes('ayah'))
    const iAsal = kol(j => j === 'asal sekolah')
    for (const r of rows.slice(1)) {
      const n = rapikan(r[iNama])
      if (!n || !/[a-z]/i.test(n)) continue
      const nis = rapikan(r[iNis])
      hasil.push({
        sheet, nama: n, nis: /^\d+$/.test(nis) ? nis : null, jk: rapikan(r[iJk]),
        kelasKolom: rapikan(r[iKelas]), program: rapikan(r[iProg]),
        lahirMentah: rapikan(r[iLahir]), lahir: tanggal(r[iLahir]),
        ayah: rapikan(r[iAyah]) || null, asal: rapikan(r[iAsal]),
      })
    }
  }
  return hasil
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const berkas = bacaBerkas()

  const { data: siswa, error } = await sb.from('students')
    .select('id, full_name, nis, kelas, program, gender, birth_date, wali_name, asal_sd_lhi, halaqoh_id')
    .eq('jenjang', 'smp').eq('is_active', true)
  if (error) throw error
  const { data: metode } = await sb.from('tahsin_methods').select('id').eq('name', 'Syajaroh').single()
  if (!metode) throw new Error('Metode Syajaroh tidak ditemukan')

  const padananBalik = new Map(Object.entries(PADANAN).map(([db, xl]) => [kunci(xl), kunci(db)]))
  const terpakai = new Set<string>()
  const catatan: Record<string, string[]> = {
    ejaan: [], baru: [], hilang: [], salahKetik: [], lahir: [], jk: [], asal: [], asalNaik: [], program: [],
  }

  let diubah = 0, dibuat = 0
  for (const b of berkas) {
    const k = kunci(b.nama)
    const ada = siswa!.find(s => b.nis && s.nis === b.nis)
      ?? siswa!.find(s => kunci(s.full_name) === k)
      ?? siswa!.find(s => kunci(s.full_name) === padananBalik.get(k))

    if (b.kelasKolom && b.kelasKolom !== b.sheet) {
      catatan.salahKetik.push(`${b.nama} — ada di sheet "Kelas ${b.sheet}", tapi kolom Kelas berisi "${b.kelasKolom}". Dipakai: ${b.sheet}.`)
    }
    if (b.lahirMentah && !b.lahir) catatan.lahir.push(`${b.nama} (${b.sheet}) — "${b.lahirMentah}" tidak terbaca, tanggal lahir dibiarkan kosong.`)

    if (ada) {
      terpakai.add(ada.id)
      const ubah: Record<string, unknown> = {}
      // Beda huruf besar/tanda baca saja ("Muh." vs "Muh") tidak diganti —
      // ejaan sistem sering justru lebih rapi daripada berkas.
      if (kunci(ada.full_name) !== k) {
        ubah.full_name = b.nama
        catatan.ejaan.push(`${b.sheet}  "${ada.full_name}"  →  "${b.nama}"`)
      }
      if (b.nis && ada.nis !== b.nis) ubah.nis = b.nis
      if (b.lahir && ada.birth_date !== b.lahir) ubah.birth_date = b.lahir
      if (b.ayah && !ada.wali_name) ubah.wali_name = b.ayah
      const jk = b.jk.startsWith('Laki') ? 'L' : b.jk.startsWith('Perempuan') ? 'P' : null
      if (jk && ada.gender !== jk) catatan.jk.push(`${b.nama} (${b.sheet}) — sistem ${ada.gender}, berkas ${b.jk}. Tidak diubah.`)
      // asal_sd_lhi berbawaan false, jadi false sering berarti "belum ditandai".
      // Berkas hanya MENAIKKAN tanda; true → false dicatat, tidak ditimpa.
      const asalLhi = /\bLHI\b/i.test(b.asal)
      if (b.asal && asalLhi && !ada.asal_sd_lhi) {
        ubah.asal_sd_lhi = true
        catatan.asalNaik.push(`${b.nama} (${b.sheet}) — asal "${b.asal}"`)
      } else if (b.asal && !asalLhi && ada.asal_sd_lhi) {
        catatan.asal.push(`${b.nama} (${b.sheet}) — sistem: alumni SD LHI; berkas: asal "${b.asal}". Tidak diubah.`)
      }
      if (Object.keys(ubah).length === 0) continue
      diubah++
      if (!dry) {
        const { error: e } = await sb.from('students').update({ ...ubah, updated_at: new Date().toISOString() }).eq('id', ada.id)
        if (e) throw new Error(`Gagal memperbarui ${b.nama}: ${e.message}`)
      }
      continue
    }

    // Siswa baru. Huruf rombel SMP: A/B boarding, C/D fullday.
    const huruf = b.sheet.slice(-1)
    const program = huruf === 'A' || huruf === 'B' ? 'reguler_bd' : 'reguler_fd'
    const gender = b.jk.startsWith('Laki') ? 'L' : 'P'
    catatan.baru.push(`${b.sheet}  ${b.nama}  (NIS ${b.nis ?? '-'}, ${b.jk}, asal ${b.asal || '-'})`)
    catatan.program.push(`${b.nama} (${b.sheet}) — diisi ${program === 'reguler_bd' ? 'Reguler Boarding' : 'Reguler Fullday'}; berkas hanya menyebut "${b.program}". Bila QULS, ubah di profil siswa.`)
    dibuat++
    if (!dry) {
      const { error: e } = await sb.from('students').insert({
        full_name: b.nama, nis: b.nis, gender, birth_date: b.lahir, jenjang: 'smp', kelas: b.sheet,
        program, wali_name: b.ayah, current_method_id: metode.id, asal_sd_lhi: /\bLHI\b/i.test(b.asal),
        is_active: true,
      })
      if (e) throw new Error(`Gagal menambah ${b.nama}: ${e.message}`)
    }
  }

  for (const s of siswa!.filter(s => !terpakai.has(s.id))) {
    catatan.hilang.push(`${s.kelas}  ${s.full_name}  (${s.program}) — tidak ada di berkas. Masih AKTIF di sistem.`)
  }

  const bagian = (judul: string, isi: string[], kosong = '(tidak ada)') =>
    `${judul}\n${'-'.repeat(judul.length)}\n${isi.length ? isi.map(x => `[ ] ${x}`).join('\n') : kosong}\n`

  const teks = [
    'CATATAN VERIFIKASI DATA SISWA SMPIT LHI — TA 2026/2027',
    `Dibuat ${new Date().toLocaleString('id-ID')} dari berkas "Data Siswa SMPIT LHI TP 2026-2027 (RQ).xlsx"`,
    'Centang [x] bila sudah dicek ke data asli (buku induk / TU).',
    '',
    bagian('1. SISWA BARU — sudah dimasukkan, BELUM punya halaqoh & jilid', catatan.baru),
    'Tindak lanjut: tempatkan di halaqoh sekolah, isi jilid Syajaroh lewat profil siswa.',
    'Catatan: Zaidan & Sakinah otomatis menjadi peserta Riyadhoh (semua kelas 9).',
    '',
    bagian('2. PROGRAM SISWA BARU — ditebak REGULER (berkas tidak menyebut QULS)', catatan.program),
    'QULS kelas 7–8 ikut Riyadhoh; reguler tidak. Mohon pastikan Fayza & Annisa (8B).',
    '',
    bagian('3. ADA DI SISTEM, TIDAK ADA DI BERKAS — belum dinonaktifkan', catatan.hilang),
    'Bila sudah keluar/pindah: nonaktifkan dari profil siswa.',
    '',
    bagian('4. EJAAN NAMA — sistem diganti mengikuti berkas; cek mana yang benar', catatan.ejaan),
    'Yang perlu dilihat khusus: Asshiddiqie/Asshidiqie, Rosyada/Rosyda, Fauqiyyah/Fauqiyya,',
    'Asryil/Arsyil, dan gelar "R." pada Naufal Pramudya Aryasatya.',
    '',
    bagian('5. SALAH KETIK DI BERKAS (kolom Kelas ≠ nama sheet)', catatan.salahKetik),
    'Annisa Khilaafatul Jannah: NIS angkatan 25 → dianggap 8B. Mohon dipastikan.',
    '',
    bagian('6. TANGGAL LAHIR TIDAK TERBACA', catatan.lahir),
    bagian('7. JENIS KELAMIN BERBEDA (tidak diubah)', catatan.jk),
    bagian('8. DITANDAI ALUMNI SD LHI dari berkas (sebelumnya belum ditandai; memengaruhi target tahfidz)', catatan.asalNaik),
    bagian('9. SISTEM MENANDAI ALUMNI SD LHI, BERKAS BERKATA LAIN (tidak diubah)', catatan.asal),
  ].join('\n')

  // Hanya jalan sungguhan yang mengubah sesuatu menulis catatan — jalan ulang
  // (atau --dry sesudahnya) akan menimpa catatan dengan daftar kosong.
  if (!dry && diubah + dibuat > 0) writeFileSync(CATATAN, teks.replace(/\n/g, '\r\n'), 'utf8')
  console.log(teks)
  console.log(`\n${berkas.length} baris berkas · ${diubah} siswa diperbarui · ${dibuat} siswa baru${dry ? ' — DRY-RUN, tidak disimpan' : ' — tersimpan'}`)
  console.log(`Catatan: ${CATATAN}`)
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
