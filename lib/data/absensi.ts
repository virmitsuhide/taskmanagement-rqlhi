import { createServerClient } from '@/lib/supabase/server'
import { hitungRekap, REKAP_KOSONG, type RekapAbsensi, type StatusAbsensi } from '@/lib/rq/absensi'
import { ditiadakan, hariKe, hariProgram } from '@/lib/rq/kalender-quran'
import { getKalender } from '@/lib/data/kalender-quran'
import { getCurrentTerm } from '@/lib/data/terms'
import { tingkatOf } from '@/lib/rq/sesi'
import type { Jenjang } from '@/types'

/**
 * Pembacaan absensi harian (0081).
 *
 * Semua fungsi di sini tahan terhadap tabel yang belum ada: selama migrasi
 * 0081 belum di-paste ke Supabase, layar absensi menampilkan pemberitahuan
 * dan rapor memakai rekap kosong — bukan galat 500.
 */

export interface BarisAbsensi {
  student_id: string
  status: StatusAbsensi
  catatan: string
}

export interface AbsensiSatuHari {
  /** false = migrasi 0081 belum dijalankan. */
  tabelAda: boolean
  /** Kosong berarti pertemuan hari itu belum pernah diabsen. */
  baris: BarisAbsensi[]
}

export async function getAbsensiTanggal(halaqohId: string, tanggal: string): Promise<AbsensiSatuHari> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('absensi_harian')
    .select('student_id, status, catatan')
    .eq('halaqoh_id', halaqohId)
    .eq('tanggal', tanggal)
  if (error) return { tabelAda: false, baris: [] }
  return { tabelAda: true, baris: (data ?? []) as BarisAbsensi[] }
}

/** Tanggal yang sudah pernah diabsen di sesi ini, terbaru dulu. */
export async function getTanggalTerabsen(halaqohId: string, batas = 30): Promise<string[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('absensi_harian')
    .select('tanggal')
    .eq('halaqoh_id', halaqohId)
    .order('tanggal', { ascending: false })
    .limit(batas * 40) // satu tanggal punya sebanyak anggota halaqoh barisnya
  if (error) return []
  return [...new Set((data ?? []).map(r => r.tanggal as string))].slice(0, batas)
}

/**
 * Rekap kehadiran sejumlah anak dalam satu rentang tanggal — bahan rapor.
 *
 * Disaring per siswa, bukan per halaqoh: anak yang pindah sesi di tengah
 * semester tetap membawa seluruh riwayat kehadirannya.
 */
export async function getRekapAbsensi(
  studentIds: string[],
  dari: string,
  sampai: string,
): Promise<{ tabelAda: boolean; per: Record<string, RekapAbsensi> }> {
  if (studentIds.length === 0) return { tabelAda: true, per: {} }
  const supabase = createServerClient()

  const kumpul: { student_id: string; status: StatusAbsensi }[] = []
  // Dipecah supaya daftar id tidak melebihi panjang URL PostgREST.
  for (let i = 0; i < studentIds.length; i += 200) {
    const { data, error } = await supabase
      .from('absensi_harian')
      .select('student_id, status')
      .in('student_id', studentIds.slice(i, i + 200))
      .gte('tanggal', dari)
      .lte('tanggal', sampai)
    if (error) return { tabelAda: false, per: {} }
    kumpul.push(...((data ?? []) as { student_id: string; status: StatusAbsensi }[]))
  }

  const per: Record<string, StatusAbsensi[]> = {}
  for (const r of kumpul) (per[r.student_id] ??= []).push(r.status)

  return {
    tabelAda: true,
    per: Object.fromEntries(studentIds.map(id => [id, per[id] ? hitungRekap(per[id]) : { ...REKAP_KOSONG }])),
  }
}

/**
 * Anggota aktif sebuah sesi — daftar nama saja, tanpa posisi tahsin/tahfidz.
 * Layar absensi tidak butuh capaian; memuatnya hanya memperlambat.
 */
export async function getSiswaSesi(halaqohId: string): Promise<{ id: string; full_name: string; kelas: string | null }[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select('id, full_name, kelas')
    .eq('halaqoh_id', halaqohId)
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as { id: string; full_name: string; kelas: string | null }[]
}

// ─── Rekap sebulan ───────────────────────────────────────────────────────────

export interface BarisAbsensiBulan {
  id: string
  nama: string
  kelas: string | null
  /** 'YYYY-MM-DD' → status hari itu. Tanggal tanpa entri = belum diabsen. */
  sel: Record<string, { status: StatusAbsensi; catatan: string }>
  /**
   * Tanggal yang bagi anak ini MEMANG TIDAK ADA SESI, beserta sebabnya —
   * "Bukan hari sesi" bila di luar jadwal programnya, atau alasan yang
   * ditulis koordinator bila sesinya ditiadakan (0084).
   *
   * Dibedakan dari sel kosong karena keduanya sangat berbeda: yang satu
   * berarti tidak ada yang perlu dikerjakan, yang satu berarti ada
   * pertemuan yang lupa diabsen.
   */
  libur: Record<string, string>
  rekap: RekapAbsensi
}

export interface AbsensiBulan {
  /** false = migrasi 0081 belum dijalankan. */
  tabelAda: boolean
  /** Hari sesi bulan itu, plus hari lain yang ternyata ada absensinya. */
  tanggal: string[]
  baris: BarisAbsensiBulan[]
  /**
   * Tanggal yang TIDAK ADA SESI bagi seluruh anak sesi ini, beserta
   * sebabnya — dipakai kepala kolom untuk menandainya sekali, alih-alih
   * mengulang tanda yang sama di tiap baris.
   */
  liburSesi: Record<string, string>
}

/**
 * Daftar hadir satu sesi sepanjang sebulan — siswa × tanggal.
 *
 * Kolomnya seluruh hari Senin–Jumat, bukan hanya hari yang sudah diabsen:
 * justru kolom kosong itulah yang berguna. Guru membuka rekap ini untuk
 * menemukan pertemuan yang terlewat diabsen, dan hari yang hilang dari tabel
 * tidak bisa ditemukan. Akhir pekan hanya muncul bila hari itu memang ada
 * absensinya — sesi pengganti tidak boleh menghilang hanya karena jatuh di
 * hari Sabtu.
 *
 * Bentuknya sengaja dikembarkan dengan Progres per Sesi (lib/data/rekap-sesi):
 * dua tabel yang dibaca berdampingan tiap bulan lebih baik dibaca dengan satu
 * kebiasaan mata.
 */
export async function getAbsensiBulan(halaqohId: string, periode: string): Promise<AbsensiBulan> {
  const [tahun, bulan] = periode.split('-').map(Number)
  const akhirBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const dari = `${periode}-01`
  const sampai = `${periode}-${String(akhirBulan).padStart(2, '0')}`

  const supabase = createServerClient()
  const [siswaRes, absensiRes, term] = await Promise.all([
    supabase.from('students').select('id, full_name, kelas, jenjang, program')
      .eq('halaqoh_id', halaqohId).eq('is_active', true).order('full_name'),
    supabase.from('absensi_harian').select('student_id, tanggal, status, catatan')
      .eq('halaqoh_id', halaqohId).gte('tanggal', dari).lte('tanggal', sampai),
    getCurrentTerm(),
  ])

  if (absensiRes.error) return { tabelAda: false, tanggal: [], baris: [], liburSesi: {} }

  const siswa = (siswaRes.data ?? []) as {
    id: string; full_name: string; kelas: string | null; jenjang: Jenjang; program: string | null
  }[]
  const baris = (absensiRes.data ?? []) as { student_id: string; tanggal: string; status: StatusAbsensi; catatan: string }[]

  // Kalender menentukan hari mana yang memang ada sesinya. Tanpa ini, Jum'at
  // bagi anak reguler dan hari yang sesinya ditiadakan sama-sama terbaca
  // sebagai "pertemuan yang lupa diabsen".
  const kalender = term
    ? await getKalender(term.id, [...new Set(siswa.map(x => x.jenjang))], dari, sampai)
    : { tabelAda: false, jadwal: [], kosong: [] }

  const sasaran = (x: typeof siswa[number]) => ({
    jenjang: x.jenjang,
    tingkat: tingkatOf(x.kelas) ?? 0,
    kelas: x.kelas,
    program: x.program,
  })

  /** '' = ada sesi; selain itu sebab tidak adanya. */
  function sebabLibur(x: typeof siswa[number], iso: string): string {
    if (!kalender.tabelAda) {
      // Tanpa kalender, jatuh ke aturan lama: Senin–Jumat hari sesi.
      const h = hariKe(iso)
      return h >= 1 && h <= 5 ? '' : 'Akhir pekan'
    }
    if (!hariProgram(kalender.jadwal, { jenjang: x.jenjang, program: x.program }).includes(hariKe(iso))) {
      return 'Bukan hari sesi'
    }
    const kos = ditiadakan(kalender.kosong, iso, sasaran(x))
    return kos ? (kos.alasan || 'Sesi ditiadakan') : ''
  }

  const adaAbsensi = new Set(baris.map(r => r.tanggal))

  // Kolom: hari yang ada sesinya bagi SETIDAKNYA satu anak, ditambah hari
  // yang ternyata ada absensinya — sesi pengganti di luar jadwal tidak boleh
  // hilang hanya karena kalender tidak menyangkanya.
  const tanggal: string[] = []
  const liburSesi: Record<string, string> = {}
  for (let h = 1; h <= akhirBulan; h++) {
    const iso = `${periode}-${String(h).padStart(2, '0')}`
    const sebab = siswa.map(x => sebabLibur(x, iso))
    const semuaLibur = siswa.length > 0 && sebab.every(Boolean)
    if (!semuaLibur || adaAbsensi.has(iso)) {
      tanggal.push(iso)
      if (semuaLibur) liburSesi[iso] = sebab[0]
      continue
    }
    // Hari yang seluruh anaknya libur DAN tidak ada absensinya tetap
    // ditampilkan bila ia hari kerja, supaya liburnya kelihatan sebagai
    // keputusan — bukan sebagai tanggal yang hilang begitu saja.
    if (hariKe(iso) <= 5 && sebab[0] !== 'Bukan hari sesi') {
      tanggal.push(iso)
      liburSesi[iso] = sebab[0]
    }
  }

  const perSiswa = new Map<string, BarisAbsensiBulan['sel']>()
  for (const r of baris) {
    const sel = perSiswa.get(r.student_id) ?? {}
    sel[r.tanggal] = { status: r.status, catatan: r.catatan ?? '' }
    perSiswa.set(r.student_id, sel)
  }

  return {
    tabelAda: true,
    tanggal,
    liburSesi,
    baris: siswa.map(x => {
      const sel = perSiswa.get(x.id) ?? {}
      const libur: Record<string, string> = {}
      for (const iso of tanggal) {
        const sebab = sebabLibur(x, iso)
        // Absensi yang terlanjur tercatat menang atas kalender: kalau gurunya
        // mengabsen, pertemuannya memang terjadi.
        if (sebab && !sel[iso]) libur[iso] = sebab
      }
      return {
        id: x.id,
        nama: x.full_name,
        kelas: x.kelas,
        sel,
        libur,
        rekap: hitungRekap(Object.values(sel).map(v => v.status)),
      }
    }),
  }
}
