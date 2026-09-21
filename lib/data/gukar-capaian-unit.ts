import { BELUM_TERCATAT, type BarisMatriks, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import type { KesiapanPeserta } from '@/lib/data/gukar-standar'
import { TAHAP_TAHSIN } from '@/lib/rq/gukar-standar'
import { posisiJuz, URUTAN_JUZ } from '@/lib/rq/hafalan'

/**
 * Capaian tahsin & tahfidz guru dan karyawan per UNIT — padanan matriks
 * kelas × jilid milik siswa (lib/data/capaian-kelas.ts), dengan bentuk data
 * yang sama supaya tabelnya bisa dipakai ulang.
 *
 * Sumbernya getKesiapanGukar: capaian terakhir yang tercatat s.d. bulan
 * terpilih, dari kolom terstruktur lebih dulu lalu catatan bebas pengampu.
 * Yang tidak punya catatan apa pun masuk kolom "Belum tercatat" — bukan
 * dianggap "Belum mengaji". Keduanya berbeda: yang satu orangnya belum mulai,
 * yang satu pengampunya belum mencatat.
 */

/** Tahap yang memenuhi ambang kepegawaian "Lulus UMMI Jilid 6". */
const MEMENUHI_TAHSIN = new Set(['Jilid 6', "Al-Qur'an", 'Ghorib', 'Tajwid', 'Tashih'])

export function matriksCapaianGukar(peserta: KesiapanPeserta[]): { tahsin: MatriksCapaian; tahfidz: MatriksCapaian } {
  const tahsinKolom = (p: KesiapanPeserta) => p.tahsin.tahap || BELUM_TERCATAT

  const tahfidzKolom = (p: KesiapanPeserta) => {
    const t = p.tahfidz
    // Juz yang sedang dihafal lebih dulu; tanpanya, juz sesudah jumlah yang
    // sudah tuntas. Urutan hafalan RQ (30 → 26 → 1 …), bukan nomor juz.
    const pos = t.juz !== null
      ? (posisiJuz(t.juz) ?? 0)
      : t.juzTuntas !== null && t.juzTuntas > 0 ? t.juzTuntas + 1 : 0
    if (pos > URUTAN_JUZ.length) return 'Khatam 30 juz'
    if (pos > 0) return `Juz ${URUTAN_JUZ[pos - 1]}`
    return t.label ? 'Lainnya' : BELUM_TERCATAT
  }

  return {
    tahsin: susun(peserta, tahsinKolom, [...TAHAP_TAHSIN],
      new Set(['Belum mengaji', 'Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6', "Al-Qur'an"]),
      k => MEMENUHI_TAHSIN.has(k), '≥ Jilid 6'),
    tahfidz: susun(peserta, tahfidzKolom, [...URUTAN_JUZ.map(j => `Juz ${j}`), 'Khatam 30 juz', 'Lainnya'],
      new Set(['Juz 30', 'Juz 29']),
      k => k !== 'Juz 30' && k !== BELUM_TERCATAT && k !== 'Lainnya', '≥ 1 juz'),
  }
}

function susun(
  peserta: KesiapanPeserta[],
  kolomOf: (p: KesiapanPeserta) => string,
  urutan: string[],
  tetap: Set<string>,
  maju: (k: string) => boolean,
  labelMaju: string,
): MatriksCapaian {
  const perUnit = new Map<string, Map<string, number>>()
  const hitung = new Map<string, number>()
  for (const p of peserta) {
    const k = kolomOf(p)
    const peta = perUnit.get(p.unit) ?? new Map<string, number>()
    peta.set(k, (peta.get(k) ?? 0) + 1)
    perUnit.set(p.unit, peta)
    hitung.set(k, (hitung.get(k) ?? 0) + 1)
  }

  const posisi = (k: string) => (k === BELUM_TERCATAT ? Number.MAX_SAFE_INTEGER : urutan.indexOf(k) === -1 ? urutan.length : urutan.indexOf(k))
  const kolom = [...new Set([...tetap, ...hitung.keys()])]
    .filter(k => tetap.has(k) || (hitung.get(k) ?? 0) > 0)
    .sort((a, b) => posisi(a) - posisi(b))

  // Unit adalah kategori, bukan ordinal: yang terbesar di atas.
  const baris: BarisMatriks[] = [...perUnit.entries()]
    .map(([unit, peta]) => {
      const sel = kolom.map(k => peta.get(k) ?? 0)
      return {
        tingkat: null,
        label: unit,
        total: sel.reduce((a, b) => a + b, 0),
        sel,
        maju: kolom.reduce((n, k, i) => n + (maju(k) ? sel[i] : 0), 0),
      }
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))

  return {
    kolom,
    baris,
    jumlahKolom: kolom.map(k => hitung.get(k) ?? 0),
    total: peserta.length,
    maju: baris.reduce((n, b) => n + b.maju, 0),
    labelMaju,
    dariRekap: 0,
  }
}
