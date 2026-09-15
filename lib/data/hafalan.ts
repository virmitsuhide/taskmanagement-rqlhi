import { createServerClient } from '@/lib/supabase/server'
import { daftarJuzSelesai, juzSelesaiSetoran, juzTerjauh, totalJuzHafalan } from '@/lib/rq/hafalan'

/**
 * Capaian hafalan seorang anak, digabung dari dua sumber yang berbeda sifat.
 *
 * SETORAN (juz_progress) menunjukkan proses yang sedang berjalan: guru
 * mencatat ziyadah tiap pekan, dan juz yang sedang dihafal belum dihitung
 * tuntas. UJIAN (ujian_tahfidz berstatus 'selesai') menunjukkan yang sudah
 * diakui selesai secara resmi, dan juz yang diujikan ikut terhitung.
 *
 * KENAPA PERLU DIGABUNG
 *
 * Sebelum ini analitik tahfidz hanya membaca juz_progress, dan baris itu
 * hanya lahir dari setoran ziyadah. Anak yang masih tercatat di program
 * tahsin tidak pernah punya setoran ziyadah — sehingga hafalannya terbaca
 * NOL walau ia sudah lulus ujian juz 1, yang menurut urutan RQ LHI berarti
 * enam juz. Saat berkas ini ditulis, 27 dari 28 anak yang sudah lulus ujian
 * tidak terlihat sama sekali di analitik hafalan; seluruhnya SMP.
 *
 * Menyelesaikan tahsin memang syarat untuk MENYETOR ziyadah, tapi ia tidak
 * pernah dimaksudkan sebagai syarat untuk PUNYA hafalan. Yang keliru bukan
 * anaknya, melainkan analitik yang menyamakan "tidak ada catatan setoran"
 * dengan "tidak ada hafalan".
 *
 * KENAPA DIGABUNG SAAT DIBACA, BUKAN DITULIS KE juz_progress
 *
 * Menulis hasil ujian ke juz_progress akan membuat seluruh analitik ikut
 * benar tanpa satu pun fungsi diubah — dan itu godaannya. Tapi juz_progress
 * menyimpan `ayat_hafal`, dan catatan ujian tidak punya hitungan ayat sama
 * sekali. Menulisnya berarti mengarang angka ayat, lalu angka karangan itu
 * mengalir ke metrik totalAyatHafal yang dipakai mengurutkan top 10 dan
 * menilai guru. Membatalkan ujian yang keliru juga tidak lagi cukup dengan
 * mengubah statusnya; barisnya harus dicari dan dicabut.
 *
 * Digabung saat dibaca: tidak ada angka yang dikarang, tidak ada yang perlu
 * dibersihkan, dan buku setoran tetap menjadi catatan apa yang benar-benar
 * disetor.
 *
 * YANG SENGAJA TIDAK IKUT DIGABUNG
 *
 * Metrik berbasis ayat — totalAyatHafal dan juzMutqin — tetap murni dari
 * setoran, karena ujian memang tidak mengukur keduanya. Angka juz-lah yang
 * dua sumbernya bisa dibandingkan, sebab keduanya menjawab pertanyaan yang
 * sama: berapa juz yang sudah tuntas.
 */
export interface JuzHafalan {
  /** Juz tuntas menurut setoran harian. */
  setoran: number
  /** Juz tuntas menurut ujian yang sudah selesai. */
  ujian: number
  /** Yang dipakai analitik: mana pun yang lebih jauh. */
  total: number
  /** Sumber yang menentukan angka total — untuk menerangkan asalnya di layar. */
  sumber: 'setoran' | 'ujian' | 'sama' | 'kosong'
}

export interface BarisJuzProgress {
  student_id: string
  juz_number: number
  ayat_hafal: number
  mutqin: boolean
}

/**
 * Juz tuntas menurut ujian yang sudah selesai, per siswa.
 *
 * Hanya status 'selesai': pengajuan yang belum diuji bukan capaian, dan
 * memasukkannya berarti hafalan seorang anak naik hanya karena ia mendaftar.
 */
export async function getJuzUjianPerSiswa(): Promise<Map<string, number>> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('ujian_tahfidz')
    .select('student_id, juz')
    .not('student_id', 'is', null)
    .eq('status', 'selesai')

  const peta = new Map<string, number>()
  // Modul ujian bisa saja belum dimigrasikan di lingkungan tertentu. Analitik
  // hafalan yang sudah ada tidak boleh ikut mati karenanya — tanpa data ujian
  // hasilnya kembali persis seperti sebelum penggabungan ini ada.
  if (error || !data) return peta

  const perSiswa = new Map<string, string[]>()
  for (const r of data as { student_id: string; juz: string }[]) {
    const daftar = perSiswa.get(r.student_id) ?? []
    daftar.push(String(r.juz))
    perSiswa.set(r.student_id, daftar)
  }
  for (const [id, daftar] of perSiswa) peta.set(id, totalJuzHafalan(daftar))
  return peta
}

/**
 * Juz yang sudah dinyatakan tuntas lewat ujian untuk SATU siswa.
 *
 * Mengembalikan nomor juz-nya, bukan sekadar jumlahnya, supaya peta belajar
 * bisa menandai lingkaran yang tepat. Turunannya langsung dari urutan
 * hafalan: lulus ujian juz 1 berarti 30, 29, 28, 27, 26, dan 1 semuanya
 * tuntas — lima juz sebelumnya pasti sudah dilewati walau tidak satu pun
 * pernah tercatat sebagai setoran.
 *
 * `terakhir` adalah tanggal ujian selesai yang paling baru, untuk diterangkan
 * di layar; null bila kolom tanggalnya kosong.
 */
export async function getJuzUjianSiswa(
  studentId: string,
): Promise<{ selesai: Set<number>; jumlah: number; terakhir: string | null }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('ujian_tahfidz')
    .select('juz, jadwal, updated_at')
    .eq('student_id', studentId)
    .eq('status', 'selesai')

  if (error || !data || data.length === 0) {
    return { selesai: new Set(), jumlah: 0, terakhir: null }
  }

  const rows = data as { juz: string; jadwal: string | null; updated_at: string | null }[]
  const jumlah = totalJuzHafalan(rows.map(r => String(r.juz)))

  // `jadwal` adalah waktu ujian yang sesungguhnya; updated_at dipakai hanya
  // bila jadwalnya tidak pernah diisi — catatan lama banyak yang begitu.
  const tanggal = rows
    .map(r => r.jadwal ?? r.updated_at)
    .filter((v): v is string => Boolean(v))
    .sort()

  return {
    selesai: new Set(daftarJuzSelesai(jumlah)),
    jumlah,
    terakhir: tanggal.at(-1) ?? null,
  }
}

/**
 * Juz tuntas menurut setoran, per siswa — aturan yang sudah lama dipakai
 * analitik, dikumpulkan di sini supaya pemanggilnya tidak menyalinnya lagi.
 *
 * Baris tanpa ayat dan tanpa mutqin diabaikan: barisnya ada, tapi belum ada
 * yang dihafal di sana.
 */
export function juzSetoranPerSiswa(rows: BarisJuzProgress[]): Map<string, number> {
  const juzPerSiswa = new Map<string, number[]>()
  for (const r of rows) {
    if ((r.ayat_hafal ?? 0) <= 0 && !r.mutqin) continue
    const daftar = juzPerSiswa.get(r.student_id) ?? []
    daftar.push(r.juz_number)
    juzPerSiswa.set(r.student_id, daftar)
  }

  const peta = new Map<string, number>()
  for (const [id, daftar] of juzPerSiswa) {
    peta.set(id, juzSelesaiSetoran(juzTerjauh(daftar)))
  }
  return peta
}

/** Juz yang sedang dihafal menurut setoran, per siswa — untuk histogram juz. */
export function juzBerjalanPerSiswa(rows: BarisJuzProgress[]): Map<string, number> {
  const juzPerSiswa = new Map<string, number[]>()
  for (const r of rows) {
    if ((r.ayat_hafal ?? 0) <= 0 && !r.mutqin) continue
    const daftar = juzPerSiswa.get(r.student_id) ?? []
    daftar.push(r.juz_number)
    juzPerSiswa.set(r.student_id, daftar)
  }

  const peta = new Map<string, number>()
  for (const [id, daftar] of juzPerSiswa) {
    const j = juzTerjauh(daftar)
    if (j !== null) peta.set(id, j)
  }
  return peta
}

/** Gabungkan kedua sumber untuk satu siswa. */
export function gabungJuz(setoran: number, ujian: number): JuzHafalan {
  const total = Math.max(setoran, ujian)
  const sumber: JuzHafalan['sumber'] =
    total === 0 ? 'kosong'
    : setoran === ujian ? 'sama'
    : ujian > setoran ? 'ujian'
    : 'setoran'
  return { setoran, ujian, total, sumber }
}

/**
 * Peta siap pakai: studentId → jumlah juz tuntas menurut sumber terjauh.
 *
 * Mencakup setiap siswa yang punya catatan di salah satu sumber. Siswa tanpa
 * catatan sama sekali tidak dimasukkan — pemanggilnya memperlakukan
 * ketiadaan kunci sebagai nol, sama seperti sebelumnya.
 */
export function juzGabunganPerSiswa(
  rowsJuzProgress: BarisJuzProgress[],
  juzUjian: Map<string, number>,
): Map<string, number> {
  const setoran = juzSetoranPerSiswa(rowsJuzProgress)
  const gabungan = new Map<string, number>(setoran)
  for (const [id, n] of juzUjian) {
    gabungan.set(id, Math.max(gabungan.get(id) ?? 0, n))
  }
  return gabungan
}
