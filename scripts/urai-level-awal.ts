/**
 * Menguraikan teks bebas `students.level_awal` menjadi current_jilid_id +
 * current_jilid_page.
 *
 * Jalankan:
 *   npx tsx scripts/urai-level-awal.ts          → laporan saja, tidak menulis
 *   npx tsx scripts/urai-level-awal.ts tulis    → menyimpan hasilnya
 *
 * `level_awal` diisi manusia dalam bentuk bebas, jadi ragamnya banyak:
 * "Jilid Jilid 1 hal 1", "jilid 4, juz 30", "Qur'an T1 hal 10 ayat 69",
 * "Gharib Gharib hal 18". Penguraian di sini SENGAJA konservatif — apa pun
 * yang tidak dikenali dilaporkan apa adanya, bukan ditebak. Menebak akan
 * menempatkan anak pada jilid yang salah, dan kesalahan itu tidak menimbulkan
 * galat apa pun: ia hanya muncul sebagai peta yang keliru berbulan-bulan.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TULIS = process.argv[2] === 'tulis'

/** Tahap yang dikenali, apa pun metodenya. */
type Tahap =
  | { jenis: 'jilid'; nomor: number }
  | { jenis: 'quran_talaqqi'; tingkat: number }
  | { jenis: 'talaqqi_mandiri' }
  | { jenis: 'gharib' }
  | { jenis: 'tajwid' }
  | { jenis: 'lulus' }

interface Hasil {
  tahap: Tahap | null
  halaman: number | null
  /** Alasan kalau tidak terurai — dipakai mengelompokkan laporan. */
  sebab?: string
}

function urai(raw: string): Hasil {
  const t = raw.toLowerCase().trim()
  if (!t || t === '-') return { tahap: null, halaman: null, sebab: 'kosong' }

  // Halaman: "hal 18", "hal. 19", "Hal 40". Nomor ayat & juz sengaja diabaikan
  // — keduanya keterangan tahfidz yang kebetulan menumpang di kolom yang sama.
  const halMatch = t.match(/hal\.?\s*(\d{1,3})/)
  const halaman = halMatch ? Number(halMatch[1]) : null

  // Urutannya penting: "tahfidz tm ..." harus tertangkap Talaqqi Mandiri lebih
  // dulu, sebelum aturan "tahfidz = lulus" di bawah menelannya.
  if (/\b(tm|talaqqi mandiri|qur.?an mandiri|qm)\b/.test(t)) {
    return { tahap: { jenis: 'talaqqi_mandiri' }, halaman }
  }
  if (/gharib|ghorib/.test(t)) return { tahap: { jenis: 'gharib' }, halaman }
  if (/tajwid/.test(t)) return { tahap: { jenis: 'tajwid' }, halaman }

  const talaqqi = t.match(/(?:qur.?an|quran)\s*(?:talaqqi\s*)?t\.?\s*([123])/)
    ?? t.match(/talaqqi\s*([123])/)
  if (talaqqi) return { tahap: { jenis: 'quran_talaqqi', tingkat: Number(talaqqi[1]) }, halaman }
  if (/(?:qur.?an|quran)/.test(t)) return { tahap: { jenis: 'quran_talaqqi', tingkat: 1 }, halaman }

  // "Jildi"/"Jikid" adalah huruf tertukar dari "Jilid" — maksudnya tidak
  // meragukan, jadi aman dinormalkan. Salah ketik yang TIDAK jelas maksudnya
  // sengaja dibiarkan gagal daripada ditebak.
  const tn = t.replace(/\bjildi\b|\bjikid\b/g, 'jilid')
  const jilid = tn.match(/jilid\s*(?:jilid\s*)?([1-6])/)
  if (jilid) return { tahap: { jenis: 'jilid', nomor: Number(jilid[1]) }, halaman }
  if (/naik jilid\s*([1-6])/.test(tn)) {
    return { tahap: { jenis: 'jilid', nomor: Number(tn.match(/naik jilid\s*([1-6])/)![1]) }, halaman }
  }

  // Sudah tuntas tahsin: hanya menyisakan hafalan. Ditaruh PALING BAWAH supaya
  // "tahfidz TM ..." dan sejenisnya sudah tertangkap aturan di atas.
  if (/^tahfidz$/.test(t) || /tahfidz|tilawah pasca/.test(t)) {
    return { tahap: { jenis: 'lulus' }, halaman: null }
  }

  // Sisanya keterangan hafalan murni: "juz 29", "pra tasmi' juz 30", nama surat.
  if (/juz|tasmi|juziyyah/.test(t)) return { tahap: null, halaman: null, sebab: 'keterangan tahfidz (juz)' }
  // Nama surat — "Al-Jin", "Ar-Rahman", "Adz-Dzariyat". Ini posisi HAFALAN,
  // bukan tahsin, jadi digolongkan bersama keterangan juz alih-alih dibuang ke
  // keranjang "tidak dikenali" yang mencampur salah ketik dengan data sah.
  if (/^(al|as|asy|ash|adz|ad|an|ar|at)[\s-]/i.test(t) || /^(yasin|abasa|ar-?rahman)$/i.test(t)) {
    return { tahap: null, halaman: null, sebab: 'keterangan tahfidz (nama surat)' }
  }
  return { tahap: null, halaman: null, sebab: 'tidak dikenali' }
}

/** Mencocokkan tahap ke baris jilid_levels milik metode anak itu. */
function cariJilid(tahap: Tahap, levels: JilidRow[]): JilidRow | null {
  const cocok = (re: RegExp): JilidRow | null =>
    levels.find(l => re.test(l.label.toLowerCase())) ?? null
  switch (tahap.jenis) {
    case 'jilid': return cocok(new RegExp(`^jilid ${tahap.nomor}$`))
    case 'quran_talaqqi':
      // UMMI punya T1/T2/T3; Syajaroh & KIBAR hanya satu "Talaqqi Al-Qur'an".
      return cocok(new RegExp(`t${tahap.tingkat}$`)) ?? cocok(/talaqqi al-?qur/)
    case 'talaqqi_mandiri': return cocok(/talaqqi mandiri/) ?? cocok(/talaqqi al-?qur/)
    case 'gharib': return cocok(/gharib|gharib/)
    case 'tajwid': return cocok(/tajwid/)
    case 'lulus': return cocok(/lulus tahsin/)
  }
}

interface JilidRow { id: string; label: string; order_num: number; total_pages: number | null; method_id: string }

async function main() {
  const { data: levelsRaw } = await db.from('jilid_levels').select('id, label, order_num, total_pages, method_id')
  const levels = (levelsRaw ?? []) as JilidRow[]
  const byMethod = new Map<string, JilidRow[]>()
  for (const l of levels) {
    if (!byMethod.has(l.method_id)) byMethod.set(l.method_id, [])
    byMethod.get(l.method_id)!.push(l)
  }
  for (const arr of byMethod.values()) arr.sort((a, b) => a.order_num - b.order_num)

  const { data: methodsRaw } = await db.from('tahsin_methods').select('id, name')
  const namaMetode = new Map((methodsRaw ?? []).map(m => [m.id, m.name]))

  const { data: siswa } = await db
    .from('students')
    .select('id, full_name, kelas, jenjang, level_awal, current_method_id')
    .eq('is_active', true)

  const rencana: { id: string; jilidId: string; hal: number | null }[] = []
  const perTarget = new Map<string, number>()
  const gagal = new Map<string, { jumlah: number; contoh: string[] }>()
  let tanpaMetode = 0

  for (const s of siswa ?? []) {
    const teks = (s.level_awal ?? '').trim()
    const h = urai(teks)

    if (!s.current_method_id) {
      // Anak murni tahfidz (3 anak Ustadzah Ayu) memang tidak punya metode.
      tanpaMetode++
      continue
    }
    // Catatan yang isinya cuma posisi hafalan (juz atau nama surat) berarti
    // tahsinnya sudah tuntas — yang tersisa memang tinggal hafalan. Anak
    // seperti itu ditempatkan di jilid terminal.
    //
    // Dibatasi ke SMP dengan sengaja. Anak SD yang catatannya berisi juz jauh
    // lebih mungkin salah isi daripada benar-benar lulus tahsin, dan
    // meluluskannya diam-diam akan menutupi seluruh sisa jalur tahsinnya.
    // Kalau ada, ia dilaporkan terpisah supaya bisa diperiksa manusia.
    const catatanHafalan = h.sebab?.startsWith('keterangan tahfidz')
    if (catatanHafalan && s.jenjang === 'smp') {
      h.tahap = { jenis: 'lulus' }
      h.halaman = null
    } else if (catatanHafalan) {
      const k = `${h.sebab} pada anak ${s.jenjang} — perlu diperiksa`
      const g = gagal.get(k) ?? { jumlah: 0, contoh: [] }
      g.jumlah++
      if (g.contoh.length < 5) g.contoh.push(`${s.full_name} [${s.kelas}]: "${teks}"`)
      gagal.set(k, g)
      continue
    }

    if (!h.tahap) {
      const k = h.sebab ?? 'tidak dikenali'
      const g = gagal.get(k) ?? { jumlah: 0, contoh: [] }
      g.jumlah++
      if (g.contoh.length < 5 && teks) g.contoh.push(`${s.full_name} [${s.kelas}]: "${teks}"`)
      gagal.set(k, g)
      continue
    }

    const levelsMetode = byMethod.get(s.current_method_id) ?? []
    const target = cariJilid(h.tahap, levelsMetode)
    if (!target) {
      const k = `tahap tidak ada di metode ${namaMetode.get(s.current_method_id)}`
      const g = gagal.get(k) ?? { jumlah: 0, contoh: [] }
      g.jumlah++
      if (g.contoh.length < 5) g.contoh.push(`${s.full_name} [${s.kelas}]: "${teks}"`)
      gagal.set(k, g)
      continue
    }

    // Halaman dijepit ke jumlah halaman jilidnya; "hal 40" pada jilid 38 halaman
    // hampir pasti salah ketik, dan menyimpannya membuat cincin kemajuan >100%.
    const hal = h.halaman && target.total_pages
      ? Math.min(h.halaman, target.total_pages)
      : h.halaman

    rencana.push({ id: s.id, jilidId: target.id, hal })
    const kunci = `${namaMetode.get(s.current_method_id)} — ${target.label}`
    perTarget.set(kunci, (perTarget.get(kunci) ?? 0) + 1)
  }

  console.log(`Siswa aktif        : ${(siswa ?? []).length}`)
  console.log(`Terurai            : ${rencana.length}`)
  console.log(`Murni tahfidz      : ${tanpaMetode} (tanpa metode, dilewati)`)
  console.log(`Tidak terurai      : ${[...gagal.values()].reduce((t, g) => t + g.jumlah, 0)}`)

  console.log('\nHASIL PENEMPATAN:')
  for (const [k, v] of [...perTarget.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`)
  }

  console.log('\nTIDAK TERURAI:')
  for (const [k, g] of [...gagal.entries()].sort((a, b) => b[1].jumlah - a[1].jumlah)) {
    console.log(`  ${String(g.jumlah).padStart(4)}  ${k}`)
    for (const c of g.contoh) console.log(`          ${c}`)
  }

  if (!TULIS) {
    console.log('\n(mode laporan — jalankan dengan "tulis" untuk menyimpan)')
    return
  }

  console.log('\nMenyimpan...')
  let n = 0
  for (const r of rencana) {
    const { error } = await db.from('students')
      .update({ current_jilid_id: r.jilidId, current_jilid_page: r.hal, updated_at: new Date().toISOString() })
      .eq('id', r.id)
    if (error) { console.error('GAGAL:', error.message); process.exit(1) }
    n++
  }
  console.log(`  ✓ ${n} siswa diperbarui`)
}

main().catch(e => { console.error('GAGAL:', e.message); process.exit(1) })
