/**
 * Mengisi TMT (teachers.joined_at) guru Qur'an dari rekap TMT RQ LHI.
 *
 *     npm run impor:tmt
 *
 * Aman diulang: hanya baris yang nilainya BERBEDA yang ditulis, dan setiap
 * perubahan mencetak nilai lamanya beserta SQL untuk mengembalikannya.
 *
 * ── KENAPA BANYAK TMT BERNILAI 2026-08-18 ───────────────────────────────
 *
 * Itu bukan tanggal sungguhan, melainkan sisa `joined_at date default
 * current_date` pada skema awal: guru yang didaftarkan massal pada hari itu
 * mewarisi tanggal pendaftaran sebagai TMT. Migrasi 0044 melepas DEFAULT-nya
 * dan 0047 melepas NOT NULL-nya, tapi keduanya tidak membetulkan baris yang
 * terlanjur terisi. Berkas inilah yang membetulkannya.
 *
 * ── SOAL BARIS BERTANDA "perlu kroscek" ─────────────────────────────────
 *
 * Tujuh baris di rekap ditandai kuning: tanggalnya perkiraan, dan beberapa
 * "kemungkinan lebih lama". Semuanya tetap ditulis, karena nilai yang
 * digantikannya (2026-08-18) pasti keliru — perkiraan yang masuk akal lebih
 * dekat ke kebenaran daripada artefak default. Kolom `kroscek` di bawah
 * menandai mana saja yang masih perlu dipastikan ke yang bersangkutan.
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

interface BarisTmt {
  no: number
  /** Nama sebagaimana tertulis di rekap, lengkap dengan gelarnya. */
  nama: string
  tmt: string
  /** true = tanggalnya perkiraan, masih perlu dipastikan. */
  kroscek?: boolean
  catatan?: string
}

// Rekap TMT guru Qur'an, baris 14-33. Baris 1-13 belum diterima.
const REKAP: BarisTmt[] = [
  { no: 14, nama: 'Afifah Nurlaila, S.E',                tmt: '2023-07-01', kroscek: true, catatan: 'kemungkinan lebih lama' },
  { no: 15, nama: 'Nardiani',                            tmt: '2023-07-01', kroscek: true, catatan: 'kemungkinan lebih lama' },
  { no: 16, nama: 'Hairiennisa Rohaya, SEI., MSI',       tmt: '2023-07-01', kroscek: true },
  { no: 17, nama: 'Rafiqoh Hulwa Mahfudah',              tmt: '2023-07-01', kroscek: true },
  { no: 18, nama: 'Siti Hanifah',                        tmt: '2024-07-01' },
  { no: 19, nama: 'Dzikrina Nur Faizah, S.Pd. M.Pd',     tmt: '2023-07-01' },
  { no: 20, nama: 'Shabira Harum Kusumanafisa, S.I.Kom', tmt: '2025-07-01' },
  { no: 21, nama: 'Ayolla Tri Andani, S.Pd.',            tmt: '2026-07-01' },
  { no: 22, nama: 'Bani Afnidar Hidayah, S.P',           tmt: '2023-07-01', kroscek: true, catatan: 'kemungkinan lebih lama' },
  { no: 23, nama: 'Mujibullah Latif, S.E.',              tmt: '2023-07-01', kroscek: true, catatan: 'kemungkinan lebih lama' },
  { no: 24, nama: 'Muhammad Fawwaz Alifiyanto',          tmt: '2025-07-01' },
  { no: 25, nama: 'Hamdan, SH.',                         tmt: '2023-07-01' },
  { no: 26, nama: 'Dian Tri Kusuma Dewi, S.Pd.',         tmt: '2023-07-01', kroscek: true, catatan: 'kemungkinan lebih lama' },
  { no: 27, nama: 'Minkhatul Maula Sofa, S.S.I',         tmt: '2025-07-01' },
  { no: 28, nama: 'Dhea Aulia Azizah',                   tmt: '2026-07-01' },
  { no: 29, nama: 'Maulana Rizky Amrullah, S.Sos.',      tmt: '2025-07-01' },
  { no: 30, nama: 'Zaky Zakaria, S.Pd.',                 tmt: '2025-07-01' },
  { no: 31, nama: 'Achmad Naufal, S.H',                  tmt: '2026-07-01' },
  { no: 32, nama: 'Dewi Ayu Lestari',                    tmt: '2025-07-01', catatan: 'outsourcing di bawah SD mulai 01 Juli 2026' },
  { no: 33, nama: 'Nunung Khasanah',                     tmt: '2026-07-01' },
]

/**
 * Menyamakan nama rekap dengan nama sistem.
 *
 * Gelar ditulis tidak konsisten di kedua sisi — "Achmad Naufal, S.H" di rekap
 * vs "Achmad Naufal" di sistem, "S.I.Kom" vs "S.I.Kom." — jadi yang
 * dibandingkan hanya nama sebelum koma, tanpa gelar dan tanda baca.
 */
function inti(n: string): string {
  return n
    .split(',')[0]
    .toLowerCase()
    .replace(/\b(s|m)\.?\s?[a-z]{1,4}\.?\b/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const { data: semua, error } = await supabase
    .from('teachers')
    .select('id, full_name, joined_at, deleted_at')
  if (error) {
    console.error(`✗ Gagal memuat guru: ${error.message}`)
    process.exit(1)
  }

  const guru = (semua ?? []).filter(g => !g.deleted_at)

  const rencana: { baris: BarisTmt; id: string; nama: string; lama: string | null }[] = []
  const gagal: string[] = []

  for (const baris of REKAP) {
    const target = inti(baris.nama)
    const cocok = guru.filter(g => {
      const gi = inti(g.full_name)
      return gi === target || gi.startsWith(target) || target.startsWith(gi)
    })

    if (cocok.length !== 1) {
      const sebab = cocok.length === 0
        ? 'tidak ditemukan'
        : `cocok ganda: ${cocok.map(c => c.full_name).join(' | ')}`
      gagal.push(`  ${String(baris.no).padStart(2)}  ${baris.nama} — ${sebab}`)
      continue
    }
    if (cocok[0].joined_at === baris.tmt) continue
    rencana.push({ baris, id: cocok[0].id, nama: cocok[0].full_name, lama: cocok[0].joined_at })
  }

  // Satu nama yang tidak terpetakan berarti rekapnya berubah atau ada guru baru
  // bernama mirip. Berhenti sebelum menulis apa pun: TMT yang mendarat di guru
  // yang keliru jauh lebih sulit ditemukan daripada impor yang batal.
  if (gagal.length > 0) {
    console.error(`✗ ${gagal.length} baris tidak terpetakan — tidak ada yang ditulis:`)
    for (const g of gagal) console.error(g)
    process.exit(1)
  }

  if (rencana.length === 0) {
    console.log('✓ Semua TMT sudah sesuai rekap. Tidak ada yang diubah.')
    return
  }

  console.log(`Mengubah ${rencana.length} dari ${REKAP.length} baris:\n`)
  for (const r of rencana) {
    const { error: e } = await supabase
      .from('teachers')
      .update({ joined_at: r.baris.tmt, updated_at: new Date().toISOString() })
      .eq('id', r.id)
    if (e) {
      console.error(`✗ ${r.nama}: ${e.message}`)
      process.exit(1)
    }

    const tanda = r.baris.kroscek ? '  [perlu kroscek]' : ''
    console.log(`  ${String(r.baris.no).padStart(2)}  ${r.nama.padEnd(34)} ${r.lama ?? '(kosong)'} -> ${r.baris.tmt}${tanda}`)
  }

  const perlu = rencana.filter(r => r.baris.kroscek)
  if (perlu.length > 0) {
    console.log(`\n! ${perlu.length} TMT di atas masih perkiraan. Pastikan ke yang bersangkutan:`)
    for (const r of perlu) {
      const ket = r.baris.catatan ? ` — ${r.baris.catatan}` : ''
      console.log(`  - ${r.nama}${ket}`)
    }
  }

  console.log('\nUntuk mengembalikan:')
  for (const r of rencana) {
    const lama = r.lama ? `'${r.lama}'` : 'NULL'
    console.log(`  UPDATE teachers SET joined_at = ${lama} WHERE id = '${r.id}';  -- ${r.nama}`)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
