'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageSetoran } from '@/lib/auth/permissions'
import type { Jenjang } from '@/types'

type Result = { error?: string; success?: boolean }
type LogTable = 'tahsin_logs' | 'tahfidz_logs' | 'tasmi_logs'

/**
 * Koreksi setoran santri — sunting & hapus, wewenang pengurus.
 *
 * Guru mencatat, pengurus membetulkan. Pemisahan itu disengaja: riwayat
 * capaian tidak boleh bisa diubah diam-diam oleh orang yang nilainya sedang
 * dinilai, sementara salah input tetap harus ada jalan keluarnya.
 *
 * Setiap perubahan pada setoran tahsin memicu PERHITUNGAN ULANG posisi siswa
 * dari seluruh riwayatnya. Menambal posisi secara mundur — mengurangi satu
 * halaman, mengembalikan satu jilid — tampak lebih murah tapi salah begitu
 * ada dua setoran di hari yang sama atau setoran yang dikoreksi bukan yang
 * terakhir.
 */

/** Pastikan penindak berwenang atas jenjang siswa pemilik setoran ini. */
async function guard(
  table: LogTable,
  logId: string,
): Promise<{ studentId: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!logId) return { error: 'Setoran tidak dikenali.' }

  const supabase = createServerClient()
  const { data: log } = await supabase
    .from(table)
    .select('id, student_id')
    .eq('id', logId)
    .maybeSingle()

  if (!log) return { error: 'Setoran tidak ditemukan.' }

  const { data: student } = await supabase
    .from('students')
    .select('id, jenjang')
    .eq('id', log.student_id)
    .maybeSingle()

  if (!student) return { error: 'Siswa tidak ditemukan.' }
  if (!canManageSetoran(session.role, student.jenjang as Jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa jenjang ini.' }
  }

  return { studentId: student.id }
}

/**
 * Hitung ulang posisi siswa dari seluruh setoran tahsinnya.
 *
 * Diputar ulang dari awal secara kronologis, mengikuti aturan yang sama
 * dengan saat setoran dibuat: 'lulus' memajukan satu halaman, 'ulang'
 * mempertahankan posisi, dan kenaikan jilid memindahkan ke jilid berikutnya
 * dengan halaman kembali ke 1.
 *
 * Diputar ulang seluruhnya, bukan dihitung mundur dari posisi sekarang,
 * karena posisi sekarang bisa saja sudah menyimpang — dan pemutaran ulang
 * memperbaikinya sekalian.
 */
async function recalcPosisi(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string,
): Promise<void> {
  const { data: logRows } = await supabase
    .from('tahsin_logs')
    .select('id, method_id, jilid_id, halaman, status, setoran_date, created_at')
    .eq('student_id', studentId)
    .order('setoran_date', { ascending: true })
    .order('created_at', { ascending: true })

  const logs = (logRows ?? []) as {
    id: string; method_id: string | null; jilid_id: string | null
    halaman: number | null; status: string
  }[]

  // Setoran habis seluruhnya: kosongkan posisi supaya tidak ada sisa angka
  // yang tak punya riwayat pendukung.
  if (logs.length === 0) {
    await supabase
      .from('students')
      .update({ current_method_id: null, current_jilid_id: null, current_jilid_page: null })
      .eq('id', studentId)
    return
  }

  const { data: promRows } = await supabase
    .from('jilid_promotions')
    .select('source_log_id, to_jilid_id')
    .eq('student_id', studentId)
    .not('source_log_id', 'is', null)

  const promosiDari = new Map(
    ((promRows ?? []) as { source_log_id: string; to_jilid_id: string }[])
      .map(p => [p.source_log_id, p.to_jilid_id]),
  )

  let method: string | null = null
  let jilid: string | null = null
  let page: number | null = null

  for (const log of logs) {
    if (log.status === 'lulus') {
      method = log.method_id
      jilid = log.jilid_id
      page = log.halaman !== null ? log.halaman + 1 : page
    }
    const naik = promosiDari.get(log.id)
    if (naik) {
      jilid = naik
      page = 1
    }
  }

  await supabase
    .from('students')
    .update({ current_method_id: method, current_jilid_id: jilid, current_jilid_page: page })
    .eq('id', studentId)
}

function refresh(studentId: string) {
  revalidatePath(`/siswa/${studentId}`)
  revalidatePath(`/guru/siswa/${studentId}`)
  revalidatePath('/dashboard/analitik/kelengkapan')
}

// ── Hapus ────────────────────────────────────────────────────────────────────

/**
 * Hapus satu setoran.
 *
 * Kenaikan jilid/juz yang ditimbulkannya ikut terhapus lewat ON DELETE
 * CASCADE pada `source_log_id` (migrasi 0027) — bukan dihapus manual di sini,
 * supaya tidak ada jalur kode yang bisa lupa melakukannya.
 */
export async function deleteSetoranAction(table: LogTable, logId: string): Promise<Result> {
  const auth = await guard(table, logId)
  if ('error' in auth) return auth

  const supabase = createServerClient()
  const { error } = await supabase.from(table).delete().eq('id', logId)
  if (error) return { error: error.message || 'Gagal menghapus setoran.' }

  if (table === 'tahsin_logs') await recalcPosisi(supabase, auth.studentId)
  if (table === 'tahfidz_logs') await recalcMutqin(supabase, auth.studentId)

  refresh(auth.studentId)
  return { success: true }
}

/**
 * Selaraskan penanda mutqin dengan kenaikan juz yang masih tersisa.
 *
 * Kenaikan juz ikut terhapus lewat CASCADE, tapi `juz_progress.mutqin` adalah
 * baris terpisah yang tidak ikut. Kalau dibiarkan, juz tetap tampak tuntas
 * padahal setoran yang menuntaskannya sudah tidak ada.
 */
async function recalcMutqin(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string,
): Promise<void> {
  const [{ data: promRows }, { data: progRows }] = await Promise.all([
    supabase.from('juz_promotions').select('juz_number').eq('student_id', studentId),
    supabase.from('juz_progress').select('juz_number, mutqin').eq('student_id', studentId),
  ])

  const masihNaik = new Set(((promRows ?? []) as { juz_number: number }[]).map(p => p.juz_number))
  const progress = (progRows ?? []) as { juz_number: number; mutqin: boolean }[]

  // Hanya juz yang penanda mutqin-nya kini tidak berdasar yang diturunkan;
  // mutqin yang ditetapkan lewat jalur lain tidak ikut disentuh.
  const perluTurun = progress.filter(p => p.mutqin && !masihNaik.has(p.juz_number))
  for (const p of perluTurun) {
    await supabase
      .from('juz_progress')
      .update({ mutqin: false, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('juz_number', p.juz_number)
  }
}

// ── Sunting ──────────────────────────────────────────────────────────────────

function num(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? '').trim()
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Nilai 0–100; di luar itu dianggap salah ketik dan diabaikan. */
function score(raw: FormDataEntryValue | null): number | null {
  const n = num(raw)
  if (n === null || n < 0 || n > 100) return null
  return n
}

export async function updateSetoranAction(_: unknown, formData: FormData): Promise<Result> {
  const table = (formData.get('table') as LogTable) ?? 'tahsin_logs'
  if (!['tahsin_logs', 'tahfidz_logs', 'tasmi_logs'].includes(table)) {
    return { error: 'Jenis setoran tidak dikenali.' }
  }

  const logId = (formData.get('id') as string) ?? ''
  const auth = await guard(table, logId)
  if ('error' in auth) return auth

  const tanggal = ((formData.get('setoran_date') as string) ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Tanggal tidak valid.' }

  const catatan = ((formData.get('catatan') as string) ?? '').trim() || null
  const sikap = score(formData.get('nilai_sikap'))

  // Tiap jenis setoran punya kolom isinya sendiri; hanya kolom yang memang
  // milik tabel itu yang dikirim, supaya PostgREST tidak menolak keseluruhan.
  let payload: Record<string, unknown>
  if (table === 'tahsin_logs') {
    const status = formData.get('status') === 'ulang' ? 'ulang' : 'lulus'
    payload = {
      setoran_date: tanggal, catatan, status,
      halaman: num(formData.get('halaman')),
      baris_dari: num(formData.get('baris_dari')),
      baris_ke: num(formData.get('baris_ke')),
      nilai_tahsin: score(formData.get('nilai_tahsin')),
      nilai_sikap: sikap,
    }
  } else if (table === 'tahfidz_logs') {
    payload = {
      setoran_date: tanggal, catatan,
      ayat_dari: num(formData.get('ayat_dari')),
      ayat_ke: num(formData.get('ayat_ke')),
      nilai_tahfidz: score(formData.get('nilai_tahfidz')),
      nilai_sikap: sikap,
    }
  } else {
    payload = {
      setoran_date: tanggal, catatan,
      status: formData.get('status') === 'ulang' ? 'ulang' : 'lulus',
      nilai_tahfidz: score(formData.get('nilai_tahfidz')),
      nilai_sikap: sikap,
    }
  }

  const supabase = createServerClient()
  const { error } = await supabase.from(table).update(payload).eq('id', logId)
  if (error) return { error: error.message || 'Gagal menyimpan perubahan.' }

  // Mengubah halaman atau status menggeser posisi siswa, jadi dihitung ulang
  // dari riwayat — sama seperti saat setoran dihapus.
  if (table === 'tahsin_logs') await recalcPosisi(supabase, auth.studentId)

  refresh(auth.studentId)
  return { success: true }
}
