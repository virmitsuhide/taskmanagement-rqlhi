import { createServerClient } from '@/lib/supabase/server'
import { canDoGukarPembinaan } from '@/lib/auth/permissions'
import type { TeacherEmployment } from '@/types'
import { type PeriodKey, periodsYearToDate, toPeriodDate } from '@/lib/finance/period'
import type { TahapJilid } from '@/lib/rq/gukar-setoran'
import type { GukarGroup, GukarMonthly, GukarParticipant } from '@/types'

/**
 * Pembinaan tahsin & tahfidz guru dan karyawan.
 *
 * Semua fungsi di sini bekerja per semester: kelompok terikat `term_id`, dan
 * rekap menjumlahkan bulan-bulan yang jatuh di dalam rentang semester itu.
 */

/**
 * Kehadiran satu baris bulanan: hadir sekian dari sekian siklus.
 *
 * Sejak 0069 kehadiran direkap pengampu sebagai angka di akhir bulan. Baris
 * yang belum direkap (jumlah_hadir NULL) memberi slot 0 — bulan itu tidak
 * ikut dihitung, bukan dianggap absen. Baris lama sudah disalin migrasi ke
 * bentuk angka dengan penyebut 5, jadi persentase lama tidak bergeser.
 */
export function kehadiranBaris(
  row: Pick<GukarMonthly, 'jumlah_hadir' | 'jumlah_siklus'>,
): { hadir: number; slot: number } {
  if (row.jumlah_hadir === null || row.jumlah_hadir === undefined || !row.jumlah_siklus) {
    return { hadir: 0, slot: 0 }
  }
  return { hadir: row.jumlah_hadir, slot: row.jumlah_siklus }
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
  /** Total siklus pada bulan-bulan yang sudah direkap kehadirannya. */
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
      const hadir = rows.reduce((total, r) => total + kehadiranBaris(r).hadir, 0)
      const slot = rows.reduce((total, r) => total + kehadiranBaris(r).slot, 0)
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
      .select('period, jumlah_hadir, jumlah_siklus, jumlah_halaman')
      .in('participant_id', participantIds)
      .in('period', periods.map(toPeriodDate))

    const byPeriod = new Map(empty.map(e => [e.period, { ...e }]))
    for (const row of (monthlyRows ?? []) as (GukarMonthly & { period: string })[]) {
      const key = row.period.slice(0, 7)
      const point = byPeriod.get(key)
      if (!point) continue
      const { hadir, slot } = kehadiranBaris(row)
      point.tercatat += 1
      point.hadir += hadir
      point.slot += slot
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

// ─── Setoran terukur: metode, tahapan, & posisi bulan lalu (0061) ────────────

/**
 * Metode tahsin yang boleh dipilih pembina gukar.
 *
 * Disaring ke UMMI & Syajaroh atas ketetapan RQ LHI. KIBAR aktif di
 * tahsin_methods tapi dipakai santri SD Juara, bukan pegawai — menawarkannya
 * di sini hanya akan menghasilkan catatan yang tidak ada padanannya di
 * pembinaan yang sebenarnya.
 *
 * Nama metode dicocokkan tanpa memandang huruf besar-kecil: tabelnya memuat
 * 'UMMI' yang aktif dan 'Ummi' lama yang sudah tidak aktif, dan hanya yang
 * aktif yang lolos.
 */
const METODE_GUKAR = ['ummi', 'syajaroh']

export interface MetodeTahsin {
  id: string
  name: string
}

export async function getMetodeGukar(): Promise<MetodeTahsin[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('tahsin_methods')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return ((data ?? []) as MetodeTahsin[])
    .filter(m => METODE_GUKAR.includes(m.name.toLowerCase()))
}

/**
 * Tahapan tiap metode — jilid berbuku sampai Lulus Tahsin.
 *
 * Diambil sekaligus untuk semua metode yang dipakai gukar, bukan per metode
 * saat dipilih: jumlahnya belasan baris, dan mengambilnya di muka membuat
 * dropdown jilid berganti isi tanpa menunggu perjalanan ke server saat
 * pembina berpindah metode.
 */
export async function getTahapanGukar(): Promise<Record<string, TahapJilid[]>> {
  const metode = await getMetodeGukar()
  if (metode.length === 0) return {}

  const supabase = createServerClient()
  const { data } = await supabase
    .from('jilid_levels')
    .select('id, method_id, label, order_num, total_pages, is_quran, is_terminal')
    .in('method_id', metode.map(m => m.id))
    .order('order_num')

  const peta: Record<string, TahapJilid[]> = {}
  for (const m of metode) peta[m.id] = []
  for (const row of (data ?? []) as (TahapJilid & { method_id: string })[]) {
    peta[row.method_id]?.push({
      id: row.id,
      label: row.label,
      order_num: row.order_num,
      total_pages: row.total_pages,
      is_quran: row.is_quran,
      is_terminal: row.is_terminal,
    })
  }
  return peta
}

/**
 * Catatan bulan SEBELUM `period` untuk sekumpulan peserta.
 *
 * Bukan "bulan lalu menurut kalender" melainkan catatan terakhir yang ada
 * sebelum periode ini — pembinaan bisa bolong sebulan, dan jarak yang
 * ditempuh tetap harus dihitung dari titik terakhir yang benar-benar
 * tercatat, bukan dari nol.
 */
export async function getPosisiSebelumnya(
  participantIds: string[],
  period: PeriodKey,
): Promise<Record<string, GukarMonthly>> {
  if (participantIds.length === 0) return {}

  const supabase = createServerClient()
  const { data } = await supabase
    .from('gukar_monthly')
    .select('*')
    .in('participant_id', participantIds)
    .lt('period', toPeriodDate(period))
    .order('period', { ascending: false })

  // Baris datang terurut menurun, jadi yang pertama ditemui untuk tiap
  // peserta adalah yang paling baru.
  const peta: Record<string, GukarMonthly> = {}
  for (const row of (data ?? []) as GukarMonthly[]) {
    if (!peta[row.participant_id]) peta[row.participant_id] = row
  }
  return peta
}

/** Daftar surah untuk dropdown — nomor, nama, dan panjangnya. */
export interface SuratRingkas {
  id: number
  nama: string
  ayat: number
}

/**
 * 114 surah dari surat_master.
 *
 * Diambil di server lalu dioper ke formulir, bukan dibaca ulang tiap kali
 * pengampu membuka isian: daftarnya tidak pernah berubah, dan 114 baris yang
 * dikirim sekali jauh lebih murah daripada satu perjalanan jaringan tiap kali
 * dropdown dibuka.
 */
export async function getDaftarSurat(): Promise<SuratRingkas[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('surat_master')
    .select('id, name_latin, total_ayat')
    .order('id')
  return ((data ?? []) as { id: number; name_latin: string; total_ayat: number }[])
    .map(s => ({ id: s.id, nama: s.name_latin, ayat: s.total_ayat }))
}
