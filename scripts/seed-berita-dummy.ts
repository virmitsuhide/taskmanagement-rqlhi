/**
 * Bersihkan berita demo lama & isi ulang dengan data dummy.
 *
 * Jalankan: npm run seed:berita
 *
 * Kenapa ada skrip ini: data demo dari seed-demo-content.ts memakai thumbnail
 * Unsplash, sedangkan next.config hanya mengizinkan host *.supabase.co — jadi
 * next/image melempar error tiap kali berita itu dirender. Data dummy di sini
 * sengaja tanpa thumbnail (thumbnail_url = null); UI sudah punya fallback
 * gradasi di carousel beranda dan ikon placeholder di panel kelola.
 *
 * Aman dijalankan berulang:
 *  - Yang dihapus HANYA judul demo lama yang terdaftar di OLD_DEMO_TITLES.
 *    Berita asli yang ditulis lewat CMS tidak pernah tersentuh.
 *  - Insert dilewati untuk judul yang sudah ada.
 *
 * Sebarannya sengaja dibuat memenuhi seluruh filter panel /humas/berita:
 * kelima kategori unit terpakai, ada berita & artikel, ada terbit & nonaktif.
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

/** Judul berita demo lama (seed-demo-content.ts) yang boleh dihapus skrip ini. */
const OLD_DEMO_TITLES = [
  'Ramadhan Ceria di SDIT LHI — Pesantren Kilat Penuh Berkah',
  'Khataman Akbar Siswa SD — Wisuda Tahfidz Juz 30',
  'Workshop Tahsin Metode Tilawati untuk Guru',
  'Prestasi Tahfidz Siswa SMPIT LHI di Tingkat Provinsi',
  'PAUD LHI Buka Pendaftaran Tahun Ajaran Baru',
  "Kiat Membangun Generasi Qur'ani Sejak Dini",
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

async function main() {
  console.log('🌱 Seed berita dummy dimulai...\n')

  // ── Penulis ──────────────────────────────────────────────────
  const { data: usersData } = await supabase
    .from('users').select('id, username')
    .in('username', ['kepala_rq', 'humas'])
  const u = new Map((usersData ?? []).map(r => [r.username, r.id]))
  const humas = u.get('humas')
  const kepala = u.get('kepala_rq')

  if (!humas || !kepala) {
    console.error('❌ User humas / kepala_rq belum ada. Jalankan dulu: npm run seed')
    process.exit(1)
  }

  // ── 1. Hapus berita demo lama ────────────────────────────────
  const { data: toDelete } = await supabase
    .from('news_articles')
    .select('id, title')
    .in('title', OLD_DEMO_TITLES)

  if (toDelete && toDelete.length > 0) {
    const { error } = await supabase
      .from('news_articles')
      .delete()
      .in('id', toDelete.map(r => r.id))
    if (error) {
      console.error('  ✗ gagal hapus berita lama:', error.message)
      process.exit(1)
    }
    for (const r of toDelete) console.log(`  − hapus: ${r.title}`)
    console.log(`  ✓ ${toDelete.length} berita demo lama dihapus\n`)
  } else {
    console.log('  · tidak ada berita demo lama yang perlu dihapus\n')
  }

  // ── 2. Isi berita dummy ──────────────────────────────────────
  const dummy = [
    {
      title: 'Pembukaan Tahun Ajaran Baru di SDIT LHI',
      excerpt: 'Kegiatan belajar tahun ajaran baru dimulai dengan apel bersama dan pembagian kelompok halaqoh.',
      content: '## Apel Pembukaan\n\nTahun ajaran baru di **SDIT LHI** dibuka dengan apel bersama di lapangan sekolah.\n\n### Agenda Pekan Pertama\n\n- Pembagian kelompok halaqoh\n- Perkenalan wali halaqoh\n- Tes penempatan tahsin\n\nSeluruh siswa diharapkan hadir tepat waktu.',
      category: 'sdit_lhi', type: 'berita', is_active: true,
      author_id: humas, created_at: daysAgo(2),
    },
    {
      title: 'Setoran Tahfidz Pekanan Kini Lewat Aplikasi',
      excerpt: 'Wali halaqoh mencatat setoran siswa langsung dari ponsel, rekap otomatis tiap akhir pekan.',
      content: '## Pencatatan Digital\n\nMulai pekan ini seluruh setoran tahfidz dicatat lewat aplikasi.\n\n### Manfaat\n\n1. Rekap otomatis tiap akhir pekan\n2. Riwayat hafalan per siswa tersimpan rapi\n3. Orang tua bisa memantau lewat rapor digital\n\nPanduan singkat sudah dibagikan ke seluruh wali halaqoh.',
      category: 'sdit_lhi', type: 'berita', is_active: true,
      author_id: humas, created_at: daysAgo(5),
    },
    {
      title: 'SMPIT LHI Gelar Simulasi Ujian Tahfidz',
      excerpt: 'Simulasi digelar dua pekan sebelum ujian sesungguhnya untuk mengukur kesiapan siswa.',
      content: '## Persiapan Ujian\n\n**SMPIT LHI** menggelar simulasi ujian tahfidz bagi siswa kelas 8 dan 9.\n\n### Format Simulasi\n\n- Sambung ayat\n- Tebak surat\n- Setoran lima halaman\n\nHasil simulasi dipakai wali halaqoh untuk menyusun program perbaikan.',
      category: 'smpit_lhi', type: 'berita', is_active: true,
      author_id: humas, created_at: daysAgo(9),
    },
    {
      title: 'Kelas Tahsin Intensif untuk Siswa SMA LHI',
      excerpt: 'Program tambahan dua kali sepekan untuk memperbaiki bacaan sebelum masuk program tahfidz lanjutan.',
      content: '## Latar Belakang\n\nSebagian siswa SMA membutuhkan penguatan bacaan sebelum lanjut ke hafalan panjang.\n\n### Jadwal\n\n- Selasa & Kamis, 15.30–17.00\n- Kelompok maksimal 8 siswa\n\nPendaftaran dibuka lewat wali halaqoh masing-masing.',
      category: 'sma_lhi', type: 'berita', is_active: true,
      author_id: humas, created_at: daysAgo(14),
    },
    {
      title: 'PAUD LHI Mulai Program Iqra Ceria',
      excerpt: 'Metode belajar huruf hijaiyah lewat permainan dan lagu untuk kelompok usia 4–5 tahun.',
      content: '## Belajar Sambil Bermain\n\n**PAUD LHI** memulai program *Iqra Ceria* untuk kelompok usia 4–5 tahun.\n\n### Pendekatan\n\n- Pengenalan huruf lewat lagu\n- Kartu bergambar\n- Sesi singkat 20 menit agar anak tidak jenuh\n\nProgram berjalan setiap Senin sampai Kamis.',
      category: 'paud_lhi', type: 'berita', is_active: true,
      author_id: humas, created_at: daysAgo(18),
    },
    {
      title: 'SD LHI Juara Tambah Dua Kelompok Halaqoh Baru',
      excerpt: 'Penambahan kelompok dilakukan menyusul bertambahnya jumlah siswa pada semester ini.',
      content: '## Penyesuaian Kapasitas\n\nJumlah siswa **SD LHI Juara** bertambah pada semester ini, sehingga dibentuk dua kelompok halaqoh baru.\n\n### Dampak\n\n- Rasio siswa per wali halaqoh kembali ideal\n- Jadwal setoran lebih longgar\n\nPembagian kelompok baru sudah ditempel di papan pengumuman.',
      category: 'sd_lhi_juara', type: 'berita', is_active: true,
      author_id: humas, created_at: daysAgo(23),
    },
    {
      title: 'Membiasakan Tilawah Harian di Rumah',
      excerpt: 'Tiga kebiasaan sederhana yang bisa diterapkan orang tua agar tilawah anak berjalan konsisten.',
      content: "## Konsistensi di Atas Kuantitas\n\nHafalan yang bertahan lahir dari kebiasaan harian, bukan dari sesi panjang sesekali.\n\n### Tiga Kebiasaan\n\n1. **Waktu tetap** — pilih satu waktu yang sama tiap hari\n2. **Target kecil** — cukup beberapa ayat, yang penting rutin\n3. **Teladan** — anak meniru apa yang dilihat, bukan yang didengar\n\n> Sedikit tapi terus-menerus lebih baik daripada banyak tapi terputus.",
      category: null, type: 'artikel', is_active: true,
      author_id: kepala, created_at: daysAgo(28),
    },
    {
      title: 'Peran Wali Halaqoh dalam Pendampingan Siswa',
      excerpt: 'Catatan singkat tentang posisi wali halaqoh sebagai pendamping, bukan sekadar penyimak setoran.',
      content: '## Lebih dari Penyimak\n\nWali halaqoh bukan hanya penyimak setoran, tetapi pendamping perkembangan siswa.\n\n### Yang Perlu Diperhatikan\n\n- Kondisi bacaan, bukan hanya jumlah hafalan\n- Perubahan semangat belajar\n- Komunikasi berkala dengan orang tua\n\nCatatan perkembangan sebaiknya diisi tiap pekan agar mudah ditinjau.',
      category: null, type: 'artikel', is_active: true,
      author_id: kepala, created_at: daysAgo(35),
    },
    {
      title: 'Draf — Rencana Wisuda Tahfidz Akhir Tahun',
      excerpt: 'Rancangan awal kegiatan wisuda tahfidz. Masih menunggu konfirmasi tanggal dan tempat.',
      content: '## Status: Draf\n\nRancangan awal kegiatan wisuda tahfidz akhir tahun.\n\n### Masih Perlu Dipastikan\n\n- Tanggal pelaksanaan\n- Tempat dan kapasitas\n- Jumlah peserta yang lulus\n\nBerita ini sengaja belum diterbitkan sampai detailnya final.',
      category: 'sdit_lhi', type: 'berita', is_active: false,
      author_id: humas, created_at: daysAgo(1),
    },
    {
      title: 'Draf — Panduan Pendaftaran Siswa Baru',
      excerpt: 'Rangkuman syarat dan alur pendaftaran. Menunggu penetapan biaya dari bendahara.',
      content: '## Status: Draf\n\nRangkuman syarat dan alur pendaftaran siswa baru.\n\n### Menunggu\n\n- Penetapan biaya dari bendahara\n- Persetujuan kepala RQ\n\nSetelah lengkap, berita ini akan diterbitkan ke halaman publik.',
      category: 'smpit_lhi', type: 'berita', is_active: false,
      author_id: humas, created_at: daysAgo(3),
    },
  ]

  const { data: existing } = await supabase.from('news_articles').select('title')
  const existingTitles = new Set((existing ?? []).map(r => r.title))
  const toInsert = dummy.filter(n => !existingTitles.has(n.title))

  if (toInsert.length === 0) {
    console.log('  · seluruh berita dummy sudah ada, tidak ada yang ditambahkan')
  } else {
    const { error } = await supabase.from('news_articles').insert(toInsert)
    if (error) {
      console.error('  ✗ gagal insert berita dummy:', error.message)
      process.exit(1)
    }
    for (const n of toInsert) {
      console.log(`  + ${n.is_active ? 'terbit  ' : 'nonaktif'} | ${n.title}`)
    }
    console.log(`  ✓ ${toInsert.length} berita dummy ditambahkan`)
  }

  // ── 3. Ringkasan ─────────────────────────────────────────────
  const { data: final } = await supabase
    .from('news_articles')
    .select('is_active, type, thumbnail_url')

  const rows = final ?? []
  const withRemoteThumb = rows.filter(r => r.thumbnail_url).length
  console.log('\n📊 Kondisi akhir tabel news_articles:')
  console.log(`   total    : ${rows.length}`)
  console.log(`   terbit   : ${rows.filter(r => r.is_active).length}`)
  console.log(`   nonaktif : ${rows.filter(r => !r.is_active).length}`)
  console.log(`   artikel  : ${rows.filter(r => r.type === 'artikel').length}`)
  console.log(`   pakai thumbnail : ${withRemoteThumb}`)
  console.log('\n✅ Selesai.')
}

main()
