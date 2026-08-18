import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import type {
  FooterLink, FooterUnit, HomeSection, HomeSectionKey, PublicTeacher, SiteSettings,
} from '@/types'

/**
 * Nilai bawaan identitas situs & tampilan beranda.
 *
 * Sengaja disimpan di kode, bukan hanya sebagai DEFAULT kolom, supaya beranda
 * tetap tampil utuh saat baris site_settings belum ada (mis. migrasi belum
 * dijalankan). Baris DB ditimpa di atas nilai ini, per-field.
 */
export const DEFAULT_SECTIONS: HomeSection[] = [
  { key: 'pengumuman',  enabled: true, title: 'Pengumuman',        limit: 6 },
  { key: 'agenda',      enabled: true, title: 'Kalender Agenda',   limit: 0 },
  { key: 'news',        enabled: true, title: 'Kabar & Berita',    limit: 12 },
  { key: 'program',     enabled: true, title: 'Program Kami',      limit: 4 },
  { key: 'profil_guru', enabled: true, title: "Guru Rumah Qur'an", limit: 6 },
]

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 1,
  header_brand: "Rumah Qur'an LHI",
  header_tagline: 'Web App RQ LHI · Banguntapan',
  footer_brand: "Rumah Qur'an LHI",
  footer_brand_sub: 'RQ · Yayasan LHI',
  footer_tagline:
    "Mendidik generasi qur'ani dengan adab, ilmu, dan cinta sunnah — untuk siswa SDIT dan SMPIT LHI Yogyakarta.",
  footer_units: [
    { name: 'SDIT LHI',  address: 'Jl. Karangsari No. 3\nBanguntapan, Bantul, DIY', phone: '(0274) 555-1247' },
    { name: 'SMPIT LHI', address: 'Jl. Wonosari No. 17\nBanguntapan, Bantul, DIY', phone: '(0274) 555-1596' },
  ],
  footer_links: [
    { label: 'Pengumuman',      href: '/#pengumuman' },
    { label: 'Kabar & Berita',  href: '/news'        },
    { label: 'Program',         href: '/program'     },
    { label: 'Profil Guru',     href: '/profil-guru' },
    { label: 'Tentang RQ',      href: '/tentang'     },
  ],
  footer_email: 'rq.rumahquran@lhi.sch.id',
  footer_phone: '(0274) 555-1247',
  footer_hours: 'Sen–Jum, 07.30–15.00',
  footer_copyright: 'RQ LHI · Yayasan Lukman Al Hakim Internasional · Yogyakarta',
  sections: DEFAULT_SECTIONS,
  updated_at: '',
  updated_by: null,
}

/** Buang field kosong/null supaya tidak menimpa default dengan string kosong. */
function coalesce<T>(value: T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  if (Array.isArray(value) && value.length === 0) return fallback
  return value
}

/**
 * Gabungkan `sections` dari DB dengan daftar bawaan.
 *
 * Seksi baru yang belum pernah disimpan Humas otomatis ikut muncul (di akhir),
 * jadi menambah seksi di kode tidak butuh migrasi data.
 */
function mergeSections(stored: HomeSection[] | null | undefined): HomeSection[] {
  if (!stored?.length) return DEFAULT_SECTIONS
  const byKey = new Map<HomeSectionKey, HomeSection>()
  for (const s of stored) {
    const known = DEFAULT_SECTIONS.find(d => d.key === s.key)
    if (known) byKey.set(s.key, { ...known, ...s })
  }
  const ordered = [...byKey.values()]
  for (const d of DEFAULT_SECTIONS) if (!byKey.has(d.key)) ordered.push(d)
  return ordered
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
    if (!data) return DEFAULT_SITE_SETTINGS

    const row = data as Partial<SiteSettings>
    const d = DEFAULT_SITE_SETTINGS
    return {
      id: 1,
      header_brand:     coalesce(row.header_brand,     d.header_brand),
      header_tagline:   coalesce(row.header_tagline,   d.header_tagline),
      footer_brand:     coalesce(row.footer_brand,     d.footer_brand),
      footer_brand_sub: coalesce(row.footer_brand_sub, d.footer_brand_sub),
      footer_tagline:   coalesce(row.footer_tagline,   d.footer_tagline),
      footer_units:     coalesce(row.footer_units as FooterUnit[], d.footer_units),
      footer_links:     coalesce(row.footer_links as FooterLink[], d.footer_links),
      footer_email:     coalesce(row.footer_email,     d.footer_email),
      footer_phone:     coalesce(row.footer_phone,     d.footer_phone),
      footer_hours:     coalesce(row.footer_hours,     d.footer_hours),
      footer_copyright: coalesce(row.footer_copyright, d.footer_copyright),
      sections:         mergeSections(row.sections),
      updated_at:       row.updated_at ?? '',
      updated_by:       row.updated_by ?? null,
    }
  } catch {
    return DEFAULT_SITE_SETTINGS
  }
})

/** Cari konfigurasi satu seksi; `enabled: false` kalau kunci tidak dikenal. */
export function findSection(settings: SiteSettings, key: HomeSectionKey): HomeSection {
  return (
    settings.sections.find(s => s.key === key) ??
    DEFAULT_SECTIONS.find(s => s.key === key) ??
    { key, enabled: false, title: '', limit: 0 }
  )
}

/** Guru yang ditandai tampil publik, untuk /profil-guru dan seksi beranda. */
export const getPublicTeachers = cache(async (limit?: number): Promise<PublicTeacher[]> => {
  try {
    const supabase = createServerClient()
    let query = supabase
      .from('teachers')
      .select('id, full_name, photo_url, public_title, public_bio, display_order')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('display_order', { ascending: true })
      .order('full_name', { ascending: true })
    if (limit && limit > 0) query = query.limit(limit)

    const { data } = await query
    return (data ?? []) as PublicTeacher[]
  } catch {
    return []
  }
})

/** Semua guru aktif + status publiknya — untuk panel kurasi Humas. */
export async function getTeachersForCuration() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('teachers')
      .select('id, full_name, photo_url, public_title, public_bio, is_public, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('full_name', { ascending: true })
    return (data ?? []) as (PublicTeacher & { is_public: boolean })[]
  } catch {
    return []
  }
}
