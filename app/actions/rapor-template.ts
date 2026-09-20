'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate } from '@/lib/auth/permissions'
import { bacaDocx } from '@/lib/rapor/docx'
import { cariSlot, pemetaanAwal, KODE_MEDAN, type KodeMedan } from '@/lib/rapor/medan'
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
  const blok = bacaDocx(Buffer.from(bytes))
  if (!blok || blok.length === 0) {
    return { error: 'Berkas tidak terbaca sebagai dokumen Word. Pastikan berkasnya .docx dan tidak rusak.' }
  }

  const tingkatMin = Number(formData.get('tingkat_min') ?? 1)
  const tingkatMax = Number(formData.get('tingkat_max') ?? 12)
  if (!Number.isInteger(tingkatMin) || !Number.isInteger(tingkatMax) || tingkatMin < 1 || tingkatMax > 12 || tingkatMin > tingkatMax) {
    return { error: 'Rentang kelas tidak masuk akal.' }
  }

  const supabase = createServerClient()
  const path = await simpanBerkas(supabase, file, bytes)

  const { data, error } = await supabase
    .from('rapor_templates')
    .insert({
      nama: (String(formData.get('nama') ?? '').trim() || file.name.replace(/\.docx$/i, '')),
      jenjang,
      tingkat_min: tingkatMin,
      tingkat_max: tingkatMax,
      file_path: path,
      file_nama: file.name,
      blok,
      pemetaan: pemetaanAwal(cariSlot(blok)),
      dibuat_oleh: session.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Gagal menyimpan template. Pastikan migrasi 0082 sudah dijalankan.' }
  }

  revalidatePath('/rapor-quran/template')
  return { success: true, id: data.id as string }
}

/** Simpan pemetaan slot → medan, plus teks pengesahan yang sama se-unit. */
export async function simpanPemetaanAction(
  id: string,
  pemetaan: Record<string, string>,
  pengesahan: { tempat_terbit: string; nama_koordinator: string; nip_koordinator: string },
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

  const { error } = await supabase
    .from('rapor_templates')
    .update({
      pemetaan: bersih,
      tempat_terbit: pengesahan.tempat_terbit.trim(),
      nama_koordinator: pengesahan.nama_koordinator.trim(),
      nip_koordinator: pengesahan.nip_koordinator.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: 'Gagal menyimpan pemetaan.' }

  revalidatePath('/rapor-quran/template')
  revalidatePath(`/rapor-quran/template/${id}`)
  return { success: true }
}

export async function ubahTemplateAction(
  id: string,
  ubahan: { nama?: string; tingkat_min?: number; tingkat_max?: number; aktif?: boolean },
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

  const { error } = await supabase
    .from('rapor_templates')
    .update({ ...ubahan, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Gagal menyimpan perubahan.' }

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
  const { data: tpl } = await supabase.from('rapor_templates').select('jenjang, file_path').eq('id', id).maybeSingle()
  if (!tpl) return { error: 'Template tidak ditemukan.' }
  if (!canManageRaporTemplate(session.role, tpl.jenjang as Jenjang)) return { error: 'Tidak memiliki izin.' }

  const { error } = await supabase.from('rapor_templates').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus template.' }
  if (tpl.file_path) await supabase.storage.from(BUCKET).remove([tpl.file_path as string])

  revalidatePath('/rapor-quran/template')
  return { success: true }
}
