'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { isValidPeriod, toPeriodDate } from '@/lib/finance/period'

type Result = { error?: string; success?: boolean }

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
): Promise<{ teacherId: string; groupId: string } | { error: string }> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid. Silakan masuk ulang.' }
  if (!groupId) return { error: 'Kelompok tidak dikenali.' }

  const supabase = createServerClient()
  const { data: group } = await supabase
    .from('gukar_groups')
    .select('id, pengampu_id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) return { error: 'Kelompok tidak ditemukan.' }
  if (group.pengampu_id !== session.teacherId) {
    return { error: 'Anda bukan pengampu kelompok ini.' }
  }

  return { teacherId: session.teacherId, groupId }
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

  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participantId,
      period: toPeriodDate(periodKey),
      capaian_tahsin: ((formData.get('capaian_tahsin') as string) ?? '').trim(),
      capaian_tahfidz: ((formData.get('capaian_tahfidz') as string) ?? '').trim(),
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
