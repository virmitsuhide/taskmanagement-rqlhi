import { halamanDariAyat } from '@/lib/rq/batas-halaman'
import { URUTAN_JUZ } from '@/lib/rq/hafalan'
import {
  HALAMAN_JUZ, capaian, formatCapaian, halamanPerJuz, halamanSelesaiDalamJuz,
  juzMushafDariAyat, type CapaianHafalan,
} from '@/lib/rq/halaman'

/**
 * Mengukur setoran gukar dalam satuan HALAMAN — tahsin maupun tahfidz.
 *
 * KENAPA HALAMAN, DAN KENAPA HARUS KUMULATIF
 *
 * Yang dicatat pembina tiap bulan adalah POSISI: sedang di jilid berapa
 * halaman berapa, atau surat apa ayat berapa. Yang dilaporkan ke SDM adalah
 * JARAK: berapa halaman yang ditempuh bulan itu. Jarak tidak bisa dihitung
 * dari dua posisi mentah — "Jilid 2 hal 5" ke "Jilid 3 hal 10" bukan minus
 * lima. Karena itu tiap posisi lebih dulu diubah menjadi satu angka
 * kumulatif dari awal metode, baru dikurangkan.
 *
 * KENAPA TAHFIDZ TIDAK BISA MEMAKAI NOMOR HALAMAN MUSHAF BEGITU SAJA
 *
 * Hafalan di RQ LHI berjalan 30, 29, 28, 27, 26, lalu 1…25 — bukan urutan
 * mushaf. Orang yang menamatkan juz 30 (halaman 582–604) lalu mulai juz 29
 * (halaman 562) bergerak MAJU, padahal nomor halamannya turun. Selisih nomor
 * halaman akan memberi angka negatif, dan yang lebih buruk: rekap bulan itu
 * akan terbaca nol. Karena itu kumulatif tahfidz dihitung menyusuri urutan
 * hafalan, bukan menyusuri mushaf.
 */

/** Satu tahap dalam sebuah metode, seperti tersimpan di jilid_levels. */
export interface TahapJilid {
  id: string
  label: string
  order_num: number
  /** null untuk tahap tak berbuku — Al-Qur'an, Talaqqi, Lulus Tahsin. */
  total_pages: number | null
  is_quran: boolean
  is_terminal: boolean
}

/** Posisi tahsin seseorang pada akhir sebuah bulan. */
export interface PosisiTahsin {
  jilidId: string | null
  /** Halaman di dalam jilid berbuku. */
  halaman: number | null
  /** Dipakai saat tahapnya Al-Qur'an. */
  surat: number | null
  ayat: number | null
}

/** Posisi tahfidz: surat & ayat terakhir yang disetorkan. */
export interface PosisiTahfidz {
  surat: number | null
  ayat: number | null
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

/**
 * Halaman kumulatif sejak awal metode sampai posisi ini.
 *
 * Tahap berbuku dijumlahkan halamannya. Begitu masuk tahap Al-Qur'an,
 * hitungannya berpindah ke halaman mushaf — sebab di sana yang dibaca memang
 * mushaf, dan satu halaman mushaf adalah satuan yang sama nilainya bagi
 * pembina maupun bagi yang membaca rekapnya.
 */
export function kumulatifTahsin(tahapan: TahapJilid[], posisi: PosisiTahsin): number {
  if (!posisi.jilidId) return 0
  const urut = [...tahapan].sort((a, b) => a.order_num - b.order_num)
  const kini = urut.find(t => t.id === posisi.jilidId)
  if (!kini) return 0

  // Seluruh tahap berbuku SEBELUM tahap sekarang dianggap tuntas.
  let total = 0
  for (const t of urut) {
    if (t.order_num >= kini.order_num) break
    total += t.total_pages ?? 0
  }

  if (kini.is_quran) {
    // Di tahap Al-Qur'an, kemajuannya diukur dengan halaman mushaf yang sudah
    // dilewati — bukan lagi halaman buku.
    const hlm = posisi.surat && posisi.ayat ? halamanDariAyat(posisi.surat, posisi.ayat) : null
    return total + (hlm ?? 0)
  }

  const maks = kini.total_pages ?? 0
  const hlm = posisi.halaman ?? 0
  return total + Math.max(0, Math.min(hlm, maks))
}

/**
 * Halaman yang ditempuh bulan ini = posisi sekarang dikurangi posisi bulan
 * lalu.
 *
 * Tidak pernah negatif. Posisi yang mundur — pembina meralat catatan, atau
 * peserta mengulang dari jilid sebelumnya — bukan "setoran minus"; bulan itu
 * hanya tidak mencatat kemajuan.
 */
export function setoranTahsinBulanIni(
  tahapan: TahapJilid[],
  sekarang: PosisiTahsin,
  bulanLalu: PosisiTahsin | null,
): number {
  const kini = kumulatifTahsin(tahapan, sekarang)
  const lalu = bulanLalu ? kumulatifTahsin(tahapan, bulanLalu) : 0
  return Math.max(0, kini - lalu)
}

/**
 * Surat yang boleh dipilih bulan ini pada tahap Al-Qur'an.
 *
 * ATURAN RQ: surat yang sudah dimulai harus dituntaskan lebih dulu.
 *
 * Selama ayat terakhir bulan lalu belum mencapai ujung suratnya, pilihan
 * bulan ini terkunci pada surat itu. Begitu tuntas, surat berikutnya terbuka.
 * Ini bukan sekadar merapikan isian: berpindah surat di tengah jalan membuat
 * bagian yang ditinggalkan tidak pernah tercatat selesai oleh siapa pun, dan
 * tidak ada di sistem ini yang akan menagihnya kemudian.
 *
 * `panjangSurat` diberikan pemanggil dari surat_master — modul ini sengaja
 * tidak memuat 114 panjang surah sendiri.
 */
export function suratTahsinTersedia(
  bulanLalu: PosisiTahfidz | null,
  panjangSurat: (surat: number) => number | null,
): { terkunci: boolean; suratWajib: number | null; mulaiDari: number } {
  if (!bulanLalu?.surat || !bulanLalu.ayat) {
    return { terkunci: false, suratWajib: null, mulaiDari: 1 }
  }
  const panjang = panjangSurat(bulanLalu.surat)
  const tuntas = panjang !== null && bulanLalu.ayat >= panjang
  if (tuntas) {
    return { terkunci: false, suratWajib: null, mulaiDari: Math.min(114, bulanLalu.surat + 1) }
  }
  return { terkunci: true, suratWajib: bulanLalu.surat, mulaiDari: bulanLalu.surat }
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

/**
 * Halaman hafalan kumulatif, menyusuri urutan hafalan RQ (30, 29, 28, …).
 *
 * Juz-juz sebelum juz yang sedang dijalani dihitung penuh; juz berjalan
 * dihitung sebanyak halaman utuh yang sudah dilewati. Keduanya memakai
 * pembagian halaman yang sama dengan peta belajar santri, jadi "5 halaman"
 * di rekap gukar berarti hal yang sama dengan "5 halaman" di rapor anak.
 */
export function kumulatifTahfidz(posisi: PosisiTahfidz): number {
  if (!posisi.surat || !posisi.ayat) return 0
  const juz = juzMushafDariAyat(posisi.surat, posisi.ayat)
  const urutanKe = URUTAN_JUZ.indexOf(juz)
  if (urutanKe === -1) return 0

  let total = 0
  for (let i = 0; i < urutanKe; i++) total += halamanPerJuz(URUTAN_JUZ[i])
  return total + halamanSelesaiDalamJuz(juz, posisi.surat, posisi.ayat)
}

export function setoranTahfidzBulanIni(
  sekarang: PosisiTahfidz,
  bulanLalu: PosisiTahfidz | null,
): number {
  return Math.max(0, kumulatifTahfidz(sekarang) - (bulanLalu ? kumulatifTahfidz(bulanLalu) : 0))
}

/**
 * Total hafalan dalam satuan "sekian juz sekian halaman".
 *
 * Rumusnya sama persis dengan hafalan santri: juz yang sudah tuntas dihitung
 * utuh, sisanya dalam halaman, dan baris yang menggantung dibuang. Menamatkan
 * juz 30 berarti 1 juz — juz 30 adalah juz pertama dalam urutan hafalan RQ,
 * bukan yang ketiga puluh.
 */
export function totalHafalanGukar(posisi: PosisiTahfidz): CapaianHafalan {
  if (!posisi.surat || !posisi.ayat) return { juz: 0, halaman: 0 }
  const juz = juzMushafDariAyat(posisi.surat, posisi.ayat)
  const urutanKe = URUTAN_JUZ.indexOf(juz)
  if (urutanKe === -1) return { juz: 0, halaman: 0 }
  return capaian(urutanKe, halamanSelesaiDalamJuz(juz, posisi.surat, posisi.ayat))
}

/** "2 juz 3 halaman" — dipakai di tabel & formulir. */
export function formatHafalanGukar(posisi: PosisiTahfidz): string {
  return formatCapaian(totalHafalanGukar(posisi))
}

/**
 * Ayat terakhir sebuah juz, untuk memandu isian tahfidz.
 *
 * Diturunkan dari halaman terakhir juz itu; pemanggil yang butuh ketepatan
 * ayat memakai batas-juz.ts. Di sini cukup untuk menunjukkan sampai mana
 * sebuah juz membentang.
 */
export function halamanAkhirJuz(juz: number): number | null {
  return HALAMAN_JUZ[juz]?.selesai ?? null
}
