'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getSession } from '@/lib/auth/session'
import { canManageGukar, canManageGukarSetoran } from '@/lib/auth/permissions'
import { isValidPeriod, toPeriodDate } from '@/lib/finance/period'
import { STANDAR_BY_KEY, TAHAP_TAHSIN } from '@/lib/rq/gukar-standar'
import type { GukarStatusPegawai } from '@/types'

type Result = { error?: string; success?: boolean }

/**
 * Angka dari form, atau NULL bila dikosongkan.
 *
 * Kosong dan nol berbeda artinya di sini: "0 juz tuntas" adalah pengukuran,
 * sedangkan kolom kosong berarti belum diukur — dan analitik memperlakukan
 * keduanya berbeda saat menghitung cakupan data.
 */
function angkaAtauNull(nilai: FormDataEntryValue | null, min: number, max: number): number | null {
  const teks = String(nilai ?? '').trim()
  if (!teks) return null
  const angka = Number(teks)
  if (!Number.isFinite(angka)) return null
  return Math.min(max, Math.max(min, Math.round(angka)))
}

/**
 * Pengisian capaian pembinaan dilakukan pengampu lewat portal /guru.
 *
 * Izinnya tidak ditentukan role melainkan PENUGASAN: yang boleh mengisi hanya
 * guru yang tercatat sebagai pengampu kelompok itu. Diperiksa ke database tiap
 * kali, bukan dititipkan lewat form — id kelompok datang dari peramban dan
 * karenanya tidak boleh dipercaya.
 */
async function guardPengampu(
  groupId: string,
): Promise<{ teacherId: string | null; groupId: string } | { error: string }> {
  if (!groupId) return { error: 'Kelompok tidak dikenali.' }

  const supabase = createServerClient()
  const { data: group } = await supabase
    .from('gukar_groups')
    .select('id, pengampu_id')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return { error: 'Kelompok tidak ditemukan.' }

  // Jalur pertama: pengampu kelompok itu sendiri, lewat portal guru.
  const teacher = await getTeacherSession()
  if (teacher) {
    if (group.pengampu_id !== teacher.teacherId) {
      return { error: 'Anda bukan pengampu kelompok ini.' }
    }
    // Batas sesungguhnya ada di sini, bukan di halaman: menyembunyikan menu
    // tidak menghentikan pengiriman langsung ke server action.
    if (!(await bolehMengampuGukar(teacher.teacherId))) {
      return { error: 'Pembinaan gukar hanya diampu guru Tetap Yayasan & Kontrak Yayasan.' }
    }
    return { teacherId: teacher.teacherId, groupId }
  }

  // Jalur kedua: SDM sebagai pemilik program, dan Kepala RQ. Keduanya masuk
  // lewat akun pengurus, bukan akun guru, sehingga sesinya berbeda jenis.
  // recorded_by dibiarkan null — kolom itu merujuk tabel teachers, dan
  // pengurus yang mengoreksi belum tentu punya baris di sana.
  const pengurus = await getSession()
  if (pengurus && canManageGukarSetoran(pengurus.role)) {
    return { teacherId: null, groupId }
  }

  return { error: 'Sesi tidak valid atau tidak memiliki izin.' }
}

/**
 * Simpan catatan satu peserta pada satu bulan.
 *
 * Memakai upsert pada (participant_id, period): pengampu lazimnya membuka
 * bulan yang sama berkali-kali — menandai kehadiran pekan ini, lalu menambah
 * capaian di akhir bulan — dan tiap kali menyimpan harus memperbarui baris
 * yang sama, bukan menumpuk baris baru.
 */
export async function saveGukarMonthlyAction(_: unknown, formData: FormData): Promise<Result> {
  const groupId = (formData.get('group_id') as string) ?? ''
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth

  const participantId = (formData.get('participant_id') as string) ?? ''
  const periodKey = (formData.get('period') as string) ?? ''
  if (!participantId) return { error: 'Peserta tidak dikenali.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  // Pastikan pesertanya memang anggota kelompok yang diampu — tanpa ini,
  // id peserta mana pun bisa dititipkan lewat form.
  const { data: participant } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  const halaman = Number((formData.get('jumlah_halaman') as string) ?? '0')

  // Tahap tahsin hanya diterima bila persis salah satu pilihan baku. Nilai
  // asing dari form yang disunting akan lolos ke analitik sebagai kategori
  // "tak tercatat" tanpa jejak, jadi ditolak lebih awal di sini.
  const tahap = ((formData.get('tahap_tahsin') as string) ?? '').trim()
  if (tahap && !(TAHAP_TAHSIN as readonly string[]).includes(tahap)) {
    return { error: 'Tahap tahsin tidak dikenali.' }
  }

  const juzTuntas = angkaAtauNull(formData.get('juz_tuntas'), 0, 30)
  const juzBerjalan = angkaAtauNull(formData.get('juz_berjalan'), 1, 30)
  const nilaiTahfidz = angkaAtauNull(formData.get('nilai_tahfidz'), 0, 100)
  const suratPilihan = angkaAtauNull(formData.get('surat_pilihan'), 0, 30) ?? 0

  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participantId,
      period: toPeriodDate(periodKey),
      capaian_tahsin: ((formData.get('capaian_tahsin') as string) ?? '').trim(),
      capaian_tahfidz: ((formData.get('capaian_tahfidz') as string) ?? '').trim(),
      tahap_tahsin: tahap,
      juz_tuntas: juzTuntas,
      juz_berjalan: juzBerjalan,
      nilai_tahfidz: nilaiTahfidz,
      surat_pilihan: suratPilihan,
      hadir_1: formData.get('hadir_1') === 'on',
      hadir_2: formData.get('hadir_2') === 'on',
      hadir_3: formData.get('hadir_3') === 'on',
      hadir_4: formData.get('hadir_4') === 'on',
      hadir_5: formData.get('hadir_5') === 'on',
      jumlah_halaman: Number.isFinite(halaman) && halaman > 0 ? Math.round(halaman) : 0,
      catatan: ((formData.get('catatan') as string) ?? '').trim(),
      recorded_by: auth.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan catatan.' }

  revalidatePath(`/guru/gukar/${groupId}`)
  return { success: true }
}

/**
 * Tandai kehadiran satu pekan tanpa membuka formulir.
 *
 * Pembinaan berjalan sepekan sekali, jadi tindakan yang paling sering
 * dilakukan pengampu adalah mencentang hadir untuk pekan berjalan. Aksi
 * ringkas ini membuatnya cukup satu klik alih-alih membuka dan menyimpan
 * seluruh formulir peserta.
 */
export async function toggleHadirAction(
  groupId: string,
  participantId: string,
  periodKey: string,
  pekan: number,
  hadir: boolean,
): Promise<Result> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (!Number.isInteger(pekan) || pekan < 1 || pekan > 5) return { error: 'Pekan tidak valid.' }

  const supabase = createServerClient()
  const { data: participant } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participantId,
      period: toPeriodDate(periodKey),
      [`hadir_${pekan}`]: hadir,
      recorded_by: auth.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan kehadiran.' }

  revalidatePath(`/guru/gukar/${groupId}`)
  return { success: true }
}

/**
 * Hapus catatan bulanan seorang peserta.
 *
 * Berbeda dengan setoran santri, tidak ada yang perlu dihitung ulang: catatan
 * gukar berdiri sendiri per bulan dan tidak menggeser posisi apa pun.
 * Menghapusnya cukup mengembalikan bulan itu ke keadaan "belum diisi".
 */
export async function deleteGukarMonthlyAction(groupId: string, participantId: string, periodKey: string): Promise<Result> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  // Pastikan pesertanya memang anggota kelompok yang diampu — id peserta
  // datang dari peramban dan karenanya tidak boleh dipercaya.
  const { data: participant } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  const { error } = await supabase
    .from('gukar_monthly')
    .delete()
    .eq('participant_id', participantId)
    .eq('period', toPeriodDate(periodKey))

  if (error) return { error: error.message || 'Gagal menghapus catatan.' }

  revalidatePath(`/guru/gukar/${groupId}`)
  revalidatePath('/dashboard/analitik/gukar')
  return { success: true }
}

/**
 * Tetapkan status kepegawaian & kategori peran seorang peserta.
 *
 * Ini keputusan kepegawaian, bukan catatan pembelajaran — karena itu izinnya
 * bukan "pengampu kelompok" melainkan canManageGukar (SDM & Kepala RQ).
 * Pengampu tetap tidak boleh menandai anggotanya sendiri sebagai calon
 * pegawai tetap: bab 06 laporan SDM memakai daftar itu sebagai dasar
 * percepatan menjelang batas berkas, dan daftarnya harus tunggal.
 */
export async function setGukarProfilPesertaAction(
  participantId: string,
  statusPegawai: GukarStatusPegawai | '',
  kategoriPeran: string,
): Promise<Result> {
  const pengurus = await getSession()
  if (!pengurus || !canManageGukar(pengurus.role)) {
    return { error: 'Anda tidak memiliki izin menetapkan status kepegawaian.' }
  }
  if (!participantId) return { error: 'Peserta tidak dikenali.' }

  const status = statusPegawai || null
  if (status && !['tetap', 'calon_tetap', 'kontrak'].includes(status)) {
    return { error: 'Status kepegawaian tidak dikenali.' }
  }
  if (kategoriPeran && !STANDAR_BY_KEY.has(kategoriPeran)) {
    return { error: 'Kategori peran tidak dikenali.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('gukar_participants')
    .update({ status_pegawai: status, kategori_peran: kategoriPeran })
    .eq('id', participantId)

  if (error) return { error: error.message || 'Gagal menyimpan status peserta.' }

  revalidatePath('/dashboard/analitik/gukar/standar')
  return { success: true }
}
