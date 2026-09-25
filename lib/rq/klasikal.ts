import type { SiswaSesiTahsin } from '@/lib/data/setoran-sesi'

/**
 * Setoran tahsin KLASIKAL — sekelompok anak membaca bersama halaman/ayat yang
 * sama. Kelompoknya diatur pengampu (kelompok_klasikal, 0080); fungsi di sini
 * dipakai bersama halaman Atur Kelompok dan halaman Setor Tahsin per sesi.
 */

type Siswa = Pick<SiswaSesiTahsin, 'id' | 'jilid_id' | 'materi' | 'total_halaman' | 'halaman' | 'baca_quran' | 'quran'>

/**
 * Kunci posisi: jilid + halaman buku, atau jilid + surat + ayat untuk tahap
 * mushaf. Tahap berbasis materi (Gharib, Tajwid) dikelompokkan per tahap saja:
 * halamannya tidak bermakna, dan satu kelas biasanya menghafal materi yang sama.
 */
export function kunciPosisi(s: Siswa): string | null {
  if (!s.jilid_id) return null
  if (s.materi.length > 0) return `m|${s.jilid_id}`
  if (s.total_halaman !== null) return s.halaman ? `b|${s.jilid_id}|${s.halaman}` : null
  if (s.baca_quran && s.quran.surat_id && s.quran.ayat) return `q|${s.jilid_id}|${s.quran.surat_id}|${s.quran.ayat}`
  return null
}

/** Usulan kelompok: anak yang posisinya sama persis, minimal dua. */
export function usulanKelompok(siswa: Siswa[]): string[][] {
  const per = new Map<string, string[]>()
  for (const s of siswa) {
    const k = kunciPosisi(s)
    if (k) per.set(k, [...(per.get(k) ?? []), s.id])
  }
  return [...per.values()].filter(ids => ids.length >= 2)
}

/**
 * Semua anak berjilid boleh klasikal. Di tahap Gharib/Tajwid kelompoknya
 * menyetor satu daftar materi bersama; pengecualian Ulang tetap per anak.
 */
export function bisaKlasikal(s: Siswa): boolean {
  return Boolean(s.jilid_id)
}

/**
 * Keanggotaan untuk layar setoran dari pengaturan tersimpan.
 *
 * Anggota yang jilidnya berbeda dari mayoritas kelompok setor INDIVIDUAL hari
 * itu dan dilaporkan: server menolak halaman jilid yang bukan jilid anak itu,
 * jadi menyamakannya hanya menghasilkan setoran yang gagal. Kelompok yang
 * tersisa satu anak juga dibubarkan untuk hari itu.
 */
export function anggotaDariPengaturan(
  kelompok: { id: string; anggota: string[] }[],
  siswa: Siswa[],
): { anggota: Record<string, string | null>; bedaJilid: string[] } {
  const perId = new Map(siswa.map(s => [s.id, s]))
  const anggota: Record<string, string | null> = Object.fromEntries(siswa.map(s => [s.id, null]))
  const bedaJilid: string[] = []
  for (const k of kelompok) {
    const calon = k.anggota.map(id => perId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
    const hitung = new Map<string, number>()
    for (const s of calon) if (bisaKlasikal(s)) hitung.set(s.jilid_id!, (hitung.get(s.jilid_id!) ?? 0) + 1)
    const jilidUtama = [...hitung.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const sah = calon.filter(s => bisaKlasikal(s) && s.jilid_id === jilidUtama)
    for (const s of calon) if (!sah.includes(s)) bedaJilid.push(s.id)
    if (sah.length >= 2) for (const s of sah) anggota[s.id] = k.id
  }
  return { anggota, bedaJilid }
}
