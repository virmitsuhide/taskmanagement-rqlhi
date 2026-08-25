import { createServerClient } from '@/lib/supabase/server'
import { canDoGukarPembinaan } from '@/lib/auth/permissions'
import type { TeacherEmployment } from '@/types'
import { type PeriodKey, periodsYearToDate, toPeriodDate } from '@/lib/finance/period'
import type { GukarGroup, GukarMonthly, GukarParticipant } from '@/types'

/**
 * Pembinaan tahsin & tahfidz guru dan karyawan.
 *
 * Semua fungsi di sini bekerja per semester: kelompok terikat `term_id`, dan
 * rekap menjumlahkan bulan-bulan yang jatuh di dalam rentang semester itu.
 */

/** Berapa kali hadir pada satu baris bulanan. */
export function hadirCount(row: Pick<GukarMonthly, 'hadir_1' | 'hadir_2' | 'hadir_3' | 'hadir_4' | 'hadir_5'>): number {
  return [row.hadir_1, row.hadir_2, row.hadir_3, row.hadir_4, row.hadir_5].filter(Boolean).length
}

export async function getGukarGroups(termId: string): Promise<GukarGroup[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('gukar_groups')
      .select('*')
      .eq('term_id', termId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
    return (data ?? []) as GukarGroup[]
  } catch {
    return []
  }
}

/** Kelompok yang diampu seorang guru pada semester tertentu. */
export async function getGukarGroupsFor(teacherId: string, termId: string): Promise<GukarGroup[]> {
  const all = await getGukarGroups(termId)
  return all.filter(g => g.pengampu_id === teacherId)
}

export async function getGukarGroup(groupId: string): Promise<GukarGroup | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('gukar_groups').select('*').eq('id', groupId).maybeSingle()
    return (data as GukarGroup) ?? null
  } catch {
    return null
  }
}

export async function getGukarParticipants(groupId: string): Promise<GukarParticipant[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('gukar_participants')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
    return (data ?? []) as GukarParticipant[]
  } catch {
    return []
  }
}

/** Catatan bulan tertentu untuk satu kelompok, dipetakan per peserta. */
export async function getGukarMonthly(
  participantIds: string[],
  period: PeriodKey,
): Promise<Map<string, GukarMonthly>> {
  const map = new Map<string, GukarMonthly>()
  if (participantIds.length === 0) return map

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('gukar_monthly')
      .select('*')
      .in('participant_id', participantIds)
      .eq('period', toPeriodDate(period))

    for (const row of (data ?? []) as GukarMonthly[]) map.set(row.participant_id, row)
    return map
  } catch {
    return map
  }
}

export interface GukarRecapRow {
  participant: GukarParticipant
  groupName: string
  pengampuName: string
  /** Total hadir sepanjang semester. */
  hadir: number
  /** Total slot pekan yang tercatat (bulan terisi × 5). */
  slot: number
  percent: number
  halaman: number
  /** Capaian terakhir yang terisi — inilah "capaian akhir" semester. */
  capaianTahsin: string
  capaianTahfidz: string
}

/**
 * Rekap satu semester untuk seluruh kelompok — sumber angka halaman analitik SDM.
 *
 * Persentase kehadiran dihitung terhadap bulan yang BENAR-BENAR TERCATAT, bukan
 * terhadap seluruh bulan semester. Bulan yang belum diisi pengampu berarti
 * datanya belum ada, bukan peserta tidak hadir — memperlakukannya sebagai nol
 * akan membuat setiap peserta terlihat gagal di awal semester.
 */
export async function getGukarRecap(termId: string, upTo: PeriodKey): Promise<GukarRecapRow[]> {
  try {
    const supabase = createServerClient()

    const [groupsRes, teachersRes] = await Promise.all([
      supabase.from('gukar_groups').select('*').eq('term_id', termId).eq('is_active', true),
      supabase.from('teachers').select('id, full_name'),
    ])

    const groups = (groupsRes.data ?? []) as GukarGroup[]
    if (groups.length === 0) return []

    const teacherName = new Map(
      ((teachersRes.data ?? []) as { id: string; full_name: string }[]).map(t => [t.id, t.full_name]),
    )

    const { data: participantRows } = await supabase
      .from('gukar_participants')
      .select('*')
      .in('group_id', groups.map(g => g.id))
      .eq('is_active', true)
      .order('full_name')

    const participants = (participantRows ?? []) as GukarParticipant[]
    if (participants.length === 0) return []

    const periods = periodsYearToDate(upTo).map(toPeriodDate)
    const { data: monthlyRows } = await supabase
      .from('gukar_monthly')
      .select('*')
      .in('participant_id', participants.map(p => p.id))
      .in('period', periods)
      .order('period', { ascending: true })

    const byParticipant = new Map<string, GukarMonthly[]>()
    for (const row of (monthlyRows ?? []) as GukarMonthly[]) {
      const list = byParticipant.get(row.participant_id)
      if (list) list.push(row)
      else byParticipant.set(row.participant_id, [row])
    }

    const groupById = new Map(groups.map(g => [g.id, g]))

    return participants.map(participant => {
      const rows = byParticipant.get(participant.id) ?? []
      const hadir = rows.reduce((total, r) => total + hadirCount(r), 0)
      const slot = rows.length * 5
      const group = groupById.get(participant.group_id)

      // Capaian akhir = catatan terisi paling akhir, bukan baris terakhir
      // begitu saja: bulan terbaru bisa saja baru diisi kehadirannya.
      const withTahsin = [...rows].reverse().find(r => r.capaian_tahsin.trim())
      const withTahfidz = [...rows].reverse().find(r => r.capaian_tahfidz.trim())

      return {
        participant,
        groupName: group?.name ?? '—',
        pengampuName: group?.pengampu_id ? (teacherName.get(group.pengampu_id) ?? '—') : '—',
        hadir,
        slot,
        percent: slot ? Math.round((hadir / slot) * 100) : 0,
        halaman: rows.reduce((total, r) => total + r.jumlah_halaman, 0),
        capaianTahsin: withTahsin?.capaian_tahsin ?? '',
        capaianTahfidz: withTahfidz?.capaian_tahfidz ?? '',
      }
    })
  } catch {
    return []
  }
}

export interface GukarTrendPoint {
  period: PeriodKey
  /** Peserta yang punya catatan bulan itu. */
  tercatat: number
  hadir: number
  slot: number
  percent: number
  halaman: number
}

/**
 * Tren kehadiran per bulan sepanjang semester.
 *
 * Bulan tanpa catatan sama sekali tetap dikembalikan dengan nilai nol supaya
 * grafiknya menunjukkan lubang pencatatan — justru itulah yang perlu dilihat
 * SDM: bulan mana yang pengampunya belum mengisi.
 */
export async function getGukarTrend(termId: string, upTo: PeriodKey): Promise<GukarTrendPoint[]> {
  const periods = periodsYearToDate(upTo)
  const empty = periods.map(p => ({ period: p, tercatat: 0, hadir: 0, slot: 0, percent: 0, halaman: 0 }))

  try {
    const supabase = createServerClient()

    const { data: groupRows } = await supabase
      .from('gukar_groups').select('id').eq('term_id', termId).eq('is_active', true)
    const groupIds = ((groupRows ?? []) as { id: string }[]).map(g => g.id)
    if (groupIds.length === 0) return empty

    const { data: participantRows } = await supabase
      .from('gukar_participants').select('id').in('group_id', groupIds).eq('is_active', true)
    const participantIds = ((participantRows ?? []) as { id: string }[]).map(p => p.id)
    if (participantIds.length === 0) return empty

    const { data: monthlyRows } = await supabase
      .from('gukar_monthly')
      .select('period, hadir_1, hadir_2, hadir_3, hadir_4, hadir_5, jumlah_halaman')
      .in('participant_id', participantIds)
      .in('period', periods.map(toPeriodDate))

    const byPeriod = new Map(empty.map(e => [e.period, { ...e }]))
    for (const row of (monthlyRows ?? []) as (GukarMonthly & { period: string })[]) {
      const key = row.period.slice(0, 7)
      const point = byPeriod.get(key)
      if (!point) continue
      point.tercatat += 1
      point.hadir += hadirCount(row)
      point.slot += 5
      point.halaman += row.jumlah_halaman
    }

    return periods.map(p => {
      const point = byPeriod.get(p)!
      return { ...point, percent: point.slot ? Math.round((point.hadir / point.slot) * 100) : 0 }
    })
  } catch {
    return empty
  }
}

/**
 * Apakah guru ini boleh mengampu pembinaan gukar?
 *
 * Dibaca dari database tiap kali, bukan dari sesi: status kepegawaian bisa
 * berubah di tengah masa sesi guru masih login, dan hak yang sudah dicabut
 * tidak boleh bertahan sampai ia logout.
 */
export async function bolehMengampuGukar(teacherId: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('teachers')
    .select('employment_type')
    .eq('id', teacherId)
    .is('deleted_at', null)
    .maybeSingle()

  return canDoGukarPembinaan((data?.employment_type ?? null) as TeacherEmployment | null)
}
