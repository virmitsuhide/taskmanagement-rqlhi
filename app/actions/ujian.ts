'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageUjian, canSubmitUjian, getUjianUnits } from '@/lib/auth/permissions'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { cocokkanLevelUjian, type TahapLevel } from '@/lib/rq/ujian'
import { getTeacherHalaqohIds, getTeacherStudents } from '@/lib/data/teacher'
import { totalJuzHafalan } from '@/lib/rq/hafalan'
import type {
  TahfidzTipe,
  UjianPredikat,
  UjianSiswa,
  UjianStatus,
  UjianUnit,
} from '@/types'

type Result = {
  error?: string
  success?: boolean
  /** Tersimpan, tapi ada bagian yang perlu ditindaklanjuti manusia. */
  warning?: string
}

/**
 * Halaman yang perlu disegarkan setiap pengajuan berubah.
 *
 * Antrian publik dan rekap ikut di sini karena keduanya di-cache; tanpa ini
 * pengunjung masih melihat antrian lama sampai revalidate berikutnya.
 */
function segarkan() {
  revalidatePath('/ujian')
  revalidatePath('/ujian/rekap')
  revalidatePath('/ujian/kelola')
  revalidatePath('/ujian/riwayat')
  revalidatePath('/guru/ujian')
}

// ─── Penjagaan ───────────────────────────────────────────────────────────────

interface Pengaju {
  unit: UjianUnit
  teacherId: string | null
  userId: string | null
}

/**
 * Siapa yang mengajukan, dan untuk unit mana.
 *
 * Unit TIDAK pernah diambil dari form untuk jalur guru — ia dibaca dari data
 * kepegawaian guru itu. Kalau ikut form, seorang guru SD bisa menyisipkan
 * pengajuan ke antrian SMP hanya dengan mengubah kiriman di peramban.
 *
 * Untuk pengurus, unit memang datang dari form (kepala & kumik memegang dua
 * unit sekaligus), tapi diperiksa balik ke wewenang role-nya.
 */
async function guardPengaju(unitDiminta?: UjianUnit): Promise<Pengaju | { error: string }> {
  const guru = await getTeacherSession()
  if (guru) {
    const unit = await getUnitUjianGuru(guru.teacherId)
    if (!unit) {
      return { error: 'Akun Anda belum punya unit SD/SMP, jadi belum bisa mengajukan ujian. Hubungi koordinator.' }
    }
    return { unit, teacherId: guru.teacherId, userId: null }
  }

  const pengurus = await getSession()
  if (pengurus && canSubmitUjian(pengurus.role)) {
    const units = getUjianUnits(pengurus.role)
    const unit = unitDiminta && units.includes(unitDiminta) ? unitDiminta : units[0]
    if (!unit) return { error: 'Anda tidak berwenang mengajukan ujian.' }
    return { unit, teacherId: null, userId: pengurus.userId }
  }

  return { error: 'Sesi tidak valid atau tidak memiliki izin.' }
}

/**
 * Boleh menjadwalkan/menilai/menghapus baris ini?
 *
 * Unit dibaca ulang dari database, bukan dari kiriman: id pengajuan datang
 * dari peramban, dan hanya baris aslinya yang tahu ia milik unit mana.
 */
async function guardPengelola(
  table: 'ujian_tahfidz' | 'ujian_tahsin',
  id: string,
): Promise<{ unit: UjianUnit } | { error: string }> {
  if (!id) return { error: 'Pengajuan tidak dikenali.' }

  const pengurus = await getSession()
  if (!pengurus) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data } = await supabase.from(table).select('unit').eq('id', id).maybeSingle()
  if (!data) return { error: 'Pengajuan tidak ditemukan.' }

  const unit = data.unit as UjianUnit
  if (!canManageUjian(pengurus.role, unit)) {
    return { error: `Anda tidak berwenang mengelola antrian unit ${unit}.` }
  }
  return { unit }
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

/** Kode program QULS: 'quls', 'quls_takhassus', 'fullday_quls', 'boarding_quls'. */
function programQuls(program: string | null | undefined): boolean {
  return Boolean(program && program.includes('quls'))
}

/**
 * Apakah anak ini QULS — menurut programnya sendiri, atau program halaqohnya.
 *
 * Halaqoh ikut dibaca karena di SMP program jarang diisi per anak, sedangkan
 * kelompoknya sudah jelas: seluruh anak di halaqoh QULS memang QULS. Menandai
 * satu halaqoh jauh lebih ringan daripada mengisi program puluhan anak.
 */
async function siswaQuls(studentId: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select('program, halaqoh:halaqoh!students_halaqoh_id_fkey(program)')
    .eq('id', studentId)
    .maybeSingle()
  const row = data as { program: string | null; halaqoh: { program: string | null } | null } | null
  return programQuls(row?.program) || programQuls(row?.halaqoh?.program)
}

export async function createTahfidzUjianAction(input: {
  tipe: TahfidzTipe
  juz: string
  /** Siswa terpilih dari saran. null hanya untuk anak yang belum terdaftar. */
  student_id: string | null
  nama_siswa: string
  nama_flyer: string
  kelas: string
  is_quls: boolean
  unit?: UjianUnit
}): Promise<Result> {

  const pengaju = await guardPengaju(input.unit)
  if ('error' in pengaju) return pengaju

  const juz = input.juz.trim()
  const namaSiswa = input.nama_siswa.trim()
  const namaFlyer = input.nama_flyer.trim()
  const kelas = input.kelas.trim()

  if (!juz) return { error: 'Nomor atau rentang juz wajib diisi.' }
  if (!namaSiswa) return { error: 'Nama siswa wajib diisi.' }
  if (!namaFlyer) return { error: 'Nama untuk flyer wajib diisi.' }
  if (!kelas) return { error: 'Kelas wajib diisi.' }

  try {
    const supabase = createServerClient()

    // Anak dari halaqoh/program QULS selalu tercatat QULS, apa pun centangan
    // di form — supaya format WhatsApp setelah ujian tidak bergantung pada
    // ingatan pengaju. Centang manual tetap berlaku untuk anak di luar itu.
    const isQuls = input.is_quls || (input.student_id ? await siswaQuls(input.student_id) : false)

    const { error } = await supabase.from('ujian_tahfidz').insert({
      unit: pengaju.unit,
      tipe: input.tipe,
      juz,
      student_id: input.student_id,
      nama_siswa: namaSiswa,
      nama_flyer: namaFlyer,
      kelas,
      is_quls: isQuls,
      status: 'diajukan',
      created_by_teacher: pengaju.teacherId,
      created_by_user: pengaju.userId,
    })
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan pengajuan.' }
  }

  segarkan()
  return { success: true }
}

export async function updateTahfidzUjianAction(
  id: string,
  data: {
    jadwal?: string | null
    penguji?: string | null
    predikat?: UjianPredikat | null
    catatan?: string | null
    nama_flyer?: string
    status?: UjianStatus
    is_quls?: boolean
  },
): Promise<Result> {
  const guard = await guardPengelola('ujian_tahfidz', id)
  if ('error' in guard) return guard

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahfidz').update(data).eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan perubahan.' }
  }

  segarkan()
  return { success: true }
}

export async function deleteTahfidzUjianAction(id: string): Promise<Result> {
  const izin = await guardHapus('ujian_tahfidz', id)
  if ('error' in izin) return izin

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahfidz').delete().eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghapus pengajuan.' }
  }

  segarkan()
  return { success: true }
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

export async function createTahsinUjianAction(input: {
  nama_kelompok: string
  sesi: string
  level: string
  siswa: UjianSiswa[]
  unit?: UjianUnit
}): Promise<Result> {
  const pengaju = await guardPengaju(input.unit)
  if ('error' in pengaju) return pengaju

  const namaKelompok = input.nama_kelompok.trim()
  const sesi = input.sesi.trim()
  const siswa = input.siswa
    .map(s => ({
      nama: s.nama.trim(),
      predikat: null,
      level: s.level?.trim() || undefined,
      // Tautan ke students — inilah yang membuat kelulusan bisa menaikkan
      // jilid anaknya nanti. Pengajuan lama tanpa id tetap diterima.
      student_id: s.student_id ?? null,
      kelas: s.kelas ?? null,
    }))
    .filter(s => s.nama)

  if (!namaKelompok) return { error: 'Nama kelompok wajib diisi.' }
  if (!sesi) return { error: 'Sesi wajib diisi.' }
  if (siswa.length === 0) return { error: 'Tambahkan minimal satu siswa.' }

  // Id siswa datang dari peramban. Formulir guru memang hanya menawarkan anak
  // halaqohnya, tapi kiriman bisa diubah — jadi diperiksa ulang di sini.
  if (pengaju.teacherId) {
    const milik = new Set((await getTeacherStudents(pengaju.teacherId)).map(s => s.id))
    if (siswa.some(s => s.student_id && !milik.has(s.student_id))) {
      return { error: 'Ada siswa yang bukan dari halaqoh Anda.' }
    }
  }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahsin').insert({
      unit: pengaju.unit,
      nama_kelompok: namaKelompok,
      sesi,
      level: input.level.trim(),
      siswa,
      status: 'diajukan',
      created_by_teacher: pengaju.teacherId,
      created_by_user: pengaju.userId,
    })
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan pengajuan.' }
  }

  segarkan()
  return { success: true }
}

export async function updateTahsinUjianAction(
  id: string,
  data: {
    jadwal?: string | null
    penguji?: string | null
    siswa?: UjianSiswa[]
    catatan?: string | null
    status?: UjianStatus
  },
): Promise<Result> {
  const guard = await guardPengelola('ujian_tahsin', id)
  if ('error' in guard) return guard

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahsin').update(data).eq('id', id)
    if (error) return { error: error.message }

    // Baru setelah barisnya tersimpan: kelulusan diteruskan ke capaian anak.
    // Urutannya penting — kalau penyimpanan gagal, tidak boleh ada anak yang
    // sudah terlanjur dinaikkan atas ujian yang tidak tercatat.
    if (data.status === 'selesai') {
      const tidakCocok = await terapkanKelulusanTahsin(id)
      if (tidakCocok.length > 0) {
        /*
          Dilaporkan sebagai PERINGATAN, bukan galat: ujiannya sendiri sudah
          tersimpan dengan benar dan tidak boleh dibatalkan karenanya. Yang
          gagal hanya penerusan capaian untuk sebagian anak, dan koordinator
          perlu tahu siapa — kalau didiamkan, anak-anak itu tertinggal di
          jilid lama tanpa seorang pun menyadarinya.
        */
        segarkan()
        return {
          success: true,
          warning:
            `Ujian tersimpan, tapi capaian ${tidakCocok.length} anak belum bisa dinaikkan — ` +
            `level ujiannya tidak ada di metode tahsin mereka: ${tidakCocok.join(', ')}.`,
        }
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan perubahan.' }
  }

  segarkan()
  return { success: true }
}

/**
 * Teruskan hasil ujian tahsin ke capaian siswa.
 *
 * MASALAH YANG DISELESAIKAN
 *
 * Sebelum ini ujian berhenti sebagai catatan: seorang anak lulus Jilid 3,
 * barisnya rapi, tapi students.current_jilid_id tidak bergerak. Analitik
 * tetap menghitungnya belum naik, dan satu-satunya jalan capaian masuk ke
 * sistem adalah centang "naik jilid" di setoran harian — dikerjakan orang
 * lain pada waktu lain, dan karenanya sering tidak dikerjakan.
 *
 * YANG DILAKUKAN, DAN YANG SENGAJA TIDAK
 *
 * Anak yang predikatnya 'lulus' dinaikkan ke tahap berikutnya dalam metode
 * yang sedang ia jalani, persis seperti centang "naik jilid": satu baris di
 * jilid_promotions, lalu current_jilid_id berpindah dan halamannya kembali
 * ke 1. Yang predikatnya 'mengulang' atau belum dinilai tidak disentuh sama
 * sekali.
 *
 * Anak tanpa student_id — pengajuan lama yang namanya diketik bebas — juga
 * dilewati. Menebak siapa yang dimaksud dari sebuah nama berarti berisiko
 * menaikkan anak yang keliru, dan kekeliruan seperti itu baru ketahuan
 * berbulan-bulan kemudian lewat rapor yang tidak masuk akal.
 *
 * TIDAK BISA MENAIKKAN DUA KALI
 *
 * Koordinator lazim menyimpan ulang baris yang sama — meralat predikat
 * seorang anak, lalu menyimpan lagi. Tanpa penjagaan, tiap penyimpanan akan
 * menaikkan satu jilid lagi. Indeks unik (student_id, source_ujian_id) di
 * migrasi 0062 membuat itu mustahil, dan di sini kegagalannya diabaikan
 * dengan tenang: "sudah pernah dinaikkan" bukan galat yang perlu dilaporkan.
 */
async function terapkanKelulusanTahsin(ujianId: string): Promise<string[]> {
  const supabase = createServerClient()
  /** Anak yang level ujiannya tidak punya padanan di metodenya. */
  const tidakCocok: string[] = []

  const { data: ujian } = await supabase
    .from('ujian_tahsin')
    .select('id, siswa, level')
    .eq('id', ujianId)
    .maybeSingle()
  if (!ujian) return tidakCocok

  const ujianLevel = (ujian.level ?? '') as string
  const daftar = (ujian.siswa ?? []) as UjianSiswa[]
  const lulus = daftar.filter(s => s.predikat === 'lulus' && s.student_id)
  if (lulus.length === 0) return tidakCocok

  const { data: siswaRows } = await supabase
    .from('students')
    .select('id, current_method_id, current_jilid_id')
    .in('id', lulus.map(s => s.student_id as string))

  const posisi = new Map(
    ((siswaRows ?? []) as {
      id: string; current_method_id: string | null; current_jilid_id: string | null
    }[]).map(s => [s.id, s]),
  )


  for (const anak of lulus) {
    const s = posisi.get(anak.student_id as string)
    if (!s?.current_method_id) continue

    const { data: tahapanRows } = await supabase
      .from('jilid_levels')
      .select('id, label, order_num, is_quran')
      .eq('method_id', s.current_method_id)
      .order('order_num')
    const tahapan = (tahapanRows ?? []) as TahapLevel[]
    if (tahapan.length === 0) continue

    /*
      LEVEL UJIAN YANG MENENTUKAN, BUKAN POSISI TERCATAT.

      Yang dibuktikan anak di ruang ujian adalah level yang diujikan. Kalau
      kenaikan diturunkan dari current_jilid_id, seorang anak yang posisinya
      tertinggal — lazim terjadi, sebab setoran harian tidak selalu dicatat —
      akan naik ke jilid yang keliru meski ia baru saja lulus jilid yang
      lebih tinggi.
    */
    const levelUjian = (anak.level ?? ujianLevel ?? '').trim()
    const diuji = cocokkanLevelUjian(tahapan, levelUjian)
    if (!diuji) {
      // Level ujian tidak punya padanan di metode anak ini — misal ujian
      // "Jilid 6" untuk anak Syajaroh yang jilidnya hanya sampai 5. Ditinggal
      // apa adanya, bukan ditebak: menebak berarti memindahkan anak ke tahap
      // yang tidak pernah ia tempuh.
      tidakCocok.push(`${anak.nama} (level "${levelUjian || '—'}")`)
      continue
    }

    const berikutnya = tahapan.find(t => t.order_num > diuji.order_num)
    // Sudah di tahap terakhir metode ini — tidak ada ke mana lagi ia naik.
    if (!berikutnya) continue

    const { error: gagalNaik } = await supabase.from('jilid_promotions').insert({
      student_id: s.id,
      from_jilid_id: diuji.id,
      to_jilid_id: berikutnya.id,
      promotion_date: new Date().toISOString().slice(0, 10),
      catatan: `Lulus ujian tahsin ${diuji.label}`,
      source_ujian_id: ujianId,
    })
    // Bentrok indeks unik = anak ini sudah dinaikkan oleh ujian yang sama.
    if (gagalNaik) continue

    /*
      KENAIKAN TIDAK PERNAH MEMUNDURKAN.

      "Level ujian yang menang" berlaku untuk menentukan DARI MANA ia naik,
      bukan untuk menarik kembali anak yang sudah lebih jauh. Anak yang
      posisinya sudah di Jilid 5 lalu lulus ujian Jilid 3 — susulan, atau
      ujian yang baru sempat dinilai — tetap di Jilid 5; barisan
      jilid_promotions-nya tetap mencatat kelulusan itu sebagai fakta, tapi
      posisinya tidak diturunkan. Memundurkan anak berarti menghapus setoran
      berbulan-bulan dari layar guru yang mengampunya.
    */
    const sekarang = s.current_jilid_id
      ? tahapan.find(t => t.id === s.current_jilid_id)
      : null
    if (sekarang && sekarang.order_num >= berikutnya.order_num) continue

    await supabase
      .from('students')
      .update({ current_jilid_id: berikutnya.id, current_jilid_page: 1 })
      .eq('id', s.id)
  }

  return tidakCocok
}

export async function deleteTahsinUjianAction(id: string): Promise<Result> {
  const izin = await guardHapus('ujian_tahsin', id)
  if ('error' in izin) return izin

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('ujian_tahsin').delete().eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghapus pengajuan.' }
  }

  segarkan()
  return { success: true }
}

/**
 * Boleh menghapus pengajuan ini?
 *
 * Dua jalur. Koordinator unitnya boleh kapan saja — itu wewenang pengelolaan
 * biasa. Guru hanya boleh menarik pengajuannya SENDIRI dan hanya selagi masih
 * berstatus 'diajukan': begitu koordinator menjadwalkannya, jadwal itu sudah
 * jadi kesepakatan dengan penguji dan tidak boleh hilang sepihak.
 */
async function guardHapus(
  table: 'ujian_tahfidz' | 'ujian_tahsin',
  id: string,
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: 'Pengajuan tidak dikenali.' }

  const supabase = createServerClient()
  const { data } = await supabase
    .from(table)
    .select('unit, status, created_by_teacher')
    .eq('id', id)
    .maybeSingle()
  if (!data) return { error: 'Pengajuan tidak ditemukan.' }

  const guru = await getTeacherSession()
  if (guru) {
    if (data.created_by_teacher !== guru.teacherId) {
      return { error: 'Anda hanya bisa menarik pengajuan yang Anda buat sendiri.' }
    }
    if (data.status !== 'diajukan') {
      return { error: 'Pengajuan yang sudah dijadwalkan hanya bisa dibatalkan koordinator.' }
    }
    return { ok: true }
  }

  const pengurus = await getSession()
  if (pengurus && canManageUjian(pengurus.role, data.unit as UjianUnit)) return { ok: true }

  return { error: 'Anda tidak berwenang menghapus pengajuan ini.' }
}

// ─── Daftar penguji ──────────────────────────────────────────────────────────

async function guardPenguji(): Promise<{ ok: true } | { error: string }> {
  const pengurus = await getSession()
  if (!pengurus || getUjianUnits(pengurus.role).length === 0) {
    return { error: 'Anda tidak berwenang mengelola daftar penguji.' }
  }
  return { ok: true }
}

/**
 * Menambah penguji dari guru yang sudah terdaftar (0054).
 *
 * Menerima id guru, BUKAN nama yang diketik. Sebelas entri pertama daftar ini
 * lahir dari kolom teks bebas, dan hasilnya panggilan sehari-hari yang tidak
 * pernah bisa dicocokkan kembali dengan akun mana pun — termasuk dua yang
 * cocok dengan lebih dari satu guru sekaligus. Salah ketik satu huruf dulu
 * melahirkan penguji baru yang sah tanpa ada yang memberi tahu.
 *
 * Namanya disalin dari full_name saat penambahan, bukan dibaca ulang tiap
 * kali ditampilkan: nama itu yang akan tercetak di rapor ujian, dan rapor
 * lama tidak boleh ikut berubah ketika gelar seorang guru bertambah.
 */
export async function createPengujiAction(teacherId: string): Promise<Result> {
  const izin = await guardPenguji()
  if ('error' in izin) return izin

  if (!teacherId) return { error: 'Pilih dulu gurunya dari daftar.' }

  try {
    const supabase = createServerClient()

    const { data: guru } = await supabase
      .from('teachers')
      .select('full_name')
      .eq('id', teacherId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!guru) return { error: 'Guru itu tidak ditemukan.' }

    const { error } = await supabase
      .from('ujian_pengujis')
      .insert({ nama: (guru.full_name as string).trim(), teacher_id: teacherId })

    if (error) {
      // 23505 = unique_violation — bisa dari nama yang kembar dengan entri
      // warisan, bisa dari guru yang sudah terdaftar lewat indeks teacher_id.
      if (error.code === '23505') return { error: 'Guru itu sudah ada di daftar penguji.' }
      if (error.message.includes('teacher_id')) {
        return { error: 'Penautan penguji belum aktif: jalankan drizzle/0054_kategori_unit_lain_dan_penguji_guru_PASTE_TO_SUPABASE.sql di Supabase.' }
      }
      return { error: error.message }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menambah penguji.' }
  }

  revalidatePath('/ujian/penguji')
  revalidatePath('/ujian/kelola')
  return { success: true }
}

export async function deletePengujiAction(id: string): Promise<Result> {
  const izin = await guardPenguji()
  if ('error' in izin) return izin

  try {
    const supabase = createServerClient()
    // Ujian lampau menyimpan nama penguji sebagai teks, bukan id, jadi
    // menghapus dari daftar tidak menghilangkan jejaknya di riwayat.
    const { error } = await supabase.from('ujian_pengujis').delete().eq('id', id)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghapus penguji.' }
  }

  revalidatePath('/ujian/penguji')
  revalidatePath('/ujian/kelola')
  return { success: true }
}

// ─── Badge "pengajuan baru" ──────────────────────────────────────────────────

/** Tandai antrian sudah dilihat — dipanggil saat halaman kelola dibuka. */
export async function markUjianSeenAction(): Promise<void> {
  const pengurus = await getSession()
  if (!pengurus || getUjianUnits(pengurus.role).length === 0) return

  try {
    const supabase = createServerClient()
    await supabase
      .from('users')
      .update({ ujian_seen_at: new Date().toISOString() })
      .eq('id', pengurus.userId)
  } catch {
    // Penanda badge, bukan data inti — gagal menyimpannya tidak perlu
    // menggagalkan halaman yang sedang dibuka.
  }
}

/**
 * Guru sudah melihat kabar pengajuannya — lencana ujian di portal guru padam.
 *
 * Dipanggil dari halaman Pengajuan Ujian dan beranda (tempat progres anak
 * tampil), bukan dari lonceng: di dua layar itulah jadwal dan hasilnya
 * benar-benar terbaca.
 */
export async function tandaiNotifUjianGuruDilihatAction(): Promise<void> {
  const guru = await getTeacherSession()
  if (!guru) return

  try {
    const supabase = createServerClient()
    const { error } = await supabase
      .from('teachers')
      .update({ ujian_notif_seen_at: new Date().toISOString() })
      .eq('id', guru.teacherId)
    // Kolom belum ada (0063 belum dijalankan): cukup lencananya yang tidak padam.
    if (!error) revalidatePath('/guru', 'layout')
  } catch {
    // Sama seperti markUjianSeenAction — penanda lencana, bukan data inti.
  }
}

// ─── Saran siswa untuk form pengajuan ────────────────────────────────────────

export interface SaranSiswa {
  id: string
  full_name: string
  kelas: string | null
  /** Program siswa; dipakai mencentang QULS otomatis. */
  program: string | null
  /** Posisi juz terjauh yang sudah tercatat. 0 = belum pernah ujian. */
  sudahSampai: number
}

/**
 * Mencari siswa untuk saran nama di form pengajuan.
 *
 * Unit ujian dipetakan ke jenjang, jadi pengaju SD tidak pernah melihat anak
 * SMP — bukan sekadar merapikan daftar, tapi supaya nama anak unit lain tidak
 * bocor ke koordinator yang tidak mengurusnya.
 *
 * Capaian juz ikut dibawa pulang sekalian. Memisahkannya jadi permintaan
 * kedua berarti daftar juz baru menyempit setelah nama dipilih, dan sekejap
 * di antaranya pengaju sempat melihat juz yang sebenarnya sudah lewat.
 */
export async function cariSiswaUjianAction(
  unit: UjianUnit,
  kueri: string,
): Promise<SaranSiswa[]> {
  const pengaju = await guardPengaju(unit)
  if ('error' in pengaju) return []

  const q = kueri.trim()
  if (q.length < 2) return []

  const supabase = createServerClient()
  // 'SD' mencakup SD reguler dan SD Juara; keduanya diuji di antrean yang sama.
  const jenjang = pengaju.unit === 'SD' ? ['sd', 'sd_juara'] : ['smp']

  /*
    GURU HANYA BOLEH MENGAJUKAN ANAK HALAQOHNYA SENDIRI.

    Sebelum ini pencarian menjangkau seluruh siswa satu unit — 493 anak untuk
    SD — sehingga seorang guru bisa mengajukan anak yang tidak pernah ia
    ampu, biasanya karena namanya mirip. Salah ajukan seperti itu baru
    ketahuan di hari ujian, saat anaknya tidak tahu ia terdaftar.

    Pengurus (koordinator, kumik) tidak dibatasi: mereka memang mengajukan
    lintas halaqoh, dan itulah sebabnya cabangnya dipisah di sini alih-alih
    menyaring semua orang dengan aturan yang sama.
  */
  let idHalaqoh: string[] | null = null
  if (pengaju.teacherId) {
    const milik = await getTeacherStudents(pengaju.teacherId)
    if (milik.length === 0) return []
    idHalaqoh = milik.map(s => s.id)
  }

  let kueriSiswa = supabase
    .from('students')
    .select('id, full_name, kelas, program, halaqoh:halaqoh!students_halaqoh_id_fkey(program)')
    .in('jenjang', jenjang)
    .eq('is_active', true)
    .ilike('full_name', `%${q}%`)
  if (idHalaqoh) kueriSiswa = kueriSiswa.in('id', idHalaqoh)

  const { data: siswa } = await kueriSiswa.order('full_name').limit(8)

  if (!siswa || siswa.length === 0) return []

  const { data: ujian } = await supabase
    .from('ujian_tahfidz')
    .select('student_id, juz')
    .in('student_id', siswa.map(s => s.id))

  const perSiswa = new Map<string, string[]>()
  for (const u of ujian ?? []) {
    if (!u.student_id) continue
    const daftar = perSiswa.get(u.student_id) ?? []
    daftar.push(String(u.juz))
    perSiswa.set(u.student_id, daftar)
  }

  return (siswa as unknown as Array<{
    id: string; full_name: string; kelas: string | null; program: string | null
    halaqoh: { program: string | null } | null
  }>).map(s => ({
    id: s.id,
    full_name: s.full_name,
    kelas: s.kelas,
    // Program halaqoh jadi cadangan — lihat siswaQuls. Dengan ini centang
    // QULS di form sudah benar sebelum pengaju sempat menyentuhnya.
    program: s.program ?? s.halaqoh?.program ?? null,
    sudahSampai: totalJuzHafalan(perSiswa.get(s.id) ?? []),
  }))
}

// ─── Pilihan ustadz → sesi → siswa untuk pengajuan tahsin ────────────────────

export interface SiswaHalaqoh {
  id: string
  full_name: string
  kelas: string | null
  /** Label jilid berjalan, mis. "Jilid 3" — penanda saat memilih level. */
  jilid: string | null
}

export interface HalaqohSesi {
  id: string
  sesi: number
  /** Ringkasan kelas anak di halaqoh ini, mis. "Kelas 4" atau "Kelas 5–6". */
  kelas: string
  siswa: SiswaHalaqoh[]
}

export interface UstadzHalaqoh {
  teacherId: string
  /** Sapaan yang tercantum di antrian, mis. "Ustadzah Afifah". */
  nama: string
  halaqoh: HalaqohSesi[]
}

/**
 * "Sesi 1 — Ustadzah Afifah" → "Ustadzah Afifah"; selain pola itu, null.
 * Keterangan program di akhir ("Usth. Dhea (QULS)") dibuang — itu sifat
 * halaqohnya, bukan bagian dari nama yang tampil di antrian.
 */
function sapaanDariNamaHalaqoh(nama: string): string | null {
  const bagian = nama.split(/\s+[—–-]\s+/)
  if (bagian.length < 2) return null
  return bagian.slice(1).join(' — ').replace(/\s*\([^)]*\)\s*$/, '').trim() || null
}

function ringkasKelas(daftar: (string | null)[]): string {
  const tingkat = [...new Set(
    daftar.map(k => k?.match(/^\d+/)?.[0]).filter((t): t is string => Boolean(t)).map(Number),
  )].sort((a, b) => a - b)
  if (tingkat.length === 0) return 'Kelas belum tercatat'
  if (tingkat.length === 1) return `Kelas ${tingkat[0]}`
  return `Kelas ${tingkat[0]}–${tingkat[tingkat.length - 1]}`
}

/**
 * Semua halaqoh aktif unit ini, dikelompokkan per ustadz lalu per sesi.
 *
 * Satu kali muat untuk seluruh formulir: tiap halaqoh hanya berisi sekitar
 * sepuluh anak, jadi memilih ustadz dan sesi cukup menyaring di peramban —
 * tidak perlu bolak-balik ke server setiap pilihan berubah.
 *
 * Guru hanya menerima halaqohnya sendiri, dengan alasan yang sama seperti
 * cariSiswaUjianAction: yang boleh diajukan guru hanyalah anak asuhannya.
 */
export async function daftarHalaqohUjianTahsinAction(unit: UjianUnit): Promise<UstadzHalaqoh[]> {
  const pengaju = await guardPengaju(unit)
  if ('error' in pengaju) return []

  const supabase = createServerClient()
  const jenjang = pengaju.unit === 'SD' ? ['sd', 'sd_juara'] : ['smp']

  let kueri = supabase
    .from('halaqoh')
    .select('id, name, sesi, wali_teacher_id, halaqoh_teachers(teacher_id)')
    .in('jenjang', jenjang)
    .eq('is_active', true)
    .order('sesi')
  if (pengaju.teacherId) {
    const milik = await getTeacherHalaqohIds(pengaju.teacherId)
    if (milik.length === 0) return []
    kueri = kueri.in('id', milik)
  }
  const { data: halaqoh } = await kueri
  if (!halaqoh || halaqoh.length === 0) return []

  const halaqohIds = halaqoh.map(h => h.id)
  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas, halaqoh_id, current_jilid:jilid_levels!students_current_jilid_id_fkey(label)')
    .in('halaqoh_id', halaqohIds)
    .eq('is_active', true)
    .order('full_name')

  const siswaPerHalaqoh = new Map<string, SiswaHalaqoh[]>()
  for (const s of (siswa ?? []) as unknown as Array<{
    id: string; full_name: string; kelas: string | null; halaqoh_id: string
    current_jilid: { label: string } | null
  }>) {
    const daftar = siswaPerHalaqoh.get(s.halaqoh_id) ?? []
    daftar.push({ id: s.id, full_name: s.full_name, kelas: s.kelas, jilid: s.current_jilid?.label ?? null })
    siswaPerHalaqoh.set(s.halaqoh_id, daftar)
  }

  // Pengampu = wali halaqoh + anggota halaqoh_teachers, sama seperti
  // getTeacherHalaqohIds. Guru pendamping ikut tampil karena ia juga bisa
  // menjadi nama kelompok yang dikenal anak-anaknya.
  const perGuru = new Map<string, { sapaan: string | null; halaqoh: HalaqohSesi[] }>()
  for (const h of halaqoh as unknown as Array<{
    id: string; name: string; sesi: number | null; wali_teacher_id: string | null
    halaqoh_teachers: { teacher_id: string }[] | null
  }>) {
    const pengampu = new Set<string>()
    if (h.wali_teacher_id) pengampu.add(h.wali_teacher_id)
    for (const ht of h.halaqoh_teachers ?? []) pengampu.add(ht.teacher_id)
    if (pengaju.teacherId && !pengampu.has(pengaju.teacherId)) continue

    const anak = siswaPerHalaqoh.get(h.id) ?? []
    const baris: HalaqohSesi = { id: h.id, sesi: h.sesi ?? 0, kelas: ringkasKelas(anak.map(a => a.kelas)), siswa: anak }
    for (const tid of pengampu) {
      if (pengaju.teacherId && tid !== pengaju.teacherId) continue
      const entri = perGuru.get(tid) ?? { sapaan: null, halaqoh: [] }
      // Sapaan diambil dari halaqoh yang diwalinya — nama halaqoh memakai
      // panggilan wali, bukan panggilan guru pendamping.
      if (!entri.sapaan && h.wali_teacher_id === tid) entri.sapaan = sapaanDariNamaHalaqoh(h.name)
      entri.halaqoh.push(baris)
      perGuru.set(tid, entri)
    }
  }
  if (perGuru.size === 0) return []

  const { data: guru } = await supabase
    .from('teachers')
    .select('id, full_name')
    .in('id', [...perGuru.keys()])
  const namaLengkap = new Map((guru ?? []).map(g => [g.id as string, g.full_name as string]))

  return [...perGuru.entries()]
    .map(([teacherId, e]) => ({
      teacherId,
      nama: e.sapaan ?? namaLengkap.get(teacherId) ?? 'Tanpa nama',
      halaqoh: e.halaqoh.sort((a, b) => a.sesi - b.sesi),
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

// ─── Pemetaan catatan lama ke siswa ──────────────────────────────────────────

/**
 * Memasangkan catatan ujian lama ke siswa.
 *
 * 36 dari 38 catatan yang ada dibuat sebelum ada tautan ke siswa, dan namanya
 * sudah tersingkat sehingga tidak bisa dicocokkan otomatis. Pemasangannya
 * dikerjakan manusia yang mengenali anaknya — pencocokan tebak-tebakan atas
 * inisial berisiko menaruh capaian juz pada anak yang keliru, dan salah pasang
 * seperti itu baru ketahuan berbulan-bulan kemudian lewat analitik yang aneh.
 *
 * nama_siswa ikut ditimpa nama lengkap dari data siswa. Nilai lamanya sudah
 * pindah ke nama_flyer lewat migrasi 0059, jadi tidak ada yang hilang.
 */
export async function petakanUjianKeSiswaAction(
  ujianId: string,
  studentId: string,
): Promise<Result> {
  const guard = await guardPengelola('ujian_tahfidz', ujianId)
  if ('error' in guard) return guard

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas')
    .eq('id', studentId)
    .maybeSingle()

  if (!siswa) return { error: 'Siswa tidak ditemukan.' }

  const { error } = await supabase
    .from('ujian_tahfidz')
    .update({
      student_id: siswa.id,
      nama_siswa: siswa.full_name,
      kelas: siswa.kelas ?? '',
    })
    .eq('id', ujianId)

  if (error) return { error: error.message }

  segarkan()
  revalidatePath('/ujian/pemetaan')
  revalidatePath(`/siswa/${siswa.id}`)
  return { success: true }
}

/** Melepas tautan yang terlanjur salah pasang. */
export async function lepasPemetaanUjianAction(ujianId: string): Promise<Result> {
  const guard = await guardPengelola('ujian_tahfidz', ujianId)
  if ('error' in guard) return guard

  const supabase = createServerClient()
  const { error } = await supabase
    .from('ujian_tahfidz')
    .update({ student_id: null })
    .eq('id', ujianId)

  if (error) return { error: error.message }

  segarkan()
  revalidatePath('/ujian/pemetaan')
  return { success: true }
}
