import { cache } from 'react'
import { UNIT_ORDER, dariKunciProgram } from '@/lib/rq/programs'
import type { Jenjang } from '@/types'
import { getTargetTahfidzSemua } from '@/lib/data/target-tahfidz'
import { getKelengkapan } from '@/lib/data/kelengkapan'
import { getCapaianKelas } from '@/lib/data/capaian-kelas'
import { getPengampuAsramaPerSiswa } from '@/lib/data/asrama'
import { createServerClient } from '@/lib/supabase/server'
import { PROGRAM_SMP_BOARDING } from '@/lib/auth/permissions'
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
// Anak boarding: pengampu asramanya ikut disebut di daftar anak tiap sel.
export const capaianSemua = cache(async () => getCapaianKelas(UNIT_ORDER, {
  pengampuTambahan: [{ label: 'asrama', nama: await getPengampuAsramaPerSiswa().catch(() => ({})) }],
}))
/**
 * Capaian per Kelas khusus anak boarding SMP (tampilan Div Qur'an BPA/BPI).
 * Dihitung ulang dari anak-anak itu saja — penyempitan lewat jalur QULS/reguler
 * tidak bisa dipakai, karena boarding mencakup keduanya.
 */
export const capaianBoarding = cache(async () => {
  const { data } = await createServerClient().from('students').select('id')
    .eq('jenjang', 'smp').eq('is_active', true).in('program', [...PROGRAM_SMP_BOARDING])
  const ids = ((data ?? []) as { id: string }[]).map(x => x.id)
  return getCapaianKelas(['smp'], {
    hanyaSiswa: ids,
    pengampuTambahan: [{ label: 'asrama', nama: await getPengampuAsramaPerSiswa().catch(() => ({})) }],
  })
})
export const kurikulumBulan = cache((bulan: string) => getKurikulum(bulan, UNIT_ORDER))
export const semesterBerjalan = cache(() => getCurrentTerm())
/*
  Tiga di bawah ini menerima kunci program (kunciProgram di lib/rq/programs.ts)
  karena hitungannya per unit sudah jadi di dalam — tidak bisa disaring per
  siswa sesudahnya. '' = seluruh program. Kunci string, bukan array:
  cache() membandingkan argumen dengan ===.
*/
export const drillTahsinSemua = cache((program = '') => getSiswaDrill(dariKunciProgram(program)))
export const drillTahfidzUnit = cache((jenjang: Jenjang | 'semua', program = '') =>
  getDrillTahfidz(jenjang === 'semua' ? undefined : [jenjang], dariKunciProgram(program)))
export const ujianSemua = cache((program = '') => getHafalanUjianPerUnit(dariKunciProgram(program)))
