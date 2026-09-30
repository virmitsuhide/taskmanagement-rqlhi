import { createServerClient } from '@/lib/supabase/server'
import type { PeriodKey } from '@/lib/finance/period'

/**
 * Kelengkapan per PEKAN — pelengkap `getKelengkapan` (lib/data/kelengkapan.ts).
 *
 * Definisinya sama dengan kelengkapan bulanan versi "setoran per sesi":
 * seorang siswa dihitung TERISI untuk sebuah pekan bila ia punya setoran
 * tahsin atau tahfidz yang `setoran_date`-nya jatuh di pekan itu. Yang tidak
 * bisa ikut dibagi per pekan hanyalah capaian akhir bulanan
 * (`halaman_akhir_tahsin`), karena kolom itu tidak bertanggal.
 *
 * Pekan = Senin–Ahad, dipotong di batas bulan. Pekan yang seluruhnya masih di
 * masa depan tidak dikembalikan.
 *
 * TERLAMBAT: setoran yang dicatat (`created_at`, dibaca dalam WIB) lebih dari
 * 2 hari setelah tanggal setorannya (`setoran_date`).
 *
 * Status per halaqoh per pekan:
 *   · 'lengkap'  — semua siswa terisi dan tidak ada catatan yang terlambat
 *   · 'sebagian' — ada yang terisi, tetapi belum semua siswa ATAU ada yang terlambat
 *   · 'kosong'   — tidak ada satu pun setoran pekan itu
 */

export type StatusPekan = 'lengkap' | 'sebagian' | 'kosong'

export interface Pekan {
  /** 'YYYY-MM-DD' Senin (atau tanggal 1 bila bulan mulai di tengah pekan). */
  dari: string
  /** 'YYYY-MM-DD' Ahad (atau tanggal terakhir bulan). */
  sampai: string
}

export interface PekanHalaqoh {
  status: StatusPekan
  terisi: number
  total: number
  terlambat: number
}

export interface KelengkapanMingguan {
  pekan: Pekan[]
  /** halaqohId → satu entri per pekan, urutannya sama dengan `pekan`. */
  perHalaqoh: Record<string, PekanHalaqoh[]>
  /** Jumlah catatan setoran bulan ini yang dicatat > 2 hari setelah tanggalnya. */
  terlambat: number
  /** Jumlah seluruh catatan setoran bulan ini (untuk konteks). */
  totalCatatan: number
}

const EMPTY: KelengkapanMingguan = { pekan: [], perHalaqoh: {}, terlambat: 0, totalCatatan: 0 }

const BATAS_TERLAMBAT_HARI = 2

function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function hariIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** Tanggal (WIB) dari sebuah timestamptz. */
function tanggalWIB(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(ts))
}

function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)
}

/** Pekan Senin–Ahad sebuah bulan, dipotong di batas bulan, tanpa pekan masa depan. */
export function pekanBulan(period: PeriodKey, hariIni: string = hariIniWIB()): Pekan[] {
  const [y, m] = period.split('-').map(Number)
  const awal = new Date(Date.UTC(y, m - 1, 1))
  const akhir = new Date(Date.UTC(y, m, 0))
  const out: Pekan[] = []
  let mulai = awal
  while (mulai <= akhir) {
    // getUTCDay: 0 = Ahad. Ahad pekan ini = mulai + (7 - hari) % 7.
    const keAhad = (7 - mulai.getUTCDay()) % 7
    let selesai = new Date(mulai.getTime() + keAhad * 86_400_000)
    if (selesai > akhir) selesai = akhir
    const dari = isoUTC(mulai)
    if (dari > hariIni) break
    out.push({ dari, sampai: isoUTC(selesai) })
    mulai = new Date(selesai.getTime() + 86_400_000)
  }
  return out
}

export async function getKelengkapanMingguan(
  period: PeriodKey,
  halaqohIds: string[],
): Promise<KelengkapanMingguan> {
  const pekan = pekanBulan(period)
  if (pekan.length === 0 || halaqohIds.length === 0) return { ...EMPTY, pekan }

  try {
    const supabase = createServerClient()

    // Keanggotaan siswa sama dengan loader bulanan: siswa aktif per halaqoh.
    const { data: studentRows } = await supabase
      .from('students')
      .select('id, halaqoh_id')
      .eq('is_active', true)
      .in('halaqoh_id', halaqohIds)
      .range(0, 4999)
    const students = (studentRows ?? []) as { id: string; halaqoh_id: string | null }[]
    if (students.length === 0) return { ...EMPTY, pekan }

    const halaqohOf = new Map<string, string>()
    const totalPer = new Map<string, number>()
    for (const s of students) {
      if (!s.halaqoh_id) continue
      halaqohOf.set(s.id, s.halaqoh_id)
      totalPer.set(s.halaqoh_id, (totalPer.get(s.halaqoh_id) ?? 0) + 1)
    }

    const dari = pekan[0].dari
    const sampai = pekan[pekan.length - 1].sampai
    type Log = { student_id: string; setoran_date: string; created_at: string | null }
    const [logTahsin, logTahfidz] = await Promise.all([
      fetchAll<Log>(() => supabase
        .from('tahsin_logs').select('student_id, setoran_date, created_at')
        .gte('setoran_date', dari).lte('setoran_date', sampai).order('id')),
      fetchAll<Log>(() => supabase
        .from('tahfidz_logs').select('student_id, setoran_date, created_at')
        .gte('setoran_date', dari).lte('setoran_date', sampai).order('id')),
    ])

    const idxPekan = (tgl: string) => pekan.findIndex(p => tgl >= p.dari && tgl <= p.sampai)

    // halaqohId → per pekan: siswa terisi & jumlah catatan terlambat
    const isi = new Map<string, { siswa: Set<string>; terlambat: number }[]>()
    let terlambat = 0
    let totalCatatan = 0
    for (const l of [...logTahsin, ...logTahfidz]) {
      const h = halaqohOf.get(l.student_id)
      if (!h) continue
      const i = idxPekan(l.setoran_date)
      if (i < 0) continue
      totalCatatan += 1
      let arr = isi.get(h)
      if (!arr) {
        arr = pekan.map(() => ({ siswa: new Set<string>(), terlambat: 0 }))
        isi.set(h, arr)
      }
      arr[i].siswa.add(l.student_id)
      if (l.created_at && selisihHari(tanggalWIB(l.created_at), l.setoran_date) > BATAS_TERLAMBAT_HARI) {
        arr[i].terlambat += 1
        terlambat += 1
      }
    }

    const perHalaqoh: Record<string, PekanHalaqoh[]> = {}
    for (const id of halaqohIds) {
      const total = totalPer.get(id) ?? 0
      const arr = isi.get(id)
      perHalaqoh[id] = pekan.map((_, i) => {
        const e = arr?.[i]
        const t = e?.siswa.size ?? 0
        const late = e?.terlambat ?? 0
        const status: StatusPekan =
          t === 0 ? 'kosong' : t >= total && late === 0 ? 'lengkap' : 'sebagian'
        return { status, terisi: t, total, terlambat: late }
      })
    }

    return { pekan, perHalaqoh, terlambat, totalCatatan }
  } catch (e) {
    console.error('[kelengkapan-mingguan] gagal:', e)
    return { ...EMPTY, pekan }
  }
}

/** Ambil seluruh baris, menembus batas 1000 baris PostgREST (sama dengan kelengkapan.ts). */
async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<T[]> {
  const SIZE = 1000
  const out: T[] = []
  for (let page = 0; page < 50; page++) {
    const { data, error } = await build().range(page * SIZE, page * SIZE + SIZE - 1)
    if (error) {
      console.error('[kelengkapan-mingguan] gagal mengambil data:', error)
      break
    }
    const batch = (data ?? []) as T[]
    out.push(...batch)
    if (batch.length < SIZE) break
  }
  return out
}
