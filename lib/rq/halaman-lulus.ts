/**
 * Berapa HALAMAN yang dilewati satu setoran tahsin Lulus — murni, tanpa akses data.
 *
 * Satu setoran tidak selalu satu halaman: guru boleh menyimak beberapa
 * halaman sekaligus (hal. 5 → hal. 10), dan setoran berikutnya bisa datang
 * dari guru lain (halaqoh sekolah ↔ ekstra). Karena itu jumlahnya dihitung
 * dari SELISIH dengan setoran Lulus sebelumnya milik anak itu, dari sumber
 * mana pun — bukan dari banyaknya baris setoran.
 *
 * Drill membaca ulang jilid dari hal. 1 (lihat drill-tahsin.ts): setoran
 * drill pertama dihitung dari hal. 1, dan halaman yang lebih kecil dari
 * sebelumnya berarti putaran baru yang juga mulai dari hal. 1.
 */

export interface LogHalaman {
  id: string
  halaman: number | null
  status: string
  drill: boolean | null
  jilid_id: string | null
}

/** `logs` milik SATU anak, URUT LAMA → BARU. Hasil: id setoran Lulus → halaman yang dilewati. */
export function halamanLulusPerSetoran(logs: LogHalaman[]): Map<string, number> {
  const hasil = new Map<string, number>()
  let sebelum: { halaman: number; drill: boolean; jilid_id: string | null } | null = null
  for (const l of logs) {
    if (l.status !== 'lulus' || l.halaman === null) continue
    const drill = Boolean(l.drill)
    const sejalur = sebelum !== null && sebelum.drill === drill && sebelum.jilid_id === l.jilid_id
    let n: number
    if (drill) {
      // Masuk drill atau putaran baru: dihitung dari hal. 1.
      const dari = sejalur ? sebelum!.halaman : 0
      n = l.halaman > dari ? l.halaman - dari : l.halaman
    } else if (!sejalur) {
      // Tanpa pembanding (setoran pertama di jilid ini / sesudah drill) — satu halaman.
      n = 1
    } else {
      // Tidak lebih jauh dari Lulus sebelumnya — mengulang halaman yang sudah
      // lulus, atau guru lain mencatat posisi yang tertinggal (sekolah hal. 36
      // sesudah ekstra hal. 39): tidak ada halaman baru.
      n = Math.max(0, l.halaman - sebelum!.halaman)
    }
    hasil.set(l.id, n)
    // Setoran biasa tidak memundurkan pembanding: sesudah hal. 39 lalu 36,
    // hal. 40 dihitung +1 dari 39. Drill justru mundur saat putaran baru.
    const halaman: number = !drill && sejalur ? Math.max(sebelum!.halaman, l.halaman) : l.halaman
    sebelum = { halaman, drill, jilid_id: l.jilid_id }
  }
  return hasil
}
