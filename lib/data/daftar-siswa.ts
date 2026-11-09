import { createServerClient } from '@/lib/supabase/server'
import { getListProgramScope, getManageableJenjang } from '@/lib/auth/permissions'
import { BELUM_TERCATAT, getPosisiUnit } from '@/lib/data/capaian-kelas'
import { posisiJuz30, URUTAN_SURAT_JUZ30 } from '@/lib/rq/hafalan-juz30'
import { SURAH } from '@/lib/rq/quran'
import { tingkatOf } from '@/lib/rq/sesi'
import type { Jenjang, UserRole as Role } from '@/types'

/**
 * Baris daftar /siswa beserta capaiannya — dipakai halaman DAN unduhan Excel
 * (app/siswa/unduh), supaya berkas yang diunduh berisi angka dan urutan yang
 * persis sama dengan yang sedang dilihat di layar.
 */

export const UNITS: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

export type SortKey = 'nama' | 'pengampu' | 'tahsin' | 'tahfidz'
export const SORT_KEYS: SortKey[] = ['nama', 'pengampu', 'tahsin', 'tahfidz']

export const LABEL_SORT: Record<SortKey, string> = {
  nama: 'Nama siswa', pengampu: 'Pengampu', tahsin: 'Capaian tahsin', tahfidz: 'Capaian tahfidz',
}

/** Nama & pengampu mulai A→Z; capaian mulai dari yang paling jauh. */
export const ARAH_AWAL: Record<SortKey, 'asc' | 'desc'> = {
  nama: 'asc', pengampu: 'asc', tahsin: 'desc', tahfidz: 'desc',
}

/** Keterangan arah yang dibaca manusia, bukan sekadar panah. */
export function ketArah(key: SortKey, d: 'asc' | 'desc'): string {
  if (key === 'nama' || key === 'pengampu') return d === 'asc' ? 'A → Z' : 'Z → A'
  return d === 'desc' ? 'terjauh dulu' : 'terdekat dulu'
}

export function bacaUrutan(sort?: string, dir?: string): { sort: SortKey; dir: 'asc' | 'desc' } {
  const s: SortKey = SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'nama'
  return { sort: s, dir: dir === 'asc' || dir === 'desc' ? dir : ARAH_AWAL[s] }
}

/** Unit yang boleh dilihat peran ini di /siswa. */
export function jenjangTerlihat(role: Role): Jenjang[] {
  return ['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(role)
    ? UNITS
    : getManageableJenjang(role).filter(j => UNITS.includes(j))
}

/** Urut kelas secara alami: 1A, 1B, 2A … 10A — bukan 1A, 10A, 2A. */
export function urutKelas(a: string, b: string): number {
  const ta = tingkatOf(a) ?? 0
  const tb = tingkatOf(b) ?? 0
  return ta !== tb ? ta - tb : a.localeCompare(b, 'id')
}

export interface Baris {
  id: string
  full_name: string
  nis: string | null
  kelas: string | null
  program: string | null
  jenjang: Jenjang
  is_active: boolean
  halaqoh: string | null
  pengampu: string | null
  /** Indeks kolom di URUTAN_TAHSIN (makin besar makin jauh); null = belum tercatat. */
  tahsinUrut: number | null
  /** Pemisah seri dalam satu kolom: halaman jilid. */
  tahsinSub: number
  tahsinLabel: string
  /** Indeks kolom di urutan tahfidz unit (makin besar makin jauh); null = belum tercatat. */
  tahfidzUrut: number | null
  /** Pemisah seri: posisi surat Juz 30 (An-Nas → An-Naba') × 1000 + ayat. */
  tahfidzSub: number
  tahfidzLabel: string
}

/**
 * Siswa aktif sebuah unit di satu kelas atau beberapa kelas (seangkatan),
 * lengkap dengan capaiannya. `query` = pencarian nama/NIS yang sedang aktif.
 */
export async function getBarisSiswa(opsi: {
  role: Role
  jenjang: Jenjang
  kelas: string[]
  query?: string
}): Promise<Baris[]> {
  const { jenjang, kelas, query } = opsi
  if (kelas.length === 0) return []
  const supabase = createServerClient()
  const programScope = getListProgramScope(opsi.role, jenjangTerlihat(opsi.role))

  let q = supabase
    .from('students')
    .select(
      'id, full_name, nis, jenjang, kelas, program, is_active, current_jilid_page,' +
      ' halaqoh:halaqoh!students_halaqoh_id_fkey(name, wali:teachers!halaqoh_wali_teacher_id_fkey(full_name))',
    )
    .eq('is_active', true)
    .eq('jenjang', jenjang)
    .in('kelas', kelas)
  if (programScope) q = q.in('program', programScope as string[])
  if (query) q = q.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)

  /*
    Capaian dibaca lewat getPosisiUnit — aturan yang sama dengan dashboard
    Capaian Unit & laporan kurikulum. Menghitung sendiri (surah bernomor
    terkecil, order_num jilid) membuat urutan di sini berbeda dari dashboard:
    SMA yang juznya bebas, juz yang tuntas lewat ujian, dan order_num yang
    tidak setara lintas metode.
  */
  const [{ data }, posisi] = await Promise.all([q, getPosisiUnit(jenjang, { kelas })])
  const rows = (data ?? []) as unknown as {
    id: string; full_name: string; nis: string | null; jenjang: Jenjang
    kelas: string | null; program: string | null; is_active: boolean
    current_jilid_page: number | null
    halaqoh: { name: string; wali: { full_name: string } | null } | null
  }[]

  const ids = rows.map(r => r.id)
  const posisiById = new Map(posisi.siswa.map(s => [s.id, s]))
  const peringkat = (urutan: string[], kolom: string | undefined) => {
    const i = kolom && kolom !== BELUM_TERCATAT ? urutan.indexOf(kolom) : -1
    return i === -1 ? null : i
  }

  // Pemisah seri di dalam satu kolom: kolom tahfidz 'Juz 30' bisa berisi
  // anak di An-Nas maupun di An-Naba'. Posisi surat Juz 30 (mundur dari
  // An-Nas) memisahkan mereka; di luar Juz 30 cukup kolomnya.
  type Log = { student_id: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null }
  const logData: Log[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data: potong } = await supabase.from('tahfidz_logs')
      .select('student_id, surat_id, ayat_dari, ayat_ke')
      .in('student_id', ids.slice(i, i + 150)).in('kind', ['ziyadah', 'hafalan_baru'])
    logData.push(...((potong ?? []) as Log[]))
  }
  const logPerSiswa = new Map<string, Log[]>()
  for (const l of logData) {
    const d = logPerSiswa.get(l.student_id) ?? []
    d.push(l)
    logPerSiswa.set(l.student_id, d)
  }

  return rows.map(r => {
    const p = posisiById.get(r.id)
    const pos30 = posisiJuz30(logPerSiswa.get(r.id) ?? [])
    const surah = pos30 ? SURAH[pos30.surat - 1] : undefined
    const tahfidzKolom = p?.tahfidz
    const tahfidzAda = tahfidzKolom && tahfidzKolom !== BELUM_TERCATAT
    return {
      id: r.id,
      full_name: r.full_name,
      nis: r.nis,
      kelas: r.kelas,
      program: r.program,
      jenjang: r.jenjang,
      is_active: r.is_active,
      halaqoh: r.halaqoh?.name ?? null,
      pengampu: r.halaqoh?.wali?.full_name ?? null,
      tahsinUrut: p?.level ? peringkat(posisi.urutanTahsin, p.tahsin) : null,
      tahsinSub: r.current_jilid_page ?? 0,
      tahsinLabel: p?.level ? `${p.level}${r.current_jilid_page ? ` hal ${r.current_jilid_page}` : ''}` : '—',
      tahfidzUrut: peringkat(posisi.urutanTahfidz, tahfidzKolom),
      tahfidzSub: pos30 ? URUTAN_SURAT_JUZ30.indexOf(pos30.surat) * 1000 + pos30.ayat : 0,
      tahfidzLabel: tahfidzAda
        ? `${tahfidzKolom}${tahfidzKolom === 'Juz 30' && surah ? ` · ${surah.nama}` : ''}`
        : '—',
    }
  })
}

/**
 * Urutkan di tempat. Kosong selalu di ujung, apa pun arahnya — baris "belum
 * tercatat" atau "tanpa pengampu" tidak boleh menyela deretan yang sedang
 * dibandingkan. Seri dipecah dengan nama, supaya urutan stabil.
 */
export function urutkanBaris(baris: Baris[], sort: SortKey, dir: 'asc' | 'desc'): Baris[] {
  const arah = dir === 'asc' ? 1 : -1
  const menurutNama = (a: Baris, b: Baris) => a.full_name.localeCompare(b.full_name, 'id')
  const kosongDiUjung = <T,>(x: T | null, y: T | null, banding: (x: T, y: T) => number) => {
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    return arah * banding(x, y)
  }
  return baris.sort((a, b) => {
    switch (sort) {
      case 'pengampu':
        return kosongDiUjung(a.pengampu, b.pengampu, (x, y) => x.localeCompare(y, 'id')) || menurutNama(a, b)
      case 'tahsin':
        return kosongDiUjung(a.tahsinUrut, b.tahsinUrut, (x, y) => x - y)
          || (a.tahsinUrut === null ? 0 : arah * (a.tahsinSub - b.tahsinSub))
          || menurutNama(a, b)
      case 'tahfidz':
        return kosongDiUjung(a.tahfidzUrut, b.tahfidzUrut, (x, y) => x - y)
          || (a.tahfidzUrut === null ? 0 : arah * (a.tahfidzSub - b.tahfidzSub))
          || menurutNama(a, b)
      default:
        return arah * menurutNama(a, b)
    }
  })
}
