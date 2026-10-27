'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageAsrama, canManageEkstra, canManageSetoran } from '@/lib/auth/permissions'
import { genderAsramaSiswa } from '@/lib/data/asrama'
import { recalcPosisi, recalcMutqin } from '@/lib/rq/hitung-ulang-setoran'
import { BARIS_MAKS, statusTahsinSah } from '@/lib/rq/status-tahsin'
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

/**
 * Guru ekstra boleh membetulkan setoran EKSTRA yang tercatat di slot yang ia
 * ampu — pengecualian dari "guru mencatat, pengurus membetulkan": setoran
 * ekstra tidak masuk penilaian KPI guru, dan guru ekstra kerap mengisi
 * pertemuan yang lalu sehingga perlu bisa meralatnya sendiri.
 */
async function guardGuruEkstra(
  table: LogTable,
  logId: string,
  teacherId: string,
): Promise<{ studentId: string; guru: true } | { error: string }> {
  if (table === 'tasmi_logs') return { error: 'Anda tidak memiliki izin untuk setoran ini.' }
  const supabase = createServerClient()
  const { data: log } = await supabase
    .from(table).select('student_id, ekstra_slot_id').eq('id', logId).maybeSingle()
  const row = log as { student_id: string; ekstra_slot_id: string | null } | null
  if (!row) return { error: 'Setoran tidak ditemukan.' }
  if (!row.ekstra_slot_id) return { error: 'Hanya setoran ekstra yang bisa Anda ubah.' }
  const { data: slot } = await supabase
    .from('ekstra_slot').select('teacher_id').eq('id', row.ekstra_slot_id).maybeSingle()
  if ((slot as { teacher_id: string } | null)?.teacher_id !== teacherId) {
    return { error: 'Setoran ini bukan dari halaqoh ekstra yang Anda ampu.' }
  }
  return { studentId: row.student_id, guru: true }
}

/** Pastikan penindak berwenang atas jenjang siswa pemilik setoran ini. */
async function guard(
  table: LogTable,
  logId: string,
): Promise<{ studentId: string; guru?: true } | { error: string }> {
  if (!logId) return { error: 'Setoran tidak dikenali.' }
  const session = await getSession()
  if (!session) {
    const guru = await getTeacherSession()
    return guru ? guardGuruEkstra(table, logId, guru.teacherId) : { error: 'Sesi tidak valid.' }
  }

  const supabase = createServerClient()
  const { data: log } = await supabase
    .from(table)
    .select('id, student_id')
    .eq('id', logId)
    .maybeSingle()

  if (!log) return { error: 'Setoran tidak ditemukan.' }

  const { data: student } = await supabase
    .from('students')
    .select('id, jenjang, program')
    .eq('id', log.student_id)
    .maybeSingle()

  if (!student) return { error: 'Siswa tidak ditemukan.' }
  // Pengelola asrama (0110) membetulkan setoran anak asramanya sendiri —
  // BPA asrama putra, BPI asrama putri.
  if (!canManageSetoran(session.role, student.jenjang as Jenjang, student.program as string | null)) {
    const gender = await genderAsramaSiswa(student.id)
    // Koordinator ekstra membetulkan setoran EKSTRA (bertanda slot), anak mana pun.
    const ekstra = table !== 'tasmi_logs' && canManageEkstra(session.role)
      && Boolean(((await supabase.from(table).select('ekstra_slot_id').eq('id', logId).maybeSingle()).data as { ekstra_slot_id: string | null } | null)?.ekstra_slot_id)
    if (!ekstra && (!gender || !canManageAsrama(session.role, gender))) {
      return { error: 'Anda tidak memiliki izin untuk siswa ini.' }
    }
  }

  return { studentId: student.id }
}

function refresh(studentId: string) {
  revalidatePath(`/siswa/${studentId}`)
  revalidatePath(`/guru/siswa/${studentId}`)
  revalidatePath('/dashboard/analitik/kelengkapan')
  revalidatePath('/setoran')
  revalidatePath('/asrama')
  revalidatePath('/guru/ekstra')
  revalidatePath('/ekstra/progres')
  revalidatePath('/ekstra/setoran')
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
  // Posisi saat setoran ini dilakukan — titik balik bila ini setoran terakhirnya.
  const awal = table === 'tahsin_logs'
    ? (await supabase.from('tahsin_logs').select('method_id, jilid_id, halaman').eq('id', logId).maybeSingle()).data as
        { method_id: string | null; jilid_id: string | null; halaman: number | null } | null
    : null
  const { error } = await supabase.from(table).delete().eq('id', logId)
  if (error) return { error: error.message || 'Gagal menghapus setoran.' }

  if (table === 'tahsin_logs') await recalcPosisi(supabase, auth.studentId, awal ?? undefined)
  if (table === 'tahfidz_logs') await recalcMutqin(supabase, auth.studentId)

  refresh(auth.studentId)
  return { success: true }
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
  // Setoran tidak ditulis di muka — sama dengan saat guru mencatat.
  if (auth.guru && tanggal > new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)) {
    return { error: 'Tanggal setoran tidak boleh melewati hari ini.' }
  }

  const catatan = ((formData.get('catatan') as string) ?? '').trim() || null
  const sikap = score(formData.get('nilai_sikap'))

  // Tiap jenis setoran punya kolom isinya sendiri; hanya kolom yang memang
  // milik tabel itu yang dikirim, supaya PostgREST tidak menolak keseluruhan.
  let payload: Record<string, unknown>
  if (table === 'tahsin_logs') {
    const status = statusTahsinSah(formData.get('status'))
    const halaman = num(formData.get('halaman'))
    const barisDari = num(formData.get('baris_dari'))
    const barisKe = num(formData.get('baris_ke'))
    if (status === 'lanjut' && halaman === null) {
      return { error: 'Status Lanjut hanya untuk setoran yang mencatat halaman buku.' }
    }
    for (const b of [barisDari, barisKe]) {
      if (b !== null && (!Number.isInteger(b) || b < 1 || b > BARIS_MAKS)) return { error: `Nomor baris harus 1–${BARIS_MAKS}.` }
    }
    if (barisDari !== null && barisKe !== null && barisKe < barisDari) {
      return { error: `Baris akhir (${barisKe}) tidak boleh sebelum baris awal (${barisDari}).` }
    }
    payload = {
      setoran_date: tanggal, catatan, status,
      halaman,
      baris_dari: barisDari,
      baris_ke: barisKe,
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
