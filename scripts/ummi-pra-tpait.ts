/**
 * Tambah tahap "Pra-UMMI" ke metode UMMI (2026-10-04, keputusan RQ):
 *   - PAUD/TPAIT : Pra-UMMI, Jilid 1–6, Al-Qur'an, …
 *   - SD (UMMI)  : langsung Jilid 1 seperti sebelumnya
 *
 *     npx tsx scripts/ummi-pra-tpait.ts --dry   # lihat rencana
 *     npx tsx scripts/ummi-pra-tpait.ts         # simpan
 *
 * Satu metode di jilid_levels untuk dua unit: tahap "Pra-UMMI" (40 halaman,
 * order 0) ditambahkan, lalu disembunyikan dari siswa SD oleh tahapBerlaku
 * (lib/tahsin.ts). Tahap lain tidak tersentuh. Aman diulang.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const dry = process.argv.includes('--dry')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: metode, error } = await sb.from('tahsin_methods').select('id').eq('name', 'UMMI').single()
  if (error || !metode) throw new Error('Metode UMMI tidak ditemukan.')

  const { data: tahap } = await sb.from('jilid_levels')
    .select('id, label, order_num').eq('method_id', metode.id).order('order_num')
  const daftar = (tahap ?? []) as { id: string; label: string; order_num: number }[]
  console.log('Sebelum:', daftar.map(t => `${t.order_num}:${t.label}`).join(' → '))

  if (daftar.some(t => t.order_num === 0)) {
    console.log('  = order 0 sudah terisi — tidak ada yang ditambah.')
  } else {
    console.log('  + tambah "Pra-UMMI" (40 halaman, order 0)')
    if (!dry) {
      const { error: e } = await sb.from('jilid_levels').insert({
        method_id: metode.id, label: 'Pra-UMMI', order_num: 0, total_pages: 40,
        is_quran: false, baca_quran: false, is_terminal: false,
      })
      if (e) throw new Error(`Gagal menambah Pra-UMMI: ${e.message}`)
    }
  }

  if (!dry) {
    const { data: akhir } = await sb.from('jilid_levels')
      .select('label, order_num, total_pages').eq('method_id', metode.id).order('order_num')
    console.log('Sesudah:', (akhir ?? []).map(t => `${t.order_num}:${t.label}${t.total_pages ? ` (${t.total_pages} hal)` : ''}`).join(' → '))
  } else {
    console.log('DRY-RUN — tidak disimpan.')
  }
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
