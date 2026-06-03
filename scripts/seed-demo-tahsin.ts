/**
 * RESET + SEED DEMO Tahsin/Tahfidz — satu siswa dummy per LEVEL (semua metode).
 *
 * ⚠️ MENGHAPUS semua data aktivitas tahsin/tahfidz (tahsin_logs, tahfidz_logs,
 *    tasmi_logs, jilid_promotions, juz_promotions, juz_progress) dan siswa demo
 *    (NIS '2024-%' & 'THS-%'), lalu membangun ulang dataset dummy yang mencakup
 *    SETIAP level UMMI/KIBAR/Syajaroh + contoh tahfidz (ziyadah / muroja'ah
 *    baru & lama / tasmi 3 & 5 juz).
 *
 * Prasyarat:
 *   - migrasi 0006 + 0007 (nilai numeric utk setengah bintang) sudah diterapkan
 *   - `npx tsx scripts/seed-phase0.ts` (metode UMMI/KIBAR/Syajaroh)
 *   - guru demo: `npm run seed:teachers` (ust_ahmad, ust_fatimah, ust_yusuf)
 *
 * Idempotent: reset di awal membuat skrip aman dijalankan berulang.
 * Jalankan: npx tsx scripts/seed-demo-tahsin.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const EPOCH = '1970-01-01'
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const int = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const chance = (p: number) => Math.random() < p
// nilai setengah-bintang acak [min..5] kelipatan 0.5 (mis. 3, 3.5, 4, 4.5, 5)
const score = (min = 3): number => { const o: number[] = []; for (let v = min; v <= 5; v += 0.5) o.push(v); return pick(o) }

// Metode → jenjang/unit representatif untuk demo (sesuai kebijakan RQ LHI)
const METHOD_JENJANG: Record<string, string> = { UMMI: 'sd', KIBAR: 'sd_juara', Syajaroh: 'smp' }
const METHOD_CODE: Record<string, string> = { UMMI: 'UMMI', KIBAR: 'KIBAR', Syajaroh: 'SYJ' }

interface Level { id: string; label: string; order_num: number; total_pages: number | null; is_quran: boolean; is_terminal: boolean }
interface Created {
  studentId: string; methodId: string; methodName: string
  teacherId: string; halaqohId: string; level: Level
}

const CATATAN = ['Bagus, lanjutkan!', 'Perhatikan madd thabi\'i', 'Latih makharijul huruf', 'Alhamdulillah lancar', 'Jaga tempo bacaan']

// ─── 1. RESET ───────────────────────────────────────────────────────
async function resetActivity() {
  console.log('🧹 Reset data tahsin/tahfidz...')
  for (const t of ['tasmi_logs', 'tahfidz_logs', 'tahsin_logs', 'jilid_promotions', 'juz_promotions']) {
    const { error } = await supabase.from(t).delete().gte('created_at', EPOCH)
    if (error) console.error(`  ✗ clear ${t}: ${error.message}`)
    else console.log(`  ✓ ${t} dikosongkan`)
  }
  const { error: jpErr } = await supabase.from('juz_progress').delete().gte('updated_at', EPOCH)
  if (jpErr) console.error(`  ✗ clear juz_progress: ${jpErr.message}`)
  else console.log('  ✓ juz_progress dikosongkan')

  for (const pat of ['2024-%', 'THS-%']) {
    const { error, count } = await supabase.from('students').delete({ count: 'exact' }).like('nis', pat)
    if (error) console.error(`  ✗ hapus siswa ${pat}: ${error.message}`)
    else console.log(`  ✓ ${count ?? 0} siswa demo (${pat}) dihapus`)
  }
}

// ─── 2. HALAQOH per metode ──────────────────────────────────────────
async function ensureHalaqoh(walis: Record<string, string>) {
  const defs = [
    { method: 'UMMI', name: 'Halaqoh UMMI (Demo)', jenjang: 'sd', wali: walis.UMMI },
    { method: 'KIBAR', name: 'Halaqoh KIBAR Juara (Demo)', jenjang: 'sd_juara', wali: walis.KIBAR },
    { method: 'Syajaroh', name: 'Halaqoh Syajaroh (Demo)', jenjang: 'smp', wali: walis.Syajaroh },
  ]
  const map: Record<string, { id: string; wali: string }> = {}
  for (const h of defs) {
    const { data: existing } = await supabase.from('halaqoh').select('id').eq('name', h.name).maybeSingle()
    let id = existing?.id as string | undefined
    if (!id) {
      const { data, error } = await supabase.from('halaqoh')
        .insert({ name: h.name, jenjang: h.jenjang, wali_teacher_id: h.wali, schedule_note: 'Senin–Jumat (demo)' })
        .select('id').single()
      if (error || !data) { console.error(`  ✗ halaqoh ${h.name}: ${error?.message}`); continue }
      id = data.id
    }
    if (!id) continue
    map[h.method] = { id, wali: h.wali }
  }
  console.log(`  ✓ ${Object.keys(map).length} halaqoh siap`)
  return map
}

// ─── 3. SISWA per level ─────────────────────────────────────────────
async function seedStudentsPerLevel(halaqoh: Record<string, { id: string; wali: string }>): Promise<Created[]> {
  const { data: methods } = await supabase.from('tahsin_methods').select('id, name').in('name', ['UMMI', 'KIBAR', 'Syajaroh'])
  if (!methods || methods.length < 3) { console.error('❌ Metode UMMI/KIBAR/Syajaroh belum di-seed (jalankan seed-phase0).'); process.exit(1) }

  const created: Created[] = []
  for (const m of methods) {
    const h = halaqoh[m.name]
    if (!h) continue
    const { data: levels } = await supabase.from('jilid_levels')
      .select('id, label, order_num, total_pages, is_quran, is_terminal')
      .eq('method_id', m.id).order('order_num')
    const levs = (levels ?? []) as Level[]

    for (let i = 0; i < levs.length; i++) {
      const lv = levs[i]
      const nis = `THS-${METHOD_CODE[m.name]}-${String(lv.order_num).padStart(2, '0')}`
      const page = lv.is_quran || lv.is_terminal || !lv.total_pages ? null : Math.ceil(lv.total_pages / 2)
      const { data: st, error } = await supabase.from('students').insert({
        nis,
        full_name: `${m.name} — ${lv.label}`,
        gender: i % 2 === 0 ? 'L' : 'P',
        jenjang: METHOD_JENJANG[m.name],
        kelas: `${int(1, 6)}${pick(['A', 'B'])}`,
        halaqoh_id: h.id,
        wali_name: `Wali ${m.name} ${lv.order_num}`,
        wali_phone: `0812${int(10000000, 99999999)}`,
        current_method_id: m.id,
        current_jilid_id: lv.id,
        current_jilid_page: page,
      }).select('id').single()
      if (error || !st) { console.error(`  ✗ siswa ${nis}: ${error?.message}`); continue }
      created.push({ studentId: st.id, methodId: m.id, methodName: m.name, teacherId: h.wali, halaqohId: h.id, level: lv })

      // Riwayat kenaikan jilid: dari level sebelumnya → level ini (kecuali jilid 1)
      if (i > 0) {
        await supabase.from('jilid_promotions').insert({
          student_id: st.id, from_jilid_id: levs[i - 1].id, to_jilid_id: lv.id,
          promoted_by: h.wali, promotion_date: isoDate(daysAgo(int(10, 40))),
          exam_score: int(78, 95), catatan: lv.is_terminal ? 'Lulus tahsin 🎓' : 'Naik dengan baik',
        })
      }
    }
  }
  console.log(`  ✓ ${created.length} siswa dibuat (satu per level)`)
  return created
}

// ─── 4. Setoran tahsin (untuk siswa yang masih dalam tahsin) ────────
async function seedTahsinLogs(created: Created[]) {
  const batch: Record<string, unknown>[] = []
  for (const c of created) {
    if (c.level.is_terminal) continue // sudah lulus, tak ada setoran harian
    let logs = 0
    for (let dayBack = 16; dayBack >= 0 && logs < 6; dayBack--) {
      const d = daysAgo(dayBack)
      if (d.getDay() === 0 || d.getDay() === 6) continue
      if (!chance(0.65)) continue
      logs++
      batch.push({
        student_id: c.studentId, teacher_id: c.teacherId, halaqoh_id: c.halaqohId,
        setoran_date: isoDate(d),
        method_id: c.methodId, jilid_id: c.level.id,
        halaman: c.level.is_quran ? null : (c.level.total_pages ? int(1, c.level.total_pages) : null),
        baris_dari: c.level.is_quran ? null : 1,
        baris_ke: c.level.is_quran ? null : int(3, 5),
        nilai_fashohah: score(3), nilai_tajwid: score(3), nilai_kelancaran: score(3),
        status: chance(0.85) ? 'lulus' : 'ulang',
        catatan: chance(0.3) ? pick(CATATAN) : null,
      })
    }
  }
  if (batch.length) {
    const { error } = await supabase.from('tahsin_logs').insert(batch)
    if (error) console.error('  ✗ tahsin_logs:', error.message)
    else console.log(`  ✓ ${batch.length} setoran tahsin`)
  }
}

// ─── 5. Tahfidz: ziyadah / muroja'ah baru-lama / tasmi ──────────────
async function seedTahfidz(created: Created[]) {
  // Surat juz 30 (78–114) & juz 29 (67–77) sebagai materi
  const [{ data: juz30 }, { data: juz29 }] = await Promise.all([
    supabase.from('surat_master').select('id, total_ayat, juz_start').gte('id', 78).lte('id', 114),
    supabase.from('surat_master').select('id, total_ayat, juz_start').gte('id', 67).lte('id', 77),
  ])
  const s30 = juz30 ?? [], s29 = juz29 ?? []

  // Siswa "lanjut" = tahap Al-Qur'an / Talaqqi / Lulus → yang ber-tahfidz
  const advanced = created.filter(c => c.level.is_quran || c.level.is_terminal).slice(0, 8)
  if (advanced.length === 0 || s30.length === 0) { console.log('  · lewati tahfidz (data materi/siswa kurang)'); return }

  const tahfidz: Record<string, unknown>[] = []
  const tasmi: Record<string, unknown>[] = []

  advanced.forEach((c, idx) => {
    // Ziyadah di juz 30 (trigger DB otomatis menambah juz_progress)
    for (let k = 0; k < int(2, 4); k++) {
      const sr = pick(s30)
      const dari = int(1, Math.max(1, sr.total_ayat - 4))
      tahfidz.push({
        student_id: c.studentId, teacher_id: c.teacherId, halaqoh_id: c.halaqohId,
        setoran_date: isoDate(daysAgo(int(1, 20))), kind: 'ziyadah',
        surat_id: sr.id, ayat_dari: dari, ayat_ke: Math.min(sr.total_ayat, dari + int(2, 4)),
        nilai_fashohah: score(3), nilai_tajwid: score(3), nilai_kelancaran: score(3),
      })
    }
    // Muroja'ah baru di juz 29 (juz berjalan)
    if (s29.length) {
      const sr = pick(s29)
      const dari = int(1, Math.max(1, sr.total_ayat - 3))
      tahfidz.push({
        student_id: c.studentId, teacher_id: c.teacherId, halaqoh_id: c.halaqohId,
        setoran_date: isoDate(daysAgo(int(1, 14))), kind: 'murojaah_baru',
        surat_id: sr.id, ayat_dari: dari, ayat_ke: Math.min(sr.total_ayat, dari + int(1, 3)),
        nilai_fashohah: score(3), nilai_tajwid: score(3), nilai_kelancaran: score(3),
      })
    }
    // Dua siswa pertama: juz 30 sudah diujikan (mutqin) + muroja'ah lama
    if (idx < 2) {
      const sr = pick(s30)
      const dari = int(1, Math.max(1, sr.total_ayat - 3))
      tahfidz.push({
        student_id: c.studentId, teacher_id: c.teacherId, halaqoh_id: c.halaqohId,
        setoran_date: isoDate(daysAgo(int(1, 10))), kind: 'murojaah_lama',
        surat_id: sr.id, ayat_dari: dari, ayat_ke: Math.min(sr.total_ayat, dari + int(1, 3)),
        nilai_fashohah: score(4), nilai_tajwid: score(4), nilai_kelancaran: score(4),
      })
    }
  })

  if (tahfidz.length) {
    const { error } = await supabase.from('tahfidz_logs').insert(tahfidz)
    if (error) console.error('  ✗ tahfidz_logs:', error.message)
    else console.log(`  ✓ ${tahfidz.length} setoran tahfidz (ziyadah/muroja'ah — trigger update juz_progress)`)
  }

  // Tandai juz 30 mutqin untuk 2 siswa pertama (riwayat ujian juz)
  for (let i = 0; i < Math.min(2, advanced.length); i++) {
    const c = advanced[i]
    await supabase.from('juz_promotions').insert({
      student_id: c.studentId, juz_number: 30, promoted_by: c.teacherId,
      promotion_date: isoDate(daysAgo(int(15, 30))), exam_score: int(85, 96), catatan: 'Khatam juz 30',
    })
    await supabase.from('juz_progress').upsert(
      { student_id: c.studentId, juz_number: 30, mutqin: true, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,juz_number' },
    )
  }

  // Tasmi': 1 siswa 3 juz (1–3), 1 siswa 5 juz (1–5)
  if (advanced[0]) tasmi.push({ student_id: advanced[0].studentId, teacher_id: advanced[0].teacherId, halaqoh_id: advanced[0].halaqohId, setoran_date: isoDate(daysAgo(7)), scope_juz: 3, juz_from: 1, juz_to: 3, nilai_fashohah: score(4), nilai_tajwid: score(4), nilai_kelancaran: score(4), status: 'lulus', catatan: 'Tasmi 3 juz lancar' })
  if (advanced[1]) tasmi.push({ student_id: advanced[1].studentId, teacher_id: advanced[1].teacherId, halaqoh_id: advanced[1].halaqohId, setoran_date: isoDate(daysAgo(4)), scope_juz: 5, juz_from: 1, juz_to: 5, nilai_fashohah: score(3), nilai_tajwid: score(3), nilai_kelancaran: score(3), status: chance(0.5) ? 'lulus' : 'ulang', catatan: 'Tasmi 5 juz' })

  if (tasmi.length) {
    const { error } = await supabase.from('tasmi_logs').insert(tasmi)
    if (error) console.error('  ✗ tasmi_logs:', error.message)
    else console.log(`  ✓ ${tasmi.length} setoran tasmi (3 & 5 juz)`)
  }
}

async function main() {
  console.log('🌱 Reset + seed demo tahsin/tahfidz (per level)...\n')

  const { data: teachers } = await supabase.from('teachers').select('id, username')
    .in('username', ['ust_ahmad', 'ust_fatimah', 'ust_yusuf'])
  if (!teachers || teachers.length < 3) {
    console.error('❌ Guru demo belum lengkap. Jalankan dulu: npm run seed:teachers')
    process.exit(1)
  }
  const byUser = Object.fromEntries(teachers.map(t => [t.username, t.id]))
  const walis = { UMMI: byUser.ust_ahmad, KIBAR: byUser.ust_fatimah, Syajaroh: byUser.ust_yusuf }

  await resetActivity()
  console.log('\n🏫 Halaqoh & siswa...')
  const halaqoh = await ensureHalaqoh(walis)
  const created = await seedStudentsPerLevel(halaqoh)
  console.log('\n📖 Setoran...')
  await seedTahsinLogs(created)
  await seedTahfidz(created)

  console.log('\n✅ Selesai. Cek:')
  console.log('  • /siswa  → daftar siswa per level (UMMI/KIBAR/Syajaroh)')
  console.log('  • /guru (ust_ahmad / ust_fatimah / ust_yusuf) → siswa + riwayat setoran/tahfidz/tasmi')
}

main().catch(err => { console.error('Seed gagal:', err); process.exit(1) })
