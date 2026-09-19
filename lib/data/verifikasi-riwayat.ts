import { createServerClient } from '@/lib/supabase/server'
import { UNIT_LABELS } from '@/lib/rq/programs'
import { juzTerjauh, kewajibanUjian, posisiJuz, totalJuzHafalan, type KewajibanUjian } from '@/lib/rq/hafalan'
import type { Jenjang, UjianUnit } from '@/types'

/**
 * Status ujian tahfidz tiap anak terhadap apa yang SEMESTINYA sudah ia tempuh.
 *
 * Satu perhitungan untuk dua halaman:
 *   • /ujian/verifikasi — anak yang punya ujian semestinya-sudah tapi belum
 *     tercatat, untuk diperiksa koordinator satu per satu;
 *   • /ujian/tasmi      — rekap tasmi' 3 & 5 juz per unit dan angkatan.
 *
 * "Semestinya sudah" diturunkan dari posisi terjauh anak dalam urutan hafalan,
 * dari setoran ATAU ujian mana pun yang lebih jauh:
 *   • setoran di juz X  → juz sebelum X sudah dilewati (X sendiri belum tuntas)
 *   • ujian lulus juz X → X dan seluruh juz sebelumnya sudah dilewati
 */

export type StatusButir =
  /** Ada catatan ujian lulus dari jalur mana pun. */
  | 'tercatat'
  /** Dinyatakan sudah oleh koordinator — catatan ujiannya dibuat verifikasi. */
  | 'terverifikasi'
  /** Dinyatakan BELUM dilaksanakan — anak perlu menempuh ujian ini. */
  | 'belum'
  /** Belum diperiksa siapa pun. */
  | 'perlu'

export interface ButirUjian extends KewajibanUjian {
  status: StatusButir
  /** Tanggal ujian bila tercatat dan bertanggal. */
  tanggal: string | null
  /** "Mar 2025" — diformat di server supaya teksnya sama saat hidrasi. */
  bulanLabel: string | null
}

export interface StatusHafalanSiswa {
  id: string
  nama: string
  kelas: string | null
  jenjang: Jenjang
  unit: UjianUnit
  unitLabel: string
  /** Tingkat kelas 1–12 dari kolom kelas; null bila tak terbaca. */
  tingkat: number | null
  halaqoh: string | null
  /** Juz yang sedang disetor menurut juz_progress, bila ada. */
  juzSetoran: number | null
  /** Posisi hafalan yang semestinya sudah diujikan. */
  sampaiPosisi: number
  butir: ButirUjian[]
}

export interface HasilStatusHafalan {
  siswa: StatusHafalanSiswa[]
  /** false = tabel verifikasi (0078) belum ada; keputusan "belum" tidak terbaca. */
  tabelVerifikasiAda: boolean
}

const JENJANG_UNIT: Record<UjianUnit, Jenjang[]> = { SD: ['sd', 'sd_juara'], SMP: ['smp'] }

export function unitDariJenjang(j: Jenjang): UjianUnit | null {
  return j === 'smp' ? 'SMP' : j === 'sd' || j === 'sd_juara' ? 'SD' : null
}

function tingkatDari(kelas: string | null): number | null {
  const n = Number(String(kelas ?? '').match(/\d+/)?.[0])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/** '30-28' / '28–30' / '28-30' → '28-30'; '7' tetap '7'. Kunci pencocokan catatan. */
export function normalJuz(teks: string): string {
  const angka = String(teks).split(/[^0-9]+/).filter(Boolean).map(Number)
  if (angka.length <= 1) return String(angka[0] ?? teks).trim()
  return `${Math.min(...angka)}-${Math.max(...angka)}`
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Bulan & tahun menurut WIB, tanpa bergantung pada data locale peramban. */
function labelBulan(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  return `${BULAN_PENDEK[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

async function ambilSemua<T>(buat: (dari: number, ke: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999)
    if (error) return hasil
    const potong = (data ?? []) as T[]
    hasil.push(...potong)
    if (potong.length < 1000) return hasil
  }
}

export async function getStatusHafalan(units: UjianUnit[]): Promise<HasilStatusHafalan> {
  const jenjang = units.flatMap(u => JENJANG_UNIT[u])
  if (jenjang.length === 0) return { siswa: [], tabelVerifikasiAda: true }
  const supabase = createServerClient()

  const [siswaRows, progres, ujian, verif] = await Promise.all([
    ambilSemua<{ id: string; full_name: string; kelas: string | null; jenjang: Jenjang; halaqoh: { name: string } | null }>((a, b) =>
      supabase.from('students')
        .select('id, full_name, kelas, jenjang, halaqoh:halaqoh!students_halaqoh_id_fkey(name)')
        .eq('is_active', true).in('jenjang', jenjang).order('full_name').range(a, b)),
    ambilSemua<{ student_id: string; juz_number: number }>((a, b) =>
      supabase.from('juz_progress').select('student_id, juz_number').gt('ayat_hafal', 0).range(a, b)),
    // Ujian LULUS saja: 'mengulang' belum menuntaskan juznya. Predikat NULL
    // (catatan lama & hasil verifikasi) dihitung lulus — sama dengan lib/data/hafalan.ts.
    ambilSemua<{ id: string; student_id: string; tipe: string; juz: string; jadwal: string | null }>((a, b) =>
      supabase.from('ujian_tahfidz').select('id, student_id, tipe, juz, jadwal')
        .not('student_id', 'is', null).eq('status', 'selesai')
        .or('predikat.is.null,predikat.neq.mengulang').range(a, b)),
    supabase.from('verifikasi_riwayat_tahfidz').select('student_id, tipe, juz, hasil, ujian_id'),
  ])

  const setoranPer = new Map<string, number[]>()
  for (const r of progres) setoranPer.set(r.student_id, [...(setoranPer.get(r.student_id) ?? []), r.juz_number])

  const ujianPer = new Map<string, typeof ujian>()
  for (const r of ujian) ujianPer.set(r.student_id, [...(ujianPer.get(r.student_id) ?? []), r])

  const verifPer = new Map<string, { hasil: 'sudah' | 'belum'; ujian_id: string | null }>()
  for (const v of (verif.data ?? []) as { student_id: string; tipe: string; juz: string; hasil: 'sudah' | 'belum'; ujian_id: string | null }[]) {
    verifPer.set(`${v.student_id}|${v.tipe}|${normalJuz(v.juz)}`, { hasil: v.hasil, ujian_id: v.ujian_id })
  }

  const siswa: StatusHafalanSiswa[] = []
  for (const s of siswaRows) {
    const unit = unitDariJenjang(s.jenjang)
    if (!unit) continue
    const juzSetoran = juzTerjauh(setoranPer.get(s.id) ?? [])
    const posSetoran = juzSetoran === null ? 0 : (posisiJuz(juzSetoran) ?? 1) - 1
    const catatan = ujianPer.get(s.id) ?? []
    const posUjian = totalJuzHafalan(catatan.map(u => u.juz))
    const sampaiPosisi = Math.max(posSetoran, posUjian)

    const tercatat = new Map<string, { id: string; jadwal: string | null }>()
    for (const u of catatan) tercatat.set(`${u.tipe}|${normalJuz(u.juz)}`, { id: u.id, jadwal: u.jadwal })

    const butir: ButirUjian[] = kewajibanUjian(sampaiPosisi).map(k => {
      const kunci = `${k.tipe}|${k.juz}`
      const ada = tercatat.get(kunci)
      const v = verifPer.get(`${s.id}|${kunci}`)
      const status: StatusButir = ada
        ? (v?.hasil === 'sudah' && v.ujian_id === ada.id ? 'terverifikasi' : 'tercatat')
        : v?.hasil === 'belum' ? 'belum' : 'perlu'
      const tanggal = ada?.jadwal ?? null
      return { ...k, status, tanggal, bulanLabel: tanggal ? labelBulan(tanggal) : null }
    })

    siswa.push({
      id: s.id, nama: s.full_name, kelas: s.kelas, jenjang: s.jenjang, unit,
      unitLabel: UNIT_LABELS[s.jenjang], tingkat: tingkatDari(s.kelas),
      halaqoh: s.halaqoh?.name ?? null, juzSetoran, sampaiPosisi, butir,
    })
  }

  return { siswa, tabelVerifikasiAda: !verif.error }
}
