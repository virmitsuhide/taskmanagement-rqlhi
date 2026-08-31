import { createServerClient } from '@/lib/supabase/server'
import { getGuruProfile } from '@/lib/data/guru-profil'
import { AMANAH_LABELS, JABATAN_ORDER } from '@/lib/auth/permissions'
import type { EmployeeProfile, GuruProfile, Jenjang, TeacherEmployment, UserRole } from '@/types'

/**
 * Lapisan data fitur Pengurus — siapa menduduki jabatan apa.
 *
 * Jabatan di RQ LHI berpadanan satu-satu dengan akun: ada tepat satu akun per
 * role. Jadi "menetapkan pemegang amanah" sama dengan menunjuk satu guru ke
 * satu akun, dan penghubungnya adalah teachers.linked_user_id (lihat
 * drizzle/0046).
 *
 * Arah bacanya sengaja dibalik dari bentuk tabelnya: tabel menyimpan guru →
 * akun, sedangkan halaman Pengurus menampilkan jabatan → guru. Pembalikan itu
 * dilakukan di sini sekali, supaya halaman dan server action tidak masing-masing
 * menyusun ulang peta yang sama.
 */

/** Jenis kepegawaian yang boleh menduduki jabatan pengurus. */
const KEPEGAWAIAN_LAYAK: TeacherEmployment[] = ['tetap_yayasan', 'kontrak_yayasan']

const urutNama = <T extends { full_name: string }>(a: T, b: T) =>
  a.full_name.localeCompare(b.full_name, 'id')

export interface CalonPengurus {
  id: string
  /** Dari tabel mana orang ini berasal — guru dan karyawan tinggal di tabel berbeda. */
  sumber: SumberAmanah
  full_name: string
  unit: Jenjang | null
  employment_type: TeacherEmployment | null
  /** Non-aktif tapi masih memegang kursi — ditandai, bukan disembunyikan. */
  is_active: boolean
  /** Jabatan yang sedang diduduki, null kalau belum menduduki apa pun. */
  menjabat: UserRole | null
}

export interface BarisJabatan {
  role: UserRole
  /** Nama resmi jabatan, mis. "Koordinator Qur'an SD". */
  label: string
  /** Akun jabatan ini — selalu ada, satu akun per role. */
  userId: string | null
  /** Nama yang tercatat di akun; tampil saat kursinya masih kosong. */
  displayName: string | null
  /** Guru yang menduduki jabatan ini, null kalau belum ditetapkan. */
  pemegang: CalonPengurus | null
}

/** Kolom guru yang dibutuhkan halaman Pengurus — ringkas, tanpa isi profil. */
const KOLOM_CALON = 'id, full_name, unit, employment_type, is_active, linked_user_id'

type BarisGuru = {
  id: string
  full_name: string
  unit: Jenjang | null
  employment_type: TeacherEmployment | null
  is_active: boolean | null
  linked_user_id: string | null
}

/**
 * Daftar guru yang boleh diangkat jadi pengurus, terurut abjad.
 *
 * Hanya guru tetap & kontrak yayasan — guru kontrak RQ dan yang jenis
 * kepegawaiannya belum diisi tidak muncul. Guru non-aktif TIDAK dibuang, hanya
 * ditandai: saat ini Bendahara dipegang orang yang is_active-nya false, dan
 * menyaringnya akan membuat pemegang kursi menghilang dari dropdown kursinya
 * sendiri — seolah kursi itu kosong.
 */
export async function getCalonPengurus(): Promise<CalonPengurus[]> {
  const supabase = createServerClient()

  const [guru, karyawan, peran] = await Promise.all([
    supabase
      .from('teachers')
      .select(KOLOM_CALON)
      .in('employment_type', KEPEGAWAIAN_LAYAK)
      .is('deleted_at', null),
    // Karyawan tidak disaring jenis kepegawaiannya. Jumlahnya sedikit dan
    // semuanya pegawai RQ — tidak ada golongan "kontrak RQ" yang perlu
    // dikecualikan seperti pada guru, dan menyaringnya hanya akan membuat
    // Bendahara hilang dari kursinya sendiri saat kolom itu belum diisi.
    supabase
      .from('employees')
      .select('id, full_name, jabatan, employment_type, is_active, linked_user_id')
      .is('deleted_at', null),
    petaRolePerUser(),
  ])

  const dariGuru = ((guru.data ?? []) as unknown as BarisGuru[]).map(g => ({
    id: g.id,
    sumber: 'guru' as const,
    full_name: g.full_name,
    unit: g.unit,
    employment_type: g.employment_type,
    is_active: g.is_active !== false,
    menjabat: g.linked_user_id ? peran.get(g.linked_user_id) ?? null : null,
  }))

  const dariKaryawan = ((karyawan.data ?? []) as unknown as BarisKaryawan[]).map(k => ({
    id: k.id,
    sumber: 'karyawan' as const,
    full_name: k.full_name,
    unit: null,
    employment_type: k.employment_type,
    is_active: k.is_active !== false,
    menjabat: k.linked_user_id ? peran.get(k.linked_user_id) ?? null : null,
  }))

  return [...dariGuru, ...dariKaryawan].sort(urutNama)
}

type BarisKaryawan = {
  id: string
  full_name: string
  jabatan: string | null
  employment_type: TeacherEmployment | null
  is_active: boolean | null
  linked_user_id: string | null
}

/** userId → role, dibaca sekali lalu dipakai ulang. */
async function petaRolePerUser(): Promise<Map<string, UserRole>> {
  const supabase = createServerClient()
  const { data } = await supabase.from('users').select('id, role')
  const peta = new Map<string, UserRole>()
  for (const u of (data ?? []) as { id: string; role: UserRole }[]) peta.set(u.id, u.role)
  return peta
}

/**
 * Semua jabatan beserta pemegangnya, dalam urutan struktural.
 *
 * Baris tetap muncul walau akunnya belum ada di database — daftar jabatan
 * berasal dari JABATAN_ORDER, bukan dari isi tabel users, supaya jabatan yang
 * akunnya belum dibuat terlihat sebagai kursi kosong dan bukan menghilang.
 */
export async function getDaftarJabatan(): Promise<BarisJabatan[]> {
  const supabase = createServerClient()

  const [akun, guru, karyawan] = await Promise.all([
    supabase.from('users').select('id, role, display_name'),
    supabase
      .from('teachers')
      .select(KOLOM_CALON)
      .not('linked_user_id', 'is', null)
      .is('deleted_at', null),
    supabase
      .from('employees')
      .select('id, full_name, jabatan, employment_type, is_active, linked_user_id')
      .not('linked_user_id', 'is', null)
      .is('deleted_at', null),
  ])

  const akunPerRole = new Map<UserRole, { id: string; display_name: string }>()
  for (const u of (akun.data ?? []) as { id: string; role: UserRole; display_name: string }[]) {
    akunPerRole.set(u.role, { id: u.id, display_name: u.display_name })
  }

  const rolePerUser = new Map<string, UserRole>()
  for (const [role, u] of akunPerRole) rolePerUser.set(u.id, role)

  // Kursi bisa diduduki guru maupun karyawan — Bendahara adalah karyawan.
  // Keduanya tidak mungkin menempati kursi yang sama sebab masing-masing tabel
  // punya indeks unik pada linked_user_id.
  const pemegangPerUser = new Map<string, CalonPengurus>()
  for (const g of (guru.data ?? []) as unknown as BarisGuru[]) {
    if (!g.linked_user_id) continue
    pemegangPerUser.set(g.linked_user_id, {
      id: g.id,
      sumber: 'guru',
      full_name: g.full_name,
      unit: g.unit,
      employment_type: g.employment_type,
      is_active: g.is_active !== false,
      menjabat: rolePerUser.get(g.linked_user_id) ?? null,
    })
  }
  for (const k of (karyawan.data ?? []) as unknown as BarisKaryawan[]) {
    if (!k.linked_user_id) continue
    pemegangPerUser.set(k.linked_user_id, {
      id: k.id,
      sumber: 'karyawan',
      full_name: k.full_name,
      unit: null,
      employment_type: k.employment_type,
      is_active: k.is_active !== false,
      menjabat: rolePerUser.get(k.linked_user_id) ?? null,
    })
  }

  return JABATAN_ORDER.map(role => {
    const u = akunPerRole.get(role)
    return {
      role,
      label: AMANAH_LABELS[role],
      userId: u?.id ?? null,
      displayName: u?.display_name ?? null,
      pemegang: u ? pemegangPerUser.get(u.id) ?? null : null,
    }
  })
}

/** Dari tabel mana profil pemegang amanah dibaca. */
export type SumberAmanah = 'guru' | 'karyawan'

export interface ProfilAmanah {
  /** Rekam orangnya — sumber tunggal data dirinya. */
  profile: GuruProfile | EmployeeProfile
  sumber: SumberAmanah
  /** Id baris di tabel asalnya, dipakai server action untuk menulis balik. */
  recordId: string
  /** Migrasi 0044 belum jalan; sebagian kolom profil belum tersedia. */
  perluMigrasi: boolean
}

/** Kolom profil karyawan — sepadan dengan KOLOM_PROFIL_GURU, tanpa unit. */
export const KOLOM_PROFIL_KARYAWAN =
  'id, full_name, jabatan, nip, employment_type, joined_at, photo_url, photo_focus,' +
  ' sapaan, nickname, birth_place, birth_date, education_level, education_history,' +
  ' quran_competencies, other_competencies, ijazah_sanad, trainings, amanah_history, awards'

/**
 * Profil orang yang sedang menduduki jabatan milik `userId`.
 *
 * Dicari di dua tabel karena kursi pengurus bisa diduduki guru maupun karyawan
 * — Bendahara adalah karyawan, bukan guru. Guru didahulukan hanya karena itu
 * kasus yang jauh lebih sering; keduanya tidak mungkin terisi bersamaan sebab
 * masing-masing tabel punya indeks unik pada linked_user_id.
 *
 * Mengembalikan null kalau kursinya belum ditetapkan kepala RQ — pemanggil
 * (halaman /profil) lalu jatuh kembali ke kolom profil di akunnya sendiri,
 * supaya isian yang telanjur diketik di sana tidak hilang begitu saja.
 */
export async function getProfilAmanah(userId: string): Promise<ProfilAmanah | null> {
  const supabase = createServerClient()

  const guru = await supabase
    .from('teachers')
    .select('id')
    .eq('linked_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (guru.data) {
    const id = (guru.data as { id: string }).id
    const { profile, perluMigrasi } = await getGuruProfile(id)
    if (profile) return { profile, sumber: 'guru', recordId: id, perluMigrasi }
  }

  const karyawan = await supabase
    .from('employees')
    .select(KOLOM_PROFIL_KARYAWAN)
    .eq('linked_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (karyawan.data) {
    const profile = karyawan.data as unknown as EmployeeProfile
    return { profile, sumber: 'karyawan', recordId: profile.id, perluMigrasi: false }
  }

  return null
}
