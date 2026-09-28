/**
 * Isi mundur drill tahfidz (drizzle/0065) dari ziyadah yang sudah tercatat.
 *
 *     npx tsx scripts/isi-drill-tahfidz.ts --dry   # lihat saja
 *     npx tsx scripts/isi-drill-tahfidz.ts         # simpan
 *
 * Aturannya sama dengan catatDrillSetelahZiyadah: ziyadah yang berakhir di
 * ayat terakhir juz menurut arah hafalan unit (akhirJuzArah) membuka drill
 * juz itu. Ujian 1 juz yang sudah ada untuk juz itu langsung ditautkan —
 * anaknya tidak tampil "sedang drill". Baris yang sudah ada tidak disentuh.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { juzTuntasDiAyat } from '@/lib/rq/target-tahfidz'
import type { Jenjang } from '@/types'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

interface Log {
  id: string; student_id: string; surat_id: number; surat_ke_id: number | null; ayat_ke: number | null
  setoran_date: string; students: { jenjang: Jenjang | null; full_name: string } | null
}

async function main() {
  const dry = process.argv.includes('--dry')
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { error: galatTabel } = await sb.from('tahfidz_juz_drill').select('id').limit(1)
  if (galatTabel) {
    console.error('✗ Tabel tahfidz_juz_drill belum ada — jalankan drizzle/0065_drill_tahfidz_juz_PASTE_TO_SUPABASE.sql dulu.')
    process.exit(1)
  }

  const logs: Log[] = []
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from('tahfidz_logs')
      .select('id, student_id, surat_id, surat_ke_id, ayat_ke, setoran_date, students(jenjang, full_name)')
      .eq('kind', 'ziyadah').order('setoran_date').order('id').range(p * 1000, p * 1000 + 999)
    if (error) { console.error('✗', error.message); process.exit(1) }
    logs.push(...((data ?? []) as unknown as Log[]))
    if ((data ?? []).length < 1000) break
  }

  const { data: drill } = await sb.from('tahfidz_juz_drill').select('student_id, juz_number')
  const ada = new Set((drill ?? []).map(d => `${d.student_id}|${d.juz_number}`))
  const { data: ujian } = await sb.from('ujian_tahfidz').select('id, student_id, juz, created_at')
    .eq('tipe', '1_juz').not('student_id', 'is', null).order('created_at', { ascending: false })

  // Ziyadah paling awal yang menamatkan juz itu = awal drill-nya.
  const baru = new Map<string, Record<string, unknown> & { nama: string }>()
  for (const l of logs) {
    if (!l.ayat_ke) continue
    const juz = juzTuntasDiAyat(l.surat_ke_id ?? l.surat_id, l.ayat_ke, l.students?.jenjang ?? null)
    const kunci = `${l.student_id}|${juz}`
    if (!juz || ada.has(kunci) || baru.has(kunci)) continue
    const u = (ujian ?? []).find(x => x.student_id === l.student_id && x.juz === String(juz))
    baru.set(kunci, {
      nama: `${l.students?.full_name} (${l.students?.jenjang}) juz ${juz} sejak ${l.setoran_date}${u ? ' — ujian sudah ada, langsung ditautkan' : ''}`,
      student_id: l.student_id, juz_number: juz, selesai_ziyadah: l.setoran_date, source_log_id: l.id, ujian_id: u?.id ?? null,
    })
  }

  for (const b of baru.values()) console.log(`  ${b.nama}`)
  if (dry || baru.size === 0) {
    console.log(`${baru.size} drill baru${dry ? ' (dry-run, tidak disimpan)' : ''}.`)
    return
  }
  const { error } = await sb.from('tahfidz_juz_drill')
    .insert([...baru.values()].map(r => { const salin = { ...r }; delete (salin as { nama?: string }).nama; return salin }))
  if (error) { console.error('✗', error.message); process.exit(1) }
  console.log(`✓ ${baru.size} drill baru tersimpan.`)
}

main().catch(e => { console.error(e); process.exit(1) })
