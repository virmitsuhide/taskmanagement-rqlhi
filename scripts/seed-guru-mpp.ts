/**
 * Impor daftar guru & pengurus dari MPP RQ LHI TA 2026/2027.
 * Jalankan: npm run seed:guru-mpp
 *
 * Sumber: MPP_Kebutuhan_Guru_RQ_LHI_TA2026-2027.xlsx, sheet "Daftar Guru
 * Sementara" — 34 orang, 8 di antaranya memegang amanah pengurus.
 *
 * Idempoten: upsert berdasarkan username, jadi aman dijalankan berulang.
 * Menjalankan ulang TIDAK menimpa password yang sudah ada (lihat catatan di
 * upsertTeacher) supaya guru yang sudah mengganti sandinya tidak terkunci.
 *
 * Prasyarat migrasi: 0020 (deleted_at), 0021 (employment & kontrak), 0022 (unit).
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Employment = 'tetap_yayasan' | 'kontrak_yayasan' | 'kontrak_rq'
type Unit = 'sd' | 'smp' | 'sd_juara' | null

interface Person {
  name: string
  employment: Employment
  unit: Unit
  /** Role pengurus di tabel users, kalau orang ini memegang amanah. */
  role?: string
}

/**
 * Tahun ajaran 2026/2027. Kontrak RQ (OS) berakhir di akhir tahun ajaran
 * sehingga aksesnya gugur sendiri — persis kebutuhan guru OS yang berganti
 * tiap tahun. Guru tetap & kontrak yayasan dibiarkan tanpa tanggal akhir.
 */
const CONTRACT_START = '2026-07-01'
const CONTRACT_END_OS = '2027-06-30'

/**
 * Daftar orangnya dibaca dari berkas data, bukan ditulis di dalam kode.
 *
 * Repositori ini publik, sedangkan daftar itu memuat nama lengkap pegawai
 * beserta status kepegawaiannya. Memisahkannya membuat logika impor tetap
 * bisa dibagikan dan ditinjau, sementara datanya tinggal di komputer yang
 * menjalankannya — scripts/data/ sengaja masuk .gitignore.
 */
function loadPeople(): Person[] {
  const path = resolve(process.cwd(), 'scripts/data/guru-mpp-2026.json')
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Person[]
  } catch {
    console.error(`Tidak menemukan ${path}.`)
    console.error('Berkas ini tidak ikut di repositori karena memuat nama pegawai.')
    console.error('Salin dari sumber MPP, atau minta ke pengurus yang punya salinannya.')
    process.exit(1)
  }
}


/**
 * Username dari nama: dua kata pertama setelah gelar dibuang.
 *
 * Gelar dikenali dari TITIKNYA (S.Pd., M.Ag., S.I.Kom.), bukan dari huruf
 * awalnya. Pola berbasis huruf awal terlihat menggoda tapi ikut memakan nama
 * asli — "Siti" dan "Sella" sama-sama diawali S diikuti beberapa huruf,
 * sehingga tersapu bersama "S.Si." dan menyisakan nama yang salah.
 *
 * Dua kata cukup membedakan seluruh 34 nama pada daftar ini, dan lebih mudah
 * diketik guru daripada nama lengkap. Tabrakan tetap dijaga pemanggil.
 */
function toUsername(name: string): string {
  const words = name
    .split(/[\s,]+/)
    .filter(word => word && !word.includes('.'))
    .map(word => word.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter(Boolean)

  return words.slice(0, 2).join('_') || 'guru'
}

/**
 * Password awal yang bisa dibacakan lewat telepon: tanpa huruf/angka yang
 * mudah tertukar (l/1, O/0) dan tanpa simbol selain '@'.
 */
function generatePassword(): string {
  const letters = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  let pwd = 'Guru@'
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)]
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)]
  return pwd
}

interface Seeded { name: string; username: string; password: string | null; role?: string }

async function main() {
  console.log('Impor daftar guru MPP RQ LHI TA 2026/2027\n')

  // Nama yang menghasilkan username sama diberi akhiran angka. Dihitung di
  // sini, bukan di database, supaya laporan di akhir memuat username final.
  const used = new Map<string, number>()
  const rows = loadPeople().map(person => {
    const base = toUsername(person.name)
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    return { ...person, username: seen === 0 ? base : `${base}${seen + 1}` }
  })

  const seeded: Seeded[] = []

  for (const person of rows) {
    const result = await upsertTeacher(person)
    seeded.push({ name: person.name, username: person.username, password: result, role: person.role })
  }

  console.log('\nMenautkan pengurus ke akun users…')
  for (const person of rows.filter(p => p.role)) {
    await linkPengurus(person.username, person.role!, person.name)
  }

  report(seeded)
}

/**
 * Simpan satu guru. Mengembalikan password awal kalau akunnya baru dibuat,
 * atau null kalau akunnya sudah ada.
 *
 * Password sengaja TIDAK ditimpa saat menjalankan ulang: guru yang sudah
 * mengganti sandinya sendiri akan terkunci kalau seed mengembalikannya ke
 * sandi awal — dan tidak akan ada yang menyadarinya sampai ia gagal login.
 */
async function upsertTeacher(person: Person & { username: string }): Promise<string | null> {
  const { data: existing } = await supabase
    .from('teachers')
    .select('id')
    .eq('username', person.username)
    .maybeSingle()

  // Data MPP: identitas & kepegawaian, yang memang bersumber dari berkas ini.
  const fromMpp = {
    full_name: person.name,
    employment_type: person.employment,
    unit: person.unit,
    contract_start: CONTRACT_START,
    // Hanya kontrak RQ (OS) yang punya tanggal akhir; sisanya tanpa batas.
    contract_end: person.employment === 'kontrak_rq' ? CONTRACT_END_OS : null,
  }

  if (existing) {
    // is_active & deleted_at SENGAJA tidak ikut diperbarui. Keduanya keputusan
    // pengelolaan yang diambil setelah impor — Bendahara misalnya dinonaktifkan
    // karena tidak mengajar. Menyertakannya di sini membuat setiap kali skrip
    // dijalankan ulang, keputusan itu diam-diam dibatalkan.
    const { error } = await supabase.from('teachers').update(fromMpp).eq('id', existing.id)
    console.log(error ? `  ✗ ${person.username}: ${error.message}` : `  · ${person.username} diperbarui`)
    return null
  }

  const password = generatePassword()
  const { error } = await supabase.from('teachers').insert({
    ...fromMpp,
    username: person.username,
    password_hash: await bcrypt.hash(password, 10),
    is_active: true,
  })

  if (error) {
    console.log(`  ✗ ${person.username}: ${error.message}`)
    return null
  }
  console.log(`  + ${person.username} dibuat`)
  return password
}

/**
 * Isikan nama asli ke akun pengurus yang sudah ada, lalu tautkan ke akun
 * gurunya.
 *
 * Akun pengurus TIDAK dibuat baru per orang: tabel users sudah punya satu
 * akun per role sejak seed awal, dan menambah akun kedua dengan role sama
 * akan membuat dua "Kepala RQ" yang sama-sama sah — RBAC di aplikasi ini
 * bekerja atas dasar role, bukan orang.
 */
async function linkPengurus(username: string, role: string, fullName: string) {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('role', role)
    .limit(1)
    .maybeSingle()

  if (!user) {
    console.log(`  ! role ${role} belum punya akun users — lewati ${fullName}`)
    return
  }

  const { error: userError } = await supabase
    .from('users')
    .update({ display_name: fullName, full_name: fullName })
    .eq('id', user.id)

  const { error: linkError } = await supabase
    .from('teachers')
    .update({ linked_user_id: user.id })
    .eq('username', username)

  const problem = userError ?? linkError
  console.log(problem ? `  ✗ ${role}: ${problem.message}` : `  · ${role} → ${fullName}`)
}

function report(seeded: Seeded[]) {
  const baru = seeded.filter(s => s.password)

  console.log(`\nSelesai: ${seeded.length} orang diproses, ${baru.length} akun baru.\n`)

  if (baru.length === 0) {
    console.log('Tidak ada akun baru — password akun lama tidak diubah.')
    return
  }

  console.log('PASSWORD AWAL (catat sekarang, tidak bisa dilihat lagi):')
  console.log('─'.repeat(72))
  for (const s of baru) {
    const amanah = s.role ? `  [${s.role}]` : ''
    console.log(`  ${s.username.padEnd(24)} ${String(s.password).padEnd(14)} ${s.name}${amanah}`)
  }
  console.log('─'.repeat(72))
  console.log('\nGuru login di /guru/login. Pengurus tetap memakai akun role-nya di /login.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
