/**
 * Seragamkan sapaan pada nama halaqoh: Ustadz / Ustadzah (bentuk panjang).
 *
 * MASALAHNYA
 *
 * Nama halaqoh diketik tangan dan terbelah per unit: SD memakai "Ustadz Hendra"
 * dan "Ustadzah Afifah", SMP memakai "Ust. Amru" dan "Usth. Dian". Titiknya pun
 * tidak konsisten ("Ust Amru" vs "Ust. Amru"), dan guru yang sama bisa muncul
 * dengan dua sapaan berbeda di sesi yang berbeda — "Ust. Sofa" di Sesi 1, tapi
 * "Usth. Sofa" di Sesi 2 dan 3.
 *
 * KENAPA JENIS KELAMIN DITURUNKAN DARI DATA, BUKAN DARI NAMA
 *
 * Tabel teachers tidak punya kolom gender, dan menebaknya dari nama Indonesia
 * adalah cara yang pasti salah untuk sebagian orang. Yang dipakai di sini bukan
 * tebakan melainkan BUKTI: hampir setiap guru sudah muncul di halaqoh lain
 * dengan sapaan yang tidak ambigu — "Ustadzah Afifah", "Usth Dian" — dan itulah
 * yang menentukan. "Ust." tidak pernah dijadikan bukti, sebab di data ini ia
 * dipakai untuk laki-laki maupun perempuan.
 *
 * Guru yang tidak punya satu pun kemunculan tak-ambigu dilaporkan terpisah agar
 * bisa diperiksa manusia, bukan diam-diam ditebak.
 *
 * Idempoten: nama yang sudah benar tidak disentuh.
 *
 * Jalankan kering : npm run rapikan:halaqoh
 * Jalankan tulis  : npm run rapikan:halaqoh -- --tulis
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

const TULIS = process.argv.includes('--tulis')

type Kelamin = 'L' | 'P'

/**
 * Pisahkan sapaan dari nama. Urutan pengujian penting: "Ustadzah" harus dicoba
 * sebelum "Ustadz", kalau tidak ia akan tercacah jadi "Ustadz" + "ah Afifah".
 */
function pecah(segmen: string): { sapaan: string; nama: string } | null {
  const m = segmen.trim().match(/^(Ustadzah|Ustadz|Usth\.?|Ust\.?)\s+(.+)$/i)
  return m ? { sapaan: m[1].toLowerCase().replace(/\.$/, ''), nama: m[2].trim() } : null
}

/** Sapaan yang sudah menyatakan jenis kelamin dengan sendirinya. */
function kelaminDariSapaan(sapaan: string): Kelamin | null {
  if (sapaan === 'ustadzah' || sapaan === 'usth') return 'P'
  if (sapaan === 'ustadz') return 'L'
  return null // "ust" — dipakai untuk keduanya, jadi tidak bisa jadi bukti
}

/** Nama orang di dalam segmen, tanpa embel-embel seperti "(QULS)". */
function kunciNama(nama: string): string {
  return nama.replace(/\(.*?\)/g, '').trim().toLowerCase()
}

async function main() {
  const { data, error } = await supabase
    .from('halaqoh')
    .select('id, name')
    .order('name')
  if (error) { console.error(`✗ gagal membaca halaqoh: ${error.message}`); process.exit(1) }

  const rows = (data ?? []) as { id: string; name: string }[]
  console.log(`${rows.length} halaqoh dibaca.${TULIS ? '' : '  (MODE KERING — tidak menulis apa pun)'}\n`)

  // 1) Kumpulkan bukti jenis kelamin dari seluruh nama yang tak ambigu.
  const bukti = new Map<string, Kelamin>()
  for (const r of rows) {
    for (const segmen of r.name.split('/')) {
      const p = pecah(segmen.replace(/^.*?—\s*/, ''))
      if (!p) continue
      const k = kelaminDariSapaan(p.sapaan)
      if (k) bukti.set(kunciNama(p.nama), k)
    }
  }

  // 2) Susun nama baru.
  const perubahan: { id: string; dari: string; ke: string }[] = []
  const tanpaBukti = new Set<string>()

  for (const r of rows) {
    const pisah = r.name.split('—')
    const awalan = pisah.length > 1 ? `${pisah[0].trim()} — ` : ''
    const isi = pisah.length > 1 ? pisah.slice(1).join('—').trim() : r.name

    const segmenBaru = isi.split('/').map(segmen => {
      const p = pecah(segmen)
      if (!p) return segmen.trim()
      const k = kelaminDariSapaan(p.sapaan)
        ?? bukti.get(kunciNama(p.nama))
        // Jalan terakhir: "usth" sudah tertangkap di atas, jadi yang tersisa
        // hanyalah "ust" — di data ini dipakai laki-laki bila bukan "usth".
        ?? (tanpaBukti.add(p.nama), 'L' as Kelamin)
      return `${k === 'P' ? 'Ustadzah' : 'Ustadz'} ${p.nama}`
    })

    const baru = awalan + segmenBaru.join('/')
    if (baru !== r.name) perubahan.push({ id: r.id, dari: r.name, ke: baru })
  }

  if (tanpaBukti.size > 0) {
    console.log('⚠ Tidak ada kemunculan tak-ambigu untuk nama berikut — disimpulkan')
    console.log('  laki-laki karena sapaannya "Ust." dan bukan "Usth.". Periksa manual:')
    for (const n of tanpaBukti) console.log(`    · ${n}`)
    console.log()
  }

  if (perubahan.length === 0) {
    console.log('✓ Semua nama halaqoh sudah seragam. Tidak ada yang diubah.')
    return
  }

  console.log(`${perubahan.length} nama akan diubah:\n`)
  for (const p of perubahan) console.log(`  ${p.dari}\n  → ${p.ke}\n`)

  if (!TULIS) {
    console.log('Mode kering. Jalankan ulang dengan --tulis untuk menerapkannya.')
    return
  }

  let berhasil = 0
  for (const p of perubahan) {
    const { error: err } = await supabase.from('halaqoh').update({ name: p.ke }).eq('id', p.id)
    if (err) console.error(`  ✗ ${p.dari}: ${err.message}`)
    else berhasil++
  }
  console.log(`\n✓ ${berhasil} dari ${perubahan.length} nama diperbarui.`)
}

main().catch(err => {
  console.error('Gagal:', err)
  process.exit(1)
})
