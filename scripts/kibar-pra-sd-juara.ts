/**
 * Susun ulang tahapan KIBAR (2026-10-02, keputusan RQ):
 *   - SD LHI       : Jilid 1, Jilid 2, Jilid 3, Al-Qur'an, Lulus Tahsin
 *   - SD LHI Juara : Pra, Jilid 1, Jilid 2, Jilid 3, Al-Qur'an, Lulus Tahsin
 *
 *     npx tsx scripts/kibar-pra-sd-juara.ts --dry   # lihat rencana
 *     npx tsx scripts/kibar-pra-sd-juara.ts         # simpan
 *
 * Dua unit, SATU metode di jilid_levels: tahap "Pra" (28 halaman, order 0)
 * ditambahkan ke KIBAR, lalu disembunyikan dari unit selain SD Juara oleh
 * tahapBerlaku (lib/tahsin.ts). Tahap "Talaqqi Al-Qur’an" berganti nama
 * menjadi "Al-Qur’an" — id-nya tetap, jadi posisi & riwayat siswa tidak
 * tersentuh. Aman diulang.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const dry = process.argv.includes('--dry')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: metode, error } = await sb.from('tahsin_methods').select('id').eq('name', 'KIBAR').single()
  if (error || !metode) throw new Error('Metode KIBAR tidak ditemukan.')

  const { data: tahap } = await sb.from('jilid_levels')
    .select('id, label, order_num').eq('method_id', metode.id).order('order_num')
  const daftar = (tahap ?? []) as { id: string; label: string; order_num: number }[]
  console.log('Sebelum:', daftar.map(t => `${t.order_num}:${t.label}`).join(' → '))

  const quran = daftar.find(t => t.order_num === 4)
  if (quran && quran.label !== 'Al-Qur’an') {
    console.log(`  ~ ganti nama "${quran.label}" → "Al-Qur’an"`)
    if (!dry) {
      const { error: e } = await sb.from('jilid_levels').update({ label: 'Al-Qur’an' }).eq('id', quran.id)
      if (e) throw new Error(`Gagal mengganti nama: ${e.message}`)
    }
  }

  if (!daftar.some(t => t.order_num === 0)) {
    console.log('  + tambah "Pra" (28 halaman, order 0)')
    if (!dry) {
      const { error: e } = await sb.from('jilid_levels').insert({
        method_id: metode.id, label: 'Pra', order_num: 0, total_pages: 28,
        is_quran: false, baca_quran: false, is_terminal: false,
      })
      if (e) throw new Error(`Gagal menambah Pra: ${e.message}`)
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
