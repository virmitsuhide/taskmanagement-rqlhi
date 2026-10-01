import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Ekstra tahsin & tahfidz (0091).
 *
 * Semua pembacaan tahan terhadap tabel yang belum ada: selama migrasi 0091
 * belum dijalankan, halaman menampilkan pemberitahuan dan data kosong —
 * bukan galat 500.
 */

export type BidangEkstra = 'tahsin' | 'tahfidz' | 'campuran'
export type StatusBooking = 'baru' | 'ditawarkan' | 'aktif' | 'ditolak' | 'berhenti'
export type StatusHadirEkstra = 'hadir' | 'izin' | 'sakit' | 'alfa'

export const HARI_EKSTRA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'] as const
export const HARI_PENDEK = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd'] as const

/** Bagian hari yang bisa dipilih orang tua (0093). */
export type BagianHari = 'pagi' | 'siang' | 'sore' | 'malam'
/** Batas guru pilihan per permintaan — lebih dari ini bukan lagi preferensi. */
export const MAKS_GURU_PILIHAN = 3

export const BAGIAN_HARI: { kode: BagianHari; label: string; jam: string; mulai: string }[] = [
  { kode: 'pagi', label: 'Pagi', jam: '06.00–08.00', mulai: '06:30' },
  { kode: 'siang', label: 'Siang', jam: '12.30–15.00', mulai: '12:30' },
  { kode: 'sore', label: 'Sore', jam: '15.00–18.00', mulai: '15:30' },
  { kode: 'malam', label: 'Malam', jam: '18.30–21.00', mulai: '19:00' },
]

/** "Selasa, Kamis · Sore" + catatan jam — ringkasan preferensi waktu orang tua. */
export function labelPreferensi(b: Pick<BookingEkstra, 'hari_pilihan' | 'waktu_pilihan' | 'catatan_waktu'>): string {
  const hari = [...(b.hari_pilihan ?? [])].sort((x, y) => x - y).map(h => HARI_EKSTRA[h]).filter(Boolean).join(', ')
  const waktu = (b.waktu_pilihan ?? []).map(w => BAGIAN_HARI.find(x => x.kode === w)?.label ?? w).join('/')
  return [hari || 'Hari bebas', waktu, b.catatan_waktu].filter(Boolean).join(' · ')
}

export const LABEL_STATUS_BOOKING: Record<StatusBooking, string> = {
  baru: 'Baru', ditawarkan: 'Ditawarkan', aktif: 'Peserta aktif', ditolak: 'Ditolak', berhenti: 'Berhenti',
}

export interface JenisEkstra {
  id: string
  nama: string
  bidang: BidangEkstra
  deskripsi: string
  biaya: number
  satuan_biaya: string
  kuota: number
  durasi_menit: number
  keterangan_waktu: string
  aktif: boolean
  urutan: number
}

export interface SlotEkstra {
  id: string
  jenis_id: string
  teacher_id: string
  hari: number
  jam_mulai: string
  jam_selesai: string
  tempat: string
  kuota: number | null
  aktif: boolean
  /** Diisi pembaca: */
  jenis?: JenisEkstra
  guru?: string
  peserta: number
  kuotaEfektif: number
}

export interface BookingEkstra {
  id: string
  /** Halaqoh ekstra tempat anak ditempatkan; null = permintaan belum ditempatkan (0093). */
  slot_id: string | null
  slot_tawaran_id: string | null
  jenis_id: string
  /** Guru yang dipilih orang tua (maks. 3, 0094) — preferensi, bukan jaminan. Kosong = siapa saja. */
  guru_pilihan_ids: string[]
  hari_pilihan: number[]
  waktu_pilihan: BagianHari[]
  catatan_waktu: string
  status: StatusBooking
  nama_anak: string
  asal: 'lhi' | 'luar'
  student_id: string | null
  kelas: string
  posisi_bacaan: string
  nama_ortu: string
  wa_ortu: string
  catatan_ortu: string
  catatan_koor: string
  mulai: string | null
  berhenti: string | null
  created_at: string
}

export interface DataEkstra {
  tabelAda: boolean
  jenis: JenisEkstra[]
  slot: SlotEkstra[]
}

const tabelHilang = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')

/** '15:30:00' → '15.30' */
export function jam(t: string): string {
  return t.slice(0, 5).replace(':', '.')
}

export function labelSlot(s: Pick<SlotEkstra, 'hari' | 'jam_mulai' | 'jam_selesai'>): string {
  return `${HARI_EKSTRA[s.hari]} ${jam(s.jam_mulai)}–${jam(s.jam_selesai)}`
}

export function rupiah(n: number): string {
  return n === 0 ? 'Tanpa biaya' : `Rp ${n.toLocaleString('id-ID')}`
}

/** Nomor WA ke format wa.me: 08xx → 628xx. */
export function nomorWa(no: string): string {
  const d = no.replace(/\D/g, '')
  return d.startsWith('0') ? `62${d.slice(1)}` : d
}

/** Jenis, slot, nama guru, dan jumlah peserta aktif per slot — sekali ambil. */
export async function getDataEkstra(opsi: { hanyaAktif?: boolean } = {}): Promise<DataEkstra> {
  const supabase = createServerClient()
  const [jRes, sRes, bRes] = await Promise.all([
    supabase.from('ekstra_jenis').select('*').order('urutan').order('nama'),
    supabase.from('ekstra_slot').select('*').order('hari').order('jam_mulai'),
    supabase.from('ekstra_booking').select('slot_id').eq('status', 'aktif'),
  ])
  if (tabelHilang(jRes.error) || tabelHilang(sRes.error)) return { tabelAda: false, jenis: [], slot: [] }

  const jenis = (jRes.data ?? []) as JenisEkstra[]
  const byJenis = new Map(jenis.map(j => [j.id, j]))
  const peserta = new Map<string, number>()
  for (const b of (bRes.data ?? []) as { slot_id: string }[]) peserta.set(b.slot_id, (peserta.get(b.slot_id) ?? 0) + 1)

  let slotRows = (sRes.data ?? []) as Omit<SlotEkstra, 'peserta' | 'kuotaEfektif'>[]
  if (opsi.hanyaAktif) slotRows = slotRows.filter(s => s.aktif && byJenis.get(s.jenis_id)?.aktif)

  const guruIds = [...new Set(slotRows.map(s => s.teacher_id))]
  const { data: guruRows } = guruIds.length
    ? await supabase.from('teachers').select('id, full_name').in('id', guruIds)
    : { data: [] }
  const namaGuru = new Map(((guruRows ?? []) as { id: string; full_name: string }[]).map(g => [g.id, g.full_name]))

  const slot: SlotEkstra[] = slotRows.map(s => {
    const j = byJenis.get(s.jenis_id)
    return {
      ...s,
      jenis: j,
      guru: namaGuru.get(s.teacher_id) ?? '—',
      peserta: peserta.get(s.id) ?? 0,
      kuotaEfektif: s.kuota ?? j?.kuota ?? 1,
    }
  })
  return { tabelAda: true, jenis: opsi.hanyaAktif ? jenis.filter(j => j.aktif) : jenis, slot }
}

export async function getBookingEkstra(status?: StatusBooking[]): Promise<BookingEkstra[]> {
  const supabase = createServerClient()
  let q = supabase.from('ekstra_booking').select('*').order('created_at', { ascending: true })
  if (status?.length) q = q.in('status', status)
  const { data, error } = await q
  if (error) return []
  return (data ?? []) as BookingEkstra[]
}

export interface CalonSiswa { id: string; full_name: string; kelas: string | null; jenjang: string }

/** Seluruh siswa aktif (dipaging, >1000 baris) — sekali per permintaan. */
const getSiswaAktif = cache(async (): Promise<CalonSiswa[]> => {
  const supabase = createServerClient()
  const hasil: CalonSiswa[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await supabase.from('students').select('id, full_name, kelas, jenjang')
      .eq('is_active', true).order('id').range(dari, dari + 999)
    if (error || !data?.length) break
    hasil.push(...(data as CalonSiswa[]))
    if (data.length < 1000) break
  }
  return hasil
})

/** 'Hammas  Izuddin' → ['hamas', 'izudin']: huruf kecil, tanpa tanda baca, huruf dobel dirapatkan. */
function kataNama(s: string): string[] {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .map(w => w.replace(/(.)\1+/g, '$1')).filter(w => w.length >= 2)
}

/** Dua kata dianggap sama bila persis, salah satu awalan yang lain (≥3 huruf), atau beda satu huruf. */
function kataMirip(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return true
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false
  let i = 0, j = 0, beda = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++beda > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return beda + (a.length - i) + (b.length - j) <= 1
}

const rapatKelas = (k: string | null | undefined) => (k ?? '').toLowerCase().replace(/kelas|\s/g, '')
const tingkatKelas = (k: string) => k.match(/^\d+/)?.[0] ?? ''

/** Kata nama yang terlalu umum untuk membedakan anak (sesudah huruf dobel dirapatkan). */
const KATA_UMUM = new Set(['muhamad', 'mohamad', 'moh', 'al', 'el', 'bin', 'binti', 'abdul', 'ahmad', 'nur'])

/**
 * Cocokkan nama yang diketik orang tua dengan data siswa. Ejaan orang tua
 * sering berbeda ('Hammas Izuddin' vs 'Hamas Izzudin Mumtaz'), jadi yang
 * dihitung kata yang mirip (persis lebih berat dari mirip; kata umum seperti
 * Muhammad tidak dihitung), lalu kelas yang sama / tingkat yang sama
 * menjadi penentu urutan.
 */
export function cocokkanSiswa(nama: string, kelas: string | null | undefined, daftar: CalonSiswa[], maks = 8): CalonSiswa[] {
  const cari = kataNama(nama).filter(w => !KATA_UMUM.has(w))
  if (cari.length === 0) return []
  const k = rapatKelas(kelas)
  return daftar.map(s => {
    const kata = kataNama(s.full_name)
    let nilai = 0
    for (const w of cari) nilai += kata.includes(w) ? 3 : kata.some(x => kataMirip(w, x)) ? 2 : 0
    const ks = rapatKelas(s.kelas)
    const bonus = !nilai || !k ? 0 : ks === k ? 3 : tingkatKelas(ks) && tingkatKelas(ks) === tingkatKelas(k) ? 1 : 0
    return { s, nilai, skor: nilai + bonus }
  }).filter(x => x.nilai > 0)
    .sort((a, b) => b.skor - a.skor || a.s.full_name.localeCompare(b.s.full_name, 'id'))
    .slice(0, maks).map(x => x.s)
}

/** Calon siswa LHI untuk ditautkan ke booking — nama mirip, kelas yang sama diutamakan. */
export async function getCalonSiswa(nama: string, kelas?: string | null, maks = 8): Promise<CalonSiswa[]> {
  return cocokkanSiswa(nama, kelas, await getSiswaAktif(), maks)
}

/** Slot aktif yang diampu guru ini, beserta pesertanya. */
export async function getSlotGuru(teacherId: string): Promise<{ tabelAda: boolean; slot: SlotEkstra[]; peserta: BookingEkstra[] }> {
  const data = await getDataEkstra()
  if (!data.tabelAda) return { tabelAda: false, slot: [], peserta: [] }
  const slot = data.slot.filter(s => s.teacher_id === teacherId && s.aktif)
  if (slot.length === 0) return { tabelAda: true, slot, peserta: [] }
  const { data: b } = await createServerClient()
    .from('ekstra_booking').select('*').in('slot_id', slot.map(s => s.id)).eq('status', 'aktif').order('nama_anak')
  return { tabelAda: true, slot, peserta: (b ?? []) as BookingEkstra[] }
}

/**
 * Boleh guru ini mencatat setoran EKSTRA anak ini di slot ini?
 * Slotnya harus diampu guru itu dan anaknya peserta aktif slot itu yang
 * sudah ditautkan ke data siswa. Setoran tidak ditulis di muka.
 */
export async function bolehEkstra(teacherId: string, studentId: string, slotId: string, tanggal: string): Promise<boolean> {
  if (tanggal > new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)) return false
  const supabase = createServerClient()
  const [sRes, bRes] = await Promise.all([
    supabase.from('ekstra_slot').select('teacher_id, aktif').eq('id', slotId).maybeSingle(),
    supabase.from('ekstra_booking').select('id').eq('slot_id', slotId).eq('student_id', studentId).eq('status', 'aktif').limit(1),
  ])
  const s = sRes.data as { teacher_id: string; aktif: boolean } | null
  return !!s && s.teacher_id === teacherId && (bRes.data ?? []).length > 0
}

export async function getHadirEkstra(bookingIds: string[], dari: string, sampai: string): Promise<{ booking_id: string; tanggal: string; status: StatusHadirEkstra; catatan: string }[]> {
  if (bookingIds.length === 0) return []
  const { data, error } = await createServerClient()
    .from('ekstra_hadir').select('booking_id, tanggal, status, catatan')
    .in('booking_id', bookingIds).gte('tanggal', dari).lte('tanggal', sampai)
  if (error) return []
  return (data ?? []) as { booking_id: string; tanggal: string; status: StatusHadirEkstra; catatan: string }[]
}

export interface SetoranEkstra {
  student_id: string
  slot_id: string
  jenis: 'tahsin' | 'tahfidz'
  tanggal: string
  ringkas: string
  nilai: number | null
}

const KOLOM_TAHSIN_EKSTRA = 'student_id, ekstra_slot_id, setoran_date, halaman, status, nilai_tahsin, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)'
const KOLOM_TAHFIDZ_EKSTRA = 'student_id, ekstra_slot_id, setoran_date, kind, ayat_dari, ayat_ke, nilai_tahfidz, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)'

/** Setoran bertanda ekstra dalam rentang tanggal, untuk laporan ekstra. */
export async function getSetoranEkstra(slotIds: string[], dari: string, sampai: string): Promise<SetoranEkstra[]> {
  if (slotIds.length === 0) return []
  const supabase = createServerClient()
  const [ts, tf] = await Promise.all([
    supabase.from('tahsin_logs').select(KOLOM_TAHSIN_EKSTRA)
      .in('ekstra_slot_id', slotIds).gte('setoran_date', dari).lte('setoran_date', sampai),
    supabase.from('tahfidz_logs').select(KOLOM_TAHFIDZ_EKSTRA)
      .in('ekstra_slot_id', slotIds).gte('setoran_date', dari).lte('setoran_date', sampai),
  ])
  return susunSetoranEkstra(ts.data, tf.data)
}

/** Seluruh riwayat setoran ekstra satu siswa LHI (semua halaqoh ekstra), terbaru dulu. */
export async function getRiwayatSetoranEkstra(studentId: string): Promise<SetoranEkstra[]> {
  const supabase = createServerClient()
  const [ts, tf] = await Promise.all([
    supabase.from('tahsin_logs').select(KOLOM_TAHSIN_EKSTRA)
      .eq('student_id', studentId).not('ekstra_slot_id', 'is', null).order('setoran_date', { ascending: false }).limit(500),
    supabase.from('tahfidz_logs').select(KOLOM_TAHFIDZ_EKSTRA)
      .eq('student_id', studentId).not('ekstra_slot_id', 'is', null).order('setoran_date', { ascending: false }).limit(500),
  ])
  return susunSetoranEkstra(ts.data, tf.data).reverse()
}

/** Jumlah setoran ekstra per siswa (sepanjang waktu) — untuk daftar siswa ekstra. */
export async function hitungSetoranEkstra(studentIds: string[]): Promise<Map<string, number>> {
  const hasil = new Map<string, number>()
  if (studentIds.length === 0) return hasil
  const supabase = createServerClient()
  const [ts, tf] = await Promise.all([
    supabase.from('tahsin_logs').select('student_id').in('student_id', studentIds).not('ekstra_slot_id', 'is', null),
    supabase.from('tahfidz_logs').select('student_id').in('student_id', studentIds).not('ekstra_slot_id', 'is', null),
  ])
  for (const r of [...(ts.error ? [] : ts.data ?? []), ...(tf.error ? [] : tf.data ?? [])] as { student_id: string }[]) {
    hasil.set(r.student_id, (hasil.get(r.student_id) ?? 0) + 1)
  }
  return hasil
}

function susunSetoranEkstra(tsData: unknown, tfData: unknown): SetoranEkstra[] {
  const ts = { data: tsData }, tf = { data: tfData }
  const hasil: SetoranEkstra[] = []
  for (const r of (ts.data ?? []) as unknown as { student_id: string; ekstra_slot_id: string; setoran_date: string; halaman: number | null; status: string | null; nilai_tahsin: number | null; jilid: { label: string } | null }[]) {
    hasil.push({
      student_id: r.student_id, slot_id: r.ekstra_slot_id, jenis: 'tahsin', tanggal: r.setoran_date,
      ringkas: [r.jilid?.label, r.halaman ? `hal. ${r.halaman}` : null, r.status === 'ulang' ? 'ulang' : r.status === 'lanjut' ? 'lanjut' : null].filter(Boolean).join(' · ') || 'Tahsin',
      nilai: r.nilai_tahsin,
    })
  }
  for (const r of (tf.data ?? []) as unknown as { student_id: string; ekstra_slot_id: string; setoran_date: string; kind: string; ayat_dari: number | null; ayat_ke: number | null; nilai_tahfidz: number | null; surat: { name_latin: string } | null }[]) {
    hasil.push({
      student_id: r.student_id, slot_id: r.ekstra_slot_id, jenis: 'tahfidz', tanggal: r.setoran_date,
      ringkas: `${r.kind === 'ziyadah' ? 'Ziyadah' : "Muroja'ah"} ${r.surat?.name_latin ?? ''}${r.ayat_dari ? ` ${r.ayat_dari}–${r.ayat_ke ?? ''}` : ''}`.trim(),
      nilai: r.nilai_tahfidz,
    })
  }
  return hasil.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

/** Id setoran bertanda ekstra — dipakai laporan orang tua halaqoh untuk mengecualikannya. */
export async function idSetoranEkstra(studentIds: string[], dari: string, sampai: string): Promise<{ tahsin: Set<string>; tahfidz: Set<string> }> {
  const kosong = { tahsin: new Set<string>(), tahfidz: new Set<string>() }
  if (studentIds.length === 0) return kosong
  const supabase = createServerClient()
  const [ts, tf] = await Promise.all([
    supabase.from('tahsin_logs').select('id').in('student_id', studentIds).not('ekstra_slot_id', 'is', null)
      .gte('setoran_date', dari).lte('setoran_date', sampai),
    supabase.from('tahfidz_logs').select('id').in('student_id', studentIds).not('ekstra_slot_id', 'is', null)
      .gte('setoran_date', dari).lte('setoran_date', sampai),
  ])
  // Kolom belum ada (sebelum 0091) → tidak ada yang dikecualikan.
  return {
    tahsin: new Set(((ts.error ? [] : ts.data) ?? []).map(r => (r as { id: string }).id)),
    tahfidz: new Set(((tf.error ? [] : tf.data) ?? []).map(r => (r as { id: string }).id)),
  }
}

/** Ringan, untuk menu portal guru: apakah guru ini punya slot ekstra aktif? */
export async function punyaSlotEkstra(teacherId: string): Promise<boolean> {
  const { data, error } = await createServerClient()
    .from('ekstra_slot').select('id').eq('teacher_id', teacherId).eq('aktif', true).limit(1)
  return !error && (data ?? []).length > 0
}

/** Bentuk jenis ekstra yang aman ditampilkan ke publik (formulir booking & beranda). */
export function keJenisPublik(j: JenisEkstra): { id: string; nama: string; bidang: BidangEkstra; deskripsi: string; biaya: string; waktu: string } {
  return {
    id: j.id, nama: j.nama, bidang: j.bidang, deskripsi: j.deskripsi,
    biaya: `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}`,
    waktu: [`${j.durasi_menit} menit`, j.keterangan_waktu, j.kuota > 1 ? `kelompok maks. ${j.kuota}` : 'privat'].filter(Boolean).join(' · '),
  }
}

/** Satu anak bisa ikut dua ekstra (mis. tahsin & tahfidz): booking-nya dikelompokkan per anak. */
export function kunciOrang(b: Pick<BookingEkstra, 'student_id' | 'nama_anak' | 'wa_ortu'>): string {
  return b.student_id ?? `${b.nama_anak.trim().toLowerCase()}|${b.wa_ortu.replace(/\D/g, '')}`
}

// ─── Halaqoh ekstra: detail satu halaqoh ────────────────────────────────────

export interface PesertaHalaqohEkstra extends BookingEkstra {
  /** Nama di data siswa bila tertaut (siswa LHI). */
  nama_siswa: string | null
  /** Kehadiran bulan berjalan. */
  hadir: number
  pertemuan: number
  /** Jumlah setoran ekstra bulan berjalan (tahsin + tahfidz). */
  setoran: number
  /** Presensi bulan berjalan per pertemuan, urut tanggal. */
  riwayat: { tanggal: string; status: StatusHadirEkstra }[]
  /** Setoran ekstra terakhir bulan berjalan di halaqoh ini. */
  setoranTerakhir: { tanggal: string; ringkas: string } | null
}

export interface DetailHalaqohEkstra {
  slot: SlotEkstra
  peserta: PesertaHalaqohEkstra[]
  /** Pernah ikut lalu berhenti — tetap ditampilkan terpisah sebagai riwayat. */
  berhenti: BookingEkstra[]
  /** Pertemuan bulan berjalan yang sudah dipresensi: hadir / tercatat. */
  pertemuan: { tanggal: string; hadir: number; total: number }[]
}

/** Satu halaqoh ekstra beserta pesertanya, kehadiran & setoran bulan ini. */
export async function getHalaqohEkstra(id: string): Promise<DetailHalaqohEkstra | null> {
  const data = await getDataEkstra()
  const slot = data.slot.find(s => s.id === id)
  if (!slot) return null

  const supabase = createServerClient()
  const { data: b } = await supabase.from('ekstra_booking').select('*')
    .eq('slot_id', id).in('status', ['aktif', 'berhenti']).order('nama_anak')
  const semua = (b ?? []) as BookingEkstra[]
  const aktif = semua.filter(x => x.status === 'aktif')

  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const awalBulan = `${hariIni.slice(0, 7)}-01`
  const idSiswa = aktif.map(x => x.student_id).filter((x): x is string => !!x)
  const [hadir, setoran, siswa] = await Promise.all([
    getHadirEkstra(aktif.map(x => x.id), awalBulan, hariIni),
    getSetoranEkstra([id], awalBulan, hariIni),
    idSiswa.length ? supabase.from('students').select('id, full_name').in('id', idSiswa) : Promise.resolve({ data: [] }),
  ])
  const namaSiswa = new Map(((siswa.data ?? []) as { id: string; full_name: string }[]).map(s => [s.id, s.full_name]))

  const peserta: PesertaHalaqohEkstra[] = aktif.map(x => {
    const h = hadir.filter(r => r.booking_id === x.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    const st = x.student_id ? setoran.filter(s => s.student_id === x.student_id) : []
    const akhir = st[st.length - 1]
    return {
      ...x,
      nama_siswa: x.student_id ? namaSiswa.get(x.student_id) ?? null : null,
      hadir: h.filter(r => r.status === 'hadir').length,
      pertemuan: h.length,
      setoran: st.length,
      riwayat: h.map(r => ({ tanggal: r.tanggal, status: r.status })),
      setoranTerakhir: akhir ? { tanggal: akhir.tanggal, ringkas: akhir.ringkas } : null,
    }
  })
  const tanggal = [...new Set(hadir.map(r => r.tanggal))].sort()
  const pertemuan = tanggal.map(t => {
    const r = hadir.filter(x => x.tanggal === t)
    return { tanggal: t, hadir: r.filter(x => x.status === 'hadir').length, total: r.length }
  })
  return { slot, peserta, berhenti: semua.filter(x => x.status === 'berhenti'), pertemuan }
}

// ─── Guru ekstra (0095): guru yang bersedia mengampu ekstra ─────────────────

export interface GuruEkstra {
  teacher_id: string
  aktif: boolean
  catatan: string
  created_at: string
  nama: string
  unit: string | null
}

/**
 * Daftar guru ekstra. `ids` = guru aktif yang boleh dibooking & dijadikan
 * pengampu; `null` bila tabelnya belum ada (migrasi 0095 belum jalan) —
 * pemanggil lalu memperlakukan semua guru sebagai boleh, seperti sebelumnya.
 */
export const getGuruEkstra = cache(async (): Promise<{ ids: Set<string> | null; daftar: GuruEkstra[] }> => {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('ekstra_guru').select('teacher_id, aktif, catatan, created_at')
  if (tabelHilang(error)) return { ids: null, daftar: [] }
  const baris = (data ?? []) as Omit<GuruEkstra, 'nama' | 'unit'>[]
  const idGuru = baris.map(b => b.teacher_id)
  const { data: t } = idGuru.length
    ? await supabase.from('teachers').select('id, full_name, unit').in('id', idGuru)
    : { data: [] }
  const info = new Map(((t ?? []) as { id: string; full_name: string; unit: string | null }[]).map(x => [x.id, x]))
  const daftar = baris.map(b => ({ ...b, nama: info.get(b.teacher_id)?.full_name ?? '—', unit: info.get(b.teacher_id)?.unit ?? null }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  return { ids: new Set(daftar.filter(d => d.aktif).map(d => d.teacher_id)), daftar }
})

/** Boleh guru ini dibooking / dijadikan pengampu ekstra? */
export function bolehGuruEkstra(ids: Set<string> | null, teacherId: string): boolean {
  return ids === null || ids.has(teacherId)
}

/** Tanggal hari ini (WIB) 'YYYY-MM-DD' — di luar komponen agar render tetap murni. */
export function hariIniWIB(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** Saat ini digeser ke WIB (baca dengan getUTC*) — di luar komponen agar render tetap murni. */
export function kiniWIB(): Date {
  return new Date(Date.now() + 7 * 3600_000)
}
