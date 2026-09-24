'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate } from '@/lib/auth/permissions'
import { bacaDocxLengkap, kertasDari, type Blok, type GambarLatar } from '@/lib/rapor/docx'
import { unggahTtd } from '@/lib/kpi/ttd-berkas'
import { cariSlot, pemetaanAwal, KODE_MEDAN, type AwalIsian, type KodeMedan } from '@/lib/rapor/medan'
import { bacaJenisRapor } from '@/lib/rapor/jenis'
import type { Jenjang } from '@/types'

type Hasil = { error?: string; success?: true; id?: string }

const BUCKET = 'rapor-templates'
const JENJANG: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

/** Berkas .docx asli — arsip, bukan yang dipakai mencetak. Gagal unggah tidak membatalkan template. */
async function simpanBerkas(
  supabase: ReturnType<typeof createServerClient>,
  file: File,
  bytes: ArrayBuffer,
): Promise<string | null> {
  try {
    const nama = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.docx`
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(nama, Buffer.from(bytes), { contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false })
    return error || !data ? null : data.path
  } catch {
    return null
  }
}

/**
 * Unggah gambar kop surat ke bucket yang sama dengan .docx-nya, lalu ganti
 * `src` tiap latar dari nama berkas di dalam .docx menjadi path penyimpanan.
 * Gambar yang dipakai beberapa halaman diunggah sekali. Gagal unggah hanya
 * membuang latarnya — template tetap tersimpan dan tercetak tanpa kop.
 */
async function simpanLatar(
  supabase: ReturnType<typeof createServerClient>,
  blok: Blok[],
  gambar: GambarLatar[],
): Promise<Blok[]> {
  const kertas = kertasDari(blok)
  if (!kertas || gambar.length === 0) return blok

  const dasar = `latar/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = new Map<string, string>()
  for (const [n, g] of gambar.entries()) {
    try {
      const tujuan = `${dasar}-${n + 1}.${g.nama.split('.').pop()}`
      const { data, error } = await supabase.storage.from(BUCKET).upload(tujuan, g.data, { contentType: g.mime, upsert: false })
      if (!error && data) path.set(g.nama, data.path)
    } catch { /* latar ini dilewati */ }
  }
  kertas.latar = kertas.latar.map(l => (l && path.has(l.src) ? { ...l, src: path.get(l.src)! } : null))
  return blok
}

/** Path kop surat yang tersimpan untuk sebuah blok — untuk dibersihkan. */
function pathLatar(blok: unknown): string[] {
  if (!Array.isArray(blok)) return []
  const kertas = kertasDari(blok as Blok[])
  return [...new Set((kertas?.latar ?? []).flatMap(l => (l?.src.startsWith('latar/') ? [l.src] : [])))]
}

/**
 * Unggah template .docx: diterjemahkan jadi blok, tempat isiannya ditebak,
 * lalu disimpan. Koordinator membetulkan tebakannya di layar pemetaan.
 */
export async function unggahTemplateAction(formData: FormData): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const jenjang = String(formData.get('jenjang') ?? '') as Jenjang
  if (!JENJANG.includes(jenjang)) return { error: 'Unit tidak dikenal.' }
  if (!canManageRaporTemplate(session.role, jenjang)) return { error: 'Tidak memiliki izin.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Pilih berkas .docx lebih dulu.' }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return { error: 'Hanya berkas .docx (Word) yang bisa dibaca. Berkas .doc lama harap disimpan ulang sebagai .docx.' }
  }
  if (file.size > 5 * 1024 * 1024) return { error: 'Berkas terlalu besar (maksimal 5 MB).' }

  const bytes = await file.arrayBuffer()
  const hasil = bacaDocxLengkap(Buffer.from(bytes))
  if (!hasil || hasil.blok.length <= 1) {
    return { error: 'Berkas tidak terbaca sebagai dokumen Word. Pastikan berkasnya .docx dan tidak rusak.' }
  }

  const tingkatMin = Number(formData.get('tingkat_min') ?? 1)
  const tingkatMax = Number(formData.get('tingkat_max') ?? 12)
  if (!Number.isInteger(tingkatMin) || !Number.isInteger(tingkatMax) || tingkatMin < 1 || tingkatMax > 12 || tingkatMin > tingkatMax) {
    return { error: 'Rentang kelas tidak masuk akal.' }
  }

  const jenis = bacaJenisRapor(String(formData.get('jenis') ?? ''))
  const supabase = createServerClient()
  const path = await simpanBerkas(supabase, file, bytes)
  const blok = await simpanLatar(supabase, hasil.blok, hasil.gambar)

  const baris = {
    nama: (String(formData.get('nama') ?? '').trim() || file.name.replace(/\.docx$/i, '')),
    jenjang,
    tingkat_min: tingkatMin,
    tingkat_max: tingkatMax,
    file_path: path,
    file_nama: file.name,
    blok,
    pemetaan: pemetaanAwal(cariSlot(blok)),
    dibuat_oleh: session.userId,
  }
  let { data, error } = await supabase.from('rapor_templates').insert({ ...baris, jenis }).select('id').single()
  // Sebelum 0086 kolom jenis belum ada. Template semester masih bisa
  // disimpan dalam bentuk lama; template ATS tidak — ia akan tertukar
  // dengan rapor semester di layar guru.
  if (error && jenis === 'semester') {
    ({ data, error } = await supabase.from('rapor_templates').insert(baris).select('id').single())
  }

  if (error || !data) {
    return {
      error: jenis === 'ats'
        ? 'Gagal menyimpan template ATS. Minta admin menjalankan migrasi 0086 lebih dulu.'
        : 'Gagal menyimpan template. Pastikan migrasi 0082 sudah dijalankan.',
    }
  }

  revalidatePath('/rapor-quran/template')
  return { success: true, id: data.id as string }
}

/** Simpan pemetaan slot → medan, plus teks pengesahan yang sama se-unit. */
export async function simpanPemetaanAction(
  id: string,
  pemetaan: Record<string, string>,
  pengesahan: { tempat_terbit: string; nama_koordinator: string; nip_koordinator: string },
  awalIsian: Record<string, string> = {},
): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: tpl } = await supabase.from('rapor_templates').select('jenjang').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }

  // Kode yang tidak dikenal dibuang, bukan disimpan apa adanya: pemetaan
  // rusak baru ketahuan saat mencetak, ketika gurunya sudah tidak di sini.
  const bersih: Record<string, KodeMedan> = {}
  for (const [slot, kode] of Object.entries(pemetaan)) {
    if ((KODE_MEDAN as readonly string[]).includes(kode)) bersih[slot] = kode as KodeMedan
  }

  // Isi awal isian merah: contoh template, kosong, atau satu medan data.
  const awalBersih: Record<string, AwalIsian> = {}
  for (const [slot, awal] of Object.entries(awalIsian)) {
    if (bersih[slot] !== 'isian_guru') continue
    if (awal === 'contoh' || awal === 'kosong' || (KODE_MEDAN as readonly string[]).includes(awal)) {
      awalBersih[slot] = awal as AwalIsian
    }
  }

  const ubahan = {
    pemetaan: bersih,
    tempat_terbit: pengesahan.tempat_terbit.trim(),
    nama_koordinator: pengesahan.nama_koordinator.trim(),
    nip_koordinator: pengesahan.nip_koordinator.trim(),
    updated_at: new Date().toISOString(),
  }
  let { error } = await supabase.from('rapor_templates').update({ ...ubahan, awal_isian: awalBersih }).eq('id', id)
  // Sebelum 0086: pemetaan tetap tersimpan, isi awal memakai aturan bawaan.
  if (error) ({ error } = await supabase.from('rapor_templates').update(ubahan).eq('id', id))
  if (error) return { error: 'Gagal menyimpan pemetaan.' }

  revalidatePath('/rapor-quran/template')
  revalidatePath(`/rapor-quran/template/${id}`)
  return { success: true }
}

export async function ubahTemplateAction(
  id: string,
  ubahan: { nama?: string; tingkat_min?: number; tingkat_max?: number; aktif?: boolean; jenis?: string },
): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: tpl } = await supabase.from('rapor_templates').select('jenjang').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }

  if (ubahan.tingkat_min !== undefined && ubahan.tingkat_max !== undefined && ubahan.tingkat_min > ubahan.tingkat_max) {
    return { error: 'Rentang kelas tidak masuk akal.' }
  }

  const bersih = { ...ubahan, ...(ubahan.jenis !== undefined ? { jenis: bacaJenisRapor(ubahan.jenis) } : {}) }
  const { error } = await supabase
    .from('rapor_templates')
    .update({ ...bersih, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return { error: ubahan.jenis !== undefined ? 'Gagal mengubah jenis. Migrasi 0086 perlu dijalankan lebih dulu.' : 'Gagal menyimpan perubahan.' }
  }

  revalidatePath('/rapor-quran/template')
  return { success: true }
}

/**
 * Hapus template. Rapor yang sudah diisi tidak ikut terhapus — kolom
 * template_id-nya menjadi NULL (0082), dan isian gurunya tetap ada.
 */
export async function hapusTemplateAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: tpl } = await supabase.from('rapor_templates').select('jenjang, file_path, blok').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }

  const { error } = await supabase.from('rapor_templates').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus template.' }
  const sisa = [...(tpl.file_path ? [tpl.file_path as string] : []), ...pathLatar(tpl.blok)]
  if (sisa.length > 0) await supabase.storage.from(BUCKET).remove(sisa)

  revalidatePath('/rapor-quran/template')
  return { success: true }
}

/**
 * Unggah tanda tangan koordinator untuk sebuah template (0083).
 *
 * Disimpan di template, bukan di akun penggunanya: yang menandatangani rapor
 * unit adalah jabatan koordinatornya, dan berkas yang sama dipakai seluruh
 * angkatan. Berkasnya masuk bucket `signatures` yang tertutup — lihat
 * lib/kpi/ttd-berkas.ts.
 */
export async function unggahTtdKoordinatorAction(id: string, formData: FormData): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: tpl } = await supabase.from('rapor_templates').select('jenjang').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }

  const file = formData.get('ttd')
  if (!(file instanceof File) || file.size === 0) return { error: 'Pilih gambar tanda tangan lebih dulu.' }

  const hasil = await unggahTtd(file, `rapor-template/${id}`)
  if ('error' in hasil) return { error: hasil.error }

  // Berkas lama sengaja tidak dihapus: rapor yang sudah tercetak menunjuk
  // kepadanya, dan mengganti gambar di dokumen yang sudah ditandatangani
  // persis hal yang dihindari.
  const { error } = await supabase
    .from('rapor_templates')
    .update({ ttd_koordinator_path: hasil.path, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Gagal menyimpan tanda tangan. Pastikan migrasi 0083 sudah dijalankan.' }

  revalidatePath(`/rapor-quran/template/${id}`)
  return { success: true }
}

/** Lepas tanda tangan koordinator — ruangnya kembali kosong untuk ttd basah. */
export async function hapusTtdKoordinatorAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: tpl } = await supabase.from('rapor_templates').select('jenjang').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }

  const { error } = await supabase
    .from('rapor_templates')
    .update({ ttd_koordinator_path: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Gagal melepas tanda tangan.' }

  revalidatePath(`/rapor-quran/template/${id}`)
  return { success: true }
}

/**
 * Baca ulang template dari berkas .docx yang tersimpan di arsip.
 *
 * Dipakai saat penerjemah .docx diperbaiki — template yang diunggah sebelum
 * perbaikan tetap menyimpan hasil terjemahan lama. Tanpa ini, satu-satunya
 * jalan adalah mengunggah ulang berkasnya, dan berkas itu bisa saja sudah
 * tidak ada di komputer koordinator.
 *
 * Pemetaannya dipertahankan bila slot hasil baca ulang SAMA dengan yang lama
 * (id dan contohnya) — misalnya bila yang berubah hanya tata letaknya. Bila
 * ada yang bergeser, pemetaan disusun ulang dari tebakan baru: pemetaan lama
 * yang dipaksa tetap akan menempel pada baris yang keliru. Koordinator
 * memeriksanya lagi di layar pemetaan — yang memang sudah ada di hadapannya.
 */
export async function bacaUlangTemplateAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  // select('*'): awal_isian baru ada sesudah 0086.
  const { data: tpl } = await supabase.from('rapor_templates').select('*').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }
  if (!tpl.file_path) {
    return { error: 'Berkas aslinya tidak tersimpan. Unggah ulang .docx-nya sebagai template baru.' }
  }

  const { data: berkas, error: galatUnduh } = await supabase.storage.from(BUCKET).download(tpl.file_path as string)
  if (galatUnduh || !berkas) return { error: 'Berkas arsip tidak bisa dibuka. Unggah ulang .docx-nya.' }

  const hasil = bacaDocxLengkap(Buffer.from(await berkas.arrayBuffer()))
  if (!hasil || hasil.blok.length <= 1) return { error: 'Berkas arsip tidak terbaca sebagai dokumen Word.' }
  const blok = await simpanLatar(supabase, hasil.blok, hasil.gambar)

  const sidik = (b: Blok[]) => cariSlot(b).map(s => `${s.id}\u0000${s.contoh}`).join('\u0001')
  const blokLama = Array.isArray(tpl.blok) ? (tpl.blok as Blok[]) : []
  const sama = blokLama.length > 0 && sidik(blokLama) === sidik(blok)
  const pemetaan = sama ? (tpl.pemetaan ?? {}) : pemetaanAwal(cariSlot(blok))
  const awalIsian = sama ? (tpl.awal_isian ?? {}) : {}

  let { error } = await supabase
    .from('rapor_templates')
    .update({ blok, pemetaan, awal_isian: awalIsian, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    ({ error } = await supabase
      .from('rapor_templates')
      .update({ blok, pemetaan, updated_at: new Date().toISOString() })
      .eq('id', id))
  }
  if (error) {
    const baru = pathLatar(blok)
    if (baru.length > 0) await supabase.storage.from(BUCKET).remove(baru)
    return { error: 'Gagal menyimpan hasil baca ulang.' }
  }

  // Kop surat hasil baca sebelumnya sudah tidak dirujuk siapa pun.
  const lama = pathLatar(blokLama)
  if (lama.length > 0) await supabase.storage.from(BUCKET).remove(lama)

  revalidatePath(`/rapor-quran/template/${id}`)
  return { success: true }
}
