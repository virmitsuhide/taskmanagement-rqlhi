'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { getCalonSiswa, type CalonSiswa, type StatusHadirEkstra, type WaktuEkstra } from '@/lib/data/ekstra'
import { kolomJadwal, periksaJadwalEkstra } from '@/lib/rq/jadwal-ekstra'
import { statusTahsinSah } from '@/lib/rq/status-tahsin'
import { METODE_NON_SISWA, metodeNonSiswa } from '@/lib/tahsin'

type Hasil = { error?: string; success?: true }

const PESAN_MIGRASI = 'Tabel ekstra belum ada. Minta admin menjalankan migrasi 0091 lebih dulu.'
const tabelHilang = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/
const JAM = /^\d{2}:\d{2}$/
const hariIniWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const teks = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)

/** Guru ekstra aktif; null bila tabel 0095 belum ada (semua guru dianggap boleh). */
async function idGuruEkstra(): Promise<Set<string> | null> {
  const { data, error } = await createServerClient().from('ekstra_guru').select('teacher_id').eq('aktif', true)
  if (tabelHilang(error)) return null
  return new Set(((data ?? []) as { teacher_id: string }[]).map(r => r.teacher_id))
}

async function koordinator() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' as const }
  if (!canManageEkstra(session.role)) return { error: 'Tidak memiliki izin.' as const }
  return { session }
}

function segarkan() {
  revalidatePath('/ekstra')
  revalidatePath('/ekstra/guru')
  revalidatePath('/')
  revalidatePath('/ekstra/halaqoh', 'layout')
  revalidatePath('/ekstra/siswa', 'layout')
  revalidatePath('/ekstra/analitik')
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
  if (!['tahsin', 'tahfidz', 'campuran', 'materi'].includes(bidang)) return { error: 'Bidang tidak dikenal.' }
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

// ─── Halaqoh ekstra (ekstra_slot: pengampu + hari + jam + tempat) ───────────

export async function simpanSlotEkstraAction(_: unknown, fd: FormData): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }

  const id = teks(fd, 'id', 40)
  const jenisId = teks(fd, 'jenis_id', 40)
  const teacherId = teks(fd, 'teacher_id', 40)
  const kuotaTeks = teks(fd, 'kuota', 4)
  if (!jenisId || !teacherId) return { error: 'Jenis ekstra dan guru wajib dipilih.' }
  // Daftar waktu dari EditorJadwalEkstra (JSON); tempat tiap waktu ikut di dalamnya.
  let masuk: unknown = null
  try { masuk = JSON.parse(String(fd.get('jadwal') ?? '')) } catch { /* ditolak di bawah */ }
  const jadwal = periksaJadwalEkstra(masuk)
  if ('error' in jadwal) return { error: jadwal.error }
  const kuota = kuotaTeks ? Number(kuotaTeks) : null
  if (kuota !== null && (!Number.isInteger(kuota) || kuota < 1 || kuota > 50)) return { error: 'Kuota 1–50, atau kosongkan untuk ikut jenisnya.' }

  const bolehGuru = await idGuruEkstra()
  if (bolehGuru && !bolehGuru.has(teacherId)) {
    // Menyunting halaqoh yang pengampunya sudah lama ada tetap boleh.
    const { data: lama } = id ? await createServerClient().from('ekstra_slot').select('teacher_id').eq('id', id).maybeSingle() : { data: null }
    if ((lama as { teacher_id: string } | null)?.teacher_id !== teacherId) return { error: 'Guru ini belum terdaftar sebagai guru ekstra. Tambahkan dulu di tab Guru ekstra.' }
  }

  const isi = {
    jenis_id: jenisId, teacher_id: teacherId, ...kolomJadwal(jadwal.jadwal),
    kuota, aktif: fd.get('aktif') === 'on',
    updated_at: new Date().toISOString(),
  }
  const supabase = createServerClient()
  const { error } = id
    ? await supabase.from('ekstra_slot').update(isi).eq('id', id)
    : await supabase.from('ekstra_slot').insert(isi)
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI : kolomHilang(error) ? PESAN_MIGRASI_JADWAL : 'Gagal menyimpan halaqoh ekstra.' }
  segarkan()
  return { success: true }
}

/** Kolom jadwal_tambahan belum ada — migrasi 0125 belum dijalankan. */
const kolomHilang = (e: { code?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204')
const PESAN_MIGRASI_JADWAL = 'Jadwal ekstra butuh migrasi 0125. Minta admin menjalankannya lebih dulu.'

// ─── Booking dari orang tua (publik, tanpa akun) ─────────────────────────────
//
// Sejak 0093 booking adalah PREFERENSI: jenis, hari & bagian hari, dan guru
// pilihan (opsional). Orang tua tidak memilih jadwal; Koordinator Ekstra yang
// menanyakan guru di luar sistem lalu menempatkan anak ke halaqoh ekstra.

const BAGIAN = new Set(['pagi', 'sore', 'malam'])

export async function ajukanBookingEkstraAction(_: unknown, fd: FormData): Promise<Hasil> {
  // Penahan spam: kolom jebakan yang tak terlihat manusia, dan formulir yang
  // dikirim terlalu cepat setelah dibuka (bot mengisi dalam milidetik).
  if (teks(fd, 'website', 200)) return { success: true }
  const dibuka = Number(fd.get('dibuka') ?? 0)
  if (!dibuka || Date.now() - dibuka < 3000) return { error: 'Mohon periksa kembali isian Anda, lalu kirim ulang.' }

  const jenisId = teks(fd, 'jenis_id', 40)
  // Maks. 3 guru pilihan; urutan pilihan orang tua dipertahankan.
  const guruIds = [...new Set(fd.getAll('guru_pilihan_id').map(v => String(v).trim()).filter(Boolean))].slice(0, 4)
  const hari = [...new Set(fd.getAll('hari').map(Number))].filter(h => Number.isInteger(h) && h >= 1 && h <= 7)
  const waktu = [...new Set(fd.getAll('waktu').map(String))].filter(w => BAGIAN.has(w))
  const namaAnak = teks(fd, 'nama_anak', 120)
  const namaOrtu = teks(fd, 'nama_ortu', 120)
  const wa = teks(fd, 'wa_ortu', 20).replace(/[^\d+]/g, '')
  const asal = teks(fd, 'asal', 5) === 'luar' ? 'luar' : 'lhi'
  if (!jenisId) return { error: 'Pilih jenis ekstra lebih dulu.' }
  if (hari.length === 0) return { error: 'Pilih setidaknya satu hari.' }
  if (waktu.length === 0) return { error: 'Pilih waktu yang diinginkan (pagi, sore, atau malam).' }
  if (namaAnak.length < 3) return { error: 'Nama peserta wajib diisi.' }
  if (namaOrtu.length < 3) return { error: 'Nama yang bisa dihubungi wajib diisi.' }
  if (!/^(\+?62|0)8\d{7,12}$/.test(wa)) return { error: 'Nomor WhatsApp tidak valid (contoh 08123456789).' }

  const supabase = createServerClient()
  const { data: jenis, error: jErr } = await supabase.from('ekstra_jenis').select('id, aktif').eq('id', jenisId).maybeSingle()
  if (tabelHilang(jErr)) return { error: 'Pendaftaran ekstra belum dibuka.' }
  if (!(jenis as { aktif: boolean } | null)?.aktif) return { error: 'Jenis ekstra ini sedang tidak dibuka. Silakan pilih jenis lain.' }

  // Guru pilihan hanya dari guru yang profilnya tampil publik.
  if (guruIds.length > 3) return { error: 'Pilih paling banyak 3 guru.' }
  if (guruIds.length) {
    const { data: g } = await supabase.from('teachers').select('id').in('id', guruIds).eq('is_public', true).is('deleted_at', null)
    if ((g ?? []).length !== guruIds.length) return { error: 'Ada guru pilihan yang tidak ditemukan. Periksa kembali pilihan guru.' }
    const bolehGuru = await idGuruEkstra()
    if (bolehGuru && guruIds.some(x => !bolehGuru.has(x))) return { error: 'Ada guru pilihan yang sedang tidak menerima ekstra. Pilih guru lain atau "siapa saja".' }
  }

  // Batas wajar: tiga permintaan per nomor WA dalam sehari.
  const sejak = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count } = await supabase.from('ekstra_booking').select('id', { count: 'exact', head: true })
    .eq('wa_ortu', wa).gte('created_at', sejak)
  if ((count ?? 0) >= 3) return { error: 'Nomor ini sudah mengirim beberapa permintaan hari ini. Koordinator Ekstra akan menghubungi Anda.' }

  const { error } = await supabase.from('ekstra_booking').insert({
    jenis_id: jenisId, guru_pilihan_ids: guruIds, hari_pilihan: hari, waktu_pilihan: waktu,
    catatan_waktu: teks(fd, 'catatan_waktu', 120),
    nama_anak: namaAnak, asal, wa_ortu: wa, nama_ortu: namaOrtu,
    kelas: teks(fd, 'kelas', 40), posisi_bacaan: teks(fd, 'posisi_bacaan', 120),
    catatan_ortu: teks(fd, 'catatan_ortu', 500),
  })
  if (error) return { error: 'Permintaan gagal terkirim. Coba lagi beberapa saat.' }
  revalidatePath('/ekstra')
  return { success: true }
}

// ─── Penanganan koordinator ──────────────────────────────────────────────────

/** Halaqoh tujuan: yang sudah ada, atau dibuat baru dari isian koordinator. */
export type TujuanHalaqoh =
  | { slotId: string }
  | { baru: {
      teacher_id: string; hari: number; jam_mulai: string; jam_selesai: string; tempat: string; kuota: number | null
      /** Waktu lain sepekan (0125) — dipakai saat pindah guru menyalin jadwal halaqoh lama. */
      jadwal_tambahan?: WaktuEkstra[]
    } }

async function ambilBooking(id: string) {
  const { data } = await createServerClient().from('ekstra_booking')
    .select('id, slot_id, slot_tawaran_id, status, asal, student_id, jenis_id').eq('id', id).maybeSingle()
  return data as { id: string; slot_id: string | null; slot_tawaran_id: string | null; status: string; asal: string; student_id: string | null; jenis_id: string } | null
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

/**
 * Pastikan halaqoh tujuan ada dan cocok dengan jenis permintaan; buat baru
 * bila diminta. Mengembalikan id halaqoh.
 */
async function siapkanHalaqoh(jenisId: string, tujuan: TujuanHalaqoh): Promise<{ slotId: string } | { error: string }> {
  const supabase = createServerClient()
  if ('slotId' in tujuan) {
    const { data } = await supabase.from('ekstra_slot').select('id, jenis_id').eq('id', tujuan.slotId).maybeSingle()
    const s = data as { id: string; jenis_id: string } | null
    if (!s) return { error: 'Halaqoh ekstra tidak ditemukan.' }
    if (s.jenis_id !== jenisId) return { error: 'Jenis halaqoh berbeda dengan jenis yang diminta orang tua.' }
    return { slotId: s.id }
  }
  const b = tujuan.baru
  if (!b.teacher_id) return { error: 'Pilih guru pengampu.' }
  const bolehGuru = await idGuruEkstra()
  if (bolehGuru && !bolehGuru.has(b.teacher_id)) return { error: 'Guru ini belum terdaftar sebagai guru ekstra. Tambahkan dulu di tab Guru ekstra.' }
  if (!(b.hari >= 1 && b.hari <= 7)) return { error: 'Hari tidak valid.' }
  if (!JAM.test(b.jam_mulai) || !JAM.test(b.jam_selesai) || b.jam_selesai <= b.jam_mulai) return { error: 'Jam selesai harus setelah jam mulai.' }
  if (b.kuota !== null && (!Number.isInteger(b.kuota) || b.kuota < 1 || b.kuota > 50)) return { error: 'Kuota 1–50, atau kosongkan untuk ikut jenisnya.' }
  const { data, error } = await supabase.from('ekstra_slot').insert({
    jenis_id: jenisId, teacher_id: b.teacher_id, hari: b.hari, jam_mulai: b.jam_mulai, jam_selesai: b.jam_selesai,
    tempat: b.tempat.slice(0, 120), kuota: b.kuota, aktif: true,
    ...(b.jadwal_tambahan?.length ? { jadwal_tambahan: b.jadwal_tambahan } : {}),
  }).select('id').single()
  if (error || !data) return { error: 'Gagal membuat halaqoh ekstra baru.' }
  return { slotId: (data as { id: string }).id }
}

/**
 * Masukkan anak ke halaqoh ekstra → peserta aktif. Tujuan: halaqoh yang ada,
 * halaqoh baru, atau (tanpa tujuan) halaqoh yang sebelumnya ditawarkan.
 */
export async function terimaBookingAction(id: string, studentId: string | null, tujuan?: TujuanHalaqoh): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const b = await ambilBooking(id)
  if (!b) return { error: 'Permintaan tidak ditemukan.' }
  if (!['baru', 'ditawarkan'].includes(b.status)) return { error: 'Permintaan ini sudah ditangani.' }

  let slotId: string | null = null
  if (tujuan) {
    const h = await siapkanHalaqoh(b.jenis_id, tujuan)
    if ('error' in h) return { error: h.error }
    slotId = h.slotId
  } else {
    slotId = b.status === 'ditawarkan' ? b.slot_tawaran_id : b.slot_id
  }
  if (!slotId) return { error: 'Pilih halaqoh ekstra, atau buat yang baru.' }
  if (await slotPenuh(slotId, id)) return { error: 'Kuota halaqoh ini sudah penuh. Pilih halaqoh lain atau buat yang baru.' }

  const { error } = await createServerClient().from('ekstra_booking').update({
    status: 'aktif', slot_id: slotId, slot_tawaran_id: null,
    student_id: b.asal === 'lhi' ? studentId : null,
    mulai: hariIniWIB(), ditangani_oleh: k.session.userId, ditangani_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: 'Gagal memasukkan peserta.' }
  segarkan()
  return { success: true }
}

/** Tawarkan guru/jadwal lain bila guru pilihan tidak bisa — orang tua menjawab lewat WhatsApp. */
export async function tawarkanBookingAction(id: string, tujuan: TujuanHalaqoh, catatan: string): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const b = await ambilBooking(id)
  if (!b || !['baru', 'ditawarkan'].includes(b.status)) return { error: 'Permintaan ini sudah ditangani.' }
  const h = await siapkanHalaqoh(b.jenis_id, tujuan)
  if ('error' in h) return { error: h.error }
  const { error } = await createServerClient().from('ekstra_booking').update({
    status: 'ditawarkan', slot_tawaran_id: h.slotId, catatan_koor: catatan.slice(0, 500),
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

/**
 * Pindahkan peserta aktif ke halaqoh ekstra lain dengan jenis yang sama, atau
 * ke guru ekstra lain. Ke guru: dibuatkan halaqoh baru untuk guru itu dengan
 * jadwal & tempat halaqoh lama — privat berkuota 1 tidak pernah punya kursi
 * kosong, jadi tanpa ini anak tidak bisa pindah guru sama sekali. Jadwalnya
 * lalu diatur sendiri oleh guru barunya (ubahJadwalEkstraGuruAction).
 */
export async function pindahHalaqohEkstraAction(id: string, tujuan: { slotId: string } | { guruId: string }): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const b = await ambilBooking(id)
  if (!b || b.status !== 'aktif') return { error: 'Hanya peserta aktif yang bisa dipindahkan.' }
  if ('slotId' in tujuan && b.slot_id === tujuan.slotId) return { error: 'Peserta sudah di halaqoh ini.' }

  let slotId: string
  if ('slotId' in tujuan) {
    const h = await siapkanHalaqoh(b.jenis_id, tujuan)
    if ('error' in h) return { error: h.error }
    if (await slotPenuh(h.slotId)) return { error: 'Kuota halaqoh tujuan sudah penuh.' }
    slotId = h.slotId
  } else {
    const { data: lama } = b.slot_id
      ? await createServerClient().from('ekstra_slot').select('*').eq('id', b.slot_id).maybeSingle()
      : { data: null }
    const l = lama as { teacher_id: string; hari: number; jam_mulai: string; jam_selesai: string; tempat: string; jadwal_tambahan?: WaktuEkstra[] | null } | null
    if (!l) return { error: 'Halaqoh asal tidak ditemukan.' }
    if (l.teacher_id === tujuan.guruId) return { error: 'Peserta sudah diampu guru ini.' }
    const h = await siapkanHalaqoh(b.jenis_id, { baru: {
      teacher_id: tujuan.guruId, hari: l.hari, jam_mulai: l.jam_mulai.slice(0, 5), jam_selesai: l.jam_selesai.slice(0, 5),
      tempat: l.tempat ?? '', kuota: null, jadwal_tambahan: l.jadwal_tambahan ?? [],
    } })
    if ('error' in h) return { error: h.error }
    slotId = h.slotId
  }
  const { error } = await createServerClient().from('ekstra_booking')
    .update({ slot_id: slotId, ditangani_oleh: k.session.userId, ditangani_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'aktif')
  if (error) return { error: 'Gagal memindahkan peserta.' }
  segarkan()
  return { success: true }
}

/**
 * Koordinator menambah peserta langsung ke halaqoh ekstra yang sudah ada, tanpa
 * booking orang tua: siswa LHI dipilih dari data siswa (kelas & wali ikut
 * terisi), non LHI cukup diketik namanya. Disimpan sebagai booking berstatus
 * aktif supaya kehadiran, setoran, dan laporan tetap satu jalur.
 */
export async function tambahPesertaEkstraAction(slotId: string, isian: {
  studentId: string | null
  namaAnak: string
  kelas: string
  namaOrtu: string
  waOrtu: string
}): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const supabase = createServerClient()
  const { data: s } = await supabase.from('ekstra_slot').select('id, jenis_id, aktif').eq('id', slotId).maybeSingle()
  const slot = s as { id: string; jenis_id: string; aktif: boolean } | null
  if (!slot) return { error: 'Halaqoh ekstra tidak ditemukan.' }
  if (!slot.aktif) return { error: 'Halaqoh ini nonaktif. Aktifkan dulu lewat Data halaqoh.' }
  if (await slotPenuh(slotId)) return { error: 'Kuota halaqoh ini sudah penuh. Naikkan kuotanya lebih dulu.' }

  let namaAnak = isian.namaAnak.trim().slice(0, 120)
  let kelas = isian.kelas.trim().slice(0, 40)
  let namaOrtu = isian.namaOrtu.trim().slice(0, 120)
  let wa = isian.waOrtu.replace(/[^\d+]/g, '').slice(0, 20)

  if (isian.studentId) {
    const { data: st } = await supabase.from('students')
      .select('id, full_name, kelas, wali_name, wali_phone').eq('id', isian.studentId).eq('is_active', true).maybeSingle()
    const siswa = st as { id: string; full_name: string; kelas: string | null; wali_name: string | null; wali_phone: string | null } | null
    if (!siswa) return { error: 'Data siswa tidak ditemukan atau sudah tidak aktif.' }
    const { data: ada } = await supabase.from('ekstra_booking').select('id')
      .eq('slot_id', slotId).eq('student_id', siswa.id).eq('status', 'aktif').limit(1)
    if ((ada ?? []).length) return { error: `${siswa.full_name} sudah menjadi peserta halaqoh ini.` }
    namaAnak = siswa.full_name
    kelas = kelas || (siswa.kelas ?? '')
    namaOrtu = namaOrtu || (siswa.wali_name ?? '')
    wa = wa || (siswa.wali_phone ?? '').replace(/[^\d+]/g, '')
  }
  if (namaAnak.length < 3) return { error: 'Nama peserta minimal 3 huruf.' }
  // WA boleh kosong (diisi belakangan), tetapi bila diisi harus nomor yang valid.
  if (wa && !/^(\+?62|0)8\d{7,12}$/.test(wa)) return { error: 'Nomor WhatsApp tidak valid (contoh 08123456789), atau kosongkan.' }

  const kini = new Date().toISOString()
  const { data: baru, error } = await supabase.from('ekstra_booking').insert({
    jenis_id: slot.jenis_id, slot_id: slotId, status: 'aktif',
    nama_anak: namaAnak, asal: isian.studentId ? 'lhi' : 'luar', student_id: isian.studentId,
    kelas, nama_ortu: namaOrtu, wa_ortu: wa, catatan_koor: 'Ditambahkan langsung oleh koordinator',
    mulai: hariIniWIB(), ditangani_oleh: k.session.userId, ditangani_at: kini, updated_at: kini,
  }).select('id').single()
  if (error || !baru) return { error: 'Gagal menambah peserta.' }
  // Non LHI: data peserta luarnya langsung dibuat (diabaikan bila 0122 belum dijalankan).
  if (!isian.studentId) await pastikanPesertaLuar((baru as { id: string }).id)
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

/** Cari data siswa aktif untuk ditautkan, bila calon yang disarankan tidak memuat anaknya. */
export async function cariSiswaEkstraAction(q: string): Promise<{ error?: string; hasil?: CalonSiswa[] }> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  if (q.trim().length < 2) return { error: 'Ketik minimal 2 huruf.' }
  return { hasil: await getCalonSiswa(q.trim().slice(0, 80), null, 12) }
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

// ─── Setoran peserta non-LHI (0122) ──────────────────────────────────────────

const PESAN_MIGRASI_LUAR = 'Fitur setoran peserta non-LHI belum aktif. Minta admin menjalankan migrasi 0122 lebih dulu.'

/** Data peserta luar milik booking ini; dibuat bila belum ada (booking luar sesudah 0122). */
async function pastikanPesertaLuar(bookingId: string): Promise<{ id: string } | { error: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('ekstra_booking')
    .select('id, asal, peserta_luar_id, nama_anak, kelas, nama_ortu, wa_ortu').eq('id', bookingId).maybeSingle()
  if (tabelHilang(error) || error?.code === '42703') return { error: PESAN_MIGRASI_LUAR }
  const b = data as { asal: string; peserta_luar_id: string | null; nama_anak: string; kelas: string; nama_ortu: string; wa_ortu: string } | null
  if (!b) return { error: 'Peserta tidak ditemukan.' }
  if (b.asal !== 'luar') return { error: 'Siswa LHI disetor lewat Setor tahsin/tahfidz.' }
  if (b.peserta_luar_id) return { id: b.peserta_luar_id }
  const { data: p, error: pErr } = await supabase.from('ekstra_peserta_luar')
    .insert({ nama: b.nama_anak, kelas: b.kelas, nama_ortu: b.nama_ortu, wa_ortu: b.wa_ortu }).select('id').single()
  if (pErr || !p) return { error: tabelHilang(pErr) ? PESAN_MIGRASI_LUAR : 'Gagal membuat data peserta.' }
  const id = (p as { id: string }).id
  await supabase.from('ekstra_booking').update({ peserta_luar_id: id }).eq('id', bookingId)
  return { id }
}

export interface IsiSetoranLuar {
  jilid_id: string
  halaman: number | null
  baris_dari: number | null
  baris_ke: number | null
  status: string
  catatan: string
}

/**
 * Guru pengampu mencatat setoran tahsin peserta non-LHI. Jilid boleh dipilih
 * bebas — penempatan peserta dewasa ditentukan gurunya, bukan ujian sekolah.
 */
export async function simpanSetoranLuarAction(slotId: string, bookingId: string, tanggal: string, isi: IsiSetoranLuar): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!TANGGAL.test(tanggal) || tanggal > hariIniWIB()) return { error: 'Tanggal tidak valid.' }

  const supabase = createServerClient()
  const [{ data: slot }, { data: b }, { data: j }] = await Promise.all([
    supabase.from('ekstra_slot').select('teacher_id').eq('id', slotId).maybeSingle(),
    supabase.from('ekstra_booking').select('id').eq('id', bookingId).eq('slot_id', slotId).eq('status', 'aktif').maybeSingle(),
    supabase.from('jilid_levels').select('id, method_id, total_pages, is_terminal, metode:tahsin_methods(name)').eq('id', isi.jilid_id).maybeSingle(),
  ])
  if ((slot as { teacher_id: string } | null)?.teacher_id !== session.teacherId) return { error: 'Anda bukan pengampu halaqoh ini.' }
  if (!b) return { error: 'Peserta ini bukan peserta aktif halaqoh ini.' }
  const jilid = j as { id: string; method_id: string; total_pages: number | null; is_terminal: boolean; metode: { name: string } | null } | null
  if (!jilid || jilid.is_terminal) return { error: 'Pilih jilid / tahap bacaan.' }
  if (metodeNonSiswa([{ name: jilid.metode?.name ?? '' }]).length === 0) return { error: `Metode peserta non-LHI: ${METODE_NON_SISWA.join(', ')}.` }

  const batas = jilid.total_pages ?? 604
  const halaman = isi.halaman
  if (halaman !== null && (!Number.isInteger(halaman) || halaman < 1 || halaman > batas)) return { error: `Halaman 1–${batas}.` }
  if (jilid.total_pages && halaman === null) return { error: 'Isi halaman jilidnya.' }
  const status = statusTahsinSah(isi.status)
  const baris = (v: number | null) => v !== null && Number.isInteger(v) && v >= 1 && v <= 30 ? v : null
  const barisDari = status === 'lanjut' ? baris(isi.baris_dari) : null
  const barisKe = status === 'lanjut' ? baris(isi.baris_ke) : null
  if (barisDari !== null && barisKe !== null && barisKe < barisDari) return { error: 'Baris akhir harus sesudah baris awal.' }

  const p = await pastikanPesertaLuar(bookingId)
  if ('error' in p) return { error: p.error }
  const { error } = await supabase.from('ekstra_setoran_luar').insert({
    peserta_id: p.id, slot_id: slotId, teacher_id: session.teacherId, tanggal,
    jilid_id: jilid.id, halaman, baris_dari: barisDari, baris_ke: barisKe, status, catatan: isi.catatan.trim().slice(0, 300),
  })
  if (error) return { error: tabelHilang(error) ? PESAN_MIGRASI_LUAR : 'Gagal menyimpan setoran.' }
  // Metode ikut tercatat di data peserta — penempatan untuk pertemuan berikutnya.
  await supabase.from('ekstra_peserta_luar').update({ method_id: jilid.method_id, updated_at: new Date().toISOString() }).eq('id', p.id)
  revalidatePath('/guru/ekstra')
  revalidatePath('/ekstra/halaqoh', 'layout')
  return { success: true }
}

/**
 * Guru pengampu mencatat setoran tahfidz peserta non-LHI (0123): ziyadah atau
 * muroja'ah, satu surat dengan rentang ayat. Yang ditampilkan hanya posisi akhir.
 */
export async function simpanSetoranTahfidzLuarAction(slotId: string, bookingId: string, tanggal: string, isi: {
  jenis: string; surat_id: number; ayat_dari: number; ayat_ke: number; catatan: string
}): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!TANGGAL.test(tanggal) || tanggal > hariIniWIB()) return { error: 'Tanggal tidak valid.' }

  const supabase = createServerClient()
  const [{ data: slot }, { data: b }, { data: s }] = await Promise.all([
    supabase.from('ekstra_slot').select('teacher_id').eq('id', slotId).maybeSingle(),
    supabase.from('ekstra_booking').select('id').eq('id', bookingId).eq('slot_id', slotId).eq('status', 'aktif').maybeSingle(),
    supabase.from('surat_master').select('total_ayat').eq('id', isi.surat_id).maybeSingle(),
  ])
  if ((slot as { teacher_id: string } | null)?.teacher_id !== session.teacherId) return { error: 'Anda bukan pengampu halaqoh ini.' }
  if (!b) return { error: 'Peserta ini bukan peserta aktif halaqoh ini.' }
  const total = (s as { total_ayat: number } | null)?.total_ayat
  if (!total) return { error: 'Pilih surat.' }
  const { ayat_dari: dari, ayat_ke: ke } = isi
  if (!Number.isInteger(dari) || !Number.isInteger(ke) || dari < 1 || ke < dari || ke > total) return { error: `Ayat 1–${total}, dan ayat akhir tidak sebelum ayat awal.` }

  const p = await pastikanPesertaLuar(bookingId)
  if ('error' in p) return { error: p.error }
  const { error } = await supabase.from('ekstra_setoran_tahfidz_luar').insert({
    peserta_id: p.id, slot_id: slotId, teacher_id: session.teacherId, tanggal,
    jenis: isi.jenis === 'murojaah' ? 'murojaah' : 'ziyadah', surat_id: isi.surat_id, ayat_dari: dari, ayat_ke: ke,
    catatan: isi.catatan.trim().slice(0, 300),
  })
  if (error) return { error: tabelHilang(error) ? 'Setoran tahfidz peserta non-LHI belum aktif. Minta admin menjalankan migrasi 0123.' : 'Gagal menyimpan setoran.' }
  revalidatePath('/guru/ekstra')
  revalidatePath('/ekstra/halaqoh', 'layout')
  return { success: true }
}

/** Hapus setoran peserta luar — oleh guru yang mencatatnya / pengampu halaqohnya, atau koordinator. */
export async function hapusSetoranLuarAction(id: string, jenis: 'tahsin' | 'tahfidz' = 'tahsin'): Promise<Hasil> {
  const supabase = createServerClient()
  const tabel = jenis === 'tahfidz' ? 'ekstra_setoran_tahfidz_luar' : 'ekstra_setoran_luar'
  const { data } = await supabase.from(tabel).select('teacher_id, slot:ekstra_slot(teacher_id)').eq('id', id).maybeSingle()
  const s = data as unknown as { teacher_id: string | null; slot: { teacher_id: string } | null } | null
  if (!s) return { error: 'Setoran tidak ditemukan.' }
  const [guru, pengurus] = await Promise.all([getTeacherSession(), getSession()])
  const koor = !!pengurus && canManageEkstra(pengurus.role)
  const pengampu = !!guru && (s.teacher_id === guru.teacherId || s.slot?.teacher_id === guru.teacherId)
  if (!koor && !pengampu) return { error: 'Tidak memiliki izin.' }
  const { error } = await supabase.from(tabel).delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus setoran.' }
  revalidatePath('/guru/ekstra')
  revalidatePath('/ekstra/halaqoh', 'layout')
  return { success: true }
}

/**
 * Simpan materi satu pertemuan ekstra bidang 'materi' (0117) — Bahasa Arab,
 * pelatihan guru, dll. Satu deskripsi per halaqoh per tanggal; menyimpan ulang
 * menimpanya, dan deskripsi kosong menghapusnya. Pengampu slot itu, atau
 * koordinator ekstra (untuk membetulkan).
 */
export async function simpanMateriEkstraAction(slotId: string, tanggal: string, deskripsi: string): Promise<Hasil> {
  const [guru, pengurus] = await Promise.all([getTeacherSession(), getSession()])
  const koor = !!pengurus && canManageEkstra(pengurus.role)
  if (!guru && !koor) return { error: 'Sesi tidak valid.' }
  if (!TANGGAL.test(tanggal) || tanggal > hariIniWIB()) return { error: 'Tanggal tidak valid.' }
  const isi = deskripsi.trim().slice(0, 2000)

  const supabase = createServerClient()
  const { data: slot } = await supabase.from('ekstra_slot')
    .select('teacher_id, jenis:ekstra_jenis(bidang)').eq('id', slotId).maybeSingle()
  const s = slot as unknown as { teacher_id: string; jenis: { bidang: string } | null } | null
  if (!s) return { error: 'Halaqoh ekstra tidak ditemukan.' }
  if (!koor && s.teacher_id !== guru?.teacherId) return { error: 'Anda bukan pengampu halaqoh ini.' }
  if (s.jenis?.bidang !== 'materi') return { error: 'Halaqoh ini menyetor tahsin/tahfidz, bukan materi.' }

  const { error } = isi
    ? await supabase.from('ekstra_materi').upsert({
        slot_id: slotId, tanggal, deskripsi: isi, teacher_id: guru?.teacherId ?? s.teacher_id, updated_at: new Date().toISOString(),
      }, { onConflict: 'slot_id,tanggal' })
    : await supabase.from('ekstra_materi').delete().eq('slot_id', slotId).eq('tanggal', tanggal)
  if (error) return { error: tabelHilang(error) ? 'Tabel materi ekstra belum ada — jalankan drizzle/0117_ekstra_materi_PASTE_TO_SUPABASE.sql di Supabase.' : 'Gagal menyimpan materi.' }
  revalidatePath('/guru/ekstra')
  revalidatePath('/guru/progres')
  revalidatePath('/ekstra/progres')
  return { success: true }
}

// ─── Guru ekstra (0095) ──────────────────────────────────────────────────────

/** Tambahkan guru (lintas unit) ke daftar guru ekstra; yang pernah dinonaktifkan diaktifkan lagi. */
export async function tambahGuruEkstraAction(teacherIds: string[]): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const ids = [...new Set(teacherIds.filter(Boolean))].slice(0, 100)
  if (ids.length === 0) return { error: 'Pilih setidaknya satu guru.' }
  const supabase = createServerClient()
  const { data: t } = await supabase.from('teachers').select('id').in('id', ids).eq('is_active', true).is('deleted_at', null)
  if ((t ?? []).length !== ids.length) return { error: 'Ada guru yang tidak ditemukan atau tidak aktif.' }
  const { error } = await supabase.from('ekstra_guru').upsert(
    ids.map(id => ({ teacher_id: id, aktif: true, ditambah_oleh: k.session.userId, updated_at: new Date().toISOString() })),
    { onConflict: 'teacher_id' },
  )
  if (error) return { error: tabelHilang(error) ? 'Tabel guru ekstra belum ada. Jalankan migrasi 0095 lebih dulu.' : 'Gagal menambah guru ekstra.' }
  segarkan()
  return { success: true }
}

/** Aktifkan / nonaktifkan guru ekstra. Halaqoh yang sudah berjalan tidak ikut berubah. */
export async function ubahGuruEkstraAction(teacherId: string, aktif: boolean, catatan = ''): Promise<Hasil> {
  const k = await koordinator()
  if ('error' in k) return { error: k.error }
  const { error } = await createServerClient().from('ekstra_guru')
    .update({ aktif, catatan: catatan.slice(0, 300), updated_at: new Date().toISOString() }).eq('teacher_id', teacherId)
  if (error) return { error: 'Gagal menyimpan.' }
  segarkan()
  return { success: true }
}

/**
 * Pengampu mengatur sendiri waktu halaqoh ekstra yang ia ampu — beberapa
 * hari sepekan, dua waktu sehari, tempat per waktu (0125) — mis. sesudah
 * peserta dipindahkan kepadanya dengan jadwal guru lama. Jenis, kuota, dan
 * status tetap urusan koordinator.
 */
export async function ubahJadwalEkstraGuruAction(slotId: string, waktu: WaktuEkstra[]): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  const jadwal = periksaJadwalEkstra(waktu)
  if ('error' in jadwal) return { error: jadwal.error }

  const supabase = createServerClient()
  const { data: slot } = await supabase.from('ekstra_slot').select('teacher_id').eq('id', slotId).maybeSingle()
  if ((slot as { teacher_id: string } | null)?.teacher_id !== session.teacherId) return { error: 'Anda bukan pengampu halaqoh ini.' }
  const { error } = await supabase.from('ekstra_slot').update({
    ...kolomJadwal(jadwal.jadwal), updated_at: new Date().toISOString(),
  }).eq('id', slotId).eq('teacher_id', session.teacherId)
  if (error) return { error: kolomHilang(error) ? PESAN_MIGRASI_JADWAL : 'Gagal menyimpan jadwal.' }
  segarkan()
  return { success: true }
}
