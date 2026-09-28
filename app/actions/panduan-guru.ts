'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { sasaranUnggahPanduan } from '@/lib/auth/permissions'
import { getPanduan } from '@/lib/data/panduan-guru'
import { BUCKET_PANDUAN, MAKS_UKURAN_PANDUAN, URUTAN_KATEGORI_PANDUAN, type KategoriPanduan } from '@/lib/rq/panduan-guru'

type Hasil = { error?: string; success?: boolean }

/**
 * Langkah 1 unggah: server memeriksa izin lalu memberi tautan unggah
 * bertanda tangan. Berkasnya dikirim peramban LANGSUNG ke storage — batas
 * kiriman server action (4 MB) terlalu kecil untuk SOP berformat PDF.
 */
export async function mintaUnggahPanduanAction(namaBerkas: string, ukuran: number, tipe: string): Promise<{ error?: string; path?: string; token?: string }> {
  const session = await getSession()
  const sasaran = session ? sasaranUnggahPanduan(session.role) : null
  if (!session || !sasaran) return { error: 'Anda tidak berwenang mengunggah panduan.' }
  if (tipe !== 'application/pdf' && !/\.pdf$/i.test(namaBerkas)) return { error: 'Berkas harus PDF.' }
  if (!(ukuran > 0) || ukuran > MAKS_UKURAN_PANDUAN) return { error: 'Ukuran PDF maksimal 25 MB.' }

  const path = `${sasaran}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
  const { data, error } = await createServerClient().storage.from(BUCKET_PANDUAN).createSignedUploadUrl(path)
  if (error || !data) {
    return { error: /bucket/i.test(error?.message ?? '') ? 'Bucket panduan belum ada: jalankan drizzle/0104_panduan_guru_PASTE_TO_SUPABASE.sql.' : 'Gagal menyiapkan unggahan.' }
  }
  return { path: data.path, token: data.token }
}

export interface InputPanduan {
  judul: string
  kategori: KategoriPanduan
  keterangan: string
  path: string
  namaBerkas: string
  ukuran: number
}

/** Langkah 2 unggah: catat dokumennya, sesudah berkasnya benar-benar ada di storage. */
export async function simpanPanduanAction(i: InputPanduan): Promise<Hasil> {
  const session = await getSession()
  const sasaran = session ? sasaranUnggahPanduan(session.role) : null
  if (!session || !sasaran) return { error: 'Anda tidak berwenang mengunggah panduan.' }

  const judul = i.judul.trim().slice(0, 200)
  if (!judul) return { error: 'Judul wajib diisi.' }
  if (!URUTAN_KATEGORI_PANDUAN.includes(i.kategori)) return { error: 'Kategori tidak dikenal.' }
  // Path datang dari peramban: harus di folder sasaran penggunggah sendiri.
  if (!i.path.startsWith(`${sasaran}/`) || i.path.includes('..')) return { error: 'Berkas tidak sah.' }

  const supabase = createServerClient()
  const [folder, nama] = [i.path.slice(0, i.path.lastIndexOf('/')), i.path.slice(i.path.lastIndexOf('/') + 1)]
  const { data: ada } = await supabase.storage.from(BUCKET_PANDUAN).list(folder, { search: nama })
  if (!ada?.some(f => f.name === nama)) return { error: 'Berkas belum terunggah. Coba lagi.' }

  const { error } = await supabase.from('panduan_guru').insert({
    judul, kategori: i.kategori, keterangan: i.keterangan.trim().slice(0, 500), sasaran,
    file_path: i.path, file_name: i.namaBerkas.slice(0, 200), file_size: Math.round(i.ukuran) || null,
    diunggah_oleh: session.userId,
  })
  if (error) {
    await supabase.storage.from(BUCKET_PANDUAN).remove([i.path])
    return { error: /panduan_guru/.test(error.message) ? 'Tabel panduan belum ada: jalankan drizzle/0104_panduan_guru_PASTE_TO_SUPABASE.sql.' : 'Gagal menyimpan panduan.' }
  }
  revalidatePath('/panduan-guru')
  revalidatePath('/guru/panduan')
  return { success: true }
}

/**
 * Hapus: pengunggahnya, Kepala RQ, atau pemegang lingkup yang sama (koor
 * pengganti tetap bisa merapikan dokumen koor sebelumnya).
 */
export async function hapusPanduanAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  const p = await getPanduan(id)
  if (!p) return { error: 'Dokumen tidak ditemukan.' }
  const boleh = session.role === 'kepala_rq' || p.diunggah_oleh === session.userId || sasaranUnggahPanduan(session.role) === p.sasaran
  if (!boleh) return { error: 'Anda tidak berwenang menghapus dokumen ini.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('panduan_guru').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus dokumen.' }
  await supabase.storage.from(BUCKET_PANDUAN).remove([p.file_path])
  revalidatePath('/panduan-guru')
  revalidatePath('/guru/panduan')
  return { success: true }
}
