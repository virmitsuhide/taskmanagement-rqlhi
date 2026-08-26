'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageStudents, getManageableJenjang } from '@/lib/auth/permissions'
import { periksaBaris, tandaiNisKembar, type BarisSiswa, type RujukanImpor } from '@/lib/rq/siswa-impor'
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
    kelas: clean(formData.get('kelas')),
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

export async function createStudentAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const fields = pickStudentFields(formData)
  if (!fields.full_name || !fields.jenjang) {
    return { error: 'Nama lengkap dan jenjang wajib diisi.' }
  }
  if (!canManageStudents(session.role, fields.jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa jenjang ini.' }
  }

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
  if (!fields.full_name || !fields.jenjang) {
    return { error: 'Nama lengkap dan jenjang wajib diisi.' }
  }
  if (!canManageStudents(session.role, fields.jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa jenjang ini.' }
  }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('students').select('jenjang, halaqoh_id').eq('id', id).single()
  if (!existing || !canManageStudents(session.role, existing.jenjang as Jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa ini.' }
  }

  const { error } = await supabase
    .from('students')
    .update({ ...fields, is_active })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'NIS sudah dipakai siswa lain.' }
    return { error: 'Gagal memperbarui siswa.' }
  }

  if (fields.halaqoh_id !== (existing.halaqoh_id as string | null)) {
    await syncHalaqohMembership(supabase, id, fields.halaqoh_id, existing.halaqoh_id as string | null)
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
    supabase.from('halaqoh').select('id, name, jenjang').eq('is_active', true),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true),
    supabase.from('jilid_levels').select('id, label, method_id'),
  ])
  const rujukan: RujukanImpor = {
    allowedJenjang: allowed,
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
  const anggota = tersimpan
    .filter(s => s.kolom.halaqoh_id)
    .map(s => ({
      halaqoh_id: s.kolom.halaqoh_id as string,
      student_id: s.kolom.id,
      joined_at: hariIni(),
      left_at: null,
    }))
  for (let i = 0; i < anggota.length; i += UKURAN_POTONGAN) {
    await supabase
      .from('halaqoh_members')
      .upsert(anggota.slice(i, i + UKURAN_POTONGAN), { onConflict: 'halaqoh_id,student_id' })
  }

  if (masuk > 0) revalidatePath('/siswa')
  return { masuk, gagal: gagal.sort((a, b) => a.baris - b.baris) }
}

function hariIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function deleteStudentAction(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('students').select('jenjang').eq('id', id).single()
  if (!existing) return { error: 'Siswa tidak ditemukan.' }
  if (!canManageStudents(session.role, existing.jenjang as Jenjang)) {
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

/**
 * Catat perpindahan halaqoh sebagai riwayat, bukan sekadar mengganti pointer.
 *
 * `students.halaqoh_id` tetap dipertahankan sebagai penunjuk penempatan yang
 * berlaku sekarang — puluhan layar memakainya untuk pertanyaan "halaqoh anak
 * ini apa?", dan menjadikannya JOIN di semua tempat tidak sepadan. Sumber
 * kebenaran riwayatnya ada di `halaqoh_members`, yang disegarkan di sini.
 *
 * Karena halaqoh sendiri milik satu semester (halaqoh.term_id), keanggotaan
 * ini ikut bersemester dengan sendirinya. Jadi setelah pengacakan semester
 * berikutnya, pertanyaan "anak ini di halaqoh mana pada Semester 1" tetap
 * terjawab — dan rapor bulan lampau tetap menyebut ustadz yang benar.
 */
async function syncHalaqohMembership(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string,
  nextHalaqohId: string | null,
  previousHalaqohId?: string | null,
) {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Keanggotaan lama ditutup, bukan dihapus: kepindahan di tengah semester
  // adalah fakta yang perlu terbaca saat rapor bulan itu disusun.
  if (previousHalaqohId) {
    await supabase
      .from('halaqoh_members')
      .update({ left_at: iso })
      .eq('halaqoh_id', previousHalaqohId)
      .eq('student_id', studentId)
      .is('left_at', null)
  }

  if (!nextHalaqohId) return

  // Kembali ke halaqoh yang pernah ditinggalkan: buka lagi barisnya alih-alih
  // membuat baris kedua — kunci utamanya sepasang (halaqoh, santri).
  await supabase
    .from('halaqoh_members')
    .upsert(
      { halaqoh_id: nextHalaqohId, student_id: studentId, joined_at: iso, left_at: null },
      { onConflict: 'halaqoh_id,student_id' },
    )
}
