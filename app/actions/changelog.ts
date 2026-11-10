'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canKelolaChangelog, canViewChangelog } from '@/lib/auth/permissions'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTerbaruChangelog } from '@/lib/data/changelog'
import { tanggalWIB } from '@/lib/rq/ujian'
import { URUTAN_JENIS, URUTAN_PEMBACA, type JenisChangelog, type PembacaChangelog } from '@/lib/rq/changelog'

type Hasil = { error?: string; success?: boolean }

export interface InputChangelog {
  /** Kosong = entri baru. */
  id?: string
  judul: string
  isi: string
  jenis: JenisChangelog
  untuk: PembacaChangelog[]
  /** 'YYYY-MM-DD' (WIB); kosong atau hari ini = saat ini juga. */
  tanggal?: string
  /**
   * Untuk draf dari commit (0128): true = terbitkan sekarang, false = tetap
   * draf. Entri baru selalu terbit; entri yang sudah terbit tidak berubah.
   */
  terbitkan?: boolean
}

const BELUM_ADA = 'Tabel pembaruan belum ada: jalankan drizzle/0121_changelog_PASTE_TO_SUPABASE.sql di Supabase.'

function segarkan() {
  revalidatePath('/pembaruan')
  revalidatePath('/guru/pembaruan')
  revalidatePath('/karyawan/profil')
  revalidatePath('/guru')
  revalidatePath('/dashboard', 'layout')
}

export async function simpanChangelogAction(i: InputChangelog): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canKelolaChangelog(session.role)) return { error: 'Hanya Kepala RQ yang dapat menulis pembaruan sistem.' }

  const judul = i.judul.trim().slice(0, 200)
  if (!judul) return { error: 'Judul wajib diisi.' }
  if (!URUTAN_JENIS.includes(i.jenis)) return { error: 'Jenis tidak dikenal.' }
  const untuk = new Set(i.untuk.filter(p => URUTAN_PEMBACA.includes(p)))
  if (untuk.size === 0) return { error: 'Pilih sedikitnya satu pembaca: pengurus, guru, atau karyawan.' }
  if (i.tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(i.tanggal)) return { error: 'Tanggal tidak sah.' }

  const baris = {
    judul,
    isi: i.isi.trim().slice(0, 5000),
    jenis: i.jenis,
    untuk_pengurus: untuk.has('pengurus'),
    untuk_guru: untuk.has('guru'),
    untuk_karyawan: untuk.has('karyawan'),
    // Tanggal hari ini → saat ini juga, supaya penanda "baru" menyala bagi
    // yang sudah membaca tadi pagi. Tanggal lain → pukul 07.00 WIB hari itu,
    // bukan tengah malam UTC.
    ...(i.tanggal && i.tanggal !== tanggalWIB(new Date())
      ? { terbit_at: `${i.tanggal}T07:00:00+07:00` }
      : i.id && !i.tanggal ? {} : { terbit_at: new Date().toISOString() }),
    ...(i.terbitkan !== undefined && i.id ? { status: i.terbitkan ? 'terbit' : 'draf' } : {}),
    updated_at: new Date().toISOString(),
  }

  const supabase = createServerClient()
  const { error } = i.id
    ? await supabase.from('changelog').update(baris).eq('id', i.id)
    : await supabase.from('changelog').insert({ ...baris, ditulis_oleh: session.userId })
  if (error) return { error: /changelog/.test(error.message) && /exist|relation|schema/i.test(error.message) ? BELUM_ADA : 'Gagal menyimpan pembaruan.' }

  segarkan()
  return { success: true }
}

export async function hapusChangelogAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canKelolaChangelog(session.role)) return { error: 'Hanya Kepala RQ yang dapat menghapus pembaruan sistem.' }
  const { error } = await createServerClient().from('changelog').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus pembaruan.' }
  segarkan()
  return { success: true }
}

/**
 * Waktu terbit pembaruan terbaru — ditanyakan ulang oleh titik merah menu
 * Pembaruan Sistem saat tab aplikasi kembali dilihat. Kerangka menu (layout)
 * tidak dirender ulang ketika berpindah halaman, jadi tanpa ini titiknya
 * baru muncul sesudah halaman dimuat ulang. Karyawan tidak punya menu ini.
 */
export async function terbaruPembaruanAction(pembaca: 'pengurus' | 'guru'): Promise<string | null> {
  if (pembaca === 'guru') {
    if (!(await getTeacherSession())) return null
  } else {
    const session = await getSession()
    if (!session || !canViewChangelog(session.role)) return null
  }
  return getTerbaruChangelog(pembaca)
}
