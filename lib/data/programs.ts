import { createServerClient } from '@/lib/supabase/server'
import type { Program } from '@/types'

const ORDER = { column: 'display_order', opts: { ascending: true } } as const

/** Semua program termasuk yang nonaktif — untuk panel kelola. */
export async function getAllPrograms(): Promise<Program[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order(ORDER.column, ORDER.opts)
      .order('created_at', { ascending: true })
    return (data ?? []) as Program[]
  } catch {
    return []
  }
}

/** Hanya program aktif — untuk halaman publik & beranda. */
export async function getActivePrograms(limit?: number): Promise<Program[]> {
  try {
    const supabase = createServerClient()
    let q = supabase
      .from('programs')
      .select('*')
      .eq('is_active', true)
      .order(ORDER.column, ORDER.opts)
      .order('created_at', { ascending: true })
    if (limit && limit > 0) q = q.limit(limit)
    const { data } = await q
    return (data ?? []) as Program[]
  } catch {
    return []
  }
}

export async function getProgramBySlug(slug: string): Promise<Program | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    return (data as Program | null) ?? null
  } catch {
    return null
  }
}
