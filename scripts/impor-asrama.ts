/**
 * Impor kelompok halaqoh ASRAMA (boarding SMPIT LHI) — TA 2026/2027.
 *
 *     npx tsx scripts/impor-asrama.ts --dry   # lihat pencocokan, tidak menyimpan
 *     npx tsx scripts/impor-asrama.ts         # simpan
 *
 * Dua sumber, bentuknya berbeda:
 *
 *   PUTRA — Downloads\Kelompok Halaqoh Putra Semester Gasal Tahun Ajaran 2026_2027.xlsx
 *     kolom Ustadz · Nama Siswa · Level · Kelas; Ustadz/Level/Kelas memakai
 *     sel gabung, jadi diisi turun ke bawah.
 *
 *   PUTRI — Downloads\Halaqoh Qur'an 2627.docx
 *     daftar paragraf: "Ustadzah X" (tebal) lalu nama siswinya. Tidak ada
 *     level; WARNA nama menandai kelas (biru 7B, hitam 8B, oranye 9B) —
 *     dicocokkan dengan data siswa, bukan dipakai sebagai level.
 *
 * Padanan nama panggilan ustadz/ustadzah ditetapkan RQ (2026-10-01).
 *
 * Nama siswa dicocokkan dengan siswa boarding SMP aktif segender. Ejaan
 * berkas kadang berbeda ("M." vs "Muhammad", salah ketik), jadi pencocokan
 * memakai kemiripan kata; yang ragu-ragu MENGHENTIKAN impor, bukan ditebak.
 *
 * Aman diulang: kelompok (menurut nama) tidak dibuat dua kali, anggota
 * di-upsert — tapi level yang sudah diisi pengelola TIDAK ditimpa bila
 * berkasnya tidak menyebut level (putri).
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import XLSX from 'xlsx'
import JSZip from 'jszip'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const BERKAS_PUTRA = 'C:/Users/Acer/Downloads/Kelompok Halaqoh Putra Semester Gasal Tahun Ajaran 2026_2027.xlsx'
const BERKAS_PUTRI = "C:/Users/Acer/Downloads/Halaqoh Qur'an 2627.docx"

type Gender = 'L' | 'P'
interface Baris { ustadz: string; nama: string; level: string | null; kelas: string }

/** Nama panggilan → nama di data guru (awal nama; dicocokkan dengan ILIKE 'nama%'). */
const USTADZ: Record<Gender, Record<string, { nama: string; panggilan: string }>> = {
  L: {
    bahrun: { nama: 'Bahrun Mahabi', panggilan: 'Ust. Bahrun' },
    amir: { nama: "Muhammad Nur I'tishom Amirul Haq", panggilan: 'Ust. Amir' },
    nathan: { nama: 'Faris Natanegara', panggilan: 'Ust. Nathan' },
    azka: { nama: 'Azka El Falaahi', panggilan: 'Ust. Azka' },
    andi: { nama: 'Ariandi Nurcahyo', panggilan: 'Ust. Andi' },
  },
  P: {
    isma: { nama: 'Ismatul Maula', panggilan: 'Usth. Isma' },
    rosyi: { nama: 'Rosyida Rhamnaia', panggilan: 'Usth. Rosyi' },
    nasywa: { nama: 'Nihayatun Nasywa', panggilan: 'Usth. Nasywa' },
    // Dokumen menyebut "Karima" dan "Binti" terpisah: Karima = Karima Hasni.
    karima: { nama: 'Karima Hasni', panggilan: 'Usth. Karima' },
    binti: { nama: 'Binti Karimah', panggilan: 'Usth. Binti' },
  },
}

/** Warna nama di dokumen putri → kelas. */
const KELAS_WARNA: Record<string, string> = { '2F5496': '7B', hitam: '8B', C45911: '9B' }

/**
 * Padanan yang tidak bisa ditebak dari kemiripan kata — nama di berkas hanya
 * inisial ("A."). Diperiksa manual: nama depannya unik, kelasnya sama.
 */
const PADANAN: Record<string, string> = {
  'Muhammad Zaffaranadyan A.': 'Muhammad Zaffaranadyan Al Fathan',
}

const LEVEL: Record<string, string> = { high: 'high', middle: 'middle', low: 'low', spesial: 'spesial' }

function bacaPutra(): Baris[] {
  const baris = XLSX.utils.sheet_to_json<string[]>(XLSX.readFile(BERKAS_PUTRA).Sheets.Sheet1, { header: 1, defval: '' }).slice(2)
  const isi: Baris[] = []
  let u = '', l = '', k = ''
  for (const r of baris) {
    if (!String(r[1] ?? '').trim()) continue
    u = String(r[0] || u).trim(); l = String(r[2] || l).trim(); k = String(r[3] || k).trim()
    isi.push({ ustadz: u.toLowerCase(), nama: String(r[1]).trim(), level: l.toLowerCase(), kelas: k })
  }
  return isi
}

async function bacaPutri(): Promise<Baris[]> {
  const zip = await JSZip.loadAsync(readFileSync(BERKAS_PUTRI))
  const xml = await zip.file('word/document.xml')!.async('string')
  const isi: Baris[] = []
  let u = ''
  for (const p of xml.split(/<\/w:p>/)) {
    const teks = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(t => t[1]).join('').trim()
    if (!teks) continue
    const kepala = teks.match(/^Ustadzah\s+(.+)$/i)
    if (kepala) { u = kepala[1].trim().toLowerCase(); continue }
    const warna = p.match(/w:color w:val="(\w+)"/)?.[1] ?? 'hitam'
    const kelas = KELAS_WARNA[warna]
    if (!kelas) throw new Error(`Warna ${warna} pada "${teks}" tidak dikenal.`)
    isi.push({ ustadz: u, nama: teks, level: null, kelas })
  }
  return isi
}

/**
 * Bentuk pembanding: huruf kecil, tanpa tanda baca & karakter tak terlihat.
 * "M"/"Muh" di AWAL nama = Muhammad; "M." di akhir nama adalah inisial
 * nama belakang ("Zahra Mumtaza M."), bukan Muhammad.
 */
function kata(s: string): string[] {
  return s
    .replace(/[\u2060\u200b]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 && (w === 'm' || w === 'muh' || w === 'moh' || w === 'mohammad') ? 'muhammad' : w))
}

/** Kemiripan dua nama: rerata kecocokan kata (kata mirip = beda ≤ 2 huruf). */
function mirip(a: string, b: string): number {
  const ka = kata(a), kb = kata(b)
  const jarak = (x: string, y: string) => {
    const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)])
    for (let j = 1; j <= y.length; j++) d[0][j] = j
    for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    }
    return d[x.length][y.length]
  }
  // Inisial satu huruf ("Ainayya Bedytra F.") cocok dengan kata berawalan huruf itu.
  const cocok = (w: string, daftar: string[]) => daftar.some(v => v === w || (w.length === 1 && v.startsWith(w)) || (v.length === 1 && w.startsWith(v)) || (w.length > 3 && jarak(w, v) <= 2) || (w.length >= 3 && v.startsWith(w)) || (v.length >= 3 && w.startsWith(v)))
  const skorA = ka.filter(w => cocok(w, kb)).length / ka.length
  const skorB = kb.filter(w => cocok(w, ka)).length / kb.length
  return (skorA + skorB) / 2
}

async function impor(sb: SupabaseClient, gender: Gender, isi: Baris[], dry: boolean) {
  const label = gender === 'L' ? 'PUTRA' : 'PUTRI'
  console.log(`\n══ ASRAMA ${label} — ${isi.length} siswa di berkas`)

  // ── Pencocokan siswa ──
  const { data: siswa } = await sb.from('students').select('id, full_name, kelas')
    .eq('jenjang', 'smp').eq('is_active', true).eq('gender', gender).in('program', ['reguler_bd', 'boarding_quls'])
  const calon = (siswa ?? []) as { id: string; full_name: string; kelas: string | null }[]
  const terpakai = new Set<string>()
  const cocok = new Map<number, { id: string; full_name: string }>()
  const ragu: string[] = []
  isi.forEach((r, i) => {
    const pasti = PADANAN[r.nama] ? calon.find(c => c.full_name === PADANAN[r.nama]) : undefined
    if (pasti && !terpakai.has(pasti.id)) {
      terpakai.add(pasti.id)
      cocok.set(i, pasti)
      console.log(`  = ${r.nama} → ${pasti.full_name} (padanan manual)`)
      return
    }
    const urut = calon.map(c => ({ c, s: mirip(r.nama, c.full_name) + (c.kelas === r.kelas ? 0.05 : 0) })).sort((a, b) => b.s - a.s)
    const [a, b] = urut
    if (!a || a.s < 0.75 || (b && a.s - b.s < 0.15) || terpakai.has(a.c.id)) {
      ragu.push(`  ? ${r.nama} (${r.kelas}) → ${urut.slice(0, 3).map(x => `${x.c.full_name} ${x.s.toFixed(2)}`).join(' | ')}`)
      return
    }
    terpakai.add(a.c.id)
    cocok.set(i, a.c)
    if (kata(r.nama).join(' ') !== kata(a.c.full_name).join(' ')) console.log(`  ~ ${r.nama} → ${a.c.full_name}`)
  })
  if (ragu.length) throw new Error(`${ragu.length} nama ragu-ragu — impor dihentikan:\n${ragu.join('\n')}`)
  const sisa = calon.filter(c => !terpakai.has(c.id))
  console.log(`Semua ${isi.length} nama cocok. Siswa boarding ${label.toLowerCase()} yang tidak ada di berkas: ${sisa.length ? sisa.map(s => `${s.full_name} (${s.kelas})`).join(', ') : '—'}`)

  // ── Ustadz ──
  const daftarUstadz = USTADZ[gender]
  const idUstadz = new Map<string, string>()
  for (const kunci of new Set(isi.map(r => r.ustadz))) {
    const us = daftarUstadz[kunci]
    if (!us) throw new Error(`Ustadz/ah "${kunci}" tidak dikenal.`)
    const { data } = await sb.from('teachers').select('id, full_name').ilike('full_name', `${us.nama}%`).is('deleted_at', null)
    const ada = (data ?? []) as { id: string; full_name: string }[]
    if (ada.length !== 1) throw new Error(`Guru "${us.nama}": ${ada.length ? `ganda (${ada.map(x => x.full_name).join(', ')})` : 'tidak ditemukan'}.`)
    idUstadz.set(kunci, ada[0].id)
    console.log(`  ${kunci} = ${ada[0].full_name}`)
  }

  // ── Kelompok per ustadz: "Ust. Bahrun · 7A" ──
  const idKelompok = new Map<string, string>()
  for (const [i, kunci] of [...new Set(isi.map(r => r.ustadz))].entries()) {
    const us = daftarUstadz[kunci]
    const kelas = [...new Set(isi.filter(r => r.ustadz === kunci).map(r => r.kelas))].sort().join('/')
    const nama = `${us.panggilan} · ${kelas}`
    console.log(`Kelompok ${nama} — ${isi.filter(r => r.ustadz === kunci).length} anak`)
    if (dry) continue
    const { data: ada } = await sb.from('asrama_kelompok').select('id').eq('nama', nama).eq('gender', gender).maybeSingle()
    if (ada) {
      await sb.from('asrama_kelompok').update({ pengampu_id: idUstadz.get(kunci), urutan: i, is_active: true }).eq('id', ada.id)
      idKelompok.set(kunci, ada.id)
      continue
    }
    const { data, error } = await sb.from('asrama_kelompok').insert({
      nama, gender, pengampu_id: idUstadz.get(kunci), urutan: i,
    }).select('id').single()
    if (error || !data) throw new Error(`Gagal membuat kelompok ${nama}: ${error?.message}`)
    idKelompok.set(kunci, data.id)
  }

  // ── Anggota & level ──
  const levelTak = isi.filter(r => r.level !== null && !LEVEL[r.level]).map(r => `${r.nama} (${r.level})`)
  if (levelTak.length) throw new Error(`Level tak dikenal: ${levelTak.join(', ')}`)
  if (dry) return
  const { error } = await sb.from('asrama_anggota').upsert(isi.map((r, i) => ({
    student_id: cocok.get(i)!.id,
    kelompok_id: idKelompok.get(r.ustadz)!,
    // Berkas tanpa level tidak menghapus level yang sudah diisi pengelola.
    ...(r.level ? { level: LEVEL[r.level] } : {}),
    updated_at: new Date().toISOString(),
  })))
  if (error) throw new Error(`Gagal menyimpan anggota: ${error.message}`)
  console.log(`Tersimpan: ${idKelompok.size} kelompok, ${isi.length} anggota.`)
}

async function main() {
  const dry = process.argv.includes('--dry')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await impor(sb, 'L', bacaPutra(), dry)
  await impor(sb, 'P', await bacaPutri(), dry)
  if (dry) console.log('\n--dry: tidak ada yang disimpan.')
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
