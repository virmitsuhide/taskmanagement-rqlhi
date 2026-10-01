/**
 * Impor SD LHI Juara TA 2026/2027 — siswa kelas 1–6, akun pemandu, kelompok
 * TTQ, dan POSISI AWAL tiap anak.
 *
 *     npx tsx scripts/impor-sd-juara.ts --dry   # lihat pencocokan, tidak menyimpan
 *     npx tsx scripts/impor-sd-juara.ts         # simpan
 *
 * Sumber (Downloads):
 *   • 2026_2027_DAFTAR SISWA-LHI JUARA.xlsx — lembar "Daftar Peserta Didik":
 *     nama lengkap, kelas, NIS (kolom ke-2), JK, tanggal lahir, orang tua, HP.
 *   • KELOMPOK TTQ & JADWAL KULTUM GURU.doc — kelompok, pemandu, dan peserta
 *     dengan NAMA PANGGILAN beserta capaiannya, mis. "Nadia (Jil.2 :13/QS.
 *     Quraisy)". Diekspor ke JSON per sel tabel (scratchpad kelompok-ttq.json).
 *
 * Posisi awal (keputusan RQ 2026-10-01):
 *   • tahsin → posisi aktif siswa (metode, jilid, halaman) — pemandu langsung
 *     melanjutkan dari sana. "Ebta" (selesai jilid, menunggu evaluasi) =
 *     halaman terakhir jilid + DRILL, sama dengan aturan "lulus halaman
 *     terakhir" di setoran. "Al-Qur'an surat X ayat N" = tahap Al-Qur'an +
 *     posisi mushaf.
 *   • tahfidz → teks capaian awal di Capaian Bulanan bulan berjalan. TIDAK
 *     dibuat sebagai setoran: setoran palsu terhitung kegiatan setor di
 *     statistik & laporan.
 *
 * Nama panggilan dicocokkan ke nama lengkap di antara siswa kelas kelompok
 * itu; yang ragu-ragu MENGHENTIKAN impor (PADANAN untuk penetapan manual).
 * Aman diulang: siswa/guru/halaqoh yang sudah ada (menurut nama) tidak dibuat
 * dua kali; posisi ditulis ulang dari dokumen.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import bcrypt from 'bcryptjs'
import XLSX from 'xlsx'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { halamanDariBacaan } from '../lib/rq/bacaan-quran'
import { syncHalaqohMemberships } from '../lib/data/halaqoh-membership'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const BERKAS_SISWA = 'C:/Users/Acer/Downloads/2026_2027_DAFTAR SISWA-LHI JUARA.xlsx'
const BERKAS_KELOMPOK = process.env.KELOMPOK_JSON
  ?? 'C:/Users/Acer/AppData/Local/Temp/claude/D--taskmanagement-rqlhi/a434d52c-be0a-4120-9583-0d4627829428/scratchpad/kelompok-ttq.json'
const PASSWORD_AWAL = 'bismillah'
const PERIODE_AWAL = '2026-10-01'
const HARI_INI = '2026-10-01'

/** Pemandu: panggilan di dokumen → nama lengkap (daftar asatidz dari RQ 2026-10-01). */
const PEMANDU: Record<string, { nama: string; username: string; gender: 'L' | 'P'; sapaan: string } | null> = {
  ery: { nama: 'Ery Sulistyawati', username: 'ery_sulistyawati', gender: 'P', sapaan: 'Ustadzah Ery' },
  amir: { nama: 'Amiruddin Al Haq', username: 'amiruddin_alhaq', gender: 'L', sapaan: 'Ustadz Amir' },
  suranti: { nama: 'Suranti', username: 'suranti', gender: 'P', sapaan: 'Ustadzah Suranti' },
  lilis: { nama: 'Lilis Dewi Prasetyawati', username: 'lilis_dewi', gender: 'P', sapaan: 'Ustadzah Lilis' },
  bangun: { nama: 'Bangun Setyo Nugroho', username: 'bangun_setyo', gender: 'L', sapaan: 'Ustadz Bangun' },
  khotimatul: { nama: 'Siti Khotimatul Mahmudah', username: 'siti_khotimatul', gender: 'P', sapaan: 'Ustadzah Khotimatul' },
  nuha: { nama: 'Mufidah Dzakiyyatun Nuha', username: '', gender: 'P', sapaan: 'Ustadzah Nuha' },
  catur: { nama: 'Catur Palupi', username: 'catur_palupi', gender: 'P', sapaan: 'Ustadzah Catur' },
  // Belum ditetapkan RQ — kelompoknya dibuat tanpa pengampu.
  sri: null,
  ama: null,
}
/** Asatidz di daftar RQ yang belum tampil sebagai pemandu — akunnya tetap dibuat. */
const AKUN_TAMBAHAN = [
  { nama: 'Ramadhanti Dea Utami', username: 'ramadhanti_dea', gender: 'P' as const },
]

/** Nama panggilan yang tidak bisa ditebak — diisi bila dry-run meragukannya. */
const PADANAN: Record<string, string> = {
  // Skor sama dengan nama lain di kelas yang sama.
  '1|Danish': 'Danish Ayyassi Badru Nurzaman',
  '6|Ahsan': 'M Ahsan Putra Setiawan',
  // Panggilan diambil dari bagian tengah/akhir nama.
  '4|Yumna': 'Pesona Lituhayumna',
  '5|Fatimah': 'Fathimah Adibatul Yumnaa',
  '7|Faiz': 'Faiz Afkar Nasrulhaq',
  '8|Miqdad': 'Miqdad Zharif Fayiz Ahmad',
  '8|Shaka': 'Muhammad Gahara Abidzar Sakha',
  '9|Izal': 'Maghribi Imam Al Ghozhali',
  "5|Dhiya'ul Haq": 'Dhiyaulhaq Faqih Al Fatih',
  // Kelas anak di daftar siswa berbeda dari label kelas kelompoknya.
  '2|Khairanu': 'Khairanu Sharga Aditya',
  '4|Ahnaf': 'Ahnaf Fawwaz Nasution',
  '4|Abyan': 'Rofi Abyan Akbar',
  '5|Ikram': 'Ahmad Ikram Al Fatih Tambunan',
  '5|Asyraf': 'Asyraaf Al-Musayyibi Rafsanjani',
  '5|Azmi': 'Muhammad Khoirul Azmi',
  '6|Juang': 'Bangga Juang Adhyastha',
  '6|Safa': 'Safa Asri Wahyuningsih',
  '6|Khonsa': 'Khonsa Hakima',
  '9|Zamzam': 'Muhammad Zamzam Piwulang',
  '9|Azka': 'Farzana Azka Adnaf',
}

/** Peserta di dokumen yang TIDAK ada di daftar siswa — dilewati dan dilaporkan. */
const TANPA_DATA = new Set(['7|Airin'])

const ROMAWI: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }

interface SiswaExcel {
  nama: string; kelas: number; nis: string | null; gender: 'L' | 'P' | null
  lahir: string | null; wali: string | null; hp: string | null
}

function bacaSiswa(): SiswaExcel[] {
  const ws = XLSX.readFile(BERKAS_SISWA).Sheets['Daftar Peserta Didik']
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }).slice(1)
  const hasil: SiswaExcel[] = []
  for (const r of rows) {
    const nama = String(r[3] ?? '').replace(/\s+/g, ' ').trim()
    const kelas = Number(String(r[4] ?? '').trim())
    if (!nama || !(kelas >= 1 && kelas <= 6)) continue
    const nis = String(r[1] ?? '').trim()
    const serial = Number(r[8])
    const lahir = serial > 20000 ? new Date(Date.UTC(1899, 11, 30) + serial * 864e5).toISOString().slice(0, 10) : null
    const jk = String(r[6] ?? '').trim().toUpperCase()
    // Baris rekap di bawah tiap kelas ("LAKI 6", "TOTAL 16") tidak punya JK.
    if (jk !== 'L' && jk !== 'P') continue
    const hp = String(r[18] ?? '').split(/[\/,]/)[0].replace(/[^\d+]/g, '') || null
    hasil.push({
      nama: nama.replace(/(^|\s)(\S)/g, (m, s, c) => s + c.toUpperCase()).replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()),
      kelas, nis: /^\d{5,}$/.test(nis) ? nis : null,
      gender: jk === 'L' || jk === 'P' ? jk : null, lahir,
      wali: String(r[13] ?? '').trim() || String(r[14] ?? '').trim() || null, hp,
    })
  }
  return hasil
}

interface Peserta { panggilan: string; capaian: string }
interface Kelompok { no: number; kelas: number[]; pemandu: string; peserta: Peserta[]; abk: boolean }

function bacaKelompok(): Kelompok[] {
  const sel = JSON.parse(readFileSync(BERKAS_KELOMPOK, 'utf8').replace(/^\uFEFF/, '')) as { tabel: number; r: number; c: number; teks: string }[]
  const tabel = [...new Set(sel.map(s => s.tabel))].slice(0, 2)
  const hasil: Kelompok[] = []
  for (const t of tabel) {
    const baris = new Map<number, Record<number, string>>()
    for (const s of sel.filter(x => x.tabel === t)) baris.set(s.r, { ...(baris.get(s.r) ?? {}), [s.c]: s.teks })
    for (const c of baris.values()) {
      const no = Number(c[1])
      if (!Number.isInteger(no) || no < 1) continue
      const kelasTeks = (c[2] ?? '').toUpperCase()
      const abk = kelasTeks.includes('ABK')
      const kelas = abk ? [2, 3, 4, 5, 6] : [...kelasTeks.matchAll(/[IV]+/g)].map(m => ROMAWI[m[0]]).filter(Boolean)
      const rentang = kelas.length === 2 ? Array.from({ length: kelas[1] - kelas[0] + 1 }, (_, i) => kelas[0] + i) : kelas
      const peserta = (c[6] ?? '').split(/\r|\n/).map(x => x.trim()).filter(Boolean).map(x => {
        // "3. Brian (Jil.2 :13/QS. Al 'Adiyat:1-11)," · "9. Izal : 5:32/QS..." · "12. Jihadan ( Jihadan (Jil.4..."
        const isi = x.replace(/^\d+\.\s*/, '').replace(/,\s*$/, '')
        const m = /^([^(:]+?)\s*[(:]\s*(.*)$/.exec(isi)
        const panggilan = (m ? m[1] : isi).replace(/^\(?\s*/, '').trim()
        const capaian = (m ? m[2] : '').replace(/^\s*[A-Za-z' ]*\(\s*/, '').replace(/\)\s*$/, '').trim()
        return { panggilan, capaian }
      })
      // Tabel jadwal kultum juga bernomor 1, 2, … — tapi tanpa kolom peserta.
      if (peserta.length === 0 || !c[5]) continue
      hasil.push({ no, kelas: rentang, pemandu: (c[5] ?? '').toLowerCase(), peserta, abk })
    }
  }
  return hasil
}

/** Kunci pemandu dari teks sel, mis. "Sri Ummiyati – diganti" → 'sri'. */
function kunciPemandu(teks: string): string {
  const k = Object.keys(PEMANDU).find(x => teks.includes(x))
  if (!k) throw new Error(`Pemandu "${teks}" tidak dikenal.`)
  return k
}

// Tanda diakritik dibuang dulu — "An-Nisā'" harus sama dengan "An-Nisa'".
const huruf = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

/** Skor kecocokan nama panggilan dengan nama lengkap. */
function skor(panggilan: string, lengkap: string): number {
  const p = panggilan.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  const kata = lengkap.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  const gabung = huruf(lengkap)
  let s = 0
  for (const w of p) {
    if (kata.includes(w)) s += 3
    else if (kata.some(k => k.startsWith(w) || (w.length >= 4 && w.startsWith(k) && k.length >= 4))) s += 2
    else if (w.length >= 4 && gabung.includes(w)) s += 1.5
    else if (w.length >= 4 && kata.some(k => jarak(k, w) <= 1)) s += 1.5
  }
  return s / p.length
}

function jarak(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length][b.length]
}

interface PosisiAwal {
  metode: 'IQRO' | 'KIBAR'
  jilid: string            // label jilid_levels
  halaman: number | null
  drill: boolean
  quran: { surat_id: number; ayat: number } | null
  tahfidz: string
  ringkas: string
}

function bacaCapaian(teks: string, suratId: (nama: string) => number | null): PosisiAwal | string {
  const [tahsin, ...sisa] = teks.split('/')
  const tahfidz = sisa.join('/').replace(/^\s*/, '').replace(/\)\s*$/, '').trim()
  const t = tahsin.toLowerCase()
  const quran = /qur.?an\s+surat\s+(.+?)\s+ayat\s+(\d+)/i.exec(tahsin)
  if (quran) {
    const id = suratId(quran[1])
    if (!id) return `surat "${quran[1]}" tidak dikenal`
    return { metode: 'IQRO', jilid: 'Talaqqi Al-Qur’an', halaman: null, drill: false, quran: { surat_id: id, ayat: Number(quran[2]) }, tahfidz, ringkas: `Al-Qur'an ${quran[1]}:${quran[2]}` }
  }
  const j = /(kibar\s*)?(?:jil\.?)?\s*(\d)\s*(?:[:\\\s]+\s*(\d+))?\s*(ebta)?/i.exec(t.replace(/^\s*:\s*/, ''))
  if (!j) return `capaian tahsin "${tahsin}" tidak terbaca`
  const metode = j[1] ? 'KIBAR' as const : 'IQRO' as const
  const nomor = Number(j[2])
  const halaman = j[3] ? Number(j[3]) : null
  const ebta = Boolean(j[4])
  return {
    metode, jilid: `Jilid ${nomor}`, halaman, drill: ebta, quran: null, tahfidz,
    ringkas: `${metode === 'KIBAR' ? 'KIBAR' : "Iqro'"} Jilid ${nomor}${halaman ? ` hal. ${halaman}` : ''}${ebta ? ' (Ebta)' : ''}`,
  }
}

async function main() {
  const dry = process.argv.includes('--dry')
  const sb: SupabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const [siswaExcel, kelompok] = [bacaSiswa(), bacaKelompok()]
  const perKelas = siswaExcel.reduce<Record<number, number>>((m, s) => ({ ...m, [s.kelas]: (m[s.kelas] ?? 0) + 1 }), {})
  console.log(`Excel: ${siswaExcel.length} siswa`, perKelas, `· Dokumen: ${kelompok.length} kelompok, ${kelompok.reduce((n, k) => n + k.peserta.length, 0)} peserta`)

  const [{ data: term }, { data: suratRows }, { data: metodeRows }, { data: adaRows }] = await Promise.all([
    sb.from('academic_terms').select('id').eq('is_current', true).single(),
    sb.from('surat_master').select('id, name_latin'),
    sb.from('tahsin_methods').select('id, name, jilid_levels(id, label, total_pages)').in('name', ['IQRO', 'KIBAR']),
    sb.from('students').select('id, full_name, kelas').eq('jenjang', 'sd_juara'),
  ])
  const normSurat = (n: string) => huruf(n.replace(/^(qs\.?\s*)?(al|an|at|as|ad|az|ar|ash|asy)[\s-]/i, ''))
  const suratId = (nama: string) => {
    const k = normSurat(nama)
    return (suratRows ?? []).find(s => normSurat(s.name_latin) === k || huruf(s.name_latin) === huruf(nama))?.id ?? null
  }
  const metode = new Map((metodeRows ?? []).map(m => [m.name, m as { id: string; name: string; jilid_levels: { id: string; label: string; total_pages: number | null }[] }]))

  // ── Pencocokan peserta → siswa ──
  const terpakai = new Set<string>()
  const ragu: string[] = []
  const penempatan: { kelompok: Kelompok; siswa: SiswaExcel; posisi: PosisiAwal }[] = []
  for (const k of kelompok) {
    const calon = siswaExcel.filter(s => k.kelas.includes(s.kelas))
    for (const p of k.peserta) {
      const kunciP = `${k.no}|${p.panggilan}`
      if (TANPA_DATA.has(kunciP)) { console.log(`  ! K${k.no} ${p.panggilan} — tidak ada di daftar siswa, dilewati`); continue }
      const pasti = PADANAN[kunciP]
      // Padanan manual dicari di semua kelas: anaknya bisa tercatat di kelas lain.
      const urut = (pasti ? siswaExcel.filter(c => c.nama.toLowerCase() === pasti.toLowerCase()) : calon)
        .filter(c => !terpakai.has(c.nama))
        .map(c => ({ c, s: skor(p.panggilan, c.nama) })).sort((a, b) => b.s - a.s)
      const [a, b] = urut
      const posisi = bacaCapaian(p.capaian, suratId)
      if (!a || (!pasti && (a.s < 1.5 || (b && b.s === a.s)))) {
        ragu.push(`  ? K${k.no} ${p.panggilan} → ${urut.slice(0, 3).map(x => `${x.c.nama} (${x.c.kelas}) ${x.s.toFixed(1)}`).join(' | ') || 'tidak ada calon'}`)
        continue
      }
      if (typeof posisi === 'string') { ragu.push(`  ? K${k.no} ${p.panggilan}: ${posisi}`); continue }
      terpakai.add(a.c.nama)
      penempatan.push({ kelompok: k, siswa: a.c, posisi })
      console.log(`  K${String(k.no).padEnd(2)} ${p.panggilan.padEnd(14)} → ${a.c.nama.padEnd(38)} kls ${a.c.kelas} · ${posisi.ringkas} · tahfidz: ${posisi.tahfidz || '—'}`)
    }
  }
  if (ragu.length) throw new Error(`${ragu.length} peserta ragu-ragu — impor dihentikan:\n${ragu.join('\n')}`)
  const tanpaKelompok = siswaExcel.filter(s => s.kelas >= 2 && !terpakai.has(s.nama))
  console.log(`\nSemua ${penempatan.length} peserta cocok. Siswa kelas 2–6 tanpa kelompok: ${tanpaKelompok.map(s => `${s.nama} (${s.kelas})`).join(', ') || '—'}`)

  // ── Guru ──
  const idGuru = new Map<string, string | null>()
  const akun = [
    ...Object.entries(PEMANDU).filter((e): e is [string, NonNullable<(typeof PEMANDU)[string]>] => e[1] !== null),
    ...AKUN_TAMBAHAN.map(a => [a.username, { ...a, sapaan: '' }] as const),
  ]
  for (const [kunci, g] of akun) {
    const { data } = await sb.from('teachers').select('id, full_name').ilike('full_name', `${g.nama}%`).is('deleted_at', null)
    if ((data ?? []).length > 1) throw new Error(`Guru "${g.nama}" ganda.`)
    if (data?.[0]) { idGuru.set(kunci, data[0].id); console.log(`  = ${g.nama}`); continue }
    console.log(`  + akun guru baru: ${g.nama} (username ${g.username}, password ${PASSWORD_AWAL})`)
    if (dry) { idGuru.set(kunci, `(baru:${kunci})`); continue }
    const { data: baru, error } = await sb.from('teachers').insert({
      username: g.username, password_hash: await bcrypt.hash(PASSWORD_AWAL, 10), full_name: g.nama,
      unit: 'sd_juara', kategori_guru: 'guru_sd_juara', gender: g.gender,
    }).select('id').single()
    if (error || !baru) throw new Error(`Gagal membuat akun ${g.nama}: ${error?.message}`)
    idGuru.set(kunci, baru.id)
  }

  // ── Siswa ──
  const sudah = new Map((adaRows ?? []).map(s => [huruf(s.full_name), s]))
  const idSiswa = new Map<string, string>()
  let baru = 0
  for (const s of siswaExcel) {
    const ada = sudah.get(huruf(s.nama))
    const isi = {
      nis: s.nis, gender: s.gender, birth_date: s.lahir, wali_name: s.wali, wali_phone: s.hp,
    }
    if (ada) {
      idSiswa.set(s.nama, ada.id)
      if (!dry) await sb.from('students').update({ ...Object.fromEntries(Object.entries(isi).filter(([, v]) => v !== null)), updated_at: new Date().toISOString() }).eq('id', ada.id)
      continue
    }
    if (s.kelas === 1) throw new Error(`Siswa kelas 1 "${s.nama}" belum ada — kelas 1 QULS diimpor terpisah.`)
    baru++
    if (dry) continue
    const { data, error } = await sb.from('students').insert({
      ...isi, full_name: s.nama, jenjang: 'sd_juara', kelas: String(s.kelas), program: 'reguler', is_active: true,
    }).select('id').single()
    if (error || !data) throw new Error(`Gagal menyimpan ${s.nama}: ${error?.message}`)
    idSiswa.set(s.nama, data.id)
  }
  console.log(`Siswa: ${baru} baru, ${siswaExcel.length - baru} sudah ada (dilengkapi NIS/JK/lahir/wali).`)

  // ── Halaqoh per kelompok: "TTQ 2 · Kelas II — Ustadzah Ery" ──
  const idHalaqoh = new Map<number, string>()
  for (const k of kelompok) {
    const kunci = kunciPemandu(k.pemandu)
    const g = PEMANDU[kunci]
    const kelasTeks = k.abk ? 'ABK' : `Kelas ${[...new Set([k.kelas[0], k.kelas[k.kelas.length - 1]])].join('–')}`
    const nama = `TTQ ${k.no} · ${kelasTeks}${g ? ` — ${g.sapaan}` : ''}`
    const { data: ada } = await sb.from('halaqoh').select('id').eq('jenjang', 'sd_juara').like('name', `TTQ ${k.no} ·%`).maybeSingle()
    console.log(`Halaqoh ${nama} — ${k.peserta.length} anak${g ? '' : ' (PENGAMPU BELUM DITETAPKAN)'}`)
    if (dry) continue
    const isi = { name: nama, jenjang: 'sd_juara', program: 'reguler', term_id: term!.id, wali_teacher_id: g ? idGuru.get(kunci) : null, is_active: true }
    if (ada) { await sb.from('halaqoh').update(isi).eq('id', ada.id); idHalaqoh.set(k.no, ada.id); continue }
    const { data, error } = await sb.from('halaqoh').insert(isi).select('id').single()
    if (error || !data) throw new Error(`Gagal membuat halaqoh ${nama}: ${error?.message}`)
    idHalaqoh.set(k.no, data.id)
  }

  // Kelompok QULS kelas 1: pemandunya Resty & Nuha — Nuha ditambahkan sebagai pengampu kedua.
  if (!dry) {
    const { data: quls } = await sb.from('halaqoh').select('id').eq('jenjang', 'sd_juara').eq('program', 'quls').maybeSingle()
    const nuha = idGuru.get('nuha')
    if (quls && nuha) await sb.from('halaqoh_teachers').upsert({ halaqoh_id: quls.id, teacher_id: nuha }, { onConflict: 'halaqoh_id,teacher_id' })
  }

  // ── Penempatan & posisi awal ──
  if (dry) { console.log('\n--dry: tidak ada yang disimpan.'); return }
  for (const { kelompok: k, siswa, posisi } of penempatan) {
    const m = metode.get(posisi.metode)!
    const jilid = m.jilid_levels.find(j => j.label.replace(/[’']/g, '') === posisi.jilid.replace(/[’']/g, ''))
    if (!jilid) throw new Error(`${posisi.metode} ${posisi.jilid} tidak ada.`)
    // Ebta = jilid selesai, menunggu evaluasi → halaman terakhir + drill.
    const halaman = posisi.drill ? jilid.total_pages : posisi.halaman !== null && jilid.total_pages ? Math.min(posisi.halaman, jilid.total_pages) : posisi.halaman
    const id = idSiswa.get(siswa.nama)!
    const { error } = await sb.from('students').update({
      halaqoh_id: idHalaqoh.get(k.no), current_method_id: m.id, current_jilid_id: jilid.id, current_jilid_page: halaman,
      tahsin_drill_sejak: posisi.drill ? HARI_INI : null,
      current_quran_surat_id: posisi.quran?.surat_id ?? null, current_quran_ayat: posisi.quran?.ayat ?? null,
      current_quran_halaman: posisi.quran ? halamanDariBacaan(posisi.quran.surat_id, posisi.quran.ayat) : null,
      level_awal: posisi.ringkas, updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) throw new Error(`Gagal menempatkan ${siswa.nama}: ${error.message}`)
    const { error: e2 } = await sb.from('student_monthly').upsert({
      student_id: id, period: PERIODE_AWAL, level: posisi.jilid.startsWith('Jilid') ? posisi.jilid : "Al-Qur'an",
      halaman_awal_tahsin: posisi.ringkas, tahfidz_awal: posisi.tahfidz ? `QS. ${posisi.tahfidz.replace(/^QS\.?\s*/i, '')}` : null,
      catatan: 'Capaian awal dari pembagian kelompok TTQ 2026/2027', updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,period' })
    if (e2) throw new Error(`Gagal mencatat capaian awal ${siswa.nama}: ${e2.message}`)
  }
  // Riwayat keanggotaan halaqoh — lewat satu-satunya pencatat perpindahan.
  await syncHalaqohMemberships(
    sb as never,
    penempatan.map(({ kelompok: k, siswa }) => ({ student_id: idSiswa.get(siswa.nama)!, ke: idHalaqoh.get(k.no)!, dari: null })),
    HARI_INI,
  )
  console.log(`\nTersimpan: ${penempatan.length} anak ditempatkan dengan posisi awal.`)
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
