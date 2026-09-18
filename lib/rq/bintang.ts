/**
 * Rumus bintang ↔ nilai 0–100 — lihat komentar panjang di
 * components/setoran/StarInput.tsx untuk alasan skalanya.
 *
 * Dipisah dari StarInput karena berkas itu 'use client': halaman server
 * (rekap progres, catatan adab) yang mengimpor fungsi dari sana hanya
 * mendapat rujukan klien, bukan fungsinya.
 */

/** Nilai angka dari jumlah bintang. */
export function nilaiDariBintang(bintang: number): number {
  return 50 + bintang * 10
}

/** Jumlah bintang dari nilai angka — kebalikannya, untuk memuat data lama. */
export function bintangDariNilai(nilai: number | null | undefined): number {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return 0
  // Dibulatkan ke setengah bintang terdekat: nilai lama seperti 88 tidak jatuh
  // persis di kisi bintang, dan menampilkannya sebagai 0 akan lebih
  // menyesatkan daripada menampilkannya sebagai 4★ yang mendekati.
  const b = (nilai - 50) / 10
  return Math.max(0, Math.min(5, Math.round(b * 2) / 2))
}

/**
 * ADAB RENDAH: nilai sikap ≤ 2,5★ (= 75), ditetapkan RQ LHI.
 *
 * Adab TIDAK ikut menentukan lulus/ulang maupun kenaikan halaman — status
 * setoran hanya dari bacaan/hafalan. Adab dicatat terpisah dan direkap di
 * halaman Catatan Adab guru.
 */
export const BINTANG_ADAB_RENDAH = 2.5
export const NILAI_ADAB_RENDAH = nilaiDariBintang(BINTANG_ADAB_RENDAH)

export function adabRendah(nilaiSikap: number | null | undefined): boolean {
  return nilaiSikap !== null && nilaiSikap !== undefined && Number.isFinite(nilaiSikap)
    && nilaiSikap <= NILAI_ADAB_RENDAH
}
