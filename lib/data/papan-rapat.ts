import { createServerClient } from '@/lib/supabase/server'
import { getViewableMeetingTypes } from '@/lib/auth/permissions'
import { TAG_PAPAN, type TugasTautan } from '@/lib/rapat/papan'
import type { AgendaTag, ApprovalStatus, MeetingType, UserRole } from '@/types'

export interface PoinPapan {
  id: string
  tag: AgendaTag
  discussion: string
  follow_up: string | null
  butuh_biaya: boolean
  approval_status: ApprovalStatus | null
  approval_at: string | null
  approval_oleh: string | null
  biaya: number | null
  biaya_catatan: string | null
  biaya_oleh: string | null
  selesai_at: string | null
  diarsipkan_at: string | null
  rapat: { id: string; subject: string; date: string; type: MeetingType }
  /** Tindak lanjut: tugas yang dibuat dari poin ini (belum dihapus). */
  tugas: TugasTautan[]
}

export interface PapanRapat {
  /** Approval, tindak lanjut, dan diskusi lanjut — aktif atau arsip menurut saringan. */
  poin: PoinPapan[]
  /** Keputusan rapat pada bulan terpilih (tanggal rapat), atau semua. */
  keputusan: PoinPapan[]
  /** Approval yang DISETUJUI pada bulan terpilih (tanggal disetujui), atau semua. */
  disetujui: PoinPapan[]
}

export interface SaringanPapan {
  /** true = poin yang sudah dikeluarkan dari papan. */
  arsip: boolean
  jenis: MeetingType | null
  /** 'YYYY-MM' atau null = semua bulan. */
  bulan: string | null
}

const KOLOM =
  'id, tag, discussion, follow_up, butuh_biaya, approval_status, approval_at, biaya, biaya_catatan,' +
  ' selesai_at, diarsipkan_at, order_num,' +
  ' rapat:meetings!inner(id, subject, date, type, deleted_at),' +
  ' approver:users!agenda_items_approval_by_fkey(display_name),' +
  ' pencatat_biaya:users!agenda_items_biaya_by_fkey(display_name)'

interface BarisMentah {
  id: string; tag: AgendaTag; discussion: string; follow_up: string | null; butuh_biaya: boolean
  approval_status: ApprovalStatus | null; approval_at: string | null
  biaya: number | null; biaya_catatan: string | null
  selesai_at: string | null; diarsipkan_at: string | null; order_num: number
  rapat: { id: string; subject: string; date: string; type: MeetingType }
  approver: { display_name: string } | null
  pencatat_biaya: { display_name: string } | null
}

function rentang(bulan: string) {
  const [y, m] = bulan.split('-').map(Number)
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { awal: `${bulan}-01`, akhir: `${bulan}-${String(akhir).padStart(2, '0')}` }
}

/**
 * Isi Papan Rapat untuk satu peran. Cakupannya rapat yang notulennya boleh
 * dibaca peran itu — papan tidak membuka poin dari rapat yang tertutup baginya.
 */
export async function getPapanRapat(role: UserRole, saring: SaringanPapan): Promise<PapanRapat> {
  const bolehJenis = getViewableMeetingTypes(role)
  const jenis = saring.jenis && bolehJenis.includes(saring.jenis) ? [saring.jenis] : bolehJenis
  if (jenis.length === 0) return { poin: [], keputusan: [], disetujui: [] }

  const supabase = createServerClient()
  const dasar = () =>
    supabase.from('agenda_items').select(KOLOM)
      .is('rapat.deleted_at', null)
      .in('rapat.type', jenis)

  let qPoin = dasar().in('tag', TAG_PAPAN)
  qPoin = saring.arsip
    ? qPoin.not('diarsipkan_at', 'is', null).order('diarsipkan_at', { ascending: false }).limit(200)
    : qPoin.is('diarsipkan_at', null)

  let qKeputusan = dasar().eq('tag', 'keputusan')
  let qDisetujui = dasar().eq('tag', 'approval').eq('approval_status', 'disetujui')
  if (saring.bulan) {
    const r = rentang(saring.bulan)
    qKeputusan = qKeputusan.gte('rapat.date', r.awal).lte('rapat.date', r.akhir)
    // approval_at bertipe timestamptz: batas atas = awal bulan berikutnya.
    const [y, m] = saring.bulan.split('-').map(Number)
    const berikut = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    qDisetujui = qDisetujui.gte('approval_at', `${r.awal}T00:00:00+07:00`).lt('approval_at', `${berikut}T00:00:00+07:00`)
  }

  const [poinRes, keputusanRes, disetujuiRes] = await Promise.all([
    qPoin, qKeputusan.limit(500), qDisetujui.limit(500),
  ])
  const mentah = [poinRes, keputusanRes, disetujuiRes].map(r => (r.data ?? []) as unknown as BarisMentah[])

  // Tugas dari poin tindak lanjut, satu query untuk semuanya.
  const idTL = mentah[0].filter(p => p.tag === 'tindak_lanjut').map(p => p.id)
  const tugasPer = new Map<string, TugasTautan[]>()
  if (idTL.length > 0) {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, source_agenda_id, assignee:users!assigned_to(display_name)')
      .in('source_agenda_id', idTL)
      .is('deleted_at', null)
    for (const t of (data ?? []) as unknown as {
      id: string; title: string; status: TugasTautan['status']; due_date: string | null
      source_agenda_id: string; assignee: { display_name: string } | null
    }[]) {
      const daftar = tugasPer.get(t.source_agenda_id) ?? []
      daftar.push({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, pic: t.assignee?.display_name ?? null })
      tugasPer.set(t.source_agenda_id, daftar)
    }
  }

  const rapikan = (b: BarisMentah): PoinPapan => ({
    id: b.id, tag: b.tag, discussion: b.discussion, follow_up: b.follow_up,
    butuh_biaya: b.butuh_biaya ?? false,
    approval_status: b.approval_status ?? (b.tag === 'approval' ? 'menunggu' : null),
    approval_at: b.approval_at, approval_oleh: b.approver?.display_name ?? null,
    biaya: b.biaya, biaya_catatan: b.biaya_catatan, biaya_oleh: b.pencatat_biaya?.display_name ?? null,
    selesai_at: b.selesai_at, diarsipkan_at: b.diarsipkan_at,
    rapat: { id: b.rapat.id, subject: b.rapat.subject, date: b.rapat.date, type: b.rapat.type },
    tugas: tugasPer.get(b.id) ?? [],
  })
  // Terlama di atas: poin yang paling lama menggantung paling perlu didorong.
  const urutRapat = (x: BarisMentah, y: BarisMentah) =>
    x.rapat.date.localeCompare(y.rapat.date) || x.order_num - y.order_num

  return {
    poin: saring.arsip ? mentah[0].map(rapikan) : [...mentah[0]].sort(urutRapat).map(rapikan),
    // Tabel keputusan: terbaru di atas, seperti buku notulen dibaca mundur.
    keputusan: [...mentah[1]].sort((x, y) => urutRapat(y, x)).map(rapikan),
    disetujui: [...mentah[2]].sort((x, y) => (y.approval_at ?? '').localeCompare(x.approval_at ?? '')).map(rapikan),
  }
}
