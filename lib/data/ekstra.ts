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

export const LABEL_STATUS_BOOKING: Record<StatusBooking, string> = {
  baru: 'Baru', ditawarkan: 'Ditawarkan', aktif: 'Aktif', ditolak: 'Ditolak', berhenti: 'Berhenti',
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
  slot_id: string
  slot_tawaran_id: string | null
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

/** Calon siswa LHI untuk ditautkan ke booking — dicocokkan dari kata pertama nama. */
export async function getCalonSiswa(nama: string): Promise<{ id: string; full_name: string; kelas: string | null; jenjang: string }[]> {
  const kata = nama.trim().split(/\s+/)[0]
  if (!kata || kata.length < 2) return []
  const { data } = await createServerClient()
    .from('students').select('id, full_name, kelas, jenjang')
    .eq('is_active', true).ilike('full_name', `%${kata}%`).order('full_name').limit(8)
  return (data ?? []) as { id: string; full_name: string; kelas: string | null; jenjang: string }[]
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

/** Setoran bertanda ekstra dalam rentang tanggal, untuk laporan ekstra. */
export async function getSetoranEkstra(slotIds: string[], dari: string, sampai: string): Promise<SetoranEkstra[]> {
  if (slotIds.length === 0) return []
  const supabase = createServerClient()
  const [ts, tf] = await Promise.all([
    supabase.from('tahsin_logs')
      .select('student_id, ekstra_slot_id, setoran_date, halaman, status, nilai_tahsin, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
      .in('ekstra_slot_id', slotIds).gte('setoran_date', dari).lte('setoran_date', sampai),
    supabase.from('tahfidz_logs')
      .select('student_id, ekstra_slot_id, setoran_date, kind, ayat_dari, ayat_ke, nilai_tahfidz, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)')
      .in('ekstra_slot_id', slotIds).gte('setoran_date', dari).lte('setoran_date', sampai),
  ])
  const hasil: SetoranEkstra[] = []
  for (const r of (ts.data ?? []) as unknown as { student_id: string; ekstra_slot_id: string; setoran_date: string; halaman: number | null; status: string | null; nilai_tahsin: number | null; jilid: { label: string } | null }[]) {
    hasil.push({
      student_id: r.student_id, slot_id: r.ekstra_slot_id, jenis: 'tahsin', tanggal: r.setoran_date,
      ringkas: [r.jilid?.label, r.halaman ? `hal. ${r.halaman}` : null, r.status === 'ulang' ? 'ulang' : null].filter(Boolean).join(' · ') || 'Tahsin',
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
