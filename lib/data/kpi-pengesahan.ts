import { createServerClient } from '@/lib/supabase/server'
import { nilaiDari, MONTH_NAMES } from '@/lib/data/kpi'
import { levelDari } from '@/lib/kpi/hitung'
import { jatuhTempo, tanggalSql } from '@/lib/kpi/alur'
import { koorPengesah } from '@/lib/auth/permissions'
import type {
  Jenjang, KpiMonthly, KpiRaporRiwayat, KpiRaporStatus, KpiSelesaiSebab, UserRole,
} from '@/types'

/**
 * Sisi alur dari modul KPI: daftar yang menunggu koordinator, rapor yang sudah
 * sampai ke guru, dan riwayat tiap lembar.
 *
 * Terpisah dari lib/data/kpi.ts (yang menyusun angka) dan lib/data/kpi-rapor.ts
 * (yang merakit satu lembar penuh). Yang dijawab di sini semata pertanyaan
 * "sudah sampai mana dokumennya", dan pemanggilnya — halaman publikasi,
 * portal guru, lencana — tidak butuh sebelas indikator untuk menjawabnya.
 */

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalisasi(raw: Record<string, unknown>): KpiMonthly {
  const opt = (v: unknown) => (v == null ? null : num(v))
  return {
    ...(raw as unknown as KpiMonthly),
    late_minutes: num(raw.late_minutes),
    db_late_days: num(raw.db_late_days),
    hafalan_juz: num(raw.hafalan_juz),
    hafalan_pages: num(raw.hafalan_pages),
    tuhfatul_bait: num(raw.tuhfatul_bait),
    bacaan_score: num(raw.bacaan_score),
    buku_pegangan_meetings: num(raw.buku_pegangan_meetings),
    izin_wa_cases: num(raw.izin_wa_cases),
    pengganti_cases: num(raw.pengganti_cases),
    pengganti_found: num(raw.pengganti_found),
    seragam_total: opt(raw.seragam_total),
    lapor_ortu_total: opt(raw.lapor_ortu_total),
    halaqoh_total: opt(raw.halaqoh_total),
  }
}

// ── Pematangan tenggat ─────────────────────────────────────────────

interface BarisTempo {
  id: string
  status: KpiRaporStatus
  guru_ttd_at: string | null
  banding_batas: string | null
}

/**
 * Matangkan rapor yang masa bandingnya sudah habis menjadi 'selesai'.
 *
 * Dijalankan saat halaman dibaca, bukan oleh pekerjaan terjadwal. Proyek ini
 * belum punya penjadwal, dan status yang hanya berubah kalau ada cron yang
 * hidup akan diam-diam salah pada hari cron itu mati — sementara pematangan
 * saat dibaca selalu benar tepat ketika ada yang melihat.
 *
 * Sebabnya dicatat 'lewat_tenggat', bukan 'ttd_guru'. Rapor ini final karena
 * waktunya habis; menyebutnya disetujui akan mengarang persetujuan dari orang
 * yang bahkan mungkin belum membuka dokumennya.
 *
 * Kegagalannya sengaja didiamkan: ini kerja rumah tangga di tengah render, dan
 * satu baris yang gagal matang akan dicoba lagi pada pembacaan berikutnya —
 * lebih baik daripada menggagalkan halaman yang sedang dibuka orang.
 */
export async function matangkanJatuhTempo(rows: BarisTempo[]): Promise<Set<string>> {
  const lewat = rows.filter(r => jatuhTempo(r))
  if (lewat.length === 0) return new Set()

  const supabase = createServerClient()
  const ids = lewat.map(r => r.id)

  const { error } = await supabase
    .from('kpi_monthly')
    .update({ status: 'selesai', selesai_sebab: 'lewat_tenggat' })
    .in('id', ids)

  if (error) return new Set()

  await supabase.from('kpi_rapor_riwayat').insert(
    lewat.map(r => ({
      kpi_monthly_id: r.id,
      aksi: 'final_tenggat',
      catatan: `Masa banding berakhir ${r.banding_batas}; tidak ada tanggapan dari guru.`,
    })),
  )

  return new Set(ids)
}

// ── Daftar publikasi koordinator ───────────────────────────────────

export interface BarisPublikasi {
  kpiId: string
  teacherId: string
  fullName: string
  status: KpiRaporStatus
  selesaiSebab: KpiSelesaiSebab | null
  versi: number
  /** Nilai rapot & levelnya — koordinator menandatangani angka, bukan nama. */
  rapot: number
  level: number
  terbitAt: string | null
  bandingBatas: string | null
  /** Guru sudah membuka rapornya? Terlihat oleh koordinator, bukan oleh guru. */
  dibuka: boolean
  sudahTtd: boolean
}

/**
 * Rapor satu unit & periode yang sudah pernah disimpan SDM.
 *
 * Berbeda dari getKpiRows(): yang belum pernah diisi TIDAK muncul di sini.
 * Halaman ini tentang dokumen yang mengalir, dan guru yang belum dinilai belum
 * punya dokumen apa pun untuk ditandatangani — daftar SDM-lah yang bertugas
 * menunjukkan siapa yang belum diisi.
 */
export async function getDaftarPublikasi(
  unit: Jenjang,
  year: number,
  month: number,
): Promise<BarisPublikasi[]> {
  const supabase = createServerClient()

  const { data: rawEntries } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('unit', unit)
    .eq('year', year)
    .eq('month', month)

  const entries = (rawEntries ?? []).map(r => normalisasi(r as Record<string, unknown>))
  if (entries.length === 0) return []

  const matang = await matangkanJatuhTempo(entries)

  const { data: profil } = await supabase
    .from('teachers')
    .select('id, full_name')
    .in('id', entries.map(e => e.teacher_id))

  const byId = new Map((profil ?? []).map(t => [t.id, t.full_name as string]))

  return entries
    .map(e => {
      const hasil = nilaiDari(e)
      return {
        kpiId: e.id,
        teacherId: e.teacher_id,
        fullName: byId.get(e.teacher_id) ?? '—',
        // Baris yang barusan dimatangkan sudah usang di memori; statusnya
        // dibetulkan di sini supaya halaman tidak menampilkan tombol untuk
        // keadaan yang tidak berlaku lagi.
        status: matang.has(e.id) ? 'selesai' : (e.status ?? 'draft'),
        selesaiSebab: matang.has(e.id) ? 'lewat_tenggat' : (e.selesai_sebab ?? null),
        versi: e.versi ?? 1,
        rapot: hasil.rapot,
        level: levelDari(hasil.rapot).level,
        terbitAt: e.terbit_at ?? null,
        bandingBatas: e.banding_batas ?? null,
        dibuka: Boolean(e.guru_dibuka_at),
        sudahTtd: Boolean(e.guru_ttd_at),
      } satisfies BarisPublikasi
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'))
}

/**
 * Berapa rapor yang menunggu tanda tangan koordinator ini — angka di lencana.
 *
 * Menghitung SELURUH periode, bukan hanya bulan yang sedang dibuka. Lencana
 * yang hanya melihat bulan berjalan akan padam pada tanggal 1 sementara rapor
 * bulan lalu masih menggantung, dan yang tidak terlihat tidak akan dikerjakan.
 */
export async function hitungMenungguKoordinator(role: UserRole): Promise<number> {
  const units = (['sd', 'sd_juara', 'smp'] as Jenjang[]).filter(u => koorPengesah(u) === role)
  if (units.length === 0) return 0

  const supabase = createServerClient()
  const { count } = await supabase
    .from('kpi_monthly')
    .select('id', { count: 'exact', head: true })
    .in('unit', units)
    .eq('status', 'diajukan')

  return count ?? 0
}

// ── Sisi guru ──────────────────────────────────────────────────────

export interface RaporGuruRingkas {
  kpiId: string
  year: number
  month: number
  unit: Jenjang | null
  label: string
  status: KpiRaporStatus
  selesaiSebab: KpiSelesaiSebab | null
  versi: number
  rapot: number
  level: number
  terbitAt: string | null
  bandingBatas: string | null
  sudahDibuka: boolean
  sudahTtd: boolean
}

/**
 * Rapor yang sudah diserahkan kepada seorang guru, terbaru di atas.
 *
 * Yang berstatus draft/diajukan/dikembalikan sengaja tidak ikut: itu dokumen
 * yang masih beredar di antara SDM dan koordinator. Guru yang melihat
 * nilainya sebelum koordinator mengesahkan akan menanggapi angka yang masih
 * bisa berubah, dan koordinator kehilangan gunanya sebagai pemeriksa terakhir.
 */
export async function getRaporGuru(teacherId: string): Promise<RaporGuruRingkas[]> {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('teacher_id', teacherId)
    .in('status', ['terbit', 'banding', 'selesai'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  const entries = (data ?? []).map(r => normalisasi(r as Record<string, unknown>))
  if (entries.length === 0) return []

  const matang = await matangkanJatuhTempo(entries)

  return entries.map(e => {
    const hasil = nilaiDari(e)
    return {
      kpiId: e.id,
      year: e.year,
      month: e.month,
      unit: e.unit,
      label: `${MONTH_NAMES[e.month - 1]} ${e.year}`,
      status: matang.has(e.id) ? 'selesai' : (e.status ?? 'draft'),
      selesaiSebab: matang.has(e.id) ? 'lewat_tenggat' : (e.selesai_sebab ?? null),
      versi: e.versi ?? 1,
      rapot: hasil.rapot,
      level: levelDari(hasil.rapot).level,
      terbitAt: e.terbit_at ?? null,
      bandingBatas: e.banding_batas ?? null,
      sudahDibuka: Boolean(e.guru_dibuka_at),
      sudahTtd: Boolean(e.guru_ttd_at),
    } satisfies RaporGuruRingkas
  })
}

/**
 * Berapa rapor terbit yang belum pernah dibuka guru ini — lencana portal guru.
 *
 * Per baris, bukan satu penanda waktu seperti announcements_seen_at. Guru
 * perlu tahu rapor BULAN MANA yang baru; penanda waktu tunggal hanya bisa
 * mengatakan "ada sesuatu yang baru" dan padam begitu ia membuka daftar,
 * termasuk ketika yang ia buka bukan rapor yang dimaksud.
 */
export async function hitungRaporBaruGuru(teacherId: string): Promise<number> {
  const supabase = createServerClient()
  const { count } = await supabase
    .from('kpi_monthly')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .in('status', ['terbit', 'banding', 'selesai'])
    .is('guru_dibuka_at', null)

  return count ?? 0
}

/**
 * Tandai rapor sudah dibuka guru. Sekali saja — penanda ini menjawab "pernah
 * dibuka?", bukan "kapan terakhir dibuka?", jadi menimpanya tiap kunjungan
 * hanya akan menghapus jawaban yang sebenarnya dicari koordinator: rapor yang
 * diserahkan tapi tidak pernah dilihat orangnya.
 */
export async function tandaiRaporDibuka(kpiId: string): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('kpi_monthly')
    .update({ guru_dibuka_at: new Date().toISOString() })
    .eq('id', kpiId)
    .is('guru_dibuka_at', null)
}

// ── Riwayat ────────────────────────────────────────────────────────

export interface RiwayatItem extends KpiRaporRiwayat {
  /** Nama pelakunya, dari tabel mana pun ia berasal. */
  actorNama: string | null
}

/**
 * Riwayat satu lembar rapor, terlama di atas — dibaca sebagai kronik.
 *
 * Dua tabel pelaku digabung di aplikasi, bukan lewat join bercabang: pengurus
 * dan guru hidup di tabel berbeda, dan PostgREST tidak bisa menyatukan
 * keduanya dalam satu embed tanpa membuat kueri yang lebih sulit dibaca
 * daripada dua pengambilan biasa.
 */
export async function getRiwayatRapor(kpiId: string): Promise<RiwayatItem[]> {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('kpi_rapor_riwayat')
    .select('*')
    .eq('kpi_monthly_id', kpiId)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as KpiRaporRiwayat[]
  if (rows.length === 0) return []

  const userIds = [...new Set(rows.map(r => r.actor_user_id).filter(Boolean))] as string[]
  const teacherIds = [...new Set(rows.map(r => r.actor_teacher_id).filter(Boolean))] as string[]

  const [{ data: users }, { data: gurus }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    teacherIds.length
      ? supabase.from('teachers').select('id, full_name').in('id', teacherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const nama = new Map<string, string>()
  for (const u of users ?? []) nama.set(u.id, u.display_name)
  for (const g of gurus ?? []) nama.set(g.id, g.full_name)

  return rows.map(r => ({
    ...r,
    actorNama: nama.get(r.actor_user_id ?? r.actor_teacher_id ?? '') ?? null,
  }))
}

/**
 * Catat satu peristiwa. Kegagalannya tidak menggagalkan pemanggilnya:
 * riwayat yang hilang satu baris lebih ringan akibatnya daripada penerbitan
 * rapor yang batal di tengah jalan dan menyisakan status yang sudah terlanjur
 * berubah tanpa catatannya.
 */
export async function catatRiwayat(entry: {
  kpiId: string
  versi: number
  aksi: KpiRaporRiwayat['aksi']
  userId?: string | null
  teacherId?: string | null
  catatan?: string | null
}): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('kpi_rapor_riwayat').insert({
    kpi_monthly_id: entry.kpiId,
    versi: entry.versi,
    aksi: entry.aksi,
    actor_user_id: entry.userId ?? null,
    actor_teacher_id: entry.teacherId ?? null,
    catatan: entry.catatan ?? null,
  })
}

/** Hari ini dalam bentuk yang dipakai kolom `date`. */
export const hariIni = () => tanggalSql(new Date())
