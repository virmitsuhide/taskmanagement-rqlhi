/**
 * Seed materi hafalan Gharib & Tajwid (UMMI).
 *
 * Sumbernya dua dokumen dari RQ LHI: "Materi Gharib_1.docx" dan
 * "Materi Tajwid.docx". Di Gharib nomor materi memang tercetak di bukunya
 * (angka dalam kurung), jadi ia disalin apa adanya. Di Tajwid dokumennya hanya
 * menyebut nama kaidah berurut per halaman, jadi nomornya diturunkan dari
 * urutan itu — kalau bukunya ternyata memakai penomoran lain, yang perlu
 * diubah cukup berkas ini.
 *
 * HALAMAN TANPA MATERI TIDAK DIMASUKKAN. Gharib punya halaman reviu (14) dan
 * penguatan (24–28), Tajwid punya halaman latihan (4 dan 20). Halaman itu tidak
 * memperkenalkan materi baru, dan memasukkannya akan membuat progres
 * "x dari sekian" menghitung sesuatu yang tidak pernah dihafalkan.
 *
 * Prasyarat: migrasi drizzle/0067 sudah diterapkan.
 * Idempotent: aman dijalankan berulang (upsert on jilid_id,nomor).
 * Jalankan: npm run seed:materi
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { GHARIB, TAJWID, periksaMateri, type Materi } from '@/lib/rq/materi-ummi'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function jilidUmmi(label: string): Promise<string | null> {
  const { data: metode } = await supabase
    .from('tahsin_methods').select('id').eq('name', 'UMMI').maybeSingle()
  if (!metode) {
    console.error('  ✗ metode UMMI belum ada — jalankan seed:phase0 dulu')
    return null
  }

  const { data: jilid } = await supabase
    .from('jilid_levels').select('id')
    .eq('method_id', (metode as { id: string }).id)
    .eq('label', label)
    .maybeSingle()
  if (!jilid) {
    console.error(`  ✗ tahap "${label}" belum ada di metode UMMI`)
    return null
  }
  return (jilid as { id: string }).id
}

async function seedMateri(label: string, daftar: Materi[]) {
  if (periksaMateri(label, daftar).length > 0) return

  const jilidId = await jilidUmmi(label)
  if (!jilidId) return

  const { error } = await supabase.from('tahsin_materi').upsert(
    daftar.map(m => ({
      jilid_id: jilidId,
      nomor: m.nomor,
      halaman: m.halaman,
      nama: m.nama,
      keterangan: m.keterangan ?? null,
    })),
    { onConflict: 'jilid_id,nomor' },
  )
  if (error) {
    console.error(`  ✗ ${label}: ${error.message}`)
    return
  }

  const halamanTerbesar = Math.max(...daftar.map(m => m.halaman))
  console.log(`  ✓ ${label}: ${daftar.length} materi (halaman 1–${halamanTerbesar})`)
}

async function main() {
  console.log('Seed materi hafalan UMMI...')
  await seedMateri('Gharib', GHARIB)
  await seedMateri('Tajwid', TAJWID)
  console.log('\nDone.')
}

main().catch(err => {
  console.error('Seed gagal:', err)
  process.exit(1)
})
