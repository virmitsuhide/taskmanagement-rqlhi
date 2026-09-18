'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { catatDrillSetelahZiyadah } from '@/lib/data/drill-tahfidz'
import { periksaBacaanQuran, posisiLanjut, type BacaanQuran } from '@/lib/rq/bacaan-quran'
import { getMateriPerJilid, getHasilMateriPerSiswa, ringkasProgres, type HasilMateri } from '@/lib/data/materi-tahsin'
import {
  periksaGandaTahsin, arsipkanTahsinSamaHari, periksaGandaTahfidz, arsipkanTahfidzSamaHari,
  tautkanPengganti, type SetoranGanda,
} from '@/lib/data/setoran-ganda'
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

/** Bilangan bulat opsional dari FormData; kosong/bukan angka = tidak diisi. */
function readInt(formData: FormData, field: string): number | null {
  const raw = formData.get(field)
  if (raw === null || String(raw).trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
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
  /** Halaman BUKU. Null di tahap tak berbuku (Al-Qur'an, Talaqqi). */
  halaman: number | null
  /** Bacaan mushaf sesi ini — progres kedua, terpisah dari halaman buku. */
  quran: BacaanQuran
  /**
   * Materi hafalan yang disetor sesi ini (Gharib/Tajwid UMMI). Kosong di
   * tahap yang tidak berbasis materi.
   */
  materi: { materi_id: string; hasil: HasilMateri }[]
  nilai_tahsin: number | null
  nilai_sikap: number | null
  status: TahsinStatus
  catatan: string | null
  setoran_date: string
  /** Guru sudah melihat perbandingan dan setuju menimpa setoran hari itu. */
  timpa?: boolean
}

/**
 * Hasil inti penyimpanan: null = tersimpan, string = galat, `ganda` = hari
 * itu sudah ada setoran dan guru belum menyetujui penimpaannya.
 */
type HasilSimpan = null | string | { ganda: SetoranGanda }

/**
 * Inti penyimpanan satu setoran tahsin — dipakai setoran satu-satu dan
 * setoran per sesi, supaya aturan jilid, halaman, dan drill hanya ditulis
 * sekali. Lihat HasilSimpan untuk arti nilai kembaliannya.
 */
async function simpanSetoranTahsin(teacherId: string, input: InputSetoranTahsin): Promise<HasilSimpan> {
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
    .select('label, total_pages, baca_quran')
    .eq('id', jilidId)
    .maybeSingle()
  const jilid = jilidRow as { label: string; total_pages: number | null; baca_quran: boolean } | null

  if (halaman !== null && halaman < 1) return 'Halaman minimal 1.'
  if (halaman !== null && jilid?.total_pages && halaman > jilid.total_pages) {
    return `${jilid.label} hanya ${jilid.total_pages} halaman — halaman ${halaman} tidak ada.`
  }

  /*
    BACAAN MUSHAF — PROGRES KEDUA YANG BERJALAN BERSAMAAN.

    Di UMMI, anak yang sudah masuk buku Gharib atau Tajwid tidak berhenti
    membaca Al-Qur'an: bukunya DIHAFAL, mushafnya tetap DIBACA. Karena itu
    kedua tahap itu ditandai baca_quran walau is_quran-nya false, dan satu
    setoran di sana memuat dua kemajuan sekaligus.

    Panjang surah diambil dari surat_master, bukan ditebak: tanpa itu
    "Al-Ikhlas ayat 12" lolos begitu saja dan baru ketahuan saat rapor dicetak.
  */
  const bacaQuran = Boolean(jilid?.baca_quran)
  let totalAyat: number | null = null
  if (input.quran.surat_id !== null) {
    const { data: suratRow } = await supabase
      .from('surat_master')
      .select('total_ayat')
      .eq('id', input.quran.surat_id)
      .maybeSingle()
    if (!suratRow) return 'Surat tidak dikenal.'
    totalAyat = (suratRow as { total_ayat: number }).total_ayat
  }

  const galatQuran = periksaBacaanQuran(input.quran, { totalAyat, wajib: bacaQuran })
  if (galatQuran) return galatQuran

  /*
    TAHAP BERBASIS MATERI — GHARIB & TAJWID.

    Bukunya DIHAFAL, bukan dibaca, dan satu halamannya memuat beberapa materi
    yang bisa memakan beberapa pertemuan. Karena itu satuan setorannya materi;
    nomor halaman tetap ikut disimpan tapi hanya sebagai turunan, supaya rekap
    lama yang menghitung halaman tidak perlu tahu apa-apa tentang ini.

    Yang menentukan sebuah tahap "berbasis materi" adalah ADA TIDAKNYA baris
    materi untuknya, bukan sebuah penanda tersendiri. Penanda bisa menyala
    sebelum materinya diseed, dan formulir yang meminta materi dari daftar
    kosong tidak bisa diselesaikan siapa pun.
  */
  const daftarMateri = (await getMateriPerJilid([jilidId])).get(jilidId) ?? []
  const pakaiMateri = daftarMateri.length > 0
  const materiSah = new Map(daftarMateri.map(m => [m.id, m]))
  const dipilih = pakaiMateri ? input.materi : []

  if (pakaiMateri) {
    if (dipilih.length === 0) return `Pilih minimal satu materi ${jilid?.label ?? ''} yang disetor.`
    for (const m of dipilih) {
      if (!materiSah.has(m.materi_id)) return 'Ada materi yang bukan milik tahap ini.'
    }
  } else if (input.materi.length > 0) {
    return 'Tahap ini tidak memakai materi hafalan.'
  }

  // Halaman buku diturunkan dari materi terjauh yang disetor, bukan diketik.
  const halamanMateri = dipilih.length > 0
    ? Math.max(...dipilih.map(m => materiSah.get(m.materi_id)!.halaman))
    : null
  const halamanTersimpan = pakaiMateri ? halamanMateri : halaman

  /*
    Di tahap berbasis materi, status setoran DITURUNKAN dari hasil materinya,
    bukan ditanyakan lagi ke guru. Menanyakan dua kali membuka kemungkinan
    jawaban yang saling bertentangan — setoran berstatus 'lulus' yang semua
    materinya mengulang — dan yang lebih rinci selalu yang benar. Kolom
    status tetap diisi supaya rekap lama yang membacanya tidak perlu tahu
    apa-apa tentang materi.
  */
  const statusTersimpan: TahsinStatus = pakaiMateri
    ? (dipilih.some(m => m.hasil === 'lulus') ? 'lulus' : 'ulang')
    : status

  /*
    SATU SETORAN PER HARI — lihat lib/data/setoran-ganda.ts.

    Diperiksa SETELAH seluruh validasi: setoran baru yang akhirnya ditolak
    tidak boleh sempat menghapus setoran lama. Setelah yang lama diarsipkan,
    posisi anak sudah diputar ulang tanpanya, jadi posisi itu dibaca lagi
    sebelum setoran baru dihitung di atasnya.
  */
  let arsipIds: string[] = []
  if (!input.timpa) {
    const ganda = await periksaGandaTahsin(supabase, studentId, input.setoran_date, {
      jilid_label: jilid?.label ?? null,
      halaman: halamanTersimpan,
      jumlah_materi: dipilih.length,
      quran_surat_id: input.quran.surat_id,
      quran_ayat_dari: input.quran.ayat_dari,
      quran_ayat_ke: input.quran.ayat_ke,
      status: statusTersimpan,
      nilai: input.nilai_tahsin,
      sikap: input.nilai_sikap,
      catatan: input.catatan,
    })
    if (ganda) return { ganda }
  } else {
    const hasil = await arsipkanTahsinSamaHari(supabase, teacherId, studentId, input.setoran_date)
    if ('galat' in hasil) return hasil.galat
    arsipIds = hasil.arsipIds
    if (arsipIds.length > 0) {
      const { data: segar } = await supabase
        .from('students')
        .select('halaqoh_id, current_method_id, current_jilid_id, current_jilid_page, tahsin_drill_sejak')
        .eq('id', studentId)
        .maybeSingle()
      if (segar) Object.assign(student, segar)
    }
  }

  const sedangDrill = Boolean(student.tahsin_drill_sejak)

  const { data: logBaru, error: logErr } = await supabase.from('tahsin_logs').insert({
    student_id: studentId,
    teacher_id: teacherId,
    halaqoh_id: student.halaqoh_id,
    setoran_date: input.setoran_date,
    method_id: methodId,
    jilid_id: jilidId,
    halaman: halamanTersimpan,
    quran_halaman: input.quran.halaman,
    quran_surat_id: input.quran.surat_id,
    quran_ayat_dari: input.quran.ayat_dari,
    quran_ayat_ke: input.quran.ayat_ke,
    nilai_tahsin: input.nilai_tahsin,
    nilai_sikap: input.nilai_sikap,
    status: statusTersimpan,
    catatan: input.catatan,
    drill: sedangDrill,
  }).select('id').single()
  if (logErr || !logBaru) return 'Gagal menyimpan setoran.'
  const logId = (logBaru as { id: string }).id
  await tautkanPengganti(supabase, arsipIds, logId)

  if (dipilih.length > 0) {
    const { error: materiErr } = await supabase.from('tahsin_log_materi').insert(
      dipilih.map(m => ({
        log_id: logId,
        student_id: studentId,
        materi_id: m.materi_id,
        hasil: m.hasil,
      })),
    )
    // Setoran tanpa materinya adalah baris yang tidak mengatakan apa-apa;
    // lebih baik dibatalkan daripada meninggalkan kemajuan yang tak terbaca.
    if (materiErr) {
      await supabase.from('tahsin_logs').delete().eq('id', logId)
      return 'Gagal menyimpan materi setoran.'
    }
  }

  /*
    Posisi di tahap materi: halaman materi BERIKUTNYA yang belum lulus, dan
    drill saat tidak ada lagi yang tersisa — padanan persis dari "lulus di
    halaman terakhir jilid". Himpunan hafal dibaca ulang dari basis data
    setelah penyimpanan, bukan ditebak dari isian: materi yang sama bisa sudah
    pernah lulus di setoran lampau, dan menghitungnya dua kali membuat anak
    tampak tuntas sebelum waktunya.
  */
  let posisi: { current_method_id: string | null; current_jilid_id: string | null; current_jilid_page: number | null }
  let masukDrill: boolean

  if (pakaiMateri) {
    const hasilMateri = (await getHasilMateriPerSiswa([studentId])).get(studentId)
      ?? new Map<string, HasilMateri>()
    const progres = ringkasProgres(daftarMateri, hasilMateri)
    posisi = {
      current_method_id: methodId ?? student.current_method_id,
      current_jilid_id: jilidId,
      current_jilid_page: progres.berikutnya?.halaman
        ?? daftarMateri[daftarMateri.length - 1]?.halaman
        ?? student.current_jilid_page,
    }
    masukDrill = progres.tuntas && !sedangDrill
  } else {
    const hasil = resolveStudentPosition({
      status, methodId, jilidId, halaman,
      totalHalaman: jilid?.total_pages ?? null,
      sedangDrill,
      current: {
        method_id: student.current_method_id,
        jilid_id: student.current_jilid_id,
        page: student.current_jilid_page,
      },
    })
    masukDrill = hasil.masukDrill
    posisi = {
      current_method_id: hasil.current_method_id,
      current_jilid_id: hasil.current_jilid_id,
      current_jilid_page: hasil.current_jilid_page,
    }
  }
  /*
    Posisi mushaf maju sendiri, tidak menumpang aturan jilid.

    Bedanya mendasar: buku punya halaman terakhir yang memicu DRILL, mushaf
    tidak — 604 halaman itu dibaca berulang seumur hidup, dan tidak ada
    "lulus Al-Qur'an" yang menutupnya. Selama drill buku pun bacaan mushafnya
    tetap berjalan, jadi sedangDrill sengaja tidak menahannya di sini; yang
    menahan hanya 'ulang', sebab anak yang mengulang belum pindah tempat.
  */
  const posisiQuran = bacaQuran && status === 'lulus' && input.quran.surat_id !== null
    ? (() => {
        const p = posisiLanjut(input.quran, totalAyat)
        return {
          current_quran_halaman: p.halaman,
          current_quran_surat_id: p.surat_id,
          current_quran_ayat: p.ayat,
        }
      })()
    : {}

  await supabase
    .from('students')
    .update({
      ...posisi,
      ...posisiQuran,
      ...(masukDrill ? { tahsin_drill_sejak: input.setoran_date } : {}),
    })
    .eq('id', studentId)

  return null
}

function segarkanSetoran(studentIds: string[]) {
  revalidatePath('/guru/siswa')
  for (const id of studentIds) revalidatePath(`/guru/siswa/${id}`)
  revalidatePath('/guru')
}

/** Jawaban formulir setor satu-satu; sukses tidak menjawab, melainkan redirect. */
export interface HasilSetoranSatu {
  error?: string
  ganda?: SetoranGanda
}

export async function createTahsinLogAction(_: unknown, formData: FormData): Promise<HasilSetoranSatu> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const studentId = formData.get('student_id') as string
  if (!studentId) return { error: 'Siswa belum dipilih.' }

  const galat = await simpanSetoranTahsin(session.teacherId, {
    student_id: studentId,
    method_id: (formData.get('method_id') as string) || null,
    jilid_id: (formData.get('jilid_id') as string) || null,
    halaman: readInt(formData, 'halaman'),
    quran: {
      halaman: readInt(formData, 'quran_halaman'),
      surat_id: readInt(formData, 'quran_surat_id'),
      ayat_dari: readInt(formData, 'quran_ayat_dari'),
      ayat_ke: readInt(formData, 'quran_ayat_ke'),
    },
    // Dua nama medan, bukan satu medan berisi JSON: kotak centang biasa
    // sudah menghasilkan bentuk ini sendiri, dan JSON di dalam FormData
    // menambah satu lapis yang bisa gagal diurai tanpa pesan yang berguna.
    materi: [
      ...formData.getAll('materi_lulus').map(id  => ({ materi_id: String(id), hasil: 'lulus'  as const })),
      ...formData.getAll('materi_lanjut').map(id => ({ materi_id: String(id), hasil: 'lanjut' as const })),
      ...formData.getAll('materi_ulang').map(id  => ({ materi_id: String(id), hasil: 'ulang'  as const })),
    ],
    nilai_tahsin: readScore(formData, 'nilai_tahsin'),
    nilai_sikap: readScore(formData, 'nilai_sikap'),
    status: ((formData.get('status') as string) || 'lulus') as TahsinStatus,
    catatan: ((formData.get('catatan') as string) || '').trim() || null,
    setoran_date: (formData.get('setoran_date') as string) || new Date().toISOString().slice(0, 10),
    timpa: formData.get('timpa') === '1',
  })
  if (typeof galat === 'string') return { error: galat }
  if (galat) return { ganda: galat.ganda }

  segarkanSetoran([studentId])
  redirect(`/guru/siswa/${studentId}?setoran=ok`)
}

export interface HasilSetoranSesi {
  tersimpan: number
  /** Per anak yang gagal: nama + alasannya, supaya bisa dibetulkan satu per satu. */
  gagal: { student_id: string; pesan: string; ganda?: SetoranGanda }[]
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
    if (typeof galat === 'string') gagal.push({ student_id: b.student_id, pesan: galat })
    else if (galat) gagal.push({ student_id: b.student_id, pesan: 'Sudah ada setoran di hari ini.', ganda: galat.ganda })
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
  /** Lihat InputSetoranTahsin.timpa. */
  timpa?: boolean
}

const JENIS_SETORAN_TAHFIDZ: TahfidzKind[] = ['ziyadah', 'murojaah_baru', 'murojaah_lama']

async function simpanSetoranTahfidz(teacherId: string, input: InputSetoranTahfidz): Promise<HasilSimpan> {
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

  // Satu setoran per jenis per hari — lihat lib/data/setoran-ganda.ts.
  let arsipIds: string[] = []
  if (!input.timpa) {
    const ganda = await periksaGandaTahfidz(supabase, studentId, input.setoran_date, {
      kind: input.kind, surat_id: suratId, ayat_dari: ayatDari, ayat_ke: ayatKe,
      nilai: input.nilai_tahfidz, sikap: input.nilai_sikap, catatan: input.catatan,
    })
    if (ganda) return { ganda }
  } else {
    const hasil = await arsipkanTahfidzSamaHari(supabase, teacherId, studentId, input.setoran_date, input.kind)
    if ('galat' in hasil) return hasil.galat
    arsipIds = hasil.arsipIds
  }

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
  if (logRow?.id) await tautkanPengganti(supabase, arsipIds, logRow.id as string)

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

export async function createTahfidzLogAction(_: unknown, formData: FormData): Promise<HasilSetoranSatu> {
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
    timpa: formData.get('timpa') === '1',
  })
  if (typeof galat === 'string') return { error: galat }
  if (galat) return { ganda: galat.ganda }

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
    if (typeof galat === 'string') gagal.push({ student_id: b.student_id, pesan: galat })
    else if (galat) gagal.push({ student_id: b.student_id, pesan: 'Sudah ada setoran di hari ini.', ganda: galat.ganda })
    else tersimpan++
  }

  segarkanSetoran(baris.map(b => b.student_id))
  return { tersimpan, gagal }
}
