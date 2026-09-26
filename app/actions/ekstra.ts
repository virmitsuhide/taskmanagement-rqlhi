'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageEkstra } from '@/lib/auth/permissions'
import type { StatusHadirEkstra } from '@/lib/data/ekstra'

type Hasil = { error?: string; success?: true }

const PESAN_MIGRASI = 'Tabel ekstra belum ada. Minta admin menjalankan migrasi 0091 lebih dulu.'
const tabelHilang = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/
const JAM = /^\d{2}:\d{2}$/
const hariIniWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const teks = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)

async function koordinator() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' as const }
  if (!canManageEkstra(session.role)) return { error: 'Tidak memiliki izin.' as const }
  return { session }
}

function segarkan() {
  revalidatePath('/ekstra')
  revalidatePath('/ekstra/atur')
  revalidatePath('/daftar-ekstra')
  revalidatePath('/profil-guru')
  revalidatePath('/guru/ekstra')
}

// ─── Jenis ekstra ────────────────────────────────────────────────────────────

export async function simpanJenisEkstraAction(_: unknown, fd: FormData): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }

  const id = teks(fd, 'id', 40)
  const nama = teks(fd, 'nama', 120)
  const bidang = teks(fd, 'bidang', 20)
  const biaya = Number(teks(fd, 'biaya', 12).replace(/\D/g, '') || 0)
  const kuota = Number(teks(fd, 'kuota', 4) || 1)
  const durasi = Number(teks(fd, 'durasi_menit', 4) || 60)
  if (!nama) return { error: 'Nama ekstra wajib diisi.' }
  if (!['tahsin', 'tahfidz', 'campuran'].includes(bidang)) return { error: 'Bidang tidak dikenal.' }
  if (!Number.isInteger(kuota) || kuota < 1 || kuota > 50) return { error: 'Jumlah peserta 1–50.' }
  if (!Number.isInteger(durasi) || durasi < 10 || durasi > 300) return { error: 'Durasi 10–300 menit.' }

  const isi = {
    nama, bidang, biaya, kuota, durasi_menit: durasi,
    satuan_biaya: teks(fd, 'satuan_biaya', 40) || 'per bulan',
    deskripsi: teks(fd, 'deskripsi', 1000),
    keterangan_waktu: teks(fd, 'keterangan_waktu', 120),
    aktif: fd.get('aktif') === 'on',
    updated_at: new Date().toISOString(),
  }
  const supabase = createServerClient()
  const { error } = id
    ? await supabase.from('ekstra_jenis').update(isi).eq('id', id)
    : await supabase.from('ekstra_jenis').insert(isi)
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan jenis ekstra.' }
  segarkan()
  return { success: true }
}

// ─── Slot pekanan ────────────────────────────────────────────────────────────

export async function simpanSlotEkstraAction(_: unknown, fd: FormData): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }

  const id = teks(fd, 'id', 40)
  const jenisId = teks(fd, 'jenis_id', 40)
  const teacherId = teks(fd, 'teacher_id', 40)
  const hari = Number(teks(fd, 'hari', 1))
  const mulai = teks(fd, 'jam_mulai', 5)
  const selesai = teks(fd, 'jam_selesai', 5)
  const kuotaTeks = teks(fd, 'kuota', 4)
  if (!jenisId || !teacherId) return { error: 'Jenis ekstra dan guru wajib dipilih.' }
  if (!(hari >= 1 && hari <= 7)) return { error: 'Hari tidak valid.' }
  if (!JAM.test(mulai) || !JAM.test(selesai) || selesai <= mulai) return { error: 'Jam selesai harus setelah jam mulai.' }
  const kuota = kuotaTeks ? Number(kuotaTeks) : null
  if (kuota !== null && (!Number.isInteger(kuota) || kuota < 1 || kuota > 50)) return { error: 'Kuota 1–50, atau kosongkan untuk ikut jenisnya.' }

  const isi = {
    jenis_id: jenisId, teacher_id: teacherId, hari, jam_mulai: mulai, jam_selesai: selesai,
    tempat: teks(fd, 'tempat', 120), kuota, aktif: fd.get('aktif') === 'on',
    updated_at: new Date().toISOString(),
  }
  const supabase = createServerClient()
  const { error } = id
    ? await supabase.from('ekstra_slot').update(isi).eq('id', id)
    : await supabase.from('ekstra_slot').insert(isi)
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan slot.' }
  segarkan()
  return { success: true }
}

// ─── Booking dari orang tua (publik, tanpa akun) ─────────────────────────────

export async function ajukanBookingEkstraAction(_: unknown, fd: FormData): Promise<Hasil> {
  // Penahan spam: kolom jebakan yang tak terlihat manusia, dan formulir yang
  // dikirim terlalu cepat setelah dibuka (bot mengisi dalam milidetik).
  if (teks(fd, 'website', 200)) return { success: true }
  const dibuka = Number(fd.get('dibuka') ?? 0)
  if (!dibuka || Date.now() - dibuka < 3000) return { error: 'Mohon periksa kembali isian Anda, lalu kirim ulang.' }

  const slotId = teks(fd, 'slot_id', 40)
  const namaAnak = teks(fd, 'nama_anak', 120)
  const namaOrtu = teks(fd, 'nama_ortu', 120)
  const wa = teks(fd, 'wa_ortu', 20).replace(/[^\d+]/g, '')
  const asal = teks(fd, 'asal', 5) === 'luar' ? 'luar' : 'lhi'
  if (!slotId) return { error: 'Pilih jadwal lebih dulu.' }
  if (namaAnak.length < 3) return { error: 'Nama anak wajib diisi.' }
  if (namaOrtu.length < 3) return { error: 'Nama orang tua wajib diisi.' }
  if (!/^(\+?62|0)8\d{7,12}$/.test(wa)) return { error: 'Nomor WhatsApp tidak valid (contoh 08123456789).' }

  const supabase = createServerClient()
  const { data: slot, error: sErr } = await supabase
    .from('ekstra_slot').select('id, aktif, jenis:ekstra_jenis(aktif)').eq('id', slotId).maybeSingle()
  if (tabelHilang(sErr)) return { error: 'Pendaftaran ekstra belum dibuka.' }
  const s = slot as unknown as { aktif: boolean; jenis: { aktif: boolean } | null } | null
  if (!s || !s.aktif || !s.jenis?.aktif) return { error: 'Jadwal ini sudah tidak dibuka. Silakan pilih jadwal lain.' }

  // Batas wajar: tiga permintaan per nomor WA dalam sehari.
  const sejak = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count } = await supabase.from('ekstra_booking').select('id', { count: 'exact', head: true })
    .eq('wa_ortu', wa).gte('created_at', sejak)
  if ((count ?? 0) >= 3) return { error: 'Nomor ini sudah mengirim beberapa permintaan hari ini. Koordinator Ekstra akan menghubungi Anda.' }

  const { error } = await supabase.from('ekstra_booking').insert({
    slot_id: slotId, nama_anak: namaAnak, asal, wa_ortu: wa, nama_ortu: namaOrtu,
    kelas: teks(fd, 'kelas', 40), posisi_bacaan: teks(fd, 'posisi_bacaan', 120),
    catatan_ortu: teks(fd, 'catatan_ortu', 500),
  })
  if (error) return { error: 'Permintaan gagal terkirim. Coba lagi beberapa saat.' }
  revalidatePath('/ekstra')
  return { success: true }
}

// ─── Penanganan koordinator ──────────────────────────────────────────────────

async function ambilBooking(id: string) {
  const { data } = await createServerClient().from('ekstra_booking')
    .select('id, slot_id, slot_tawaran_id, status, asal, student_id').eq('id', id).maybeSingle()
  return data as { id: string; slot_id: string; slot_tawaran_id: string | null; status: string; asal: string; student_id: string | null } | null
}

async function slotPenuh(slotId: string, kecuali?: string): Promise<boolean> {
  const supabase = createServerClient()
  const [{ data: s }, { data: b }] = await Promise.all([
    supabase.from('ekstra_slot').select('kuota, jenis:ekstra_jenis(kuota)').eq('id', slotId).maybeSingle(),
    supabase.from('ekstra_booking').select('id').eq('slot_id', slotId).eq('status', 'aktif'),
  ])
  const slot = s as unknown as { kuota: number | null; jenis: { kuota: number } | null } | null
  const kuota = slot?.kuota ?? slot?.jenis?.kuota ?? 1
  return ((b ?? []) as { id: string }[]).filter(x => x.id !== kecuali).length >= kuota
}

export async function terimaBookingAction(id: string, studentId: string | null): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const b = await ambilBooking(id)
  if (!b) return { error: 'Permintaan tidak ditemukan.' }
  if (!['baru', 'ditawarkan'].includes(b.status)) return { error: 'Permintaan ini sudah ditangani.' }

  // Permintaan yang ditawari slot lain pindah ke slot tawaran saat diterima.
  const slotId = b.status === 'ditawarkan' && b.slot_tawaran_id ? b.slot_tawaran_id : b.slot_id
  if (await slotPenuh(slotId, id)) return { error: 'Kuota slot ini sudah penuh. Tawarkan jadwal lain.' }

  const { error } = await createServerClient().from('ekstra_booking').update({
    status: 'aktif', slot_id: slotId, slot_tawaran_id: null,
    student_id: b.asal === 'lhi' ? studentId : null,
    mulai: hariIniWIB(), ditangani_oleh: k.session.userId, ditangani_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: 'Gagal menerima permintaan.' }
  segarkan()
  return { success: true }
}

export async function tawarkanBookingAction(id: string, slotTawaranId: string, catatan: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const b = await ambilBooking(id)
  if (!b || !['baru', 'ditawarkan'].includes(b.status)) return { error: 'Permintaan ini sudah ditangani.' }
  if (!slotTawaranId || slotTawaranId === b.slot_id) return { error: 'Pilih slot lain untuk ditawarkan.' }
  const { error } = await createServerClient().from('ekstra_booking').update({
    status: 'ditawarkan', slot_tawaran_id: slotTawaranId, catatan_koor: catatan.slice(0, 500),
    ditangani_oleh: k.session.userId, ditangani_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: 'Gagal menyimpan tawaran.' }
  segarkan()
  return { success: true }
}

export async function ubahStatusBookingAction(id: string, status: 'ditolak' | 'berhenti', catatan: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const b = await ambilBooking(id)
  if (!b) return { error: 'Permintaan tidak ditemukan.' }
  if (status === 'ditolak' && !['baru', 'ditawarkan'].includes(b.status)) return { error: 'Hanya permintaan yang belum diterima yang bisa ditolak.' }
  if (status === 'berhenti' && b.status !== 'aktif') return { error: 'Hanya peserta aktif yang bisa diberhentikan.' }
  const { error } = await createServerClient().from('ekstra_booking').update({
    status, catatan_koor: catatan.slice(0, 500),
    ...(status === 'berhenti' ? { berhenti: hariIniWIB() } : {}),
    ditangani_oleh: k.session.userId, ditangani_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: 'Gagal menyimpan.' }
  segarkan()
  return { success: true }
}

export async function tautkanSiswaEkstraAction(id: string, studentId: string | null): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const { error } = await createServerClient().from('ekstra_booking')
    .update({ student_id: studentId, asal: studentId ? 'lhi' : 'luar', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Gagal menautkan siswa.' }
  segarkan()
  return { success: true }
}

// ─── Kehadiran (guru pengampu slot) ──────────────────────────────────────────

export async function simpanHadirEkstraAction(
  slotId: string,
  tanggal: string,
  baris: { booking_id: string; status: StatusHadirEkstra; catatan: string }[],
): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!TANGGAL.test(tanggal) || tanggal > hariIniWIB()) return { error: 'Tanggal tidak valid.' }

  const supabase = createServerClient()
  const [{ data: slot }, { data: peserta }] = await Promise.all([
    supabase.from('ekstra_slot').select('teacher_id').eq('id', slotId).maybeSingle(),
    supabase.from('ekstra_booking').select('id').eq('slot_id', slotId).eq('status', 'aktif'),
  ])
  if ((slot as { teacher_id: string } | null)?.teacher_id !== session.teacherId) return { error: 'Anda bukan pengampu slot ini.' }
  const sah = new Set(((peserta ?? []) as { id: string }[]).map(p => p.id))
  const STATUS: StatusHadirEkstra[] = ['hadir', 'izin', 'sakit', 'alfa']
  const isi = baris
    .filter(b => sah.has(b.booking_id) && STATUS.includes(b.status))
    .map(b => ({ booking_id: b.booking_id, tanggal, status: b.status, catatan: b.catatan.slice(0, 200), dicatat_oleh: session.teacherId, updated_at: new Date().toISOString() }))
  if (isi.length === 0) return { error: 'Tidak ada peserta untuk disimpan.' }
  const { error } = await supabase.from('ekstra_hadir').upsert(isi, { onConflict: 'booking_id,tanggal' })
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : 'Gagal menyimpan kehadiran.' }
  revalidatePath('/guru/ekstra')
  return { success: true }
}
