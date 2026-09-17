'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditKalenderTahfidz, canTandaiAsalSdLhi } from '@/lib/auth/permissions'
import { kalenderBawaan } from '@/lib/rq/target-tahfidz'

type Result = { error?: string; success?: boolean }

const JALUR = '/dashboard/analitik/target-tahfidz'

/**
 * Simpan pekan efektif 12 bulan satu tahun ajaran.
 *
 * Semester tiap bulan tidak diterima dari formulir: Juli–Desember selalu
 * ganjil, Januari–Juni selalu genap. Membiarkannya diisi berarti membuka
 * kemungkinan satu bulan tercatat di dua semester, dan target semester itu
 * menjadi dua kali lebih panjang tanpa terlihat di layar mana pun.
 */
export async function simpanKalenderTahfidzAction(_: unknown, formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditKalenderTahfidz(session.role)) return { error: 'Tidak memiliki izin mengubah kalender.' }

  const tahunAjaran = String(formData.get('tahun_ajaran') ?? '')
  if (!/^\d{4}\/\d{4}$/.test(tahunAjaran)) return { error: 'Tahun ajaran tidak valid.' }

  const rows = []
  for (const b of kalenderBawaan(tahunAjaran)) {
    const mentah = String(formData.get(`pekan_${b.bulan}`) ?? '').trim().replace(',', '.')
    const pekan = Number(mentah)
    if (mentah === '' || !Number.isFinite(pekan) || pekan < 0 || pekan > 6 || Math.round(pekan * 2) !== pekan * 2) {
      return { error: `Pekan efektif ${b.bulan} harus 0–6, kelipatan setengah pekan.` }
    }
    rows.push({
      tahun_ajaran: tahunAjaran, bulan: `${b.bulan}-01`, semester: b.semester, pekan_efektif: pekan,
      updated_by: session.userId, updated_at: new Date().toISOString(),
    })
  }
  const pekanGanjil = rows.filter(r => r.semester === 1).reduce((t, r) => t + r.pekan_efektif, 0)
  const pekanGenap = rows.filter(r => r.semester === 2).reduce((t, r) => t + r.pekan_efektif, 0)
  // Semester tanpa pekan efektif membuat seluruh targetnya jatuh di nol.
  if (pekanGanjil === 0 || pekanGenap === 0) return { error: 'Tiap semester perlu setidaknya satu pekan efektif.' }

  const { error } = await createServerClient()
    .from('kalender_pekan_efektif')
    .upsert(rows, { onConflict: 'tahun_ajaran,bulan' })
  if (error) return { error: `Gagal menyimpan kalender: ${error.message}` }

  revalidatePath(JALUR)
  revalidatePath('/dashboard/analitik')
  return { success: true }
}

/**
 * Tandai siswa SMP lulusan SD LHI.
 *
 * Formulir mengirim SEMUA siswa yang tampil (`siswa`) dan yang dicentang
 * (`internal`). Yang tampil tapi tidak dicentang dilepas tandanya — tanpa
 * daftar yang tampil, melepas centang tidak bisa dibedakan dari siswa yang
 * memang tidak ada di layar.
 */
export async function simpanAsalSdLhiAction(_: unknown, formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canTandaiAsalSdLhi(session.role)) return { error: 'Tidak memiliki izin menandai siswa SMP.' }

  const tampil = formData.getAll('siswa').map(String).filter(Boolean)
  const internal = new Set(formData.getAll('internal').map(String))
  if (tampil.length === 0) return { error: 'Tidak ada siswa yang dikirim.' }

  const ya = tampil.filter(id => internal.has(id))
  const tidak = tampil.filter(id => !internal.has(id))
  const supabase = createServerClient()

  // eq('jenjang', 'smp') menjaga tanda ini tidak bisa ditempel ke siswa unit
  // lain lewat formulir yang dirakit tangan.
  for (const [ids, nilai] of [[ya, true], [tidak, false]] as const) {
    if (ids.length === 0) continue
    const { error } = await supabase.from('students').update({ asal_sd_lhi: nilai }).in('id', ids).eq('jenjang', 'smp')
    if (error) {
      return {
        error: error.message.includes('asal_sd_lhi')
          ? 'Kolom asal siswa belum ada — jalankan migrasi 0070 di Supabase dulu.'
          : `Gagal menyimpan: ${error.message}`,
      }
    }
  }

  revalidatePath(JALUR)
  revalidatePath(`${JALUR}/asal-siswa`)
  return { success: true }
}
