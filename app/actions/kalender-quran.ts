'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageKalenderQuran, canManageStudents, kalenderPerProgram } from '@/lib/auth/permissions'
import { HARI_PILIHAN, hariKe, hariProgram, tanggalRentang } from '@/lib/rq/kalender-quran'
import { getJadwalKalender, getKelasPerAngkatan } from '@/lib/data/kalender-quran'
import { PROGRAMS_BY_JENJANG } from '@/lib/rq/programs'
import type { Jenjang } from '@/types'

type Hasil = { error?: string; success?: true }

const PATH = '/kalender-quran'

/**
 * Kalender aktif pembelajaran Al-Qur'an (0084) dipegang koordinator unit —
 * wewenang yang sama dengan template rapor, sebab keduanya menetapkan bentuk
 * rapor seluruh angkatan.
 */
async function izin(jenjang: Jenjang) {
  const session = await getSession()
  if (!session) return { galat: 'Sesi tidak valid.' as const, session: null }
  if (!canManageKalenderQuran(session.role, jenjang)) return { galat: 'Tidak memiliki izin.' as const, session: null }
  return { galat: null, session }
}

/** Tetapkan hari aktif sebuah program pada satu semester. */
export async function simpanJadwalAction(
  termId: string,
  jenjang: Jenjang,
  program: string,
  hari: number[],
): Promise<Hasil> {
  const { galat, session } = await izin(jenjang)
  if (galat || !session) return { error: galat ?? 'Tidak memiliki izin.' }
  // Koor SD tidak mengatur hari QULS, dan sebaliknya.
  if (!canManageStudents(session.role, jenjang, program)) return { error: 'Program ini dipegang koordinator lain.' }

  const bersih = [...new Set(hari)].filter(h => (HARI_PILIHAN as readonly number[]).includes(h)).sort()
  if (bersih.length === 0) {
    return { error: 'Pilih minimal satu hari. Program tanpa hari aktif membuat TM-nya nol dan kehadiran anak tak bisa dinilai.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('kalender_jadwal').upsert(
    { term_id: termId, jenjang, program, hari: bersih, updated_by: session.userId, updated_at: new Date().toISOString() },
    { onConflict: 'term_id,jenjang,program' },
  )
  if (error) return { error: 'Gagal menyimpan jadwal. Pastikan migrasi 0084 sudah dijalankan.' }

  revalidatePath(PATH)
  return { success: true }
}

/** Siapa yang ditiadakan: seluruh angkatan (`kelas` null) atau satu rombel. */
export interface SasaranKosong {
  tingkat: number
  kelas: string | null
}

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/
/** Agenda terpanjang yang masuk akal (pekan ujian + libur); mencegah salah ketik tahun. */
const RENTANG_MAKS = 31

/**
 * Tandai rentang tanggal sebagai sesi kosong bagi beberapa sasaran sekaligus.
 *
 * Agenda sekolah jarang sebatas satu hari satu rombel — outing tiga hari
 * untuk kelas 7A dan 7B, pekan ujian seluruh kelas 9. Yang disimpan tetap
 * satu baris per tanggal per sasaran, jadi `hitungTM` dan rapor tidak berubah.
 *
 * Hanya hari sesi Qur'an unit ini yang ditandai: Sabtu–Ahad di tengah rentang
 * dilewati supaya daftar penandaan tidak berisi hari yang memang tak bersesi.
 * Sasaran yang sudah tercakup dilewati, bukan ditolak — indeks unik 0084
 * parsial (kelas NULL vs bukan), jadi tidak bisa diserahkan ke upsert.
 */
export async function tandaiKosongRentangAction(
  termId: string,
  dari: string,
  sampai: string,
  jenjang: Jenjang,
  sasaran: SasaranKosong[],
  alasan: string,
): Promise<Hasil & { baris?: number; hari?: number }> {
  const { galat, session } = await izin(jenjang)
  if (galat || !session) return { error: galat ?? 'Tidak memiliki izin.' }
  if (!TANGGAL.test(dari) || !TANGGAL.test(sampai)) return { error: 'Tanggal tidak sah.' }
  if (sampai < dari) return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }

  const rentang = tanggalRentang(dari, sampai)
  if (rentang.length > RENTANG_MAKS) return { error: `Rentang paling panjang ${RENTANG_MAKS} hari.` }

  // Seluruh angkatan menelan penandaan per rombel di angkatan yang sama.
  const angkatanPenuh = new Set(sasaran.filter(s => s.kelas === null).map(s => s.tingkat))
  const bersih = new Map<string, SasaranKosong>()
  for (const s of sasaran) {
    if (!Number.isInteger(s.tingkat) || s.tingkat < 1 || s.tingkat > 12) return { error: 'Angkatan tidak sah.' }
    const kelas = s.kelas?.trim() || null
    if (kelas && angkatanPenuh.has(s.tingkat)) continue
    bersih.set(`${s.tingkat}|${(kelas ?? '').toLowerCase()}`, { tingkat: s.tingkat, kelas })
  }
  if (bersih.size === 0) return { error: 'Centang minimal satu angkatan atau kelas.' }

  if (kalenderPerProgram(session.role, jenjang)) {
    const milik = new Set(Object.values(await getKelasPerAngkatan(jenjang, session.role)).flat().map(k => k.toLowerCase()))
    for (const s of bersih.values()) {
      if (s.kelas === null) return { error: 'Tandai per kelas — satu angkatan SD berisi kelas milik koordinator lain.' }
      if (!milik.has(s.kelas.toLowerCase())) return { error: `Kelas ${s.kelas} dipegang koordinator lain.` }
    }
  }

  const { jadwal } = await getJadwalKalender(termId)
  const hariSesi = new Set(
    ['', ...PROGRAMS_BY_JENJANG[jenjang].map(p => p.code)].flatMap(p => hariProgram(jadwal, { jenjang, program: p })),
  )
  const tanggal = rentang.filter(t => hariSesi.has(hariKe(t)))
  if (tanggal.length === 0) return { error: "Tidak ada hari sesi Qur'an di rentang itu." }

  const supabase = createServerClient()
  const { data: ada, error: galatBaca } = await supabase
    .from('kalender_kosong')
    .select('tanggal, tingkat, kelas')
    .eq('jenjang', jenjang)
    .gte('tanggal', dari)
    .lte('tanggal', sampai)
  if (galatBaca) return { error: 'Gagal membaca kalender. Pastikan migrasi 0084 sudah dijalankan.' }

  const sudah = (t: string, s: SasaranKosong) => (ada ?? []).some(k =>
    k.tanggal === t && k.tingkat === s.tingkat
    && (k.kelas === null || (s.kelas !== null && k.kelas.toLowerCase() === s.kelas.toLowerCase())),
  )

  const catatan = alasan.trim().slice(0, 120)
  const baris = tanggal.flatMap(t => [...bersih.values()]
    .filter(s => !sudah(t, s))
    .map(s => ({ tanggal: t, jenjang, tingkat: s.tingkat, kelas: s.kelas, alasan: catatan, ditandai_oleh: session.userId })))
  if (baris.length === 0) return { error: 'Semua tanggal dan kelas itu sudah ditandai kosong.' }

  const { error } = await supabase.from('kalender_kosong').insert(baris)
  if (error) {
    if (error.code === '23505') return { error: 'Sebagian sudah ditandai orang lain barusan. Muat ulang lalu coba lagi.' }
    return { error: 'Gagal menandai. Pastikan migrasi 0084 sudah dijalankan.' }
  }

  revalidatePath(PATH)
  return { success: true, baris: baris.length, hari: new Set(baris.map(b => b.tanggal)).size }
}

/** Batalkan penandaan — sesinya kembali dihitung sebagai tatap muka. */
export async function batalKosongAction(id: string, jenjang: Jenjang): Promise<Hasil> {
  const { galat, session } = await izin(jenjang)
  if (galat || !session) return { error: galat ?? 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  // Jenjang dibaca dari barisnya, bukan dari argumen: tanpa itu koor SMP bisa
  // membatalkan penandaan SD cukup dengan mengirim jenjang 'smp'.
  const { data: baris } = await supabase.from('kalender_kosong').select('jenjang, kelas').eq('id', id).maybeSingle()
  if (!baris) return { error: 'Penandaan tidak ditemukan.' }
  if (baris.jenjang !== jenjang) return { error: 'Tidak memiliki izin.' }
  if (kalenderPerProgram(session.role, jenjang)) {
    const milik = new Set(Object.values(await getKelasPerAngkatan(jenjang, session.role)).flat().map(k => k.toLowerCase()))
    if (baris.kelas === null || !milik.has(String(baris.kelas).toLowerCase())) {
      return { error: 'Penandaan ini mengenai kelas koordinator lain.' }
    }
  }

  const { error } = await supabase.from('kalender_kosong').delete().eq('id', id)
  if (error) return { error: 'Gagal membatalkan penandaan.' }

  revalidatePath(PATH)
  return { success: true }
}
