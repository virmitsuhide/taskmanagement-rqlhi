import * as XLSX from 'xlsx'
import {
  BULAN_ID,
  formatJadwal,
  getPredikatLabel,
  getTahfidzLabel,
} from '@/lib/rq/ujian'
import type { UjianTahfidz, UjianTahsin } from '@/types'

/**
 * Rekap bulanan ujian sebagai berkas Excel dua sheet.
 *
 * Dipisah dari lib/rq/ujian.ts karena mengimpor xlsx (~400 KB): file ini hanya
 * dimuat komponen yang benar-benar punya tombol ekspor, sehingga halaman
 * antrian publik tidak ikut menanggung bundelnya.
 *
 * Berjalan di peramban — XLSX.writeFile memicu unduhan langsung.
 */
export function exportRekapUjian(
  tahfidz: UjianTahfidz[],
  tahsin: UjianTahsin[],
  month: number,
  year: number,
) {
  const wb = XLSX.utils.book_new()
  const periode = `${BULAN_ID[month - 1]} ${year}`

  // ── Sheet Tahfidz — satu baris per siswa ──────────────────────────
  const barisTahfidz = [
    ['REKAP HASIL UJIAN TAHFIDZ'],
    [`Periode: ${periode}`],
    [],
    ['No', 'Unit', 'Nama Siswa', 'Ayah', 'Kelas', 'Tipe Ujian', 'Predikat', 'Penguji', 'Jadwal', 'Catatan'],
    ...tahfidz.map((item, i) => [
      i + 1,
      item.unit,
      item.nama_siswa,
      item.nama_ayah,
      `${item.kelas}${item.is_quls ? ' (QULS)' : ''}`,
      getTahfidzLabel(item.tipe, item.juz),
      getPredikatLabel(item.predikat),
      item.penguji ?? '-',
      formatJadwal(item.jadwal),
      item.catatan ?? '',
    ]),
  ]

  const wsTahfidz = XLSX.utils.aoa_to_sheet(barisTahfidz)
  wsTahfidz['!cols'] = [
    { wch: 4 }, { wch: 6 }, { wch: 28 }, { wch: 22 }, { wch: 12 },
    { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 24 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, wsTahfidz, 'Tahfidz')

  // ── Sheet Tahsin — satu baris per SISWA, bukan per kelompok ───────
  // Kolom kelompok hanya diisi di baris pertama tiap kelompok supaya
  // pengelompokannya tetap terbaca tanpa merge cell.
  const barisTahsin: (string | number)[][] = [
    ['REKAP HASIL UJIAN TAHSIN'],
    [`Periode: ${periode}`],
    [],
    ['No', 'Unit', 'Nama Kelompok', 'Sesi', 'Level', 'Nama Siswa', 'Hasil', 'Penguji', 'Jadwal', 'Catatan'],
  ]

  let nomor = 1
  for (const item of tahsin) {
    if (item.siswa.length === 0) {
      barisTahsin.push([
        nomor++, item.unit, item.nama_kelompok, item.sesi, item.level,
        '-', '-', item.penguji ?? '-', formatJadwal(item.jadwal), item.catatan ?? '',
      ])
      continue
    }

    item.siswa.forEach((s, i) => {
      const awal = i === 0
      barisTahsin.push([
        awal ? nomor++ : '',
        awal ? item.unit : '',
        awal ? item.nama_kelompok : '',
        awal ? item.sesi : '',
        s.level?.trim() || item.level,
        s.nama,
        s.predikat === 'lulus' ? 'Lulus' : s.predikat === 'mengulang' ? 'Mengulang' : '-',
        awal ? (item.penguji ?? '-') : '',
        awal ? formatJadwal(item.jadwal) : '',
        awal ? (item.catatan ?? '') : '',
      ])
    })
  }

  const wsTahsin = XLSX.utils.aoa_to_sheet(barisTahsin)
  wsTahsin['!cols'] = [
    { wch: 4 }, { wch: 6 }, { wch: 24 }, { wch: 10 }, { wch: 14 },
    { wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 24 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, wsTahsin, 'Tahsin')

  XLSX.writeFile(wb, `Rekap_Ujian_${BULAN_ID[month - 1]}_${year}.xlsx`)
}
