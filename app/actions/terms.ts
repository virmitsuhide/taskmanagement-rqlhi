'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh, canManageTerms } from '@/lib/auth/permissions'
import type { Jenjang } from '@/types'

type Result = { error?: string; success?: boolean }

function revalidateTermPaths() {
  revalidatePath('/tahun-ajaran')
  revalidatePath('/halaqoh')
  revalidatePath('/siswa')
  revalidatePath('/ustadz')
}

async function guardTerms(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageTerms(session.role)) return { error: 'Tidak memiliki izin.' }
  return { userId: session.userId }
}

// ── Tahun ajaran ─────────────────────────────────────────────────────────────

export async function createTermAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guardTerms()
  if ('error' in auth) return auth

  const year_label = ((formData.get('year_label') as string) ?? '').trim()
  const semester = formData.get('semester') === 'ganjil' ? 'ganjil' : 'genap'
  const start_date = ((formData.get('start_date') as string) ?? '').trim()
  const end_date = ((formData.get('end_date') as string) ?? '').trim()

  if (!/^\d{4}\/\d{4}$/.test(year_label)) {
    return { error: 'Tahun ajaran ditulis seperti 2026/2027.' }
  }
  if (!start_date || !end_date) return { error: 'Tanggal mulai dan selesai wajib diisi.' }
  if (end_date <= start_date) return { error: 'Tanggal selesai harus setelah tanggal mulai.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('academic_terms')
    .insert({ year_label, semester, start_date, end_date, is_current: false })

  if (error) {
    if (error.code === '23505') return { error: 'Semester itu sudah ada.' }
    return { error: error.message || 'Gagal membuat tahun ajaran.' }
  }

  revalidateTermPaths()
  return { success: true }
}

/**
 * Pindahkan status "berjalan" ke satu semester.
 *
 * Dilakukan dua langkah — turunkan semua, lalu naikkan satu — karena index
 * unik parsial menolak dua baris `is_current` sekaligus. Menaikkan lebih dulu
 * akan ditolak database selama yang lama belum diturunkan.
 */
export async function setCurrentTermAction(id: string): Promise<Result> {
  const auth = await guardTerms()
  if ('error' in auth) return auth

  const supabase = createServerClient()

  const { error: clearError } = await supabase
    .from('academic_terms')
    .update({ is_current: false })
    .eq('is_current', true)
  if (clearError) return { error: 'Gagal melepas semester lama.' }

  const { error } = await supabase
    .from('academic_terms')
    .update({ is_current: true })
    .eq('id', id)
  if (error) return { error: 'Gagal menetapkan semester berjalan.' }

  revalidateTermPaths()
  return { success: true }
}

export async function deleteTermAction(id: string): Promise<Result> {
  const auth = await guardTerms()
  if ('error' in auth) return auth

  const supabase = createServerClient()

  // Halaqoh menunjuk semester dengan ON DELETE RESTRICT, jadi penghapusan akan
  // ditolak database. Dicegat di sini supaya pesannya menerangkan sebabnya,
  // bukan sekadar galat kunci asing.
  const { count } = await supabase
    .from('halaqoh')
    .select('id', { count: 'exact', head: true })
    .eq('term_id', id)

  if ((count ?? 0) > 0) {
    return { error: `Semester ini sudah punya ${count} halaqoh. Hapus atau pindahkan halaqohnya dulu.` }
  }

  const { error } = await supabase.from('academic_terms').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus tahun ajaran.' }

  revalidateTermPaths()
  return { success: true }
}

// ── Sesi mengajar ────────────────────────────────────────────────────────────

/** Sesi mengikuti halaqoh, jadi izinnya pun mengikuti izin halaqoh. */
async function guardHalaqoh(halaqohId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: halaqoh } = await supabase
    .from('halaqoh')
    .select('jenjang')
    .eq('id', halaqohId)
    .maybeSingle()

  if (!halaqoh) return { error: 'Halaqoh tidak ditemukan.' }
  if (!canManageHalaqoh(session.role, halaqoh.jenjang as Jenjang)) {
    return { error: 'Tidak memiliki izin untuk halaqoh jenjang ini.' }
  }
  return { ok: true }
}

export async function saveSessionAction(_: unknown, formData: FormData): Promise<Result> {
  const halaqohId = (formData.get('halaqoh_id') as string) ?? ''
  const guard = await guardHalaqoh(halaqohId)
  if ('error' in guard) return guard

  const day_of_week = Number(formData.get('day_of_week'))
  const start_time = ((formData.get('start_time') as string) ?? '').trim()
  const end_time = ((formData.get('end_time') as string) ?? '').trim()
  const note = ((formData.get('note') as string) ?? '').trim()

  if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7) {
    return { error: 'Hari tidak valid.' }
  }
  if (!start_time || !end_time) return { error: 'Jam mulai dan selesai wajib diisi.' }
  if (end_time <= start_time) return { error: 'Jam selesai harus setelah jam mulai.' }

  const supabase = createServerClient()
  const id = (formData.get('id') as string) || null
  const payload = { halaqoh_id: halaqohId, day_of_week, start_time, end_time, note }

  const { error } = id
    ? await supabase.from('halaqoh_sessions').update(payload).eq('id', id)
    : await supabase.from('halaqoh_sessions').insert(payload)

  if (error) {
    if (error.code === '23505') return { error: 'Sudah ada sesi di hari dan jam yang sama.' }
    return { error: error.message || 'Gagal menyimpan sesi.' }
  }

  revalidatePath(`/halaqoh/${halaqohId}`)
  revalidatePath('/ustadz')
  return { success: true }
}

export async function deleteSessionAction(id: string, halaqohId: string): Promise<Result> {
  const guard = await guardHalaqoh(halaqohId)
  if ('error' in guard) return guard

  const supabase = createServerClient()
  const { error } = await supabase.from('halaqoh_sessions').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus sesi.' }

  revalidatePath(`/halaqoh/${halaqohId}`)
  revalidatePath('/ustadz')
  return { success: true }
}

// ── Pengacakan semester ──────────────────────────────────────────────────────

/**
 * Siapkan halaqoh semester baru dengan menyalin kerangka semester lain.
 *
 * Yang disalin hanya KERANGKANYA: nama, jenjang, dan jadwal sesi. Santri,
 * wali, dan pengampu sengaja TIDAK ikut — tiap semester keduanya diacak
 * ulang, jadi menyalinnya justru menciptakan penempatan palsu yang tampak
 * sah dan menunggu untuk terlupakan.
 *
 * Halaqoh semester lama tetap utuh beserta anggotanya, sehingga rapor bulan
 * lampau tetap menyebut kelompok dan ustadz yang benar.
 */
export async function copyHalaqohToTermAction(fromTermId: string, toTermId: string): Promise<Result> {
  const auth = await guardTerms()
  if ('error' in auth) return auth
  if (fromTermId === toTermId) return { error: 'Semester asal dan tujuan sama.' }

  const supabase = createServerClient()

  const { data: existing, count } = await supabase
    .from('halaqoh')
    .select('id', { count: 'exact' })
    .eq('term_id', toTermId)
    .limit(1)

  if ((count ?? (existing?.length ?? 0)) > 0) {
    return { error: 'Semester tujuan sudah punya halaqoh. Kosongkan dulu kalau ingin menyalin ulang.' }
  }

  const { data: sourceRows } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, schedule_note')
    .eq('term_id', fromTermId)
    .order('name')

  const source = (sourceRows ?? []) as {
    id: string; name: string; jenjang: string; schedule_note: string | null
  }[]
  if (source.length === 0) return { error: 'Semester asal belum punya halaqoh.' }

  const { data: created, error } = await supabase
    .from('halaqoh')
    .insert(source.map(h => ({
      name: h.name,
      jenjang: h.jenjang,
      schedule_note: h.schedule_note,
      term_id: toTermId,
      wali_teacher_id: null,
      is_active: true,
    })))
    .select('id, name, jenjang')

  if (error || !created) return { error: error?.message || 'Gagal menyalin halaqoh.' }

  // Cocokkan halaqoh baru ke asalnya lewat nama + jenjang untuk menyalin
  // jadwalnya. Pasangan itu unik dalam satu semester, dan urutan hasil insert
  // tidak dijamin sama dengan urutan masukan.
  const newIdOf = new Map(created.map(h => [`${h.jenjang}|${h.name}`, h.id as string]))

  const { data: sessionRows } = await supabase
    .from('halaqoh_sessions')
    .select('halaqoh_id, day_of_week, start_time, end_time, note')
    .in('halaqoh_id', source.map(h => h.id))

  const sessions = (sessionRows ?? []) as {
    halaqoh_id: string; day_of_week: number; start_time: string; end_time: string; note: string
  }[]

  if (sessions.length > 0) {
    const sourceById = new Map(source.map(h => [h.id, h]))
    const copies = sessions.flatMap(s => {
      const origin = sourceById.get(s.halaqoh_id)
      if (!origin) return []
      const target = newIdOf.get(`${origin.jenjang}|${origin.name}`)
      if (!target) return []
      return [{
        halaqoh_id: target,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        note: s.note,
      }]
    })
    if (copies.length > 0) await supabase.from('halaqoh_sessions').insert(copies)
  }

  revalidateTermPaths()
  return { success: true }
}
