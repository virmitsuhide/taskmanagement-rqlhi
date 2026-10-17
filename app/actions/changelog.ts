'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canKelolaChangelog } from '@/lib/auth/permissions'
import { URUTAN_JENIS, URUTAN_PEMBACA, type JenisChangelog, type PembacaChangelog } from '@/lib/rq/changelog'

type Hasil = { error?: string; success?: boolean }

export interface InputChangelog {
  /** Kosong = entri baru. */
  id?: string
  judul: string
  isi: string
  jenis: JenisChangelog
  untuk: PembacaChangelog[]
  /** 'YYYY-MM-DD' (WIB); kosong = sekarang. */
  tanggal?: string
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
    // Tanggal saja → pukul 07.00 WIB hari itu, supaya terbit pagi hari, bukan tengah malam UTC.
    ...(i.tanggal ? { terbit_at: `${i.tanggal}T07:00:00+07:00` } : i.id ? {} : { terbit_at: new Date().toISOString() }),
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
