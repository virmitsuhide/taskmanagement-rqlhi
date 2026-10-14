import { createServerClient } from '@/lib/supabase/server'
import { tanggalWIB } from '@/lib/rq/ujian'
import { jalurSetoran } from '@/lib/rq/jalur'
import { halamanRentang } from '@/lib/rq/murojaah'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { URUTAN_TAHSIN, kolomTahsin } from '@/lib/data/capaian-kelas'
import type { Jenjang } from '@/types'

/**
 * Pelengkap lib/data/analitik-halaqoh.ts untuk halaman Analitik Halaqoh
 * (ringkasan unit & detail satu halaqoh). Hanya MEMBACA; setiap kueri
 * dibatasi rentang tanggal yang diminta dan disaring `.in()` atas id
 * halaqoh/siswa, dipotong per 150 id dan per 1000 baris.
 */

type Hasil = { data: unknown; error: unknown }
type Pembangun = { range: (dari: number, ke: number) => PromiseLike<Hasil> }

/** Ambil semua baris (menembus batas 1000 PostgREST), per potongan id. */
async function ambilPotong<T>(ids: string[], buat: (potong: string[]) => Pembangun): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const potong = ids.slice(i, i + 150)
    for (let hal = 0; hal < 50; hal++) {
      const { data, error } = await buat(potong).range(hal * 1000, hal * 1000 + 999)
      if (error) { console.error('[analitik-halaqoh-detail]', error); break }
      const rows = (data ?? []) as T[]
      out.push(...rows)
      if (rows.length < 1000) break
    }
  }
  return out
}

export function akhirBulanDari(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number)
  return `${bulan}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

export interface Kehadiran {
  hadir: number
  izin: number
  sakit: number
  alfa: number
  /** Seluruh catatan presensi (hadir + tidak hadir). */
  total: number
}

const hadirKosong = (): Kehadiran => ({ hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 })

function tambahHadir(k: Kehadiran, status: string) {
  if (status === 'hadir' || status === 'izin' || status === 'sakit' || status === 'alfa') k[status]++
  k.total++
}

/** Persen hadir; null bila belum ada catatan presensi. */
export function persenHadir(k: Kehadiran | undefined): number | null {
  return k && k.total > 0 ? Math.round((k.hadir / k.total) * 100) : null
}

// ─── Ringkasan unit ─────────────────────────────────────────────────────────

export interface TambahanRingkas {
  /** studentId → halaqohId (siswa aktif hari ini). */
  anggota: Record<string, string>
  /** halaqohId → rekap presensi bulan itu. */
  hadir: Record<string, Kehadiran>
}

/** Keanggotaan siswa & presensi sebulan untuk sekumpulan halaqoh. */
export async function getTambahanRingkas(halaqohIds: string[], bulan: string): Promise<TambahanRingkas> {
  if (halaqohIds.length === 0) return { anggota: {}, hadir: {} }
  const supabase = createServerClient()
  const [siswa, absen] = await Promise.all([
    ambilPotong<{ id: string; halaqoh_id: string }>(halaqohIds, p => supabase.from('students')
      .select('id, halaqoh_id').eq('is_active', true).in('halaqoh_id', p).order('id')),
    ambilPotong<{ halaqoh_id: string | null; status: string }>(halaqohIds, p => supabase.from('absensi_harian')
      .select('halaqoh_id, status').in('halaqoh_id', p)
      .gte('tanggal', `${bulan}-01`).lte('tanggal', akhirBulanDari(bulan))
      .order('tanggal').order('student_id')),
  ])
  const anggota: Record<string, string> = {}
  for (const s of siswa) anggota[s.id] = s.halaqoh_id
  const hadir: Record<string, Kehadiran> = {}
  for (const a of absen) {
    if (!a.halaqoh_id) continue
    tambahHadir(hadir[a.halaqoh_id] ??= hadirKosong(), a.status)
  }
  return { anggota, hadir }
}

// ─── Detail satu halaqoh ────────────────────────────────────────────────────

export interface SesiJadwal { hari: number; mulai: string; selesai: string }

export interface SiswaDetail {
  id: string
  nama: string
  kelas: string | null
  program: string | null
  metode: string | null
  /** Tahap (URUTAN_TAHSIN) — null bila belum tercatat. */
  tahap: string | null
  /** Teks posisi kini, mis. 'Jilid 3 · hal. 12' atau "Al-Qur'an · hal. 40". */
  posisi: string | null
  /** Halaman tahsin lulus bulan terpilih (jalur sekolah, unik, bukan drill). */
  tahsinBulan: number
  /** Halaman mushaf ziyadah bulan terpilih (jalur sekolah). */
  tahfidzBulan: number
  hadir: Kehadiran
  /** Tanggal setoran terakhir (semua jalur) dalam rentang; null = tidak ada. */
  terakhirSetor: string | null
  /** Lama drill tahsin berjalan (hari); null = tidak sedang drill. */
  drillTahsinHari: number | null
  /** Lama drill juz terlama yang belum diujikan (hari); null = tidak ada. */
  drillJuzHari: number | null
}

export interface UjianDetail {
  studentId: string
  nama: string
  tipe: string
  juz: string
  status: string
  predikat: string | null
  tanggal: string | null
}

export interface DetailHalaqoh {
  id: string
  nama: string
  jenjang: Jenjang
  program: string | null
  sesi: number | null
  tempat: string
  catatanJadwal: string | null
  isActive: boolean
  wali: { id: string; nama: string; gender: string | null; sapaan: string | null } | null
  pengampu: string[]
  jadwal: SesiJadwal[]
  siswa: SiswaDetail[]
  /** Hari setoran (siswa × tanggal, jalur sekolah) di bulan terpilih. */
  setoranBulan: number
  ujian: UjianDetail[]
}

interface BarisSiswa {
  id: string; full_name: string; kelas: string | null; program: string | null
  current_method_id: string | null; current_jilid_id: string | null; current_jilid_page: number | null
  current_quran_halaman: number | null; tahsin_drill_sejak: string | null
}

type LogTahsin = {
  student_id: string; setoran_date: string; jilid_id: string | null; halaman: number | null; quran_halaman: number | null
  status: string | null; drill: boolean | null
  ekstra_slot_id?: string | null; tahsin_rekomendasi?: boolean | null; riyadhoh?: boolean | null; asrama?: boolean | null
}
type LogTahfidz = {
  student_id: string; setoran_date: string; kind: string; surat_id: number; surat_ke_id?: number | null
  ayat_dari: number | null; ayat_ke: number | null
  ekstra_slot_id?: string | null; tahsin_rekomendasi?: boolean | null; riyadhoh?: boolean | null; asrama?: boolean | null
}

const selisihHari = (dari: string, ke: string) =>
  Math.max(0, Math.round((Date.parse(`${ke.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dari.slice(0, 10)}T00:00:00Z`)) / 86_400_000))

/**
 * Data satu halaqoh untuk halaman detail. `dari` = awal rentang (tanggal
 * setoran terakhir dicari di dalamnya), `bulan` = bulan yang angkanya
 * dihitung, `awalSemester` = batas ujian yang ditampilkan.
 * `cocokSiswa` menyempitkan siswa (koor QULS SD).
 */
export async function getDetailHalaqoh(id: string, opsi: {
  dari: string
  bulan: string
  awalSemester: string
  program?: readonly string[] | null
}): Promise<DetailHalaqoh | null> {
  const supabase = createServerClient()
  const hariIni = tanggalWIB(new Date())
  const { data: h } = await supabase.from('halaqoh')
    .select('id, name, jenjang, program, sesi, tempat, schedule_note, is_active, wali:teachers!halaqoh_wali_teacher_id_fkey(id, full_name, gender, sapaan)')
    .eq('id', id).maybeSingle()
  if (!h) return null
  const hq = h as unknown as {
    id: string; name: string; jenjang: Jenjang; program: string | null; sesi: number | null; tempat: string | null
    schedule_note: string | null; is_active: boolean | null
    wali: { id: string; full_name: string; gender: string | null; sapaan: string | null } | null
  }

  const [siswaRes, sesiRes, pengampuRes, metodeRes, levelRes] = await Promise.all([
    supabase.from('students')
      .select('id, full_name, kelas, program, current_method_id, current_jilid_id, current_jilid_page, current_quran_halaman, tahsin_drill_sejak')
      .eq('is_active', true).eq('halaqoh_id', id).order('full_name').limit(500),
    supabase.from('halaqoh_sessions').select('day_of_week, start_time, end_time').eq('halaqoh_id', id).order('day_of_week'),
    supabase.from('halaqoh_teachers').select('role, teacher:teachers(full_name)').eq('halaqoh_id', id),
    supabase.from('tahsin_methods').select('id, name'),
    supabase.from('jilid_levels').select('id, label, is_quran, is_terminal'),
  ])

  const semuaSiswa = (siswaRes.data ?? []) as BarisSiswa[]
  // Koor QULS SD: anak QULS saja (program anak, atau program halaqohnya).
  const siswa = semuaSiswa.filter(s => !opsi.program || (!!(s.program ?? hq.program) && opsi.program.includes((s.program ?? hq.program)!)))
  const ids = siswa.map(s => s.id)
  const metode = new Map(((metodeRes.data ?? []) as { id: string; name: string }[]).map(m => [m.id, m.name]))
  const level = new Map(((levelRes.data ?? []) as { id: string; label: string; is_quran: boolean; is_terminal: boolean }[]).map(l => [l.id, l]))

  const awalBulan = `${opsi.bulan}-01`
  const akhirBulan = akhirBulanDari(opsi.bulan)
  const sampai = akhirBulan < hariIni ? akhirBulan : hariIni

  const [logTahsin, logTahfidz, absen, drillJuz, ujian, peta] = ids.length === 0
    ? [[], [], [], [], [], null] as [LogTahsin[], LogTahfidz[], { student_id: string; tanggal: string; status: string }[], never[], never[], null]
    : await Promise.all([
      // '*' supaya penanda jalur ikut bila kolomnya ada (sama dengan analitik-halaqoh).
      ambilPotong<LogTahsin>(ids, p => supabase.from('tahsin_logs').select('*')
        .in('student_id', p).gte('setoran_date', opsi.dari).lte('setoran_date', sampai).order('id')),
      ambilPotong<LogTahfidz>(ids, p => supabase.from('tahfidz_logs').select('*')
        .in('student_id', p).gte('setoran_date', opsi.dari).lte('setoran_date', sampai).order('id')),
      ambilPotong<{ student_id: string; tanggal: string; status: string }>(ids, p => supabase.from('absensi_harian')
        .select('student_id, tanggal, status').in('student_id', p)
        .gte('tanggal', awalBulan).lte('tanggal', akhirBulan).order('tanggal').order('student_id')),
      ambilPotong<{ student_id: string; selesai_ziyadah: string; ujian: { created_at: string } | null }>(ids, p => supabase
        .from('tahfidz_juz_drill').select('student_id, selesai_ziyadah, ujian:ujian_tahfidz(created_at)')
        .in('student_id', p).order('id')),
      ambilPotong<{ student_id: string; nama_siswa: string; tipe: string; juz: string; status: string; predikat: string | null; jadwal: string | null; created_at: string }>(ids, p => supabase
        .from('ujian_tahfidz').select('student_id, nama_siswa, tipe, juz, status, predikat, jadwal, created_at')
        .in('student_id', p).gte('created_at', `${opsi.awalSemester}T00:00:00+07:00`).order('id')),
      getPetaHalaman().catch(() => null),
    ])

  const tahsinBulan = new Map<string, Set<string>>()
  const hariSetor = new Set<string>()
  const terakhir = new Map<string, string>()
  const catatTerakhir = (sid: string, tgl: string) => { if ((terakhir.get(sid) ?? '') < tgl) terakhir.set(sid, tgl) }
  for (const l of logTahsin) {
    catatTerakhir(l.student_id, l.setoran_date)
    if (l.setoran_date < awalBulan || jalurSetoran(l) !== 'sekolah') continue
    hariSetor.add(`${l.student_id}|${l.setoran_date}`)
    if (l.status !== 'lulus' || l.drill) continue
    const kunci = l.halaman !== null ? `${l.jilid_id}|${l.halaman}` : l.quran_halaman !== null ? `Q|${l.quran_halaman}` : null
    if (kunci) tahsinBulan.set(l.student_id, (tahsinBulan.get(l.student_id) ?? new Set<string>()).add(kunci))
  }
  const tahfidzBulan = new Map<string, number>()
  for (const l of logTahfidz) {
    catatTerakhir(l.student_id, l.setoran_date)
    if (l.setoran_date < awalBulan || jalurSetoran(l) !== 'sekolah') continue
    hariSetor.add(`${l.student_id}|${l.setoran_date}`)
    if (!peta || (l.kind !== 'ziyadah' && l.kind !== 'hafalan_baru')) continue
    tahfidzBulan.set(l.student_id, (tahfidzBulan.get(l.student_id) ?? 0) + halamanRentang(peta, {
      surat_id: l.surat_id, ayat_dari: l.ayat_dari, surat_ke_id: l.surat_ke_id ?? null, ayat_ke: l.ayat_ke,
    }))
  }
  const hadir = new Map<string, Kehadiran>()
  for (const a of absen) {
    let k = hadir.get(a.student_id)
    if (!k) { k = hadirKosong(); hadir.set(a.student_id, k) }
    tambahHadir(k, a.status)
  }

  const lamaJuz = new Map<string, number>()
  for (const d of drillJuz as { student_id: string; selesai_ziyadah: string; ujian: { created_at: string } | null }[]) {
    if (d.ujian) continue
    lamaJuz.set(d.student_id, Math.max(lamaJuz.get(d.student_id) ?? 0, selisihHari(d.selesai_ziyadah, hariIni)))
  }

  const siswaDetail: SiswaDetail[] = siswa.map(s => {
    const l = s.current_jilid_id ? level.get(s.current_jilid_id) : undefined
    const tahap = l ? kolomTahsin(l) : null
    let posisi: string | null = null
    if (l) {
      const hal = l.is_quran ? s.current_quran_halaman ?? s.current_jilid_page : s.current_jilid_page
      posisi = tahap === 'Lulus' ? 'Lulus tahsin' : `${l.label}${hal ? ` · hal. ${hal}` : ''}`
    }
    return {
      id: s.id,
      nama: s.full_name,
      kelas: s.kelas,
      program: s.program,
      metode: s.current_method_id ? metode.get(s.current_method_id) ?? null : null,
      tahap,
      posisi,
      tahsinBulan: tahsinBulan.get(s.id)?.size ?? 0,
      tahfidzBulan: Math.round((tahfidzBulan.get(s.id) ?? 0) * 10) / 10,
      hadir: hadir.get(s.id) ?? hadirKosong(),
      terakhirSetor: terakhir.get(s.id) ?? null,
      drillTahsinHari: s.tahsin_drill_sejak ? selisihHari(s.tahsin_drill_sejak, hariIni) : null,
      drillJuzHari: lamaJuz.get(s.id) ?? null,
    }
  })

  type BarisPengampu = { role: string | null; teacher: { full_name: string } | { full_name: string }[] | null }
  const pengampu = ((pengampuRes.data ?? []) as unknown as BarisPengampu[])
    .flatMap(p => (Array.isArray(p.teacher) ? p.teacher : p.teacher ? [p.teacher] : []).map(t => t.full_name))
    .filter(n => n !== hq.wali?.full_name)

  return {
    id: hq.id,
    nama: hq.name,
    jenjang: hq.jenjang,
    program: hq.program,
    sesi: hq.sesi,
    tempat: hq.tempat ?? '',
    catatanJadwal: hq.schedule_note,
    isActive: hq.is_active !== false,
    wali: hq.wali ? { id: hq.wali.id, nama: hq.wali.full_name, gender: hq.wali.gender, sapaan: hq.wali.sapaan } : null,
    pengampu: [...new Set(pengampu)],
    jadwal: ((sesiRes.data ?? []) as { day_of_week: number; start_time: string; end_time: string }[])
      .map(r => ({ hari: r.day_of_week, mulai: r.start_time.slice(0, 5), selesai: r.end_time.slice(0, 5) })),
    siswa: siswaDetail,
    setoranBulan: hariSetor.size,
    ujian: (ujian as { student_id: string; nama_siswa: string; tipe: string; juz: string; status: string; predikat: string | null; jadwal: string | null; created_at: string }[])
      .map(u => ({
        studentId: u.student_id, nama: u.nama_siswa, tipe: u.tipe, juz: u.juz, status: u.status, predikat: u.predikat,
        tanggal: u.jadwal ? tanggalWIB(u.jadwal) : tanggalWIB(u.created_at),
      }))
      .sort((a, b) => (b.tanggal ?? '').localeCompare(a.tanggal ?? '')),
  }
}

/** Urutan tahap untuk sebaran (Pra … Lulus). */
export const TAHAP_URUT: readonly string[] = URUTAN_TAHSIN
