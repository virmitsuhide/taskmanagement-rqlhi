'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { catatDrillSetelahZiyadah } from '@/lib/data/drill-tahfidz'
import type { TahsinStatus, TahfidzKind } from '@/types'

/**
 * KEBIJAKAN POSISI SISWA setelah setoran tahsin (ditetapkan RQ LHI).
 *
 *  - LULUS : maju ke halaman berikutnya (halaman + 1).
 *  - LULUS di HALAMAN TERAKHIR jilid : posisi tetap di halaman itu dan anak
 *            masuk DRILL — mengulang jilid tersebut sampai lulus ujian tahsin.
 *  - ULANG : posisi TIDAK bergeser.
 *  - Selama DRILL : setoran tetap dicatat (latihan drill, halaman bebas di
 *            jilid itu) tapi posisi tidak bergerak sama sekali.
 *
 * Naik jilid TIDAK lagi lewat setoran harian. Satu-satunya pintunya kelulusan
 * ujian tahsin (terapkanKelulusanTahsin di actions/ujian.ts), yang sekaligus
 * mengakhiri drill. Dua pintu untuk satu peristiwa berarti dua catatan yang
 * bisa saling bertentangan — anak "naik" di setoran padahal belum pernah diuji.
 */
function resolveStudentPosition(opts: {
  status: TahsinStatus
  methodId: string | null
  jilidId: string | null
  halaman: number | null
  totalHalaman: number | null
  sedangDrill: boolean
  current: { method_id: string | null; jilid_id: string | null; page: number | null }
}): { current_method_id: string | null; current_jilid_id: string | null; current_jilid_page: number | null; masukDrill: boolean } {
  const tetap = {
    current_method_id: opts.current.method_id ?? opts.methodId,
    current_jilid_id: opts.current.jilid_id ?? opts.jilidId,
    current_jilid_page: opts.current.page,
    masukDrill: false,
  }
  if (opts.sedangDrill || opts.status === 'ulang' || opts.halaman === null) return tetap

  if (opts.totalHalaman !== null && opts.halaman >= opts.totalHalaman) {
    return { ...tetap, current_jilid_page: opts.totalHalaman, masukDrill: true }
  }
  return {
    current_method_id: opts.methodId,
    current_jilid_id: opts.jilidId,
    current_jilid_page: opts.halaman + 1,
    masukDrill: false,
  }
}

/**
 * Baca nilai 0-100 dari form.
 *
 * Kosong berarti aspek itu memang tidak dinilai, bukan bernilai nol -- nol
 * akan menyeret rata-rata rapor ke bawah tanpa ada yang menyadarinya.
 * Nilai di luar 0-100 ditolak di sini juga, bukan hanya oleh CHECK di
 * database, supaya pesannya bisa menyebut aspek mana yang keliru.
 */
function readScore(formData: FormData, field: string): number | null {
  const raw = formData.get(field)
  if (raw === null || String(raw).trim() === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return value
}

/** Nilai 0-100 dari angka mentah; di luar rentang dianggap tidak dinilai. */
function nilaiSah(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

export interface InputSetoranTahsin {
  student_id: string
  method_id: string | null
  jilid_id: string | null
  halaman: number | null
  nilai_tahsin: number | null
  nilai_sikap: number | null
  status: TahsinStatus
  catatan: string | null
  setoran_date: string
}

/**
 * Inti penyimpanan satu setoran tahsin — dipakai setoran satu-satu dan
 * setoran per sesi, supaya aturan jilid, halaman, dan drill hanya ditulis
 * sekali. Mengembalikan pesan galat, atau null bila tersimpan.
 */
async function simpanSetoranTahsin(teacherId: string, input: InputSetoranTahsin): Promise<string | null> {
  const { student_id: studentId, method_id: methodId, jilid_id: jilidId, halaman, status } = input

  // Guru hanya boleh setor untuk siswa di halaqoh yang diampu
  const allowed = await canTeacherAccessStudent(teacherId, studentId)
  if (!allowed) return 'Anda tidak mengampu siswa ini.'

  if (!jilidId) return 'Jilid wajib dipilih.'

  const supabase = createServerClient()

  // Ambil halaqoh & posisi siswa saat ini
  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id, current_method_id, current_jilid_id, current_jilid_page, tahsin_drill_sejak')
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return 'Siswa tidak ditemukan.'

  /*
    DUA ATURAN JILID, DITEGAKKAN DI SINI — BUKAN DI FORMULIR.

    Formulir sudah mengunci pilihan jilid dan memasang batas `max` pada
    halaman, tapi keduanya hanya menghentikan orang yang memakai formulir.
    FormData bisa disusun siapa saja, dan setoran yang mendarat di jilid yang
    belum ditempuh merusak riwayat kenaikan tanpa meninggalkan jejak.

    1) Jilid harus jilid yang sedang dijalani. Perpindahan hanya lewat
       kelulusan ujian tahsin. Siswa yang belum punya posisi (setoran
       pertama) dikecualikan: di situlah jilid awalnya ditetapkan.

    2) Halaman tidak boleh melewati panjang jilidnya. "Jilid 2 halaman 45"
       untuk buku 40 halaman bukan sekadar salah ketik — ia terbawa ke rekap
       bulanan sebagai kemajuan yang tidak pernah terjadi.
  */
  if (student.current_jilid_id && jilidId !== student.current_jilid_id) {
    return 'Siswa sedang di jilid lain. Jilid hanya berpindah setelah lulus ujian tahsin.'
  }

  const { data: jilidRow } = await supabase
    .from('jilid_levels')
    .select('label, total_pages')
    .eq('id', jilidId)
    .maybeSingle()
  const jilid = jilidRow as { label: string; total_pages: number | null } | null

  if (halaman !== null && halaman < 1) return 'Halaman minimal 1.'
  if (halaman !== null && jilid?.total_pages && halaman > jilid.total_pages) {
    return `${jilid.label} hanya ${jilid.total_pages} halaman — halaman ${halaman} tidak ada.`
  }

  const sedangDrill = Boolean(student.tahsin_drill_sejak)

  const { error: logErr } = await supabase.from('tahsin_logs').insert({
    student_id: studentId,
    teacher_id: teacherId,
    halaqoh_id: student.halaqoh_id,
    setoran_date: input.setoran_date,
    method_id: methodId,
    jilid_id: jilidId,
    halaman,
    nilai_tahsin: input.nilai_tahsin,
    nilai_sikap: input.nilai_sikap,
    status,
    catatan: input.catatan,
    drill: sedangDrill,
  })
  if (logErr) return 'Gagal menyimpan setoran.'

  const { masukDrill, ...posisi } = resolveStudentPosition({
    status, methodId, jilidId, halaman,
    totalHalaman: jilid?.total_pages ?? null,
    sedangDrill,
    current: {
      method_id: student.current_method_id,
      jilid_id: student.current_jilid_id,
      page: student.current_jilid_page,
    },
  })
  await supabase
    .from('students')
    .update(masukDrill ? { ...posisi, tahsin_drill_sejak: input.setoran_date } : posisi)
    .eq('id', studentId)

  return null
}

function segarkanSetoran(studentIds: string[]) {
  revalidatePath('/guru/siswa')
  for (const id of studentIds) revalidatePath(`/guru/siswa/${id}`)
  revalidatePath('/guru')
}

export async function createTahsinLogAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const studentId = formData.get('student_id') as string
  if (!studentId) return { error: 'Siswa belum dipilih.' }

  const galat = await simpanSetoranTahsin(session.teacherId, {
    student_id: studentId,
    method_id: (formData.get('method_id') as string) || null,
    jilid_id: (formData.get('jilid_id') as string) || null,
    halaman: formData.get('halaman') ? Number(formData.get('halaman')) : null,
    nilai_tahsin: readScore(formData, 'nilai_tahsin'),
    nilai_sikap: readScore(formData, 'nilai_sikap'),
    status: ((formData.get('status') as string) || 'lulus') as TahsinStatus,
    catatan: ((formData.get('catatan') as string) || '').trim() || null,
    setoran_date: (formData.get('setoran_date') as string) || new Date().toISOString().slice(0, 10),
  })
  if (galat) return { error: galat }

  segarkanSetoran([studentId])
  redirect(`/guru/siswa/${studentId}?setoran=ok`)
}

export interface HasilSetoranSesi {
  tersimpan: number
  /** Per anak yang gagal: nama + alasannya, supaya bisa dibetulkan satu per satu. */
  gagal: { student_id: string; pesan: string }[]
  error?: string
}

/**
 * Setoran tahsin satu sesi sekaligus. Tiap anak disimpan sendiri-sendiri
 * lewat inti yang sama; satu anak gagal tidak menggagalkan yang lain, dan
 * yang gagal dikembalikan agar tetap tampil di formulir untuk dibetulkan.
 */
export async function createTahsinLogSesiAction(baris: InputSetoranTahsin[]): Promise<HasilSetoranSesi> {
  const session = await getTeacherSession()
  if (!session) return { tersimpan: 0, gagal: [], error: 'Sesi guru tidak valid.' }
  if (baris.length === 0) return { tersimpan: 0, gagal: [], error: 'Belum ada anak yang diisi.' }

  const gagal: HasilSetoranSesi['gagal'] = []
  let tersimpan = 0
  for (const b of baris) {
    const galat = await simpanSetoranTahsin(session.teacherId, {
      ...b,
      nilai_tahsin: nilaiSah(b.nilai_tahsin),
      nilai_sikap: nilaiSah(b.nilai_sikap),
      status: b.status === 'ulang' ? 'ulang' : 'lulus',
      catatan: b.catatan?.trim() || null,
    })
    if (galat) gagal.push({ student_id: b.student_id, pesan: galat })
    else tersimpan++
  }

  segarkanSetoran(baris.map(b => b.student_id))
  return { tersimpan, gagal }
}

// ─── TAHFIDZ ────────────────────────────────────────────────────────
//
// Setoran tahfidz hanya mencatat ziyadah & muroja'ah. Dua hal yang dulu ada
// di sini sengaja dicabut:
//
//  • "Tandai juz selesai (mutqin)" — pengakuan bahwa satu juz tuntas kini
//    datang dari pengajuan ujian yang berstatus selesai (juz teruji), bukan
//    dari centang guru pada setoran harian.
//  • Tasmi' 3 & 5 juz — sudah menjadi jenis ujian di modul pengajuan ujian.
//    Mencatatnya di dua tempat membuat satu tasmi' bisa terhitung dua kali
//    atau saling bertentangan. Riwayat tasmi' lama dimasukkan koordinator
//    lewat halaman ujian (Catat Riwayat).

export interface InputSetoranTahfidz {
  student_id: string
  kind: TahfidzKind
  surat_id: number | null
  ayat_dari: number | null
  ayat_ke: number | null
  nilai_tahfidz: number | null
  nilai_sikap: number | null
  catatan: string | null
  setoran_date: string
}

const JENIS_SETORAN_TAHFIDZ: TahfidzKind[] = ['ziyadah', 'murojaah_baru', 'murojaah_lama']

async function simpanSetoranTahfidz(teacherId: string, input: InputSetoranTahfidz): Promise<string | null> {
  const { student_id: studentId, surat_id: suratId, ayat_dari: ayatDari, ayat_ke: ayatKe } = input

  const allowed = await canTeacherAccessStudent(teacherId, studentId)
  if (!allowed) return 'Anda tidak mengampu siswa ini.'

  if (!JENIS_SETORAN_TAHFIDZ.includes(input.kind)) return 'Jenis setoran tidak dikenal.'
  if (!suratId) return 'Surat wajib dipilih.'
  if (!ayatDari || !ayatKe) return 'Rentang ayat wajib diisi.'
  if (ayatKe < ayatDari) return 'Ayat akhir tidak boleh lebih kecil dari ayat awal.'

  const supabase = createServerClient()

  // Validasi rentang ayat terhadap data surat
  const { data: surat } = await supabase
    .from('surat_master')
    .select('total_ayat, name_latin')
    .eq('id', suratId)
    .maybeSingle()
  if (!surat) return 'Surat tidak ditemukan.'
  if (ayatKe > surat.total_ayat) return `Surat ${surat.name_latin} hanya punya ${surat.total_ayat} ayat.`

  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id')
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return 'Siswa tidak ditemukan.'

  // Trigger DB upsert_juz_progress otomatis menambah ayat_hafal ke
  // juz_progress (hanya untuk kind='ziyadah').
  const { data: logRow, error: logErr } = await supabase.from('tahfidz_logs').insert({
    student_id: studentId,
    teacher_id: teacherId,
    halaqoh_id: student.halaqoh_id,
    setoran_date: input.setoran_date,
    kind: input.kind,
    surat_id: suratId,
    ayat_dari: ayatDari,
    ayat_ke: ayatKe,
    nilai_tahfidz: input.nilai_tahfidz,
    nilai_sikap: input.nilai_sikap,
    catatan: input.catatan,
  }).select('id').single()
  if (logErr) return 'Gagal menyimpan setoran tahfidz.'

  // Ziyadah yang menuntaskan sebuah juz membuka masa drill juz itu — awal
  // hitungan lama anak menyiapkan ujian 1 juz (0065).
  if (input.kind === 'ziyadah') {
    await catatDrillSetelahZiyadah(studentId, {
      id: (logRow?.id as string | undefined) ?? null,
      surat_id: suratId,
      ayat_dari: ayatDari,
      ayat_ke: ayatKe,
      setoran_date: input.setoran_date,
    })
  }
  return null
}

export async function createTahfidzLogAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const studentId = formData.get('student_id') as string
  if (!studentId) return { error: 'Siswa belum dipilih.' }

  const galat = await simpanSetoranTahfidz(session.teacherId, {
    student_id: studentId,
    kind: ((formData.get('kind') as string) || 'ziyadah') as TahfidzKind,
    surat_id: formData.get('surat_id') ? Number(formData.get('surat_id')) : null,
    ayat_dari: formData.get('ayat_dari') ? Number(formData.get('ayat_dari')) : null,
    ayat_ke: formData.get('ayat_ke') ? Number(formData.get('ayat_ke')) : null,
    nilai_tahfidz: readScore(formData, 'nilai_tahfidz'),
    nilai_sikap: readScore(formData, 'nilai_sikap'),
    catatan: ((formData.get('catatan') as string) || '').trim() || null,
    setoran_date: (formData.get('setoran_date') as string) || new Date().toISOString().slice(0, 10),
  })
  if (galat) return { error: galat }

  segarkanSetoran([studentId])
  redirect(`/guru/siswa/${studentId}?setoran=tahfidz_ok`)
}

/** Setoran tahfidz satu sesi sekaligus — pola yang sama dengan tahsin. */
export async function createTahfidzLogSesiAction(baris: InputSetoranTahfidz[]): Promise<HasilSetoranSesi> {
  const session = await getTeacherSession()
  if (!session) return { tersimpan: 0, gagal: [], error: 'Sesi guru tidak valid.' }
  if (baris.length === 0) return { tersimpan: 0, gagal: [], error: 'Belum ada anak yang diisi.' }

  const gagal: HasilSetoranSesi['gagal'] = []
  let tersimpan = 0
  for (const b of baris) {
    const galat = await simpanSetoranTahfidz(session.teacherId, {
      ...b,
      nilai_tahfidz: nilaiSah(b.nilai_tahfidz),
      nilai_sikap: nilaiSah(b.nilai_sikap),
      catatan: b.catatan?.trim() || null,
    })
    if (galat) gagal.push({ student_id: b.student_id, pesan: galat })
    else tersimpan++
  }

  segarkanSetoran(baris.map(b => b.student_id))
  return { tersimpan, gagal }
}
