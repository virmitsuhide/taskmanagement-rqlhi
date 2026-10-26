import type { WaktuEkstra } from '@/lib/data/ekstra'

/**
 * Pemeriksaan daftar waktu halaqoh ekstra (0125) — satu tempat untuk guru
 * dan koordinator. Dua kali sehari (pagi & sore) dan beberapa hari sepekan
 * boleh; dua waktu yang BERTUMPUK di hari yang sama tidak — itu hampir pasti
 * salah ketik, dan presensi per tanggal tidak bisa membedakannya.
 */

/** Jadwal utama + 13 tambahan = dua waktu tiap hari. Sama dengan CHECK di 0125. */
export const MAKS_WAKTU_EKSTRA = 14

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/

export function periksaJadwalEkstra(masuk: unknown): { jadwal: WaktuEkstra[] } | { error: string } {
  if (!Array.isArray(masuk) || masuk.length === 0) return { error: 'Isi sedikitnya satu waktu.' }
  if (masuk.length > MAKS_WAKTU_EKSTRA) return { error: `Paling banyak ${MAKS_WAKTU_EKSTRA} waktu sepekan.` }

  const jadwal: WaktuEkstra[] = []
  for (const w of masuk as Partial<WaktuEkstra>[]) {
    const hari = Number(w?.hari)
    const mulai = String(w?.jam_mulai ?? '').slice(0, 5)
    const selesai = String(w?.jam_selesai ?? '').slice(0, 5)
    if (!(Number.isInteger(hari) && hari >= 1 && hari <= 7)) return { error: 'Hari tidak valid.' }
    if (!JAM.test(mulai) || !JAM.test(selesai) || selesai <= mulai) return { error: 'Jam selesai harus setelah jam mulai.' }
    jadwal.push({ hari, jam_mulai: mulai, jam_selesai: selesai, tempat: String(w?.tempat ?? '').trim().slice(0, 120) })
  }

  jadwal.sort((a, b) => a.hari - b.hari || a.jam_mulai.localeCompare(b.jam_mulai))
  for (let i = 1; i < jadwal.length; i++) {
    const a = jadwal[i - 1], b = jadwal[i]
    if (a.hari === b.hari && b.jam_mulai < a.jam_selesai) return { error: 'Ada dua waktu yang bertumpuk di hari yang sama.' }
  }
  return { jadwal }
}

/** Waktu pertama → kolom jadwal utama; sisanya → jadwal_tambahan. */
export function kolomJadwal(jadwal: WaktuEkstra[]) {
  const [utama, ...lain] = jadwal
  return {
    hari: utama.hari, jam_mulai: utama.jam_mulai, jam_selesai: utama.jam_selesai, tempat: utama.tempat,
    jadwal_tambahan: lain,
  }
}
