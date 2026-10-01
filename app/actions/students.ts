'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  canManageStudents, getManageableJenjang, programScopeFor, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { hariIni, syncHalaqohMembership, syncHalaqohMemberships } from '@/lib/data/halaqoh-membership'
import { periksaBaris, tandaiNisKembar, type BarisSiswa, type RujukanImpor } from '@/lib/rq/siswa-impor'
import { bakukanKelas, contohKelas, galatRombelSmp, KELAS_TETAP, kelasBerikutnya, kelasJelas } from '@/lib/rq/kelas'
import { rapikanAnggotaAsrama } from '@/lib/data/asrama'
import type { Gender, Jenjang } from '@/types'

/** Ubah string kosong atau sentinel 'none' (dari Radix Select) menjadi null. */
function clean(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim()
  if (!s || s === 'none') return null
  return s
}

function pickStudentFields(formData: FormData) {
  return {
    nis: clean(formData.get('nis')),
    full_name: ((formData.get('full_name') as string) || '').trim(),
    gender: clean(formData.get('gender')) as Gender | null,
    birth_date: clean(formData.get('birth_date')),
    jenjang: formData.get('jenjang') as Jenjang,
    // Dibakukan per unit: 'TK A' → 'TKA'. Sah-tidaknya diperiksa kelasTetapSah.
    kelas: clean(formData.get('kelas')) && bakukanKelas(formData.get('jenjang') as Jenjang, clean(formData.get('kelas'))),
    program: clean(formData.get('program')),
    halaqoh_id: clean(formData.get('halaqoh_id')),
    wali_name: clean(formData.get('wali_name')),
    wali_phone: clean(formData.get('wali_phone')),
    wali_email: clean(formData.get('wali_email')),
    current_method_id: clean(formData.get('current_method_id')),
    current_jilid_id: clean(formData.get('current_jilid_id')),
    current_jilid_page: formData.get('current_jilid_page')
      ? Number(formData.get('current_jilid_page')) || null
      : null,
  }
}

/**
 * Unit tanpa rombel (TPAIT, SD Juara, SMA) hanya mengenal daftar kelas tetap —
 * '1A' di SD Juara adalah kelas yang tidak ada. SD & SMP tetap longgar di
 * formulir; bentuknya ditagih lewat halaman pembenahan kelas.
 */
function galatKelas(jenjang: Jenjang, kelas: string | null): string | null {
  if (!kelas || !KELAS_TETAP[jenjang] || kelasJelas(jenjang, kelas)) return null
  return `Kelas ${JENJANG_LABELS[jenjang]} hanya: ${contohKelas(jenjang)}.`
}

export async function createStudentAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const fields = pickStudentFields(formData)
  if (!fields.full_name || !fields.jenjang) {
    return { error: 'Nama lengkap dan jenjang wajib diisi.' }
  }
  // Program ikut diperiksa, bukan cuma jenjang: sejak ada koor QULS SD, dua
  // pengurus berbagi jenjang 'sd' dan hanya programnya yang memisahkan.
  if (!canManageStudents(session.role, fields.jenjang, fields.program)) {
    return { error: 'Anda tidak memiliki izin untuk siswa program ini.' }
  }
  const galatK = galatKelas(fields.jenjang, fields.kelas)
    ?? galatRombelSmp(fields.jenjang, fields.kelas, fields.program, fields.gender)
  if (galatK) return { error: galatK }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('students')
    .insert(fields)
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return { error: 'NIS sudah dipakai siswa lain.' }
    }
    return { error: 'Gagal menambah siswa.' }
  }

  await syncHalaqohMembership(supabase, data.id, fields.halaqoh_id)

  revalidatePath('/siswa')
  redirect(`/siswa/${data.id}`)
}

export async function updateStudentAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'ID siswa hilang.' }

  const fields = pickStudentFields(formData)
  const is_active = formData.get('is_active') === 'on'
  if (!fields.full_name) {
    return { error: 'Nama lengkap wajib diisi.' }
  }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('students').select('jenjang, program, halaqoh_id').eq('id', id).single()
  // Keadaan LAMA diperiksa terpisah dari yang baru. Tanpa itu, seorang koor
  // bisa menarik siswa milik koor lain ke lingkupnya sendiri hanya dengan
  // mengganti kolom program di formulir.
  if (!existing || !canManageStudents(session.role, existing.jenjang as Jenjang, existing.program as string | null)) {
    return { error: 'Anda tidak memiliki izin untuk siswa ini.' }
  }

  // Jenjang TIDAK diambil dari form. Ia menentukan halaqoh mana yang boleh
  // ditempati, metode tahsin mana yang berlaku, dan siapa yang berwenang atas
  // anak ini — memindahkannya antar unit menyeret semuanya, jadi itu bukan
  // pekerjaan satu dropdown di formulir edit.
  //
  // Diambil dari baris yang sudah ada, bukan sekadar disembunyikan dari
  // tampilan: request buatan tangan yang menyisipkan 'jenjang' pun tidak bisa
  // memindahkan siswa ke unit lain.
  const jenjang = existing.jenjang as Jenjang

  if (!canManageStudents(session.role, jenjang, fields.program)) {
    return { error: 'Anda tidak memiliki izin untuk siswa program ini.' }
  }
  // Formulir sunting tidak mengirim jenjang — bakukan ulang dengan jenjang asli.
  fields.kelas = fields.kelas && bakukanKelas(jenjang, fields.kelas)
  const galatK = galatKelas(jenjang, fields.kelas)
    ?? galatRombelSmp(jenjang, fields.kelas, fields.program, fields.gender)
  if (galatK) return { error: galatK }

  const { error } = await supabase
    .from('students')
    .update({ ...fields, jenjang, is_active })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'NIS sudah dipakai siswa lain.' }
    return { error: 'Gagal memperbarui siswa.' }
  }

  if (fields.halaqoh_id !== (existing.halaqoh_id as string | null)) {
    await syncHalaqohMembership(supabase, id, fields.halaqoh_id, existing.halaqoh_id as string | null)
  }

  // Pindah ke fullday (atau nonaktif): keluar otomatis dari kelompok asrama (0110).
  if (await rapikanAnggotaAsrama(id, { jenjang, program: fields.program, gender: fields.gender, is_active })) {
    revalidatePath('/asrama')
  }

  revalidatePath('/siswa')
  revalidatePath(`/siswa/${id}`)
  redirect(`/siswa/${id}`)
}

// ─── Impor massal ───────────────────────────────────────────────────
//
// Baris sudah diperiksa di peramban sebelum sampai ke sini, tapi pemeriksaan
// itu tidak dipercaya: yang dikirim adalah JSON biasa yang bisa disusun siapa
// saja. Karena itu seluruh aturan dijalankan ULANG di server, memakai fungsi
// yang sama persis (periksaBaris) sehingga tidak ada dua versi aturan yang
// bisa berbeda diam-diam.

/** Sekali unggah dibatasi supaya satu berkas keliru tidak menyandera koneksi. */
const MAKS_BARIS_IMPOR = 1000

/** Baris dikirim per potongan agar satu INSERT tidak melebihi batas payload. */
const UKURAN_POTONGAN = 100

export interface BarisGagal {
  baris: number
  nama: string
  alasan: string
}

export interface HasilImpor {
  masuk: number
  gagal: BarisGagal[]
  error?: string
}

/**
 * Baris mentah dari berkas Excel — persis seperti yang dibaca peramban,
 * BUKAN hasil olahannya. Server menerjemahkan sendiri nama → id.
 */
export type BarisMentah = Record<string, string | number | boolean | null>

export async function importStudentsAction(rows: BarisMentah[]): Promise<HasilImpor> {
  const session = await getSession()
  if (!session) return { masuk: 0, gagal: [], error: 'Sesi tidak valid.' }

  const allowed = getManageableJenjang(session.role).filter(j => canManageStudents(session.role, j))
  if (allowed.length === 0) {
    return { masuk: 0, gagal: [], error: 'Anda tidak memiliki izin menambah siswa.' }
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { masuk: 0, gagal: [], error: 'Tidak ada baris untuk diimpor.' }
  }
  if (rows.length > MAKS_BARIS_IMPOR) {
    return { masuk: 0, gagal: [], error: `Sekali impor maksimal ${MAKS_BARIS_IMPOR} baris.` }
  }

  const supabase = createServerClient()
  const [halaqohResult, methodsResult, jilidResult] = await Promise.all([
    supabase.from('halaqoh').select('id, name, jenjang, program').eq('is_active', true),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true),
    supabase.from('jilid_levels').select('id, label, method_id'),
  ])
  const rujukan: RujukanImpor = {
    allowedJenjang: allowed,
    allowedPrograms: programScopeFor(session.role, allowed),
    halaqohList: halaqohResult.data ?? [],
    methods: methodsResult.data ?? [],
    jilidLevels: jilidResult.data ?? [],
  }

  const gagal: BarisGagal[] = []
  // Nomor baris ikut dikirim di kolom cadangan `__baris` supaya pesan galat
  // menunjuk ke baris Excel yang dilihat operator, bukan ke indeks array.
  const hasil = tandaiNisKembar(
    rows.map((r, i) => periksaBaris(r, Number(r.__baris) || i + 2, rujukan)),
  )

  for (const h of hasil) {
    if (!h.data) gagal.push({ baris: h.baris, nama: h.nama, alasan: h.galat.join(' ') })
  }
  const siap = hasil.filter(h => h.data)
  if (siap.length === 0) {
    return { masuk: 0, gagal, error: 'Tidak ada baris yang lolos pemeriksaan.' }
  }

  // NIS yang sudah terpakai disaring lebih dulu. Tanpa ini satu bentrok akan
  // menggagalkan seluruh potongan 100 baris, bukan satu barisnya sendiri.
  const nisList = siap.map(h => h.data!.nis).filter((n): n is string => !!n)
  const terpakai = new Set<string>()
  for (let i = 0; i < nisList.length; i += 200) {
    const { data } = await supabase
      .from('students').select('nis').in('nis', nisList.slice(i, i + 200))
    for (const row of data ?? []) if (row.nis) terpakai.add(row.nis)
  }

  const lolos = siap.filter(h => {
    if (h.data!.nis && terpakai.has(h.data!.nis)) {
      gagal.push({ baris: h.baris, nama: h.nama, alasan: `NIS ${h.data!.nis} sudah dipakai siswa lain.` })
      return false
    }
    return true
  })

  // Id dibuat di sini, bukan diserahkan ke default kolom: keanggotaan halaqoh
  // harus dipasangkan kembali ke baris asalnya, dan urutan kembalian INSERT
  // bukan janji yang layak digantungi.
  // Kolom tabel dipisah dari keterangan baris supaya yang dikirim ke INSERT
  // adalah persis kolom students — tidak ada 'baris'/'nama' yang menyelinap.
  const siapSimpan = lolos.map(h => ({
    baris: h.baris,
    nama: h.nama,
    kolom: { id: crypto.randomUUID(), ...(h.data as BarisSiswa) },
  }))

  let masuk = 0
  const tersimpan: typeof siapSimpan = []
  for (let i = 0; i < siapSimpan.length; i += UKURAN_POTONGAN) {
    const potongan = siapSimpan.slice(i, i + UKURAN_POTONGAN)
    const { error } = await supabase
      .from('students')
      .insert(potongan.map(p => p.kolom))
    if (error) {
      for (const p of potongan) {
        gagal.push({ baris: p.baris, nama: p.nama, alasan: `Gagal disimpan: ${error.message}` })
      }
      continue
    }
    masuk += potongan.length
    tersimpan.push(...potongan)
  }

  // Keanggotaan halaqoh dicatat sekali untuk semua, mengikuti alasan yang sama
  // dengan syncHalaqohMembership: penempatan adalah riwayat, bukan pointer.
  await syncHalaqohMemberships(
    supabase,
    tersimpan.map(s => ({ student_id: s.kolom.id, ke: s.kolom.halaqoh_id, dari: null })),
    hariIni(),
  )

  if (masuk > 0) revalidatePath('/siswa')
  return { masuk, gagal: gagal.sort((a, b) => a.baris - b.baris) }
}

export async function deleteStudentAction(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('students').select('jenjang, program').eq('id', id).single()
  if (!existing) return { error: 'Siswa tidak ditemukan.' }
  if (!canManageStudents(session.role, existing.jenjang as Jenjang, existing.program as string | null)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  // Soft delete: set is_active=false. Lebih aman daripada hard delete karena
  // ada FK ke tahsin_logs/tahfidz_logs.
  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return { error: 'Gagal menonaktifkan siswa.' }

  revalidatePath('/siswa')
  redirect('/siswa')
}

// ─── Kenaikan kelas antar tahun ajaran ───────────────────────────────────────

/*
 * Kelas berikutnya & tingkat akhir tiap unit dibaca dari lib/rq/kelas.ts
 * (kelasBerikutnya), satu tempat bersama halaman pembenahan kelas. Selama
 * keduanya memakai aturan yang sama, tidak mungkin ada anak yang dinyatakan
 * beres di satu layar tapi tetap dilewati di layar lain.
 */

export interface RencanaKenaikan {
  naik: number
  lulus: number
  /** Kelas yang tidak berpola <angka><rombel> — dilewati, tidak ditebak. */
  dilewati: { kelas: string; jumlah: number }[]
}

interface BarisKenaikan {
  id: string
  jenjang: Jenjang
  kelas: string | null
}

/**
 * Memilah siswa aktif menjadi tiga: naik, lulus, dan dilewati.
 *
 * Dipakai bersama oleh pratinjau dan pelaksanaan, supaya angka yang dilihat
 * sebelum menekan tombol adalah angka yang benar-benar dikerjakan sesudahnya.
 */
function pilah(rows: BarisKenaikan[]) {
  const naik: { id: string; kelas: string }[] = []
  const lulus: string[] = []
  const dilewati = new Map<string, number>()

  for (const s of rows) {
    const berikut = kelasBerikutnya(s.jenjang, s.kelas)
    if (!berikut) {
      // Termasuk '4.0' dan kawan-kawannya yang lolos dari impor Excel. Ditolak,
      // BUKAN ditebak: tidak ada rombel yang bisa dipertahankan dari '4.0', dan
      // menebaknya berarti memindahkan anak ke kelas yang tak pernah diputuskan
      // siapa pun. Yang benar diperbaiki manusia lewat sunting siswa.
      const k = s.kelas?.trim() || '(kelas kosong)'
      dilewati.set(k, (dilewati.get(k) ?? 0) + 1)
      continue
    }
    if (berikut === 'lulus') lulus.push(s.id)
    else naik.push({ id: s.id, kelas: berikut.naik })
  }

  return { naik, lulus, dilewati }
}

/** Angka yang ditampilkan sebelum kenaikan dijalankan. Tidak mengubah apa pun. */
export async function pratinjauKenaikanAction(): Promise<
  { error: string } | { rencana: RencanaKenaikan }
> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageStudents(session.role)) return { error: 'Anda tidak memiliki izin.' }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, jenjang, kelas')
    .eq('is_active', true)

  if (error) return { error: 'Gagal membaca data siswa.' }

  const { naik, lulus, dilewati } = pilah((data ?? []) as BarisKenaikan[])
  return {
    rencana: {
      naik: naik.length,
      lulus: lulus.length,
      dilewati: [...dilewati].map(([kelas, jumlah]) => ({ kelas, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah),
    },
  }
}

/**
 * Menaikkan seluruh siswa aktif satu tingkat, menuju tahun ajaran `termId`.
 *
 *   1A → 2A, 5C → 6C   — angkanya naik, rombelnya tetap
 *   6A (SD), 9A (SMP)  — tidak naik; ditandai nonaktif alias lulus
 *   4.0                — dilewati dan dilaporkan, tidak ditebak
 *
 * TIDAK ditempelkan pada setCurrentTermAction meski itu yang paling menggoda.
 * Menetapkan semester berjalan adalah tindakan yang wajar diulang — koor
 * berpindah ke semester lalu untuk memeriksa rekap, lalu kembali. Kalau
 * kenaikan ikut menempel di sana, satu kali menengok arsip akan menaikkan
 * seluruh angkatan untuk kedua kalinya.
 *
 * Penjaga sesungguhnya ada di kolom academic_terms.kenaikan_at (0055): sekali
 * terisi, kenaikan menuju tahun itu ditolak. Konfirmasi di layar hanya menahan
 * orang yang ragu — ia tidak menahan tombol yang terklik dua kali.
 */
export async function naikkanKelasAction(termId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  // Kenaikan menyentuh seluruh unit sekaligus, jadi yang boleh menjalankannya
  // hanya yang berwenang atas seluruh unit — bukan koor satu jenjang.
  if (!canManageStudents(session.role)) return { error: 'Anda tidak memiliki izin.' }
  if (session.role !== 'kepala_rq' && session.role !== 'kumik') {
    return { error: 'Hanya Kepala RQ dan Kumik yang bisa menjalankan kenaikan kelas.' }
  }
  if (!termId) return { error: 'Tahun ajaran tujuan tidak dikenali.' }

  const supabase = createServerClient()

  const { data: term } = await supabase
    .from('academic_terms')
    .select('id, year_label, semester, kenaikan_at')
    .eq('id', termId)
    .maybeSingle()

  if (!term) return { error: 'Tahun ajaran tujuan tidak ditemukan.' }
  if (term.kenaikan_at) {
    return {
      error: `Kenaikan menuju ${term.year_label} sudah pernah dijalankan pada ` +
        `${new Date(term.kenaikan_at as string).toLocaleString('id-ID')}. ` +
        'Menjalankannya lagi akan menaikkan seluruh angkatan dua tingkat.',
    }
  }

  const { data, error: bacaError } = await supabase
    .from('students')
    .select('id, jenjang, kelas')
    .eq('is_active', true)

  if (bacaError) return { error: 'Gagal membaca data siswa.' }

  const { naik, lulus, dilewati } = pilah((data ?? []) as BarisKenaikan[])

  // Penanda dipasang LEBIH DULU. Kalau pemasangannya gagal, tidak satu baris
  // pun siswa tersentuh — lebih baik kenaikan tidak jadi berjalan daripada
  // berjalan tanpa penjaga yang menahan pengulangannya.
  const { error: tandaError } = await supabase
    .from('academic_terms')
    .update({ kenaikan_at: new Date().toISOString() })
    .eq('id', termId)
    .is('kenaikan_at', null)

  if (tandaError) {
    return tandaError.message.includes('kenaikan_at')
      ? { error: 'Kenaikan kelas belum aktif: jalankan drizzle/0055_kenaikan_kelas_PASTE_TO_SUPABASE.sql di Supabase.' }
      : { error: 'Gagal menandai tahun ajaran; kenaikan dibatalkan.' }
  }

  // Dikelompokkan menurut kelas TUJUAN, bukan satu update per anak: 694 baris
  // berarti 694 perjalanan ke database, dan putus di tengahnya meninggalkan
  // separuh angkatan naik dan separuh tidak.
  const perKelas = new Map<string, string[]>()
  for (const s of naik) {
    const daftar = perKelas.get(s.kelas) ?? []
    daftar.push(s.id)
    perKelas.set(s.kelas, daftar)
  }

  let gagal = 0
  for (const [kelasBaru, ids] of perKelas) {
    const { error } = await supabase
      .from('students')
      .update({ kelas: kelasBaru, updated_at: new Date().toISOString() })
      .in('id', ids)
    if (error) gagal += ids.length
  }

  if (lulus.length > 0) {
    const { error } = await supabase
      .from('students')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', lulus)
    if (error) gagal += lulus.length
  }

  revalidatePath('/siswa')
  revalidatePath('/tahun-ajaran')
  revalidatePath('/halaqoh')

  return {
    success: true,
    naik: naik.length,
    lulus: lulus.length,
    gagal,
    dilewati: [...dilewati].map(([kelas, jumlah]) => ({ kelas, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah),
  }
}

// ─── Pembenahan kelas ────────────────────────────────────────────────────────

/**
 * Memindahkan sekumpulan siswa ke satu kelas yang jelas.
 *
 * Dipakai halaman /siswa/kelas untuk membereskan nilai sisa impor seperti
 * '4.0': tingkatnya masih terbaca, rombelnya hilang. Yang dipilih manusia di
 * sini adalah DUA hal — siapa saja anaknya dan rombel mana tujuannya — jadi
 * tidak ada yang ditebak mesin, hanya diketikkan sekali untuk banyak baris
 * alih-alih membuka formulir sunting 31 kali.
 *
 * Sengaja menerima banyak id: 31 dari 33 anak yang bermasalah ada di tingkat
 * yang sama, dan operator membacanya dari daftar rombel sekolah per kelompok,
 * bukan per anak.
 */
export async function pindahkanKelasAction(ids: string[], kelas: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const tujuan = kelas.trim()
  if (!tujuan) return { error: 'Kelas tujuan wajib diisi.' }
  if (ids.length === 0) return { error: 'Belum ada siswa yang dipilih.' }

  const supabase = createServerClient()
  const { data, error: bacaGagal } = await supabase
    .from('students')
    .select('id, full_name, jenjang, program, gender')
    .in('id', ids)

  if (bacaGagal || !data) return { error: 'Gagal membaca data siswa.' }
  if (data.length !== ids.length) return { error: 'Sebagian siswa tidak ditemukan.' }

  const rows = data as { id: string; full_name: string; jenjang: Jenjang; program: string | null; gender: 'L' | 'P' | null }[]

  // Izin diperiksa per baris memakai keadaan yang TERSIMPAN, bukan yang
  // dikirim peramban — pola yang sama dengan updateStudentAction. Daftar id
  // adalah JSON biasa yang bisa disusun siapa saja, jadi satu id milik koor
  // lain yang diselipkan ke dalamnya harus tertolak di sini.
  for (const s of rows) {
    if (!canManageStudents(session.role, s.jenjang, s.program)) {
      return { error: `Anda tidak memiliki izin atas ${s.full_name}.` }
    }
  }

  // Tujuan wajib lolos aturan yang sama dengan yang membuat baris ini muncul
  // di daftar. Tanpa ini, '4.0' bisa ditukar dengan '4.1' dan halamannya
  // tampak berkurang padahal tidak ada yang selesai.
  const tolak = rows.find(s => !kelasJelas(s.jenjang, tujuan))
  if (tolak) {
    return {
      error: `'${tujuan}' belum berbentuk kelas yang utuh untuk ${JENJANG_LABELS[tolak.jenjang]} ` +
        (KELAS_TETAP[tolak.jenjang] ? `— pilih salah satu: ${contohKelas(tolak.jenjang)}.` : '— tulis tingkat lalu rombelnya, mis. 4B.'),
    }
  }

  // Rombel SMP: huruf kelas tujuan harus cocok dengan program & gender tiap anak.
  for (const s of rows) {
    const galat = galatRombelSmp(s.jenjang, tujuan, s.program, s.gender)
    if (galat) return { error: `${s.full_name}: ${galat}` }
  }

  const { error } = await supabase
    .from('students')
    .update({ kelas: tujuan, updated_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: 'Gagal memindahkan siswa.' }

  revalidatePath('/siswa')
  revalidatePath('/siswa/kelas')
  for (const s of rows) revalidatePath(`/siswa/${s.id}`)

  return { jumlah: rows.length, kelas: tujuan }
}
