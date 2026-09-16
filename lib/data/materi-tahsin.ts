import { createServerClient } from '@/lib/supabase/server'

/**
 * Materi hafalan Gharib & Tajwid (UMMI) — daftar acuannya dan sejauh mana
 * seorang anak sudah menuntaskannya.
 *
 * KENAPA PROGRES DIHITUNG DARI SETORAN, BUKAN DISIMPAN SEBAGAI ANGKA
 *
 * Tidak ada kolom "sudah berapa materi" di tabel students, dan itu disengaja.
 * Angka simpanan seperti itu punya dua sumber kebenaran begitu sebuah setoran
 * dikoreksi atau dihapus: angkanya bilang 12, riwayatnya bilang 11, dan tidak
 * ada cara menebak mana yang benar. Menghitungnya dari tahsin_log_materi
 * membuat penghapusan setoran otomatis mengembalikan progresnya — CASCADE di
 * basis data yang mengerjakannya, bukan kode yang harus ingat.
 */

/**
 * Hasil satu materi pada satu setoran.
 *
 *  ulang  — materinya sudah dicoba utuh tapi belum lancar; diulang dari awal.
 *  lanjut — materinya belum selesai dibahas; pertemuan berikutnya meneruskan.
 *  lulus  — tuntas. Hanya ini yang menambah progres.
 */
export type HasilMateri = 'ulang' | 'lanjut' | 'lulus'

export interface MateriTahsin {
  id: string
  nomor: number
  halaman: number
  nama: string
  keterangan: string | null
}

/**
 * Daftar materi untuk beberapa tahap sekaligus, dikelompokkan per jilid.
 *
 * Menerima banyak jilid karena satu sesi bisa memuat anak Gharib dan anak
 * Tajwid berbarengan; memanggil per anak akan menembakkan query yang sama
 * belasan kali untuk jawaban yang identik.
 */
export async function getMateriPerJilid(jilidIds: string[]): Promise<Map<string, MateriTahsin[]>> {
  const unik = [...new Set(jilidIds.filter(Boolean))]
  if (unik.length === 0) return new Map()

  const supabase = createServerClient()
  const { data } = await supabase
    .from('tahsin_materi')
    .select('id, jilid_id, nomor, halaman, nama, keterangan')
    .in('jilid_id', unik)
    .order('nomor')

  const hasil = new Map<string, MateriTahsin[]>()
  for (const m of (data ?? []) as Array<MateriTahsin & { jilid_id: string }>) {
    const daftar = hasil.get(m.jilid_id) ?? []
    daftar.push({ id: m.id, nomor: m.nomor, halaman: m.halaman, nama: m.nama, keterangan: m.keterangan })
    hasil.set(m.jilid_id, daftar)
  }
  return hasil
}

/**
 * Keadaan TERAKHIR tiap materi, per anak.
 *
 * Satu materi bisa muncul di banyak setoran — lanjut, lanjut, lalu lulus. Yang
 * berlaku adalah catatan terakhir, jadi barisnya diurutkan menaik dan yang
 * belakangan menimpa yang lebih dulu. Aturan "terakhir menang" dipilih daripada
 * "lulus mengunci" supaya koreksi guru benar-benar berlaku: kalau sebuah materi
 * dinyatakan mengulang setelah sempat diluluskan, itu pernyataan yang disengaja,
 * dan progres yang menolak turun akan menyembunyikannya.
 */
export async function getHasilMateriPerSiswa(
  studentIds: string[],
): Promise<Map<string, Map<string, HasilMateri>>> {
  const unik = [...new Set(studentIds.filter(Boolean))]
  if (unik.length === 0) return new Map()

  const supabase = createServerClient()
  const { data } = await supabase
    .from('tahsin_log_materi')
    .select('student_id, materi_id, hasil, created_at')
    .in('student_id', unik)
    .order('created_at', { ascending: true })

  const hasil = new Map<string, Map<string, HasilMateri>>()
  for (const r of (data ?? []) as Array<{ student_id: string; materi_id: string; hasil: HasilMateri }>) {
    const perAnak = hasil.get(r.student_id) ?? new Map<string, HasilMateri>()
    perAnak.set(r.materi_id, r.hasil)
    hasil.set(r.student_id, perAnak)
  }
  return hasil
}

export interface ProgresMateri {
  total: number
  /** Materi yang sudah tuntas — ini yang dipakai sebagai angka progres. */
  lulus: number
  /** Materi yang sedang berjalan (mengulang atau belum selesai). */
  berjalan: number
  /**
   * Materi yang wajar dikerjakan berikutnya: yang sedang berjalan lebih dulu,
   * baru yang belum pernah disentuh. Anak yang materinya belum selesai harus
   * meneruskannya, bukan melompat ke materi baru.
   */
  berikutnya: MateriTahsin | null
  /** Semua materi lulus: pemicu drill, padanan "lulus di halaman terakhir jilid". */
  tuntas: boolean
}

/** Ringkas daftar materi + keadaan terakhirnya menjadi satu progres. */
export function ringkasProgres(
  materi: MateriTahsin[],
  hasil: Map<string, HasilMateri>,
): ProgresMateri {
  const lulus = materi.filter(m => hasil.get(m.id) === 'lulus').length
  const berjalan = materi.filter(m => {
    const h = hasil.get(m.id)
    return h === 'ulang' || h === 'lanjut'
  })
  const belumTersentuh = materi.find(m => !hasil.has(m.id)) ?? null

  return {
    total: materi.length,
    lulus,
    berjalan: berjalan.length,
    berikutnya: berjalan[0] ?? belumTersentuh,
    // Tahap tanpa materi sama sekali tidak pernah "tuntas" — kalau tidak,
    // tahap yang materinya belum diseed akan langsung melempar anak ke drill.
    tuntas: materi.length > 0 && lulus === materi.length,
  }
}
