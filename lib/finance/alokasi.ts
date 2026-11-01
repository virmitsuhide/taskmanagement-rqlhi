/**
 * Sumber dana pengeluaran (tabel 1.5.3) — dihitung, bukan diisi.
 *
 * Pola ini dibaca dari laporan BPH Agustus & September 2026 dan menghasilkan
 * angka keduanya persis:
 *
 *   1. Tiap unit membiayai pos miliknya sendiri lebih dulu
 *      (SD → Gaji OS SD, SMP → Gaji OS SMP, Ekstra → Gaji Ekstra,
 *       Proposal Yayasan → Program).
 *   2. Kekurangan pos selain Gaji YYS ditutup dari SISA dana unit, berurutan
 *      SD → SMP → Ekstra → SD Quls Takhassus → Lain-lain → Proposal.
 *      (Agustus: SMP kurang Rp7.285.000 untuk Gaji OS SMP → ditutup SD;
 *       operasional ditutup sisa SD Rp284.000 lalu Ekstra Rp205.800.)
 *   3. Gaji YYS dibiayai seluruh sisa dana unit, urutan yang sama.
 *   4. Subsidi Yayasan menutup sisanya. Bila subsidi yang diisi bendahara
 *      kurang, selisihnya muncul sebagai `belumTerdanai`; bila lebih,
 *      sebagai sisa (`sisa`) — dua-duanya berarti laporan tidak balance.
 */

export const SUBSIDI = 'subsidi_yayasan'

/** Pos yang lebih dulu dibiayai unit pemiliknya: pengeluaran → pemasukan. */
const MILIK_UNIT: Record<string, string> = {
  gaji_os_sd: 'sd',
  gaji_os_smp: 'smp',
  gaji_ekstra: 'ekstra',
  program: 'proposal_yayasan',
}

/** Urutan sumber penutup kekurangan (selain subsidi). Slug baru menyusul di belakang. */
const URUTAN_SUMBER = ['sd', 'smp', 'ekstra', 'sd_quls_takhassus', 'lain_lain', 'proposal_yayasan']

export interface HasilAlokasi {
  /** pengeluaran slug → (pemasukan slug → rupiah). */
  matriks: Record<string, Record<string, number>>
  /** Pengeluaran yang tidak tertutup dana apa pun. */
  belumTerdanai: number
  /** Dana yang tidak terpakai, per sumber. */
  sisa: Record<string, number>
}

/**
 * @param pemasukan   slug pos pemasukan → jumlah diterima bulan itu
 * @param pengeluaran slug pos pengeluaran → jumlah, URUT tampil (Gaji YYS di mana pun)
 */
export function hitungSumberDana(pemasukan: Record<string, number>, pengeluaran: [string, number][]): HasilAlokasi {
  const sisa: Record<string, number> = { ...pemasukan }
  const matriks: Record<string, Record<string, number>> = {}
  const kurang: Record<string, number> = {}
  const urutan = [...URUTAN_SUMBER, ...Object.keys(pemasukan).filter(s => s !== SUBSIDI && !URUTAN_SUMBER.includes(s))]

  const ambil = (pos: string, sumber: string, perlu: number): number => {
    const ada = sisa[sumber] ?? 0
    const pakai = Math.min(ada, perlu)
    if (pakai > 0) {
      sisa[sumber] = ada - pakai
      ;(matriks[pos] ??= {})[sumber] = ((matriks[pos] ??= {})[sumber] ?? 0) + pakai
    }
    return perlu - pakai
  }

  // 1. Pos milik unit.
  for (const [pos, jumlah] of pengeluaran) {
    matriks[pos] ??= {}
    kurang[pos] = MILIK_UNIT[pos] ? ambil(pos, MILIK_UNIT[pos], jumlah) : jumlah
  }
  // 2. Kekurangan pos selain Gaji YYS, dari sisa unit.
  for (const [pos] of pengeluaran) {
    if (pos === 'gaji_yys') continue
    for (const s of urutan) if (kurang[pos] > 0) kurang[pos] = ambil(pos, s, kurang[pos])
  }
  // 3. Gaji YYS dari sisa unit.
  if (kurang.gaji_yys > 0) for (const s of urutan) if (kurang.gaji_yys > 0) kurang.gaji_yys = ambil('gaji_yys', s, kurang.gaji_yys)
  // 4. Subsidi menutup sisanya — Gaji YYS dulu, lalu pos lain yang masih kurang.
  for (const pos of ['gaji_yys', ...pengeluaran.map(([p]) => p).filter(p => p !== 'gaji_yys')]) {
    if (kurang[pos] > 0) kurang[pos] = ambil(pos, SUBSIDI, kurang[pos])
  }

  return {
    matriks,
    belumTerdanai: Object.values(kurang).reduce((n, v) => n + Math.max(v, 0), 0),
    sisa: Object.fromEntries(Object.entries(sisa).filter(([, v]) => v > 0)),
  }
}
