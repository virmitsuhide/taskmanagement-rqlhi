import { cache } from 'react'
import { UNIT_ORDER } from '@/lib/rq/programs'
import type { Jenjang } from '@/types'
import { getTargetTahfidzSemua } from '@/lib/data/target-tahfidz'
import { getKelengkapan } from '@/lib/data/kelengkapan'
import { getCapaianKelas } from '@/lib/data/capaian-kelas'
import { getKurikulum } from '@/lib/data/kurikulum'
import { getCurrentTerm } from '@/lib/data/terms'
import { getSiswaDrill, getDrillTahfidz, getHafalanUjianPerUnit } from '@/lib/data/analytics'

/**
 * Pengambil data halaman analitik tunggal, dibungkus React cache().
 *
 * Halaman itu terdiri dari beberapa seksi yang dimuat terpisah (Suspense),
 * dan panel "Perlu Tindak Lanjut" di atas merangkum angka dari seksi-seksi
 * di bawahnya. Tanpa cache, satu kunjungan halaman menjalankan kueri target
 * tahfidz dan kelengkapan masing-masing dua kali. cache() membuat
 * pemanggilan kedua dalam SATU permintaan memakai hasil yang pertama —
 * tidak lebih: kunjungan berikutnya tetap membaca data segar.
 *
 * Seluruhnya mengambil cakupan SEMUA unit; penyaringan per unit dilakukan di
 * seksinya, supaya satu hasil bisa dipakai bersama ringkasan dan seksi.
 */

export const targetSemua = getTargetTahfidzSemua
export const kelengkapanBulan = cache((bulan: string) => getKelengkapan(bulan, UNIT_ORDER))
export const capaianSemua = cache(() => getCapaianKelas(UNIT_ORDER))
export const kurikulumBulan = cache((bulan: string) => getKurikulum(bulan, UNIT_ORDER))
export const semesterBerjalan = cache(() => getCurrentTerm())
export const drillTahsinSemua = cache(() => getSiswaDrill())
/** Kunci string, bukan array: cache() membandingkan argumen dengan ===. */
export const drillTahfidzUnit = cache((jenjang: Jenjang | 'semua') =>
  getDrillTahfidz(jenjang === 'semua' ? undefined : [jenjang]))
export const ujianSemua = cache(() => getHafalanUjianPerUnit())
