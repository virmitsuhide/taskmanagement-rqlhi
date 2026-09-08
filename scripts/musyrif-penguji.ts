/**
 * Mendaftarkan musyrif/ah baru dan menyatukan daftar penguji dengan data guru (0054).
 * Jalankan: npm run musyrif:penguji
 *
 * BUKAN skrip demo. Yang ditulis di sini data guru sungguhan — jangan
 * disamakan dengan seed:demo* yang memang tidak boleh dijalankan lagi.
 *
 * Idempoten: dijalankan ulang tidak membuat duplikat dan tidak menimpa nama
 * yang sudah benar. Password hanya dibuat untuk akun yang benar-benar baru;
 * menjalankan ulang tidak mengganti password siapa pun.
 *
 * PRASYARAT: drizzle/0054_..._PASTE_TO_SUPABASE.sql sudah dijalankan di
 * Supabase. Tanpa itu, penyatuan penguji gagal dengan pesan yang menyebut
 * kolom teacher_id.
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

/**
 * Musyrif/ah yang didaftarkan.
 *
 * `unit` sengaja dibiarkan kosong, mengikuti rekam musyrif yang sudah ada
 * (@bahrun_mahabi): unit adalah unit akademik tempat rubrik KPI-nya diambil,
 * sementara musyrif bertugas di jam asrama. Menebak 'smp' di sini akan
 * memasukkan mereka ke rubrik yang belum tentu berlaku.
 */
const MUSYRIF_BARU: { username: string; full_name: string }[] = [
  { username: 'ismatul_maula',    full_name: 'Ismatul Maula, S.Ag.' },
  { username: 'karima_hasni',     full_name: 'Karima Hasni' },
  { username: 'rosyida_rhamnaia', full_name: 'Rosyida Rhamnaia' },
  { username: 'binti_karimah',    full_name: 'Binti Karimah, M. Pd.' },
  { username: 'nihayatun_nasywa', full_name: 'Nihayatun Nasywa' },
  { username: 'muhammad_itishom', full_name: "Muhammad Nur I'tishom Amirul Haq, S.Kom." },
  { username: 'faris_natanegara', full_name: 'Faris Natanegara, S.I.P' },
  { username: 'ariandi_nurcahyo', full_name: 'Ariandi Nurcahyo, S. Pd' },
  { username: 'azka_falaahi',     full_name: 'Azka El Falaahi, S.Pd' },
]

/**
 * Guru yang sudah ada dan hanya perlu dilengkapi namanya.
 *
 * Dipisahkan dari MUSYRIF_BARU dengan sengaja: menimpa nama orang yang sudah
 * tercatat adalah tindakan yang berbeda dari mendaftarkan orang baru, dan
 * keduanya tidak boleh tercampur dalam satu daftar yang dibaca sekilas.
 */
const NAMA_DILENGKAPI: { username: string; full_name: string }[] = [
  { username: 'bahrun_mahabi', full_name: 'Bahrun Mahabi, M. Sos.' },
]

/**
 * Penyatuan sebelas entri penguji warisan dengan akun gurunya.
 *
 * Dua di antaranya cocok dengan lebih dari satu guru dan TIDAK ditebak di sini:
 * "Ust Maulana" (30 riwayat ujian) dan "Usth Aulia" ditetapkan langsung oleh
 * pengelola, bukan oleh pencocokan teks. Sisanya cocok satu-satu.
 */
const TAUTAN_PENGUJI: { nama: string; username: string }[] = [
  { nama: 'Ust Akhid',              username: 'akhid_ahmad' },
  { nama: 'Ust Bahrun (Boarding)',  username: 'bahrun_mahabi' },
  { nama: 'Ust Fariz',              username: 'mohammad_fariz' },
  { nama: 'Ust Habib',              username: 'muhammad_habiburrahman' },
  { nama: 'Ust Hendra',             username: 'hendra_kusuma' },
  { nama: 'Ust Maulana',            username: 'maulana_achmad' },
  { nama: 'Usth Aulia',             username: 'luluk_aulia' },
  { nama: 'Usth Erna',              username: 'erna' },
  { nama: 'Usth Herlina',           username: 'herlina_wati' },
  { nama: 'Usth Karima (Boarding)', username: 'karima_hasni' },
  { nama: 'Usth Rima',              username: 'rima_indah' },
]

/** Format password yang sama dengan app/actions/teachers.ts. */
function buatPassword(): string {
  const huruf = 'abcdefghijkmnpqrstuvwxyz'
  const angka = '23456789'
  let p = 'Guru@'
  for (let i = 0; i < 3; i++) p += huruf[Math.floor(Math.random() * huruf.length)]
  for (let i = 0; i < 4; i++) p += angka[Math.floor(Math.random() * angka.length)]
  return p
}

async function main() {
  const kredensial: string[] = []

  console.log('\n── 1. Musyrif/ah baru ───────────────────────────────\n')

  for (const m of MUSYRIF_BARU) {
    const { data: ada } = await supabase
      .from('teachers')
      .select('id, full_name, kategori_guru, deleted_at')
      .eq('username', m.username)
      .maybeSingle()

    if (ada) {
      // Akun sudah ada — kategorinya saja yang dipastikan, namanya tidak
      // ditimpa. Skrip ini tidak berhak membetulkan nama yang mungkin sudah
      // disunting SDM setelah penjalanan pertama.
      const { error } = await supabase
        .from('teachers')
        .update({ kategori_guru: 'musyrif_smp', updated_at: new Date().toISOString() })
        .eq('id', ada.id)

      console.log(
        `  = ${m.username.padEnd(20)} sudah ada (${ada.full_name})` +
        `${ada.deleted_at ? ' — TERHAPUS, pulihkan dari tab Terhapus' : ''}` +
        `${error ? ' — gagal set kategori: ' + error.message : ' — kategori dipastikan musyrif'}`,
      )
      continue
    }

    const password = buatPassword()
    const password_hash = await bcrypt.hash(password, 10)

    const { error } = await supabase.from('teachers').insert({
      username: m.username,
      password_hash,
      full_name: m.full_name,
      kategori_guru: 'musyrif_smp',
      is_active: true,
    })

    if (error) {
      console.log(`  ✗ ${m.username.padEnd(20)} ${error.message}`)
      continue
    }
    console.log(`  ✓ ${m.username.padEnd(20)} ${m.full_name}`)
    kredensial.push(`  ${m.username.padEnd(20)} ${password}`)
  }

  console.log('\n── 2. Nama yang dilengkapi ──────────────────────────\n')

  for (const n of NAMA_DILENGKAPI) {
    const { data: guru } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('username', n.username)
      .maybeSingle()

    if (!guru) {
      console.log(`  ✗ ${n.username.padEnd(20)} tidak ditemukan`)
      continue
    }
    if (guru.full_name === n.full_name) {
      console.log(`  = ${n.username.padEnd(20)} sudah "${n.full_name}"`)
      continue
    }

    const { error } = await supabase
      .from('teachers')
      .update({
        full_name: n.full_name,
        kategori_guru: 'musyrif_smp',
        updated_at: new Date().toISOString(),
      })
      .eq('id', guru.id)

    console.log(
      error
        ? `  ✗ ${n.username.padEnd(20)} ${error.message}`
        : `  ✓ ${n.username.padEnd(20)} "${guru.full_name}" → "${n.full_name}"`,
    )
  }

  /*
    ── 3. Penguji dan guru disatukan ──────────────────────────────────────────

    Entri lama tidak hanya ditautkan lewat teacher_id, NAMANYA JUGA DIGANTI
    dengan nama guru yang bersangkutan. "Ust Habib" menjadi "Muhammad
    Habiburrahman Al-Fatih", dan sejak itu hanya ada satu wujud orang tersebut
    di seluruh sistem.

    Tanpa penggantian nama, penautan hanya setengah jalan: daftar penguji tetap
    berbunyi panggilan yang tidak tercatat di mana pun, dan pembacanya tetap
    harus tahu sendiri bahwa "Ust Habib" itu Habiburrahman. Yang berubah cuma
    ada kolom baru yang tak terlihat siapa pun.

    RIWAYAT UJIAN TIDAK DISENTUH. ujian_tahfidz.penguji dan ujian_tahsin.penguji
    menyimpan teks, dan 49 baris di sana tetap berbunyi "Ust Maulana", "Usth
    Karima (Boarding)", dan seterusnya. Itu memang yang tercetak di rapor yang
    sudah diserahkan kepada wali murid, dan mengubahnya hari ini akan membuat
    arsip di sekolah berbeda dari arsip di tangan orang tua. Yang disatukan
    adalah nama yang berlaku SEJAK SEKARANG; yang sudah lewat dibiarkan
    sebagaimana ia dicetak.
  */
  console.log('\n── 3. Penguji disatukan dengan data guru ────────────\n')

  for (const t of TAUTAN_PENGUJI) {
    const { data: guru } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('username', t.username)
      .is('deleted_at', null)
      .maybeSingle()

    if (!guru) {
      console.log(`  ✗ ${t.nama.padEnd(24)} guru @${t.username} tidak ditemukan`)
      continue
    }

    // Dicari lewat teacher_id LEBIH DULU, baru lewat nama warisannya. Setelah
    // penjalanan pertama nama lamanya sudah tidak ada — mencari lewat nama saja
    // akan melaporkan "entri tidak ditemukan" pada baris yang justru sudah
    // beres, dan skrip yang berbohong saat dijalankan ulang berhenti dipercaya.
    const kolom = 'id, nama, teacher_id'
    const [lewatId, lewatNama] = await Promise.all([
      supabase.from('ujian_pengujis').select(kolom).eq('teacher_id', guru.id).maybeSingle(),
      supabase.from('ujian_pengujis').select(kolom).eq('nama', t.nama).maybeSingle(),
    ])

    // Dua baris untuk satu orang muncul kalau gurunya terlanjur ditambahkan
    // lewat layar Daftar Penguji sebelum skrip ini jalan. DILAPORKAN, bukan
    // dihapus diam-diam: baris warisannya memikul riwayat ujian atas nama
    // panggilan itu, dan memilih mana yang dibuang bukan urusan skrip.
    if (lewatId.data && lewatNama.data && lewatId.data.id !== lewatNama.data.id) {
      console.log(
        `  ! ${t.nama.padEnd(24)} DUA baris untuk satu orang: "${t.nama}" (lepas) dan ` +
        `"${lewatId.data.nama}" — hapus salah satunya di /ujian/penguji`,
      )
      continue
    }

    const penguji = lewatId.data ?? lewatNama.data

    if (!penguji) {
      console.log(`  ✗ ${t.nama.padEnd(24)} entri penguji tidak ditemukan`)
      continue
    }
    if (penguji.teacher_id === guru.id && penguji.nama === guru.full_name) {
      console.log(`  = ${t.nama.padEnd(24)} sudah menyatu`)
      continue
    }

    const { error } = await supabase
      .from('ujian_pengujis')
      .update({ teacher_id: guru.id, nama: guru.full_name })
      .eq('id', penguji.id)

    if (error) {
      // 23505 = unique_violation: sudah ada entri penguji lain bernama sama.
      // Terjadi kalau gurunya terlanjur ditambahkan lewat layar Daftar Penguji
      // sebelum skrip ini dijalankan — dan itu memang dua baris untuk satu
      // orang, yang harus dihapus manual supaya tidak ada yang terhapus di sini
      // tanpa sepengetahuan siapa pun.
      console.log(
        `  ✗ ${t.nama.padEnd(24)} ${error.code === '23505'
          ? `sudah ada entri lain bernama "${guru.full_name}" — hapus salah satunya di /ujian/penguji`
          : error.message}`,
      )
      continue
    }
    console.log(`  ✓ ${t.nama.padEnd(24)} → ${guru.full_name}`)
  }

  if (kredensial.length > 0) {
    console.log('\n── Password akun baru ───────────────────────────────')
    console.log('  Catat sekarang — hash-nya tidak bisa dibaca kembali.\n')
    kredensial.forEach(k => console.log(k))
    console.log('\n  Login guru: /guru/login')
  }

  console.log('\nSelesai.')
}

main().catch(err => {
  console.error('Gagal:', err)
  process.exit(1)
})
