/**
 * Aturan baca berkas impor KELOMPOK — pembagian ulang santri ke halaqoh.
 *
 * Bedanya dengan lib/rq/siswa-impor.ts: di sana berkas MEMBUAT siswa baru, di
 * sini berkas hanya MEMINDAHKAN siswa yang sudah ada. Karena itu tak satu pun
 * kolom identitas boleh menulis apa pun — NIS dan nama semata-mata dipakai
 * untuk menemukan barisnya di basis data, dan kalau tidak ketemu, barisnya
 * gagal alih-alih diam-diam membuat santri kedua bernama sama.
 *
 * Bentuk berkasnya mengikuti cara pembagian itu benar-benar dikerjakan: satu
 * lembar per sesi. Sesi diambil dari NAMA LEMBAR ('Sesi 1'), jadi operator
 * cukup menempel daftar per sesi apa adanya. Kolom 'Sesi' tetap diterima untuk
 * berkas yang terlanjur disusun dalam satu lembar.
 *
 * Bebas dependensi xlsx maupun server: dipakai peramban untuk pratinjau dan
 * dijalankan ULANG di server sebelum menyimpan, supaya tidak ada dua versi
 * aturan yang bisa berbeda diam-diam.
 */
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { programLabel } from '@/lib/rq/programs'
import { sesiOf } from '@/lib/rq/sesi'
import type { Jenjang } from '@/types'

/** Halaqoh yang boleh dijadikan tujuan — sudah disaring ke wewenang operator. */
export interface HalaqohTujuan {
  id: string
  name: string
  jenjang: Jenjang
  program: string | null
  sesi: number | null
  wali: string | null
}

/** Santri yang boleh dipindah — sudah disaring ke wewenang operator. */
export interface SantriTerpindahkan {
  id: string
  nis: string | null
  full_name: string
  kelas: string | null
  jenjang: Jenjang
  program: string | null
  halaqoh_id: string | null
  halaqoh_name: string | null
}

export interface RujukanKelompok {
  halaqohList: HalaqohTujuan[]
  santri: SantriTerpindahkan[]
}

export type StatusBaris = 'pindah' | 'tetap' | 'galat'

export interface HasilKelompok {
  /** Nomor baris di dalam lembarnya, judul terhitung. */
  baris: number
  /** Nama lembar apa adanya — dua lembar bisa punya baris 5, keduanya berbeda. */
  sheet: string
  sesi: number | null
  nis: string
  /** Nama seperti tertulis di berkas; tetap tampil walau barisnya gagal. */
  nama: string
  dari: string | null
  ke: string | null
  student_id: string | null
  halaqoh_id: string | null
  status: StatusBaris
  galat: string[]
  catatan: string[]
}

/** Satu perintah pindah yang siap dikirim ke server. */
export interface PerintahPindah {
  student_id: string
  halaqoh_id: string
}

interface Kolom {
  key: 'nis' | 'nama' | 'kelas' | 'halaqoh' | 'sesi'
  header: string
  contoh: string
  petunjuk: string
  lebar: number
  alias?: string[]
}

/** Susunan kolom berkas impor kelompok — juga dipakai membangun berkas contoh. */
export const KOLOM_KELOMPOK: Kolom[] = [
  {
    key: 'nis', header: 'NIS', lebar: 14,
    contoh: '2024001',
    petunjuk: 'Cara paling aman menunjuk santri. Boleh kosong kalau namanya sudah unik.',
  },
  {
    key: 'nama', header: 'Nama Siswa', lebar: 30,
    contoh: 'Ahmad Fauzan Hakim',
    petunjuk: 'Wajib kalau NIS kosong. Harus sama persis dengan data — dipakai mencari, bukan mengubah.',
    alias: ['nama', 'namalengkap', 'namasiswa'],
  },
  {
    key: 'kelas', header: 'Kelas', lebar: 10,
    contoh: '4A',
    petunjuk: 'Hanya untuk dilihat operator. Tidak mengubah apa pun.',
  },
  {
    key: 'halaqoh', header: 'Halaqoh Baru', lebar: 32,
    contoh: 'Sesi 1 — Ustadz Hamdan',
    petunjuk: 'Wajib. Tulis persis seperti di lembar Daftar Halaqoh.',
    alias: ['halaqoh', 'halaqohbaru', 'kelompok', 'kelompokbaru', 'halaqohtujuan'],
  },
  {
    key: 'sesi', header: 'Sesi', lebar: 8,
    contoh: '1',
    petunjuk: 'Boleh kosong — sesi diambil dari nama lembar. Diisi hanya kalau satu lembar memuat beberapa sesi.',
  },
]

/** Judul kolom dicocokkan longgar: 'Halaqoh Baru', 'halaqoh_baru', 'HALAQOH BARU' sama saja. */
function normal(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function teks(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/**
 * Sesi dari nama lembar: 'Sesi 1', 'SESI 2', 'sesi3', 'Sesi 1 (SD)'.
 *
 * null berarti lembar itu tidak menyatakan sesi — bukan galat, karena kolom
 * 'Sesi' di dalamnya masih boleh menyatakannya per baris.
 */
export function sesiDariNamaSheet(nama: string): number | null {
  const m = normal(nama).match(/sesi([123])/)
  return m ? Number(m[1]) : null
}

/**
 * Baca satu baris menjadi perintah pindah, atau alasan mengapa tidak bisa.
 *
 * Galat dikumpulkan semuanya, tidak berhenti di yang pertama: operator yang
 * memperbaiki berkas ingin melihat seluruh masalah satu baris sekaligus.
 */
export function periksaBarisKelompok(
  mentah: Record<string, unknown>,
  baris: number,
  sheet: string,
  sesiSheet: number | null,
  rujukan: RujukanKelompok,
): HasilKelompok {
  const sel = new Map<string, unknown>()
  for (const [k, v] of Object.entries(mentah)) sel.set(normal(k), v)

  const ambil = (key: Kolom['key']): string => {
    const kol = KOLOM_KELOMPOK.find(k => k.key === key)!
    const utama = sel.get(normal(kol.header))
    if (utama !== undefined && utama !== null) return teks(utama)
    for (const a of kol.alias ?? []) {
      const v = sel.get(a)
      if (v !== undefined && v !== null) return teks(v)
    }
    return ''
  }

  const galat: string[] = []
  const catatan: string[] = []
  const nis = ambil('nis')
  const nama = ambil('nama')
  const halaqohTeks = ambil('halaqoh')

  // Sesi baris: kolom menang atas nama lembar, karena ia lebih spesifik.
  const sesiKolom = Number(ambil('sesi').match(/[123]/)?.[0]) || null
  const sesi = sesiKolom ?? sesiSheet

  const gagal = (): HasilKelompok => ({
    baris, sheet, sesi, nis, nama,
    dari: null, ke: halaqohTeks || null,
    student_id: null, halaqoh_id: null,
    status: 'galat', galat, catatan,
  })

  // ── Temukan santrinya ──
  //
  // NIS didahulukan karena ia satu-satunya penunjuk yang benar-benar tunggal.
  // Nama dipakai sebagai jalan kedua, dan hanya kalau tepat satu yang cocok:
  // di daftar 493 anak, "Muhammad Fauzan" yang kembar bukan hal aneh, dan
  // menebak salah satunya berarti memindahkan anak yang keliru.
  let santri: SantriTerpindahkan | undefined
  if (nis) {
    santri = rujukan.santri.find(s => s.nis === nis)
    if (!santri) galat.push(`NIS ${nis} tidak ada di daftar santri yang boleh Anda pindahkan.`)
    else if (nama && normal(santri.full_name) !== normal(nama)) {
      catatan.push(`Nama di berkas berbeda dari data ('${santri.full_name}') — yang dipakai NIS.`)
    }
  } else if (nama) {
    const cocok = rujukan.santri.filter(s => normal(s.full_name) === normal(nama))
    if (cocok.length === 1) santri = cocok[0]
    else if (cocok.length > 1) {
      galat.push(`Ada ${cocok.length} santri bernama '${nama}' — isi kolom NIS untuk memastikan yang mana.`)
    } else galat.push(`Santri '${nama}' tidak ada di daftar yang boleh Anda pindahkan.`)
  } else {
    galat.push('NIS dan Nama Siswa dua-duanya kosong.')
  }

  // ── Temukan halaqoh tujuannya ──
  //
  // Dicocokkan di dalam jenjang santrinya saja: nama halaqoh berulang antar
  // unit, dan yang benar selalu yang sejenjang. Tanpa santri yang ketemu,
  // jenjangnya belum diketahui — jadi pencocokan ditunda sampai baris gagal.
  let tujuan: HalaqohTujuan | undefined
  if (!halaqohTeks) {
    galat.push('Kolom Halaqoh Baru kosong.')
  } else if (santri) {
    const sejenjang = rujukan.halaqohList.filter(h => h.jenjang === santri!.jenjang)
    const cocok = sejenjang.filter(h => normal(h.name) === normal(halaqohTeks))
    if (cocok.length === 1) tujuan = cocok[0]
    else if (cocok.length > 1) {
      galat.push(`Ada ${cocok.length} halaqoh bernama '${halaqohTeks}' di ${JENJANG_LABELS[santri.jenjang]}.`)
    } else {
      galat.push(`Halaqoh '${halaqohTeks}' tidak ada di daftar halaqoh yang boleh Anda isi.`)
    }
  }

  if (!santri || !tujuan) return gagal()

  // ── Cocokkan sesinya ──
  //
  // Ini jaring pengaman utama berkas ini. Salah tempel satu blok baris dari
  // lembar Sesi 2 ke lembar Sesi 1 tidak akan terlihat di layar mana pun
  // setelah tersimpan — anak itu cuma tidak pernah datang ke halaqohnya.
  if (sesi && tujuan.sesi && tujuan.sesi !== sesi) {
    galat.push(`'${tujuan.name}' ada di Sesi ${tujuan.sesi}, sedangkan baris ini di Sesi ${sesi}.`)
  }

  // Sesi seharusnya mengikuti tingkat kelas anak. Kalau meleset, itu belum
  // tentu salah — ada anak yang sengaja dititipkan di sesi lain — jadi cukup
  // ditandai, bukan ditahan.
  const sesiSeharusnya = sesiOf(santri.jenjang, santri.kelas)
  if (sesiSeharusnya && tujuan.sesi && sesiSeharusnya !== tujuan.sesi) {
    catatan.push(`Kelas ${santri.kelas} biasanya di Sesi ${sesiSeharusnya}, halaqoh ini Sesi ${tujuan.sesi}.`)
  }

  // Program kelompok dan program anak sebaiknya sama. Ditandai saja: sebagian
  // besar halaqoh lama belum ditandai programnya, dan menahannya akan membuat
  // impor pertama gagal seluruhnya tanpa sebab yang nyata.
  if (tujuan.program !== santri.program) {
    catatan.push(
      `Program berbeda — santri ${programLabel(santri.jenjang, santri.program)}, ` +
      `halaqoh ${programLabel(tujuan.jenjang, tujuan.program)}.`,
    )
  }

  if (galat.length > 0) return gagal()

  return {
    baris, sheet, sesi,
    nis: santri.nis ?? '',
    nama: santri.full_name,
    dari: santri.halaqoh_name,
    ke: tujuan.name,
    student_id: santri.id,
    halaqoh_id: tujuan.id,
    status: santri.halaqoh_id === tujuan.id ? 'tetap' : 'pindah',
    galat,
    catatan,
  }
}

/**
 * Tandai santri yang muncul lebih dari sekali DI DALAM berkas.
 *
 * Satu anak tidak bisa duduk di dua kelompok, dan kemunculan kedua hampir
 * selalu sisa salin-tempel. Yang ditandai gagal adalah kemunculan KEDUA dan
 * seterusnya — yang pertama dibiarkan berlaku, karena membatalkan dua-duanya
 * berarti anak itu tidak terbagi sama sekali.
 */
export function tandaiSantriKembar(hasil: HasilKelompok[]): HasilKelompok[] {
  const pertama = new Map<string, HasilKelompok>()
  for (const h of hasil) {
    if (!h.student_id) continue
    const awal = pertama.get(h.student_id)
    if (!awal) {
      pertama.set(h.student_id, h)
      continue
    }
    h.galat.push(`Santri ini sudah dibagi di ${awal.sheet} baris ${awal.baris}.`)
    h.status = 'galat'
    h.student_id = null
    h.halaqoh_id = null
  }
  return hasil
}

/** Ringkasan yang tampil di kepala layar pratinjau. */
export function ringkas(hasil: HasilKelompok[]) {
  return {
    pindah: hasil.filter(h => h.status === 'pindah').length,
    tetap: hasil.filter(h => h.status === 'tetap').length,
    galat: hasil.filter(h => h.status === 'galat').length,
  }
}
