/**
 * Jalan DRILL tahsin — murni, tanpa akses data.
 *
 * Anak yang lulus halaman terakhir jilidnya masuk drill: membaca ulang jilid
 * itu dari hal. 1 sampai lulus ujian tahsin. Satu PUTARAN selesai saat
 * halaman terakhir lulus lagi, lalu putaran berikutnya mulai dari hal. 1.
 *
 * Putaran hanya terhitung bila DIMULAI DARI HAL. 1: lulus halaman terakhir
 * tanpa pernah lulus hal. 1 sejak putaran itu dimulai tidak menutup apa pun.
 * Sebelum 2026-10-07 drill boleh di halaman mana saja — guru melatih hal.
 * 10, 16, 18 di sela hal. 40 — dan latihan acak itu bukan membaca ulang satu
 * jilid. Aturan "ada halaman lain selain terakhir" pernah dipakai dan
 * menghitung latihan acak itu sebagai 2–3 putaran.
 */

export interface LogDrill {
  halaman: number | null
  status: string
}

export interface JalanDrill {
  /** Halaman bawaan setoran drill berikutnya. */
  halaman: number
  /** Putaran yang sedang berjalan, mulai 1. */
  putaran: number
  /** Setoran terakhir berstatus Lanjut di halaman itu — barisnya dilanjutkan. */
  lanjut: { baris_ke: number | null } | null
  /** Putaran tiap log, sejajar dengan larik masukan. */
  putaranLog: number[]
}

/** `logs` URUT LAMA → BARU, hanya setoran drill jilid yang sedang di-drill. */
export function jalanDrill(
  logs: (LogDrill & { baris_ke?: number | null })[],
  totalHalaman: number,
): JalanDrill {
  let putaran = 1
  let jalan = false
  const putaranLog: number[] = []
  for (const l of logs) {
    putaranLog.push(putaran)
    if (l.status !== 'lulus' || l.halaman === null) continue
    if (l.halaman >= totalHalaman) {
      if (jalan) { putaran++; jalan = false }
    } else if (l.halaman === 1) jalan = true
  }

  const akhir = [...logs].reverse().find(l => l.halaman !== null)
  if (!akhir) return { halaman: 1, putaran, lanjut: null, putaranLog }
  if (akhir.status === 'lulus') {
    return { halaman: akhir.halaman! >= totalHalaman ? 1 : akhir.halaman! + 1, putaran, lanjut: null, putaranLog }
  }
  return {
    halaman: akhir.halaman!,
    putaran,
    lanjut: akhir.status === 'lanjut' ? { baris_ke: akhir.baris_ke ?? null } : null,
    putaranLog,
  }
}

/**
 * "Drill putaran 2 hal. 1–5" — halaman drill yang disetor dalam periode,
 * dikelompokkan per putaran: rentang yang melewati pergantian putaran
 * ("hal. 1–40") akan menyesatkan. `periode` = putaran & halaman tiap setoran
 * drill periode itu, urut lama → baru. Kosong = sebut putaran yang berjalan.
 */
export function teksDrill(periode: { putaran: number; halaman: number }[], putaranKini: number): string {
  if (periode.length === 0) return `Drill putaran ${putaranKini}`
  const per = new Map<number, number[]>()
  for (const p of periode) per.set(p.putaran, [...(per.get(p.putaran) ?? []), p.halaman])
  return 'Drill ' + [...per.entries()].map(([putaran, hal]) => {
    const a = Math.min(...hal), b = Math.max(...hal)
    return `putaran ${putaran} hal. ${a === b ? a : `${a}–${b}`}`
  }).join(' · ')
}
