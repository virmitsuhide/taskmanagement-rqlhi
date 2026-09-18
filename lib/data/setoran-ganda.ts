import type { createServerClient } from '@/lib/supabase/server'
import { recalcPosisi, recalcMutqin, kurangiJuzProgress } from '@/lib/rq/hitung-ulang-setoran'

/**
 * SATU SETORAN PER ANAK PER HARI.
 *
 * Setoran kedua di hari yang sama tidak lagi ditumpuk sebagai baris baru —
 * menumpuknya membuat halaman anak maju dua kali untuk satu pertemuan, dan
 * rekap bulanan menghitung pertemuan yang tidak pernah terjadi. Setoran
 * terakhirlah yang berlaku; yang lama disalin ke `setoran_arsip` (0074)
 * lalu dihapus, sehingga seluruh kueri lama tetap benar tanpa disentuh.
 *
 * "Hari yang sama" untuk tahfidz berarti juga JENIS yang sama: ziyadah dan
 * muroja'ah di satu hari adalah dua kegiatan berbeda, bukan ralat satu sama
 * lain.
 *
 * Penimpaan tidak pernah terjadi diam-diam. Tanpa `timpa`, penyimpanan
 * berhenti dan mengembalikan perbandingan lama vs baru untuk ditampilkan ke
 * guru; baru setelah guru menekan "Timpa" setoran itu dikirim ulang.
 */

type Supabase = ReturnType<typeof createServerClient>
export type JenisSetoran = 'tahsin' | 'tahfidz'

/** Satu setoran yang sudah diringkas untuk dibandingkan berdampingan. */
export interface RingkasSetoran {
  /** Jam dicatat (WIB); null untuk setoran yang belum tersimpan. */
  waktu: string | null
  /** "Jilid 3 · halaman 12 · 📖 Al-Mulk 1–10" atau "Ziyadah · An-Naba' 1–16". */
  isi: string
  status: 'lulus' | 'ulang' | null
  /** Nilai bacaan / hafalan, 0–100. */
  nilai: number | null
  /** Nilai sikap (adab), 0–100. */
  sikap: number | null
  catatan: string | null
}

export interface SetoranGanda {
  student_id: string
  nama: string
  tanggal: string
  lama: RingkasSetoran[]
  baru: RingkasSetoran
}

const LABEL_JENIS_TAHFIDZ: Record<string, string> = {
  ziyadah: 'Ziyadah',
  hafalan_baru: 'Ziyadah',
  murojaah_baru: "Muroja'ah baru",
  murojaah_lama: "Muroja'ah lama",
  murojaah: "Muroja'ah",
}

export function labelJenisTahfidz(kind: string): string {
  return LABEL_JENIS_TAHFIDZ[kind] ?? kind
}

function jamWib(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit',
  })
}

function angka(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function namaSurat(supabase: Supabase, ids: number[]): Promise<Map<number, string>> {
  const unik = [...new Set(ids)]
  if (unik.length === 0) return new Map()
  const { data } = await supabase.from('surat_master').select('id, name_latin').in('id', unik)
  return new Map(((data ?? []) as { id: number; name_latin: string }[]).map(s => [s.id, s.name_latin]))
}

async function namaSiswa(supabase: Supabase, id: string): Promise<string> {
  const { data } = await supabase.from('students').select('full_name').eq('id', id).maybeSingle()
  return (data as { full_name: string } | null)?.full_name ?? 'Siswa'
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

export interface IsiTahsin {
  jilid_label: string | null
  halaman: number | null
  jumlah_materi: number
  quran_surat_id: number | null
  quran_ayat_dari: number | null
  quran_ayat_ke: number | null
}

function isiTahsin(x: IsiTahsin, surat: Map<number, string>): string {
  const bagian: string[] = []
  if (x.jilid_label) bagian.push(x.jilid_label)
  if (x.jumlah_materi > 0) bagian.push(`${x.jumlah_materi} materi`)
  else if (x.halaman !== null) bagian.push(`halaman ${x.halaman}`)
  if (x.quran_surat_id !== null) {
    const rentang = x.quran_ayat_dari !== null
      ? ` ${x.quran_ayat_dari}${x.quran_ayat_ke !== null && x.quran_ayat_ke !== x.quran_ayat_dari ? `–${x.quran_ayat_ke}` : ''}`
      : ''
    bagian.push(`📖 ${surat.get(x.quran_surat_id) ?? `Surat ${x.quran_surat_id}`}${rentang}`)
  }
  return bagian.join(' · ') || '—'
}

interface LogTahsinLama {
  id: string
  jilid_id: string | null
  halaman: number | null
  status: 'lulus' | 'ulang'
  drill: boolean | null
  nilai_tahsin: unknown
  nilai_sikap: unknown
  catatan: string | null
  quran_surat_id: number | null
  quran_ayat_dari: number | null
  quran_ayat_ke: number | null
  created_at: string
  jilid: { label: string } | null
  [kolom: string]: unknown
}

async function cariTahsinSamaHari(supabase: Supabase, studentId: string, tanggal: string) {
  const { data } = await supabase
    .from('tahsin_logs')
    .select('*, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
    .eq('student_id', studentId)
    .eq('setoran_date', tanggal)
    .order('created_at')
  const logs = (data ?? []) as LogTahsinLama[]
  if (logs.length === 0) return { logs, materi: new Map<string, Record<string, unknown>[]>() }

  const { data: materiRows } = await supabase
    .from('tahsin_log_materi')
    .select('*')
    .in('log_id', logs.map(l => l.id))
  const materi = new Map<string, Record<string, unknown>[]>()
  for (const m of (materiRows ?? []) as Record<string, unknown>[]) {
    const k = m.log_id as string
    materi.set(k, [...(materi.get(k) ?? []), m])
  }
  return { logs, materi }
}

/**
 * Periksa setoran tahsin di hari yang sama. Mengembalikan perbandingan bila
 * ada dan guru belum menyetujui penimpaan; null berarti aman disimpan.
 */
export async function periksaGandaTahsin(
  supabase: Supabase,
  studentId: string,
  tanggal: string,
  baru: IsiTahsin & Omit<RingkasSetoran, 'isi' | 'waktu'>,
): Promise<SetoranGanda | null> {
  const { logs, materi } = await cariTahsinSamaHari(supabase, studentId, tanggal)
  if (logs.length === 0) return null

  const surat = await namaSurat(supabase, [
    ...logs.map(l => l.quran_surat_id), baru.quran_surat_id,
  ].filter((x): x is number => x !== null))

  return {
    student_id: studentId,
    nama: await namaSiswa(supabase, studentId),
    tanggal,
    lama: logs.map(l => ({
      waktu: jamWib(l.created_at),
      isi: isiTahsin({
        jilid_label: l.jilid?.label ?? null,
        halaman: l.halaman,
        jumlah_materi: materi.get(l.id)?.length ?? 0,
        quran_surat_id: l.quran_surat_id,
        quran_ayat_dari: l.quran_ayat_dari,
        quran_ayat_ke: l.quran_ayat_ke,
      }, surat),
      status: l.status,
      nilai: angka(l.nilai_tahsin),
      sikap: angka(l.nilai_sikap),
      catatan: l.catatan,
    })),
    baru: {
      waktu: null,
      isi: isiTahsin(baru, surat),
      status: baru.status,
      nilai: baru.nilai,
      sikap: baru.sikap,
      catatan: baru.catatan,
    },
  }
}

/**
 * Arsipkan & hapus setoran tahsin di hari yang sama, lalu kembalikan posisi
 * anak seolah setoran itu tidak pernah ada. Mengembalikan id arsip (untuk
 * ditautkan ke penggantinya) atau pesan galat.
 */
export async function arsipkanTahsinSamaHari(
  supabase: Supabase,
  teacherId: string,
  studentId: string,
  tanggal: string,
): Promise<{ arsipIds: string[] } | { galat: string }> {
  const { logs, materi } = await cariTahsinSamaHari(supabase, studentId, tanggal)
  if (logs.length === 0) return { arsipIds: [] }

  const hasil = await arsipkan(supabase, teacherId, logs.map(l => {
    // Label jilid hasil join bukan kolom tahsin_logs — tidak ikut diarsipkan.
    const data: Record<string, unknown> = { ...l }
    delete data.jilid
    return {
      jenis: 'tahsin' as const,
      log_id: l.id,
      student_id: studentId,
      setoran_date: tanggal,
      kind: null,
      data,
      materi: materi.get(l.id) ?? null,
    }
  }), 'tahsin_logs')
  if ('galat' in hasil) return hasil

  /*
    Drill yang DIMULAI oleh setoran yang ditimpa ikut dibatalkan: tanda
    drill_sejak bertanggal hari itu, dan setoran pemicunya bukan setoran
    drill. Setoran pengganti akan memasukkan anak ke drill lagi bila memang
    lulus di halaman terakhir — keputusan itu milik setoran yang berlaku.
  */
  const { data: siswa } = await supabase
    .from('students')
    .select('tahsin_drill_sejak')
    .eq('id', studentId)
    .maybeSingle()
  if ((siswa as { tahsin_drill_sejak: string | null } | null)?.tahsin_drill_sejak === tanggal
    && logs.some(l => !l.drill)) {
    await supabase.from('students').update({ tahsin_drill_sejak: null }).eq('id', studentId)
  }

  await recalcPosisi(supabase, studentId)
  return hasil
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

export interface IsiTahfidz {
  kind: string
  surat_id: number | null
  ayat_dari: number | null
  ayat_ke: number | null
}

function isiTahfidz(x: IsiTahfidz, surat: Map<number, string>): string {
  const nama = x.surat_id !== null ? surat.get(x.surat_id) ?? `Surat ${x.surat_id}` : '—'
  const rentang = x.ayat_dari !== null ? ` ${x.ayat_dari}${x.ayat_ke !== null && x.ayat_ke !== x.ayat_dari ? `–${x.ayat_ke}` : ''}` : ''
  return `${labelJenisTahfidz(x.kind)} · ${nama}${rentang}`
}

interface LogTahfidzLama {
  id: string
  kind: string
  surat_id: number
  ayat_dari: number | null
  ayat_ke: number | null
  nilai_tahfidz: unknown
  nilai_sikap: unknown
  catatan: string | null
  created_at: string
  [kolom: string]: unknown
}

async function cariTahfidzSamaHari(supabase: Supabase, studentId: string, tanggal: string, kind: string) {
  const { data } = await supabase
    .from('tahfidz_logs')
    .select('*')
    .eq('student_id', studentId)
    .eq('setoran_date', tanggal)
    .eq('kind', kind)
    .order('created_at')
  return (data ?? []) as LogTahfidzLama[]
}

export async function periksaGandaTahfidz(
  supabase: Supabase,
  studentId: string,
  tanggal: string,
  baru: IsiTahfidz & Pick<RingkasSetoran, 'nilai' | 'sikap' | 'catatan'>,
): Promise<SetoranGanda | null> {
  const logs = await cariTahfidzSamaHari(supabase, studentId, tanggal, baru.kind)
  if (logs.length === 0) return null

  const surat = await namaSurat(supabase, [
    ...logs.map(l => l.surat_id), baru.surat_id,
  ].filter((x): x is number => x !== null))

  return {
    student_id: studentId,
    nama: await namaSiswa(supabase, studentId),
    tanggal,
    lama: logs.map(l => ({
      waktu: jamWib(l.created_at),
      isi: isiTahfidz(l, surat),
      status: null,
      nilai: angka(l.nilai_tahfidz),
      sikap: angka(l.nilai_sikap),
      catatan: l.catatan,
    })),
    baru: {
      waktu: null,
      isi: isiTahfidz(baru, surat),
      status: null,
      nilai: baru.nilai,
      sikap: baru.sikap,
      catatan: baru.catatan,
    },
  }
}

export async function arsipkanTahfidzSamaHari(
  supabase: Supabase,
  teacherId: string,
  studentId: string,
  tanggal: string,
  kind: string,
): Promise<{ arsipIds: string[] } | { galat: string }> {
  const logs = await cariTahfidzSamaHari(supabase, studentId, tanggal, kind)
  if (logs.length === 0) return { arsipIds: [] }

  /*
    Masa drill juz yang dibuka ziyadah lama dihapus lebih dulu. FK-nya
    ON DELETE SET NULL, jadi tanpa ini barisnya tertinggal yatim dan tetap
    menyatakan juz itu tuntas — padahal ziyadah penggantinya belum tentu
    menuntaskannya. Bila memang tuntas, setoran pengganti membukanya lagi.
  */
  await supabase.from('tahfidz_juz_drill').delete().in('source_log_id', logs.map(l => l.id))

  const hasil = await arsipkan(supabase, teacherId, logs.map(data => ({
    jenis: 'tahfidz' as const,
    log_id: data.id,
    student_id: studentId,
    setoran_date: tanggal,
    kind,
    data,
    materi: null,
  })), 'tahfidz_logs')
  if ('galat' in hasil) return hasil

  if (kind === 'ziyadah' || kind === 'hafalan_baru') {
    for (const l of logs) {
      await kurangiJuzProgress(supabase, { student_id: studentId, surat_id: l.surat_id, ayat_dari: l.ayat_dari, ayat_ke: l.ayat_ke })
    }
  }
  await recalcMutqin(supabase, studentId)
  return hasil
}

// ─── Bersama ─────────────────────────────────────────────────────────────────

interface BarisArsip {
  jenis: JenisSetoran
  log_id: string
  student_id: string
  setoran_date: string
  kind: string | null
  data: Record<string, unknown>
  materi: Record<string, unknown>[] | null
}

/**
 * Salin ke arsip, BARU hapus. Urutannya penting: bila arsip gagal (misalnya
 * migrasi 0074 belum dijalankan), setoran lama dibiarkan utuh dan penimpaan
 * dibatalkan — lebih baik guru melihat galat daripada setoran hilang tanpa jejak.
 */
async function arsipkan(
  supabase: Supabase,
  teacherId: string,
  baris: BarisArsip[],
  tabel: 'tahsin_logs' | 'tahfidz_logs',
): Promise<{ arsipIds: string[] } | { galat: string }> {
  const { data, error } = await supabase
    .from('setoran_arsip')
    .insert(baris.map(b => ({ ...b, diarsipkan_oleh: teacherId })))
    .select('id')
  if (error || !data) {
    return { galat: 'Setoran lama gagal diarsipkan, jadi belum ditimpa. Pastikan migrasi 0074 sudah dijalankan.' }
  }
  const arsipIds = (data as { id: string }[]).map(d => d.id)

  const { error: hapusErr } = await supabase.from(tabel).delete().in('id', baris.map(b => b.log_id))
  if (hapusErr) {
    await supabase.from('setoran_arsip').delete().in('id', arsipIds)
    return { galat: 'Setoran lama gagal dihapus, jadi belum ditimpa.' }
  }
  return { arsipIds }
}

/** Tautkan arsip ke setoran penggantinya — jejak "ditimpa oleh" untuk audit. */
export async function tautkanPengganti(supabase: Supabase, arsipIds: string[], logBaruId: string): Promise<void> {
  if (arsipIds.length === 0) return
  await supabase.from('setoran_arsip').update({ diganti_oleh: logBaruId }).in('id', arsipIds)
}
