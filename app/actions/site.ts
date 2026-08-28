'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageHomepage } from '@/lib/auth/permissions'
import { DEFAULT_SECTIONS } from '@/lib/data/site'
import { focusFromFormData } from '@/lib/profil/foto'
import type { FooterLink, FooterUnit, HomeSection } from '@/types'

type FormState = { error?: string; success?: string } | null

/** Beranda + semua halaman publik ikut menampilkan header/footer. */
function revalidatePublicPages() {
  revalidatePath('/', 'layout')
}

async function guard() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' as const }
  if (!canManageHomepage(session.role)) return { error: 'Tidak memiliki izin.' as const }
  return { session }
}

const str = (fd: FormData, key: string) => ((fd.get(key) as string) ?? '').trim()

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/**
 * Unggah foto guru. Berbagi bucket dengan foto pengurus — keduanya sama-sama
 * foto orang berukuran kecil, dan bucket tambahan berarti satu langkah manual
 * lagi di Supabase yang gampang terlupa. Awalan `teacher-` pada nama berkas
 * yang memisahkannya.
 *
 * Mengembalikan null kalau gagal; pemanggil tetap menyimpan sisa profilnya.
 */
async function uploadTeacherPhoto(
  supabase: ReturnType<typeof createServerClient>,
  file: File,
  teacherId: string,
): Promise<string | null> {
  try {
    const bytes = await file.arrayBuffer()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `teacher-${teacherId}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filename, Buffer.from(bytes), { contentType: file.type, upsert: true })
    if (error || !data) return null
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path).data.publicUrl
  } catch {
    return null
  }
}

/**
 * Baris site_settings selalu id = 1. Upsert dipakai (bukan update) supaya
 * penyimpanan pertama tetap berhasil meski baris awal belum pernah dibuat.
 */
async function saveSettings(patch: Record<string, unknown>, userId: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('site_settings')
    .upsert(
      { id: 1, ...patch, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
  return error?.message ?? null
}

/* ─── Tab 1: Header & Footer ──────────────────────────────────────── */

export async function updateSiteTextAction(_: unknown, formData: FormData): Promise<FormState> {
  const g = await guard()
  if ('error' in g) return g

  // Unit pendidikan & link footer dikirim sebagai baris sejajar (name[], address[], …).
  // Baris yang label/namanya kosong dibuang supaya tidak ada entri hantu di footer.
  const unitNames     = formData.getAll('unit_name')    as string[]
  const unitAddresses = formData.getAll('unit_address') as string[]
  const unitPhones    = formData.getAll('unit_phone')   as string[]
  const footer_units: FooterUnit[] = unitNames
    .map((name, i) => ({
      name: (name ?? '').trim(),
      address: (unitAddresses[i] ?? '').trim(),
      phone: (unitPhones[i] ?? '').trim(),
    }))
    .filter(u => u.name !== '')

  const linkLabels = formData.getAll('link_label') as string[]
  const linkHrefs  = formData.getAll('link_href')  as string[]
  const footer_links: FooterLink[] = linkLabels
    .map((label, i) => ({ label: (label ?? '').trim(), href: (linkHrefs[i] ?? '').trim() || '#' }))
    .filter(l => l.label !== '')

  const err = await saveSettings(
    {
      header_brand:     str(formData, 'header_brand'),
      header_tagline:   str(formData, 'header_tagline'),
      footer_brand:     str(formData, 'footer_brand'),
      footer_brand_sub: str(formData, 'footer_brand_sub'),
      footer_tagline:   str(formData, 'footer_tagline'),
      footer_email:     str(formData, 'footer_email'),
      footer_phone:     str(formData, 'footer_phone'),
      footer_hours:     str(formData, 'footer_hours'),
      footer_copyright: str(formData, 'footer_copyright'),
      footer_units,
      footer_links,
    },
    g.session.userId,
  )
  if (err) return { error: err }

  revalidatePublicPages()
  return { success: 'Teks header & footer tersimpan.' }
}

/* ─── Tab 2: Seksi beranda ────────────────────────────────────────── */

export async function updateHomeSectionsAction(_: unknown, formData: FormData): Promise<FormState> {
  const g = await guard()
  if ('error' in g) return g

  // Urutan ditentukan oleh field `order` (angka), bukan urutan input di DOM —
  // tombol naik/turun hanya menukar angka itu di sisi klien.
  const sections: HomeSection[] = DEFAULT_SECTIONS
    .map(def => {
      const key = def.key
      const rawLimit = Number(formData.get(`limit_${key}`))
      const rawOrder = Number(formData.get(`order_${key}`))
      return {
        section: {
          key,
          enabled: formData.get(`enabled_${key}`) === 'on',
          title: ((formData.get(`title_${key}`) as string) ?? '').trim() || def.title,
          limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 24) : def.limit,
        } satisfies HomeSection,
        order: Number.isFinite(rawOrder) ? rawOrder : 999,
      }
    })
    .sort((a, b) => a.order - b.order)
    .map(x => x.section)

  const err = await saveSettings({ sections }, g.session.userId)
  if (err) return { error: err }

  revalidatePublicPages()
  return { success: 'Tampilan beranda diperbarui.' }
}

/**
 * Reset ke tampilan bawaan — hanya menyentuh `sections`.
 * Dua argumen pertama tidak dipakai, tapi wajib ada agar cocok dengan
 * signature yang diharapkan `useActionState`.
 */
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export async function resetHomeSectionsAction(_prev: unknown, _formData: FormData): Promise<FormState> {
  const g = await guard()
  if ('error' in g) return g

  const err = await saveSettings({ sections: DEFAULT_SECTIONS }, g.session.userId)
  if (err) return { error: err }

  revalidatePublicPages()
  return { success: 'Seksi beranda dikembalikan ke bawaan.' }
}

/* ─── Tab 3: Kurasi Profil Guru ───────────────────────────────────── */

export async function updateTeacherProfilesAction(_: unknown, formData: FormData): Promise<FormState> {
  const g = await guard()
  if ('error' in g) return g

  const ids = formData.getAll('teacher_id') as string[]
  if (ids.length === 0) return { error: 'Tidak ada guru untuk disimpan.' }

  const supabase = createServerClient()

  // Foto diunggah lebih dulu, berurutan per guru yang memang mengirim berkas.
  // Biasanya hanya satu-dua guru diganti fotonya dalam sekali simpan, jadi
  // tidak perlu diparalelkan seperti update barisnya.
  const uploadedPhotos = new Map<string, string>()
  let photoWarning: string | null = null
  for (const id of ids) {
    const file = formData.get(`photo_${id}`) as File | null
    if (!file || file.size === 0) continue
    if (file.size > MAX_PHOTO_BYTES) {
      return { error: `Foto guru maksimal 2 MB — ada berkas yang lebih besar.` }
    }
    const url = await uploadTeacherPhoto(supabase, file, id)
    if (url) uploadedPhotos.set(id, url)
    else photoWarning = 'Sebagian foto gagal diunggah. Pastikan bucket "profile-photos" sudah dibuat di Supabase.'
  }

  // Supabase tidak punya update massal multi-nilai, jadi satu update per guru.
  // Jumlah guru RQ berada di orde puluhan, masih wajar untuk dijalankan paralel.
  const results = await Promise.all(
    ids.map((id, i) => {
      const rawOrder = Number(formData.get(`order_${id}`))
      const patch: Record<string, unknown> = {
        is_public: formData.get(`public_${id}`) === 'on',
        public_title: ((formData.get(`title_${id}`) as string) ?? '').trim() || null,
        public_bio: ((formData.get(`bio_${id}`) as string) ?? '').trim() || null,
        display_order: Number.isFinite(rawOrder) ? rawOrder : i,
        photo_focus: focusFromFormData(formData, `focus_${id}`),
        updated_at: new Date().toISOString(),
      }
      // photo_url hanya disentuh kalau ada berkas baru — guru yang fotonya
      // sedang dipinjam dari akun pengurus tidak boleh ikut terkunci di sini.
      const uploaded = uploadedPhotos.get(id)
      if (uploaded) patch.photo_url = uploaded

      return supabase.from('teachers').update(patch).eq('id', id)
    }),
  )

  const failed = results.find(r => r.error)
  if (failed?.error) {
    if (failed.error.message?.includes('photo_focus')) {
      return {
        error:
          'Posisi foto belum bisa disimpan: jalankan drizzle/0040_foto_geser_dan_foto_guru_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    return { error: failed.error.message }
  }

  revalidatePath('/profil-guru')
  revalidatePublicPages()
  if (photoWarning) return { success: `Profil guru tersimpan. ${photoWarning}` }
  return { success: 'Profil guru tersimpan.' }
}
