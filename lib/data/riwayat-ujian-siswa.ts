import { createServerClient } from '@/lib/supabase/server'
import {
  getPredikatClass, getPredikatLabel, getSiswaPredikatClass, getSiswaPredikatLabel, getStatusLabel, getTahfidzLabel,
} from '@/lib/rq/ujian'
import { posisiTertinggiDari } from '@/lib/rq/hafalan'
import type { TahfidzTipe, UjianPredikat, UjianSiswa, UjianStatus } from '@/types'

/**
 * Seluruh ujian seorang siswa — tahfidz (juz'iyyah & tasmi') dan tahsin —
 * dalam satu daftar, untuk profil siswa di portal guru.
 *
 * Ujian tahfidz ditautkan lewat kolom student_id; ujian tahsin menyimpan
 * pesertanya di larik JSON `siswa`, jadi dicari dengan kecocokan isi larik.
 * Pengajuan tahsin lama yang pesertanya hanya berupa nama ketikan tidak bisa
 * dikenali sebagai anak ini, dan memang tidak ikut tampil.
 */

export interface UjianSiswaRiwayat {
  id: string
  jenis: 'tahfidz' | 'tahsin'
  judul: string
  status: UjianStatus
  statusLabel: string
  /** Jadwal ujian; null = riwayat lama tanpa tanggal (hasil verifikasi koordinator). */
  jadwal: string | null
  /** Urutan dalam hafalan untuk riwayat tanpa tanggal — makin besar makin jauh. */
  urutan: number
  penguji: string | null
  hasil: string | null
  hasilClass: string
  catatan: string | null
}

export async function getRiwayatUjianSiswa(studentId: string): Promise<UjianSiswaRiwayat[]> {
  const supabase = createServerClient()
  const [tahfidz, tahsin] = await Promise.all([
    supabase.from('ujian_tahfidz')
      .select('id, tipe, juz, status, jadwal, penguji, predikat, catatan')
      .eq('student_id', studentId),
    supabase.from('ujian_tahsin')
      .select('id, level, siswa, status, jadwal, penguji, catatan')
      // Larik objek harus dikirim sebagai teks JSON: bila dioper sebagai larik,
      // supabase-js menulisnya dengan format larik Postgres ({…}) dan kecocokan
      // jsonb tidak pernah terjadi.
      .contains('siswa', JSON.stringify([{ student_id: studentId }])),
  ])

  const hasil: UjianSiswaRiwayat[] = []
  for (const u of (tahfidz.data ?? []) as {
    id: string; tipe: TahfidzTipe; juz: string; status: UjianStatus; jadwal: string | null
    penguji: string | null; predikat: UjianPredikat | null; catatan: string | null
  }[]) {
    const selesai = u.status === 'selesai'
    hasil.push({
      id: u.id, jenis: 'tahfidz', judul: getTahfidzLabel(u.tipe, u.juz),
      status: u.status, statusLabel: getStatusLabel(u.status),
      jadwal: u.jadwal, penguji: u.penguji,
      // Tasmi' sesudah juz'iyyah terakhir bloknya: 5 juz > 3 juz > 1 juz pada posisi yang sama.
      urutan: (posisiTertinggiDari(u.juz) ?? 0) * 10 + (u.tipe === '5_juz' ? 2 : u.tipe === '3_juz' ? 1 : 0),
      // Selesai tanpa predikat = catatan lama / verifikasi — tetap dihitung lulus.
      hasil: selesai ? (u.predikat ? getPredikatLabel(u.predikat) : 'Lulus') : null,
      hasilClass: u.predikat ? getPredikatClass(u.predikat) : 'text-success font-semibold',
      catatan: u.catatan,
    })
  }
  for (const u of (tahsin.data ?? []) as {
    id: string; level: string; siswa: UjianSiswa[]; status: UjianStatus; jadwal: string | null
    penguji: string | null; catatan: string | null
  }[]) {
    const saya = u.siswa.find(s => s.student_id === studentId)
    hasil.push({
      id: u.id, jenis: 'tahsin', judul: `Ujian Tahsin ${saya?.level ?? u.level}`,
      status: u.status, statusLabel: getStatusLabel(u.status),
      jadwal: u.jadwal, penguji: u.penguji, urutan: 0,
      hasil: u.status === 'selesai' ? getSiswaPredikatLabel(saya?.predikat ?? null, 'Belum dinilai') : null,
      hasilClass: getSiswaPredikatClass(saya?.predikat ?? null),
      catatan: u.catatan,
    })
  }

  // Yang masih berjalan di atas, lalu yang selesai dari terbaru; riwayat tanpa
  // tanggal paling bawah, dari yang terjauh dalam urutan hafalan.
  const bobot = (u: UjianSiswaRiwayat) => (u.status === 'selesai' ? (u.jadwal ? 1 : 2) : 0)
  return hasil.sort((a, b) => bobot(a) - bobot(b) || (b.jadwal ?? '').localeCompare(a.jadwal ?? '') || b.urutan - a.urutan)
}
