import { createServerClient } from '@/lib/supabase/server'
import { type PeriodKey, periodsYearToDate, toPeriodDate } from '@/lib/finance/period'
import {
  kategoriTahfidz, type KategoriTahfidz, type KategoriTahsin,
  LABEL_TAHFIDZ, LABEL_TAHSIN, nilaiTahfidz, nilaiTahsin,
  type PenilaianTahfidz, type PenilaianTahsin, statusTerhadapStandar,
  URUTAN_TAHFIDZ, URUTAN_TAHSIN,
} from '@/lib/rq/gukar-standar'
import { hadirCount } from './gukar'
import type { GukarGroup, GukarMonthly, GukarParticipant, GukarStatusPegawai } from '@/types'

/**
 * Kesiapan gukar terhadap standar kepegawaian — bahan Laporan Eksekutif SDM.
 *
 * Berbeda dari getGukarRecap yang mengukur KEHADIRAN, berkas ini mengukur
 * CAPAIAN dibanding ambang: tahsin terhadap "Lulus UMMI Jilid 6" dan tahfidz
 * terhadap "minimal 1 juz". Keduanya sengaja dipisah karena menjawab
 * pertanyaan berbeda — yang satu soal keberjalanan program, yang satu soal
 * syarat kepegawaian.
 *
 * Penyebutnya mengikuti laporan: cakupan dihitung terhadap SELURUH peserta,
 * sedangkan capaian tahsin/tahfidz dihitung terhadap yang TERDATA saja.
 * Mencampur keduanya akan membuat unit yang datanya belum lengkap tampak
 * berkemampuan rendah, padahal yang kurang adalah pencatatannya.
 */

export type SumberCapaian = 'terstruktur' | 'catatan' | 'awal' | 'kosong'

export interface KesiapanPeserta {
  id: string
  nama: string
  unit: string
  kelompokId: string
  kelompok: string
  pengampu: string
  kind: string
  statusPegawai: GukarStatusPegawai | null
  kategoriPeran: string
  tahsin: PenilaianTahsin
  tahfidz: PenilaianTahfidz
  sumber: SumberCapaian
  terdata: boolean
  /** Memenuhi kedua syarat inti: tahsin ≥ Jilid 6 DAN tahfidz ≥ 1 juz. */
  inti: boolean
  status: { teks: string; memenuhi: boolean; acuan: string }
  hadir: number
  slot: number
}

export interface RingkasKesiapan {
  total: number
  terdata: number
  persenTerdata: number
  tahsinAmbang: number
  tahfidz1Juz: number
  inti: number
}

export interface KesiapanKelompok extends RingkasKesiapan {
  id: string
  nama: string
  unit: string
  pengampu: string
}

export interface KesiapanUnit extends RingkasKesiapan {
  unit: string
  kelompok: string[]
}

export interface SebaranBaris<T extends string> {
  kategori: T
  label: string
  jumlah: number
}

export interface KesiapanGukar {
  peserta: KesiapanPeserta[]
  perUnit: KesiapanUnit[]
  perKelompok: KesiapanKelompok[]
  ringkas: RingkasKesiapan
  sebaranTahsin: SebaranBaris<KategoriTahsin>[]
  sebaranTahfidz: SebaranBaris<KategoriTahfidz>[]
  /** Kelompok yang belum punya satu pun catatan capaian. */
  kelompokTanpaData: KesiapanKelompok[]
}

const KOSONG: KesiapanGukar = {
  peserta: [], perUnit: [], perKelompok: [],
  ringkas: { total: 0, terdata: 0, persenTerdata: 0, tahsinAmbang: 0, tahfidz1Juz: 0, inti: 0 },
  sebaranTahsin: [], sebaranTahfidz: [], kelompokTanpaData: [],
}

/**
 * Baris bulanan apa adanya dari select('*').
 *
 * Lima kolom migrasi 0029 dibuat opsional karena select('*') tidak akan
 * memuatnya bila migrasi itu belum dijalankan di Supabase — halaman ini harus
 * tetap tampil dengan membaca teks bebasnya, bukan gagal seluruhnya.
 */
type KolomBaru = 'tahap_tahsin' | 'juz_tuntas' | 'juz_berjalan' | 'nilai_tahfidz' | 'surat_pilihan'
type MonthlyRow = Omit<GukarMonthly, KolomBaru> & Partial<Pick<GukarMonthly, KolomBaru>>

export async function getKesiapanGukar(
  termId: string,
  upTo: PeriodKey,
): Promise<KesiapanGukar> {
  try {
    const supabase = createServerClient()

    const [groupsRes, teachersRes] = await Promise.all([
      supabase.from('gukar_groups').select('*').eq('term_id', termId).eq('is_active', true)
        .order('unit').order('name'),
      supabase.from('teachers').select('id, full_name'),
    ])

    const groups = (groupsRes.data ?? []) as GukarGroup[]
    if (groups.length === 0) return KOSONG

    const namaGuru = new Map(
      ((teachersRes.data ?? []) as { id: string; full_name: string }[]).map(t => [t.id, t.full_name]),
    )

    const { data: participantRows } = await supabase
      .from('gukar_participants')
      .select('*')
      .in('group_id', groups.map(g => g.id))
      .eq('is_active', true)
      .order('full_name')

    const participants = (participantRows ?? []) as (GukarParticipant & {
      status_pegawai?: GukarStatusPegawai | null
      kategori_peran?: string | null
    })[]
    if (participants.length === 0) return KOSONG

    const periods = periodsYearToDate(upTo).map(toPeriodDate)
    const { data: monthlyRows } = await supabase
      .from('gukar_monthly')
      .select('*')
      .in('participant_id', participants.map(p => p.id))
      .in('period', periods)
      .order('period', { ascending: true })

    const perPeserta = new Map<string, MonthlyRow[]>()
    for (const row of (monthlyRows ?? []) as MonthlyRow[]) {
      const list = perPeserta.get(row.participant_id)
      if (list) list.push(row)
      else perPeserta.set(row.participant_id, [row])
    }

    const kelompokById = new Map(groups.map(g => [g.id, g]))

    const peserta: KesiapanPeserta[] = participants.map(p => {
      const rows = perPeserta.get(p.id) ?? []
      const terbaru = [...rows].reverse()
      const group = kelompokById.get(p.group_id)

      // "Capaian terakhir yang tercatat" — bukan baris terakhir begitu saja:
      // bulan terbaru bisa baru terisi kehadirannya sementara capaiannya
      // masih menunggu setoran akhir bulan.
      const barisTahap = terbaru.find(r => (r.tahap_tahsin ?? '').trim())
      const barisTahsin = terbaru.find(r => r.capaian_tahsin.trim())
      const barisJuz = terbaru.find(r => r.juz_tuntas !== null && r.juz_tuntas !== undefined)
      const barisTahfidz = terbaru.find(r => r.capaian_tahfidz.trim())
      const barisNilai = terbaru.find(r => r.nilai_tahfidz !== null && r.nilai_tahfidz !== undefined)

      const tahsin = nilaiTahsin(
        barisTahap?.tahap_tahsin ?? '',
        // Tanpa catatan bulanan sama sekali, level_awal dari rekap induk yang
        // dipakai — sumber yang sama dengan yang dibaca laporan Juni.
        barisTahsin?.capaian_tahsin || p.level_awal,
      )
      const tahfidz = nilaiTahfidz(
        barisJuz?.juz_tuntas ?? null,
        barisJuz?.juz_berjalan ?? null,
        barisNilai?.nilai_tahfidz ?? null,
        barisJuz?.surat_pilihan ?? 0,
        // level_awal ikut dibaca di sini karena sebagian ditulis sebagai
        // 'Tahfidz juz 29' — keterangan hafalan, bukan tahap tahsin.
        barisTahfidz?.capaian_tahfidz || p.level_awal,
      )

      const sumber: SumberCapaian =
        barisTahap || barisJuz ? 'terstruktur'
          : barisTahsin || barisTahfidz ? 'catatan'
            : tahsin.tahap || tahfidz.label ? 'awal'
              : 'kosong'

      const terdata = sumber !== 'kosong'
      const kategoriPeran = p.kategori_peran ?? ''

      return {
        id: p.id,
        nama: p.full_name,
        unit: group?.unit || p.unit || 'Tanpa unit',
        kelompokId: p.group_id,
        kelompok: group?.name ?? '—',
        pengampu: group?.pengampu_id ? (namaGuru.get(group.pengampu_id) ?? '—') : '—',
        kind: p.kind ?? '',
        statusPegawai: p.status_pegawai ?? null,
        kategoriPeran,
        tahsin,
        tahfidz,
        sumber,
        terdata,
        inti: tahsin.memenuhi && tahfidz.memenuhi,
        status: statusTerhadapStandar(tahsin, tahfidz, kategoriPeran),
        hadir: rows.reduce((t, r) => t + hadirCount(r), 0),
        slot: rows.length * 5,
      }
    })

    const perKelompok: KesiapanKelompok[] = groups.map(g => {
      const anggota = peserta.filter(x => x.kelompokId === g.id)
      return {
        ...ringkas(anggota),
        id: g.id,
        nama: g.name,
        unit: g.unit || 'Tanpa unit',
        pengampu: g.pengampu_id ? (namaGuru.get(g.pengampu_id) ?? '—') : '—',
      }
    }).filter(k => k.total > 0)

    const unitNames = [...new Set(peserta.map(x => x.unit))].sort()
    const perUnit: KesiapanUnit[] = unitNames.map(unit => {
      const anggota = peserta.filter(x => x.unit === unit)
      return {
        ...ringkas(anggota),
        unit,
        kelompok: perKelompok.filter(k => k.unit === unit).map(k => k.pengampu),
      }
    })

    const hitungTahsin = new Map<KategoriTahsin, number>()
    const hitungTahfidz = new Map<KategoriTahfidz, number>()
    for (const x of peserta.filter(p => p.terdata)) {
      hitungTahsin.set(x.tahsin.kategori, (hitungTahsin.get(x.tahsin.kategori) ?? 0) + 1)
      const k = kategoriTahfidz(x.tahfidz)
      hitungTahfidz.set(k, (hitungTahfidz.get(k) ?? 0) + 1)
    }

    return {
      peserta,
      perUnit,
      perKelompok,
      ringkas: ringkas(peserta),
      sebaranTahsin: URUTAN_TAHSIN.map(kategori => ({
        kategori, label: LABEL_TAHSIN[kategori], jumlah: hitungTahsin.get(kategori) ?? 0,
      })),
      sebaranTahfidz: URUTAN_TAHFIDZ.map(kategori => ({
        kategori, label: LABEL_TAHFIDZ[kategori], jumlah: hitungTahfidz.get(kategori) ?? 0,
      })),
      kelompokTanpaData: perKelompok.filter(k => k.terdata === 0),
    }
  } catch (error) {
    console.error('[gukar-standar] gagal menyusun kesiapan:', error)
    return KOSONG
  }
}

function ringkas(anggota: KesiapanPeserta[]): RingkasKesiapan {
  const terdata = anggota.filter(x => x.terdata)
  return {
    total: anggota.length,
    terdata: terdata.length,
    persenTerdata: anggota.length ? Math.round((terdata.length / anggota.length) * 1000) / 10 : 0,
    tahsinAmbang: terdata.filter(x => x.tahsin.memenuhi).length,
    tahfidz1Juz: terdata.filter(x => x.tahfidz.memenuhi).length,
    inti: terdata.filter(x => x.inti).length,
  }
}
