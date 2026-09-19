'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageUjian } from '@/lib/auth/permissions'
import { kewajibanUjian } from '@/lib/rq/hafalan'
import { normalJuz, unitDariJenjang } from '@/lib/data/verifikasi-riwayat'
import { tautkanUjianKeDrill } from '@/lib/data/drill-tahfidz'
import type { Jenjang } from '@/types'

type Hasil = { error?: string; success?: true; tersimpan?: number }

export interface KeputusanVerifikasi {
  tipe: '1_juz' | '3_juz' | '5_juz'
  juz: string
  /** 'batal' menghapus keputusan sebelumnya — butirnya kembali "perlu diverifikasi". */
  hasil: 'sudah' | 'belum' | 'batal'
}

/** Seluruh pasangan (tipe, juz) yang sah — penjaga dari isian yang dikarang. */
const SAH = new Set(kewajibanUjian(30).map(k => `${k.tipe}|${k.juz}`))

/**
 * Simpan keputusan koordinator atas ujian lama seorang anak.
 *
 *   sudah → dibuat baris ujian_tahfidz berstatus selesai (tanpa predikat &
 *           penguji, karena memang tidak diketahui), jadi juz teruji dan
 *           rekap tasmi' langsung ikut. Bila `bulan` diisi, itulah jadwalnya;
 *           bila tidak, jadwal kosong — catatannya tidak masuk rekap bulanan
 *           publik dan tidak dikabarkan sebagai ujian baru.
 *   belum → hanya diingat, supaya anak tidak terus muncul sebagai "perlu
 *           diverifikasi"; ujiannya perlu diajukan seperti biasa.
 *   batal → keputusan dicabut; ujian yang DIBUAT verifikasi ikut dihapus.
 */
export async function simpanVerifikasiAction(input: {
  studentId: string
  keputusan: KeputusanVerifikasi[]
  /** 'YYYY-MM' perkiraan bulan ujian, opsional. */
  bulan: string | null
  catatan: string
}): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (input.keputusan.length === 0) return { error: 'Belum ada ujian yang dipilih.' }
  if (input.bulan && !/^\d{4}-\d{2}$/.test(input.bulan)) return { error: 'Bulan tidak valid.' }
  const kiniBulan = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7)
  if (input.bulan && input.bulan > kiniBulan) return { error: 'Bulan ujian tidak boleh di masa depan.' }

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas, jenjang, program, halaqoh:halaqoh!students_halaqoh_id_fkey(program)')
    .eq('id', input.studentId)
    .maybeSingle()
  const s = siswa as unknown as {
    id: string; full_name: string; kelas: string | null; jenjang: Jenjang; program: string | null
    halaqoh: { program: string | null } | null
  } | null
  if (!s) return { error: 'Siswa tidak ditemukan.' }
  const unit = unitDariJenjang(s.jenjang)
  if (!unit || !canManageUjian(session.role, unit)) {
    return { error: 'Hanya koordinator unit siswa ini yang bisa memverifikasi riwayat ujiannya.' }
  }

  const [{ data: verifLama, error: galatVerif }, { data: ujianLulus }] = await Promise.all([
    supabase.from('verifikasi_riwayat_tahfidz').select('id, tipe, juz, hasil, ujian_id').eq('student_id', s.id),
    supabase.from('ujian_tahfidz').select('id, tipe, juz').eq('student_id', s.id).eq('status', 'selesai')
      .or('predikat.is.null,predikat.neq.mengulang'),
  ])
  if (galatVerif) return { error: 'Tabel verifikasi belum ada. Jalankan migrasi 0078 lebih dulu.' }
  const verifPer = new Map(
    ((verifLama ?? []) as { id: string; tipe: string; juz: string; hasil: string; ujian_id: string | null }[])
      .map(v => [`${v.tipe}|${normalJuz(v.juz)}`, v]),
  )
  const sudahAda = new Set(((ujianLulus ?? []) as { tipe: string; juz: string }[]).map(u => `${u.tipe}|${normalJuz(u.juz)}`))

  const waktu = input.bulan ? new Date(`${input.bulan}-01T08:00:00+07:00`).toISOString() : null
  const catatan = input.catatan.trim() || 'Diverifikasi koordinator — ujian sebelum sistem'
  const isQuls = [s.program, s.halaqoh?.program].some(p => Boolean(p && p.includes('quls')))
  let tersimpan = 0

  for (const k of input.keputusan) {
    const juz = normalJuz(k.juz)
    const kunci = `${k.tipe}|${juz}`
    if (!SAH.has(kunci)) return { error: `Ujian ${k.tipe} juz ${k.juz} tidak dikenal.` }
    const lama = verifPer.get(kunci)

    // Mencabut "sudah" menghapus ujian buatan verifikasi — tidak pernah ujian lain.
    const cabutUjianBuatan = async () => {
      if (lama?.hasil === 'sudah' && lama.ujian_id) {
        await supabase.from('ujian_tahfidz').delete().eq('id', lama.ujian_id)
        sudahAda.delete(kunci)
      }
    }

    if (k.hasil === 'batal') {
      if (!lama) continue
      await cabutUjianBuatan()
      await supabase.from('verifikasi_riwayat_tahfidz').delete().eq('id', lama.id)
      tersimpan++
      continue
    }

    if (k.hasil === 'belum') {
      await cabutUjianBuatan()
      const { error } = await supabase.from('verifikasi_riwayat_tahfidz').upsert({
        student_id: s.id, tipe: k.tipe, juz, hasil: 'belum', ujian_id: null,
        catatan: input.catatan.trim() || null,
        diverifikasi_by: session.userId, diverifikasi_at: new Date().toISOString(),
      }, { onConflict: 'student_id,tipe,juz' })
      if (error) return { error: 'Gagal menyimpan verifikasi.' }
      tersimpan++
      continue
    }

    // 'sudah' — ujian yang sudah tercatat lulus tidak dicatat dua kali.
    if (sudahAda.has(kunci)) continue
    const { data: baru, error: galatUjian } = await supabase.from('ujian_tahfidz').insert({
      unit, tipe: k.tipe, juz, student_id: s.id,
      nama_siswa: s.full_name, nama_flyer: s.full_name.split(' ')[0] ?? s.full_name,
      kelas: s.kelas ?? '', is_quls: isQuls,
      jadwal: waktu, penguji: null, predikat: null, catatan,
      status: 'selesai',
      // Dengan tanggal: cap waktunya tanggal itu (trigger 0064 menghormatinya).
      // Tanpa tanggal: jadwal kosong menandainya riwayat — lihat ujian-notifikasi.
      ...(waktu ? { dijadwalkan_at: waktu, selesai_at: waktu } : {}),
      created_by_user: session.userId,
    }).select('id').single()
    if (galatUjian || !baru) return { error: galatUjian?.message ?? 'Gagal mencatat ujian.' }
    const ujianId = baru.id as string
    sudahAda.add(kunci)
    if (k.tipe === '1_juz') await tautkanUjianKeDrill(s.id, juz, ujianId)

    const { error } = await supabase.from('verifikasi_riwayat_tahfidz').upsert({
      student_id: s.id, tipe: k.tipe, juz, hasil: 'sudah', ujian_id: ujianId,
      catatan: input.catatan.trim() || null,
      diverifikasi_by: session.userId, diverifikasi_at: new Date().toISOString(),
    }, { onConflict: 'student_id,tipe,juz' })
    if (error) {
      // Jangan tinggalkan ujian yatim tanpa jejak verifikasinya.
      await supabase.from('ujian_tahfidz').delete().eq('id', ujianId)
      return { error: 'Gagal menyimpan verifikasi.' }
    }
    tersimpan++
  }

  revalidatePath('/ujian/verifikasi')
  revalidatePath('/ujian/tasmi')
  revalidatePath('/ujian/riwayat')
  revalidatePath('/dashboard/analitik')
  return { success: true, tersimpan }
}
