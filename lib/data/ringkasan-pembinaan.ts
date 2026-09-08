import { createServerClient } from '@/lib/supabase/server'
import { getKelengkapan } from '@/lib/data/kelengkapan'
import { currentPeriod } from '@/lib/finance/period'
import type { Jenjang } from '@/types'

/**
 * Angka pembinaan untuk dashboard manajemen.
 *
 * Ada karena keempat kartu besar di puncak tiap dashboard seluruhnya menghitung
 * TUGAS — mendesak, jatuh tempo, perlu verifikasi, dikerjakan. Tidak satu pun
 * menghitung santri, halaqoh, atau capaian, padahal itulah pekerjaan lembaga
 * ini. Kepala RQ dan koor unit membuka dashboardnya dan tidak menemukan satu
 * angka pun yang menyentuh keputusan yang jadi tanggung jawabnya.
 *
 * Yang dijawab di sini dua pertanyaan, dan sengaja hanya dua:
 *
 *   1. Sampai mana anak-anak sekarang     → sebaran jilid / Al-Qur'an / tahfidz
 *   2. Apakah catatannya lengkap          → berapa yang sudah dinilai bulan ini
 *
 * Pertanyaan kedua ditaruh berdampingan dengan yang pertama dengan sengaja.
 * Sebaran capaian hanya bermakna sejauh datanya lengkap; menampilkan "312 anak
 * di Al-Qur'an" tanpa menyebut bahwa setengah angkatan belum dinilai bulan ini
 * adalah cara membuat angka yang keliru terlihat resmi.
 */

export interface RingkasanPembinaan {
  /** Santri aktif dalam cakupan peran ini. */
  totalSiswa: number
  /** Sebaran capaian tahsin — dibaca dari penanda pada jilid_levels. */
  jilid: number
  quran: number
  tahfidz: number
  /** Belum punya level sama sekali. Bukan nol capaian — belum terdata. */
  belumTerdata: number
  /** Kelengkapan penilaian bulan berjalan. */
  bulan: {
    period: string
    dinilai: number
    total: number
    percent: number
    /** Halaqoh yang belum satu anak pun dinilai bulan ini. */
    halaqohKosong: number
    totalHalaqoh: number
  }
}

const KOSONG: RingkasanPembinaan = {
  totalSiswa: 0, jilid: 0, quran: 0, tahfidz: 0, belumTerdata: 0,
  bulan: { period: '', dinilai: 0, total: 0, percent: 0, halaqohKosong: 0, totalHalaqoh: 0 },
}

export async function getRingkasanPembinaan(
  jenjangScope: Jenjang[],
): Promise<RingkasanPembinaan> {
  if (jenjangScope.length === 0) return KOSONG

  try {
    const supabase = createServerClient()
    const period = currentPeriod()

    const [siswaRes, levelRes, kelengkapan] = await Promise.all([
      supabase.from('students')
        .select('current_jilid_id')
        .eq('is_active', true)
        .in('jenjang', jenjangScope),
      supabase.from('jilid_levels').select('id, is_quran, is_terminal'),
      getKelengkapan(period, jenjangScope),
    ])

    const level = new Map(
      ((levelRes.data ?? []) as { id: string; is_quran: boolean | null; is_terminal: boolean | null }[])
        .map(l => [l.id, l]),
    )

    /*
      Tiga golongan dibaca dari PENANDA pada jilid_levels, bukan dari nama
      levelnya. Enam metode hidup berdampingan di RQ (UMMI, KIBAR, Syajaroh,
      Tilawati, Ummi, Iqro) dengan penamaan yang berbeda-beda — 'Talaqqi
      Al-Qur'an', 'Al-Qur'an T1', 'Ghoroibul Qur'an' — jadi mencocokkan teks
      akan meleset pada sebagian. is_quran dan is_terminal ada justru supaya
      tidak perlu menebak.
    */
    let jilid = 0, quran = 0, tahfidz = 0, belumTerdata = 0
    for (const s of (siswaRes.data ?? []) as { current_jilid_id: string | null }[]) {
      const l = s.current_jilid_id ? level.get(s.current_jilid_id) : undefined
      if (!l) belumTerdata++
      else if (l.is_terminal) tahfidz++
      else if (l.is_quran) quran++
      else jilid++
    }

    const totalSiswa = jilid + quran + tahfidz + belumTerdata

    // Kelengkapan diambil dari getKelengkapan supaya definisi "sudah dinilai"
    // hanya hidup di satu tempat: halaman_akhir_tahsin yang terisi. Kolom awal
    // bisa terisi sendiri lewat tombol salin bulan lalu, jadi memakainya akan
    // membuat bulan yang belum dinilai sama sekali terlihat sudah dikerjakan.
    const bulanIni = kelengkapan.trend.find(t => t.period === period)
    const dinilai = bulanIni?.terisi ?? 0
    const total = bulanIni?.totalSiswa ?? totalSiswa

    return {
      totalSiswa,
      jilid,
      quran,
      tahfidz,
      belumTerdata,
      bulan: {
        period,
        dinilai,
        total,
        percent: total > 0 ? Math.round((dinilai / total) * 100) : 0,
        halaqohKosong: kelengkapan.rows.filter(r => r.terisi === 0).length,
        totalHalaqoh: kelengkapan.rows.length,
      },
    }
  } catch {
    return KOSONG
  }
}
