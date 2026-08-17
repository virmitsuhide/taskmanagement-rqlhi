'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageHomepage } from '@/lib/auth/permissions'
import { DEFAULT_SECTIONS } from '@/lib/data/site'
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

  // Supabase tidak punya update massal multi-nilai, jadi satu update per guru.
  // Jumlah guru RQ berada di orde puluhan, masih wajar untuk dijalankan paralel.
  const results = await Promise.all(
    ids.map((id, i) => {
      const rawOrder = Number(formData.get(`order_${id}`))
      return supabase
        .from('teachers')
        .update({
          is_public: formData.get(`public_${id}`) === 'on',
          public_title: ((formData.get(`title_${id}`) as string) ?? '').trim() || null,
          public_bio: ((formData.get(`bio_${id}`) as string) ?? '').trim() || null,
          display_order: Number.isFinite(rawOrder) ? rawOrder : i,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }),
  )

  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/profil-guru')
  revalidatePublicPages()
  return { success: 'Profil guru tersimpan.' }
}
