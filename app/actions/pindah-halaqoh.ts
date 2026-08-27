'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh, canManageStudents, getManageableJenjang } from '@/lib/auth/permissions'
import { hariIni, syncHalaqohMemberships } from '@/lib/data/halaqoh-membership'
import {
  periksaBarisKelompok, tandaiSantriKembar,
  type RujukanKelompok,
} from '@/lib/rq/kelompok-impor'
import type { Jenjang, SessionData } from '@/types'

// ─── Pemindahan santri antar halaqoh ────────────────────────────────
//
// Satu-satunya jalan sah untuk mengubah penempatan di luar formulir siswa.
// Keduanya bermuara ke lib/data/halaqoh-membership: `students.halaqoh_id`
// adalah penunjuk penempatan sekarang, `halaqoh_members` adalah riwayatnya,
// dan yang kedua tidak boleh tertinggal.

/** Sekali pindah dibatasi supaya satu permintaan keliru tidak menyandera koneksi. */
const MAKS_SEKALI_PINDAH = 500

/** Baris dikirim per potongan agar satu perintah tidak melebihi batas payload. */
const UKURAN_POTONGAN = 100

export interface HasilPindah {
  dipindah: number
  /** Santri yang dilewati beserta alasannya — biasanya di luar wewenang. */
  dilewati: { nama: string; alasan: string }[]
  error?: string
}

/**
 * Pindahkan satu atau banyak santri ke satu halaqoh tujuan.
 *
 * Menerima banyak sekaligus karena begitulah pemindahan benar-benar terjadi:
 * bukan satu anak sesekali, melainkan sekelompok anak yang dipindah bersama
 * saat kelompoknya ditata ulang.
 *
 * Wewenang diperiksa DUA KALI — atas halaqoh tujuan dan atas tiap santrinya.
 * Keduanya perlu: tanpa yang pertama seorang koor bisa menitipkan anaknya ke
 * kelompok koor lain, tanpa yang kedua ia bisa menarik anak koor lain ke
 * kelompoknya sendiri.
 */
export async function pindahSiswaAction(
  studentIds: string[],
  targetHalaqohId: string,
): Promise<HasilPindah> {
  const session = await getSession()
  if (!session) return { dipindah: 0, dilewati: [], error: 'Sesi tidak valid.' }

  const ids = [...new Set((studentIds ?? []).filter(Boolean))]
  if (ids.length === 0) return { dipindah: 0, dilewati: [], error: 'Tidak ada santri yang dipilih.' }
  if (ids.length > MAKS_SEKALI_PINDAH) {
    return { dipindah: 0, dilewati: [], error: `Sekali pindah maksimal ${MAKS_SEKALI_PINDAH} santri.` }
  }
  if (!targetHalaqohId) return { dipindah: 0, dilewati: [], error: 'Halaqoh tujuan belum dipilih.' }

  const supabase = createServerClient()

  const { data: tujuan } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, program, is_active')
    .eq('id', targetHalaqohId)
    .maybeSingle()
  if (!tujuan) return { dipindah: 0, dilewati: [], error: 'Halaqoh tujuan tidak ditemukan.' }
  if (!canManageHalaqoh(session.role, tujuan.jenjang as Jenjang, tujuan.program as string | null)) {
    return { dipindah: 0, dilewati: [], error: 'Anda tidak berwenang mengisi halaqoh tujuan itu.' }
  }

  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, jenjang, program, halaqoh_id')
    .in('id', ids)

  const dilewati: HasilPindah['dilewati'] = []
  const boleh: { id: string; dari: string | null }[] = []
  for (const s of siswa ?? []) {
    if (!canManageStudents(session.role, s.jenjang as Jenjang, s.program as string | null)) {
      dilewati.push({ nama: s.full_name, alasan: 'Di luar wewenang Anda.' })
      continue
    }
    // Jenjang tujuan harus sama dengan jenjang santri. Halaqoh SD tidak boleh
    // menampung anak SMP walau pengurusnya kebetulan berwenang atas keduanya.
    if (s.jenjang !== tujuan.jenjang) {
      dilewati.push({ nama: s.full_name, alasan: `Beda unit dengan halaqoh tujuan.` })
      continue
    }
    if (s.halaqoh_id === tujuan.id) {
      dilewati.push({ nama: s.full_name, alasan: 'Sudah ada di halaqoh itu.' })
      continue
    }
    boleh.push({ id: s.id, dari: s.halaqoh_id as string | null })
  }

  if (boleh.length === 0) {
    return { dipindah: 0, dilewati, error: 'Tidak ada santri yang bisa dipindahkan.' }
  }

  const asal = new Set(boleh.map(b => b.dari).filter((v): v is string => !!v))
  const dipindah = await terapkanPindah(supabase, boleh.map(b => ({
    student_id: b.id, ke: tujuan.id, dari: b.dari,
  })))

  revalidatePath('/halaqoh')
  revalidatePath(`/halaqoh/${tujuan.id}`)
  for (const id of asal) revalidatePath(`/halaqoh/${id}`)
  revalidatePath('/siswa')

  return { dipindah, dilewati }
}

// ─── Impor kelompok dari Excel ──────────────────────────────────────
//
// Baris sudah diperiksa di peramban sebelum sampai ke sini, tapi pemeriksaan
// itu tidak dipercaya: yang dikirim adalah JSON biasa yang bisa disusun siapa
// saja. Seluruh aturan dijalankan ULANG di sini memakai fungsi yang sama
// persis (periksaBarisKelompok), lalu lingkupnya dibangun ulang dari sesi
// pengguna — bukan dari apa pun yang datang bersama permintaan.

/** Sekali unggah dibatasi supaya satu berkas keliru tidak menyandera koneksi. */
const MAKS_BARIS_IMPOR = 1500

/**
 * Baris mentah dari berkas Excel, ditambah dua kolom cadangan yang ditulis
 * peramban: `__sheet` (nama lembar, sumber sesinya) dan `__baris` (nomor baris
 * di lembar itu, supaya pesan galat menunjuk ke tempat yang dilihat operator).
 */
export type BarisKelompokMentah = Record<string, string | number | boolean | null>

export interface HasilImporKelompok {
  dipindah: number
  tetap: number
  gagal: { sheet: string; baris: number; nama: string; alasan: string }[]
  error?: string
}

export async function importKelompokAction(
  rows: BarisKelompokMentah[],
): Promise<HasilImporKelompok> {
  const session = await getSession()
  if (!session) return { dipindah: 0, tetap: 0, gagal: [], error: 'Sesi tidak valid.' }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { dipindah: 0, tetap: 0, gagal: [], error: 'Tidak ada baris untuk diimpor.' }
  }
  if (rows.length > MAKS_BARIS_IMPOR) {
    return { dipindah: 0, tetap: 0, gagal: [], error: `Sekali impor maksimal ${MAKS_BARIS_IMPOR} baris.` }
  }

  const supabase = createServerClient()
  const rujukan = await muatLingkupKelompok(supabase, session)
  if (rujukan.halaqohList.length === 0) {
    return { dipindah: 0, tetap: 0, gagal: [], error: 'Tidak ada halaqoh dalam wewenang Anda.' }
  }

  const hasil = tandaiSantriKembar(rows.map((r, i) => periksaBarisKelompok(
    r,
    Number(r.__baris) || i + 2,
    String(r.__sheet ?? 'Sheet1'),
    // Sesi lembar ikut dikirim peramban sebagai angka; dibaca ulang di sini
    // supaya server tidak perlu menebak dari nama lembar yang bisa apa saja.
    Number(r.__sesi) || null,
    rujukan,
  )))

  const gagal = hasil
    .filter(h => h.status === 'galat')
    .map(h => ({ sheet: h.sheet, baris: h.baris, nama: h.nama, alasan: h.galat.join(' ') }))
  const tetap = hasil.filter(h => h.status === 'tetap').length
  const pindah = hasil.filter(h => h.status === 'pindah')

  if (pindah.length === 0) {
    return {
      dipindah: 0, tetap, gagal,
      error: tetap > 0 ? undefined : 'Tidak ada baris yang lolos pemeriksaan.',
    }
  }

  const asalSantri = new Map(rujukan.santri.map(s => [s.id, s.halaqoh_id]))
  const dipindah = await terapkanPindah(supabase, pindah.map(h => ({
    student_id: h.student_id!,
    ke: h.halaqoh_id!,
    dari: asalSantri.get(h.student_id!) ?? null,
  })))

  revalidatePath('/halaqoh')
  revalidatePath('/siswa')
  for (const id of new Set(pindah.map(h => h.halaqoh_id!))) revalidatePath(`/halaqoh/${id}`)

  return { dipindah, tetap, gagal }
}

/**
 * Lingkup pemindahan seorang pengurus: halaqoh yang boleh ia isi dan santri
 * yang boleh ia pindahkan.
 *
 * Dibangun dari sesi, tidak pernah dari permintaan. Dipakai bersama oleh
 * layar pratinjau (lewat halaman servernya) dan oleh penyimpanan, sehingga
 * apa yang terlihat siap dipindah di layar persis yang diterima server.
 */
export async function muatLingkupKelompokUntukSesi(): Promise<RujukanKelompok> {
  const session = await getSession()
  if (!session) return { halaqohList: [], santri: [] }
  return muatLingkupKelompok(createServerClient(), session)
}

async function muatLingkupKelompok(
  supabase: ReturnType<typeof createServerClient>,
  session: SessionData,
): Promise<RujukanKelompok> {
  const jenjangList = getManageableJenjang(session.role)
    .filter(j => canManageStudents(session.role, j))
  if (jenjangList.length === 0) return { halaqohList: [], santri: [] }

  const [halaqohResult, santriResult] = await Promise.all([
    supabase
      .from('halaqoh')
      .select('id, name, jenjang, program, sesi, is_active, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(full_name)')
      .in('jenjang', jenjangList)
      .eq('is_active', true)
      .order('sesi')
      .order('name'),
    supabase
      .from('students')
      .select('id, nis, full_name, kelas, jenjang, program, halaqoh_id, halaqoh:halaqoh!students_halaqoh_id_fkey(name)')
      .in('jenjang', jenjangList)
      .eq('is_active', true)
      .order('full_name'),
  ])

  type HalaqohRow = {
    id: string; name: string; jenjang: Jenjang; program: string | null; sesi: number | null
    wali_teacher: { full_name: string } | null
  }
  type SantriRow = {
    id: string; nis: string | null; full_name: string; kelas: string | null
    jenjang: Jenjang; program: string | null; halaqoh_id: string | null
    halaqoh: { name: string } | null
  }

  // Penyempitan program dilakukan di sini, bukan di kueri: aturannya ada di
  // canManage* dan menyalinnya jadi filter Supabase berarti dua tempat yang
  // harus sepakat selamanya.
  const halaqohList = ((halaqohResult.data ?? []) as unknown as HalaqohRow[])
    .filter(h => canManageHalaqoh(session.role, h.jenjang, h.program))
    .map(h => ({
      id: h.id, name: h.name, jenjang: h.jenjang, program: h.program, sesi: h.sesi,
      wali: h.wali_teacher?.full_name ?? null,
    }))

  const santri = ((santriResult.data ?? []) as unknown as SantriRow[])
    .filter(s => canManageStudents(session.role, s.jenjang, s.program))
    .map(s => ({
      id: s.id, nis: s.nis, full_name: s.full_name, kelas: s.kelas,
      jenjang: s.jenjang, program: s.program,
      halaqoh_id: s.halaqoh_id, halaqoh_name: s.halaqoh?.name ?? null,
    }))

  return { halaqohList, santri }
}

/** Tulis penempatan baru + riwayatnya. Mengembalikan berapa baris yang masuk. */
async function terapkanPindah(
  supabase: ReturnType<typeof createServerClient>,
  pindah: { student_id: string; ke: string; dari: string | null }[],
): Promise<number> {
  // Dikelompokkan per halaqoh tujuan supaya seluruh anak yang menuju kelompok
  // yang sama selesai dalam satu UPDATE, bukan satu per anak.
  const perTujuan = new Map<string, string[]>()
  for (const p of pindah) {
    const daftar = perTujuan.get(p.ke) ?? []
    daftar.push(p.student_id)
    perTujuan.set(p.ke, daftar)
  }

  const berhasil = new Set<string>()
  for (const [halaqohId, siswa] of perTujuan) {
    for (let i = 0; i < siswa.length; i += UKURAN_POTONGAN) {
      const potongan = siswa.slice(i, i + UKURAN_POTONGAN)
      const { error } = await supabase
        .from('students')
        .update({ halaqoh_id: halaqohId })
        .in('id', potongan)
      if (!error) for (const id of potongan) berhasil.add(id)
    }
  }

  // Riwayat hanya dicatat untuk yang penempatannya benar-benar tersimpan —
  // kalau tidak, halaqoh_members akan menyebut kepindahan yang tidak terjadi.
  await syncHalaqohMemberships(
    supabase,
    pindah.filter(p => berhasil.has(p.student_id)),
    hariIni(),
  )

  return berhasil.size
}
