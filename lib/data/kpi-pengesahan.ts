import { createServerClient } from '@/lib/supabase/server'
import { nilaiDari, MONTH_NAMES } from '@/lib/data/kpi'
import { levelDari } from '@/lib/kpi/hitung'
import { jatuhTempo, tanggalSql } from '@/lib/kpi/alur'
import { koorPengesah } from '@/lib/auth/permissions'
import type {
  Jenjang, KpiMonthly, KpiRaporRiwayat, KpiRaporStatus, KpiSelesaiSebab, LingkupPenugasan,
  UserRole,
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
  teacher_id: string
  year: number
  month: number
  versi?: number
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
      // Identitas periode ikut disalin, sealasan dengan catatRiwayat: baris ini
      // harus tetap terbaca kalau rapornya kelak dihapus lewat reset.
      teacher_id: r.teacher_id,
      year: r.year,
      month: r.month,
      versi: r.versi ?? 1,
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
  /**
   * Lingkup penugasan gurunya (0052) — penentu SIAPA yang boleh menandatangani
   * baris ini. Diambil dari `teachers`, bukan dari `kpi_monthly`: lingkup
   * adalah keadaan orangnya hari ini, sedangkan baris rapor adalah potret
   * bulan lalu. Guru yang bulan ini dipindahkan ke lingkup yayasan harus
   * langsung berpindah meja tanda tangan, bukan menunggu periode berikutnya.
   */
  lingkup: LingkupPenugasan
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

  const teacherIds = entries.map(e => e.teacher_id)

  // Kalau 0052 belum dijalankan, kueri ini gagal seluruhnya — dan gagalnya
  // bukan berupa lingkup yang kosong melainkan NAMA GURU yang hilang, sebab
  // keduanya diambil bersama. Meja publikasi berisi tiga puluh baris bernama
  // "—" adalah kerusakan yang jauh lebih buruk daripada satu kolom yang belum
  // ada, jadi disediakan jalan mundurnya.
  const penuh = await supabase
    .from('teachers')
    .select('id, full_name, lingkup_penugasan')
    .in('id', teacherIds)

  const { data: profil } = penuh.error
    ? await supabase.from('teachers').select('id, full_name').in('id', teacherIds)
    : penuh

  const byId = new Map(
    (profil ?? []).map(t => [
      t.id as string,
      {
        nama: t.full_name as string,
        lingkup: ((t as { lingkup_penugasan?: LingkupPenugasan }).lingkup_penugasan ?? 'unit'),
      },
    ]),
  )

  return entries
    .map(e => {
      const hasil = nilaiDari(e)
      return {
        kpiId: e.id,
        teacherId: e.teacher_id,
        fullName: byId.get(e.teacher_id)?.nama ?? '—',
        lingkup: byId.get(e.teacher_id)?.lingkup ?? 'unit',
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
  const supabase = createServerClient()

  /*
    Kepala RQ dihitung lewat jalur yang lain sama sekali (0052). Ia tidak
    memegang unit mana pun, jadi menyaring per unit selalu menghasilkan nol
    untuknya — dan lencananya akan padam selamanya sementara rapor guru
    berlingkup yayasan menumpuk di mejanya.

    Karena lingkup tinggal di `teachers` dan bukan di `kpi_monthly`, urutannya
    dibalik: cari dulu gurunya, baru rapornya. Daftar guru lintas yayasan
    berjumlah belasan, jadi ini kueri kecil — dan menjadikannya embed PostgREST
    akan menukar dua kueri murah dengan satu kueri yang jauh lebih sulit dibaca.
  */
  const units = (['sd', 'sd_juara', 'smp'] as Jenjang[]).filter(u => koorPengesah(u) === role)
  if (role !== 'kepala_rq' && units.length === 0) return 0

  const { data: guru } = await supabase
    .from('teachers')
    .select('id')
    .eq('lingkup_penugasan', 'yayasan')
    .is('deleted_at', null)

  const idsYayasan = (guru ?? []).map(g => g.id as string)

  if (role === 'kepala_rq') {
    if (idsYayasan.length === 0) return 0
    const { count } = await supabase
      .from('kpi_monthly')
      .select('id', { count: 'exact', head: true })
      .in('teacher_id', idsYayasan)
      .eq('status', 'diajukan')
    return count ?? 0
  }

  // Guru lintas yayasan DIKELUARKAN dari hitungan koor unitnya, walau baris
  // rapornya tetap ber-unit sd/smp. Kalau ikut terhitung, lencana koor akan
  // menampilkan pekerjaan yang tombolnya sendiri menolak ia kerjakan — dan
  // angka yang tak pernah bisa turun adalah angka yang berhenti dipercaya.
  let q = supabase
    .from('kpi_monthly')
    .select('id', { count: 'exact', head: true })
    .in('unit', units)
    .eq('status', 'diajukan')

  if (idsYayasan.length > 0) q = q.not('teacher_id', 'in', `(${idsYayasan.join(',')})`)

  const { count } = await q
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
export async function getRiwayatRapor(
  kpiId: string | null,
  periode?: { teacherId: string; year: number; month: number },
): Promise<RiwayatItem[]> {
  const supabase = createServerClient()

  // Dicari per PERIODE bila identitasnya diketahui, bukan cuma per baris.
  // Rapor yang direset dihapus barisnya, dan kpi_monthly_id pada riwayatnya
  // ikut menjadi NULL (0051) — tanpa jalur periode, catatan "penilaian
  // dihapus" akan hilang dari pandangan tepat ketika ia paling dibutuhkan,
  // dan penilaian berikutnya atas bulan yang sama akan tampak tak berumur.
  const q = periode
    ? supabase
        .from('kpi_rapor_riwayat')
        .select('*')
        .eq('teacher_id', periode.teacherId)
        .eq('year', periode.year)
        .eq('month', periode.month)
    : supabase.from('kpi_rapor_riwayat').select('*').eq('kpi_monthly_id', kpiId ?? '')

  const { data } = await q.order('created_at', { ascending: true })

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
  /** Pelakunya, bila seorang pengurus. */
  userId?: string | null
  /** Pelakunya, bila seorang guru. */
  teacherId?: string | null
  /**
   * Identitas rapornya — guru & periode. Disalin ke baris riwayat, bukan
   * cuma diacu lewat kpi_monthly_id, supaya catatannya tetap terbaca setelah
   * rapornya dihapus (reset Kepala RQ). Lihat 0051.
   *
   * Dinamai pemilikId karena teacherId di atas sudah dipakai untuk PELAKU,
   * dan keduanya berbeda: yang mencatat "guru menandatangani" adalah gurunya
   * sendiri, tapi yang mencatat "penilaian dihapus" adalah Kepala RQ atas
   * rapor MILIK seorang guru.
   */
  pemilikId?: string | null
  year?: number | null
  month?: number | null
  catatan?: string | null
}): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('kpi_rapor_riwayat').insert({
    kpi_monthly_id: entry.kpiId,
    teacher_id: entry.pemilikId ?? entry.teacherId ?? null,
    year: entry.year ?? null,
    month: entry.month ?? null,
    versi: entry.versi,
    aksi: entry.aksi,
    actor_user_id: entry.userId ?? null,
    actor_teacher_id: entry.teacherId ?? null,
    catatan: entry.catatan ?? null,
  })
}

/** Hari ini dalam bentuk yang dipakai kolom `date`. */
export const hariIni = () => tanggalSql(new Date())
