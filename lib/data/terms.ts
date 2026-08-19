import { createServerClient } from '@/lib/supabase/server'
import type { AcademicTerm, HalaqohSession } from '@/types'

/**
 * Tahun ajaran & sesi mengajar.
 *
 * Semester berjalan adalah acuan tunggal seluruh modul tahsin/tahfidz: halaqoh
 * mana yang aktif, santri siapa di dalamnya, dan guru mana yang mengampu.
 * Database menjamin hanya satu baris `is_current` lewat index unik parsial,
 * jadi fungsi di sini boleh mengandalkan "paling banyak satu".
 */

export async function getCurrentTerm(): Promise<AcademicTerm | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('academic_terms')
      .select('*')
      .eq('is_current', true)
      .maybeSingle()
    return (data as AcademicTerm) ?? null
  } catch {
    return null
  }
}

/** Semua tahun ajaran, terbaru dulu. */
export async function getTerms(): Promise<AcademicTerm[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('academic_terms')
      .select('*')
      .order('start_date', { ascending: false })
    return (data ?? []) as AcademicTerm[]
  } catch {
    return []
  }
}

/** 'Semester Genap 2025/2026' */
export function formatTerm(term: Pick<AcademicTerm, 'year_label' | 'semester'>): string {
  const semester = term.semester === 'ganjil' ? 'Ganjil' : 'Genap'
  return `Semester ${semester} ${term.year_label}`
}

export interface TermStats {
  termId: string
  halaqohCount: number
  studentCount: number
  teacherCount: number
}

/**
 * Ringkasan isi tiap semester — dipakai panel tahun ajaran untuk menunjukkan
 * semester mana yang sudah terisi dan mana yang masih kosong.
 *
 * Dihitung sekali untuk semua semester lalu dikelompokkan di memori. Menghitung
 * per semester berarti tiga query dikalikan jumlah semester, dan jumlah itu
 * bertambah dua tiap tahun.
 */
export async function getTermStats(): Promise<Map<string, TermStats>> {
  const stats = new Map<string, TermStats>()

  try {
    const supabase = createServerClient()
    const { data: halaqohRows } = await supabase
      .from('halaqoh')
      .select('id, term_id')

    const halaqohList = (halaqohRows ?? []) as { id: string; term_id: string | null }[]
    const termOf = new Map(halaqohList.map(h => [h.id, h.term_id]))

    const [{ data: memberRows }, { data: teacherRows }] = await Promise.all([
      supabase.from('halaqoh_members').select('halaqoh_id, student_id'),
      supabase.from('halaqoh_teachers').select('halaqoh_id, teacher_id'),
    ])

    // Santri & guru dihitung unik per semester: satu orang yang mengampu dua
    // halaqoh di semester yang sama tetap satu orang.
    const students = new Map<string, Set<string>>()
    const teachers = new Map<string, Set<string>>()

    for (const row of (memberRows ?? []) as { halaqoh_id: string; student_id: string }[]) {
      const term = termOf.get(row.halaqoh_id)
      if (!term) continue
      if (!students.has(term)) students.set(term, new Set())
      students.get(term)!.add(row.student_id)
    }
    for (const row of (teacherRows ?? []) as { halaqoh_id: string; teacher_id: string }[]) {
      const term = termOf.get(row.halaqoh_id)
      if (!term) continue
      if (!teachers.has(term)) teachers.set(term, new Set())
      teachers.get(term)!.add(row.teacher_id)
    }

    for (const h of halaqohList) {
      if (!h.term_id) continue
      const entry = stats.get(h.term_id) ?? {
        termId: h.term_id, halaqohCount: 0, studentCount: 0, teacherCount: 0,
      }
      entry.halaqohCount += 1
      stats.set(h.term_id, entry)
    }
    for (const [term, entry] of stats) {
      entry.studentCount = students.get(term)?.size ?? 0
      entry.teacherCount = teachers.get(term)?.size ?? 0
    }

    return stats
  } catch {
    return stats
  }
}

/** Sesi satu halaqoh, urut hari lalu jam. */
export async function getHalaqohSessions(halaqohId: string): Promise<HalaqohSession[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('halaqoh_sessions')
      .select('*')
      .eq('halaqoh_id', halaqohId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
    return (data ?? []) as HalaqohSession[]
  } catch {
    return []
  }
}

/**
 * Berapa sesi yang diampu tiap guru pada semester berjalan.
 *
 * Inilah angka "2 sesi" / "3 sesi" pada MPP guru OS, dan dasar perhitungan
 * Gaji OS di laporan keuangan. Dihitung, bukan diinput — jadi ia tidak bisa
 * menyimpang dari jadwal yang sebenarnya berlaku.
 */
export async function getTeacherSessionLoad(termId: string): Promise<Map<string, number>> {
  const load = new Map<string, number>()

  try {
    const supabase = createServerClient()
    const { data: halaqohRows } = await supabase
      .from('halaqoh')
      .select('id')
      .eq('term_id', termId)

    const halaqohIds = ((halaqohRows ?? []) as { id: string }[]).map(h => h.id)
    if (halaqohIds.length === 0) return load

    const [{ data: sessionRows }, { data: assignRows }] = await Promise.all([
      supabase.from('halaqoh_sessions').select('halaqoh_id').in('halaqoh_id', halaqohIds),
      supabase.from('halaqoh_teachers').select('halaqoh_id, teacher_id').in('halaqoh_id', halaqohIds),
    ])

    const sessionsPerHalaqoh = new Map<string, number>()
    for (const row of (sessionRows ?? []) as { halaqoh_id: string }[]) {
      sessionsPerHalaqoh.set(row.halaqoh_id, (sessionsPerHalaqoh.get(row.halaqoh_id) ?? 0) + 1)
    }

    for (const row of (assignRows ?? []) as { halaqoh_id: string; teacher_id: string }[]) {
      const count = sessionsPerHalaqoh.get(row.halaqoh_id) ?? 0
      load.set(row.teacher_id, (load.get(row.teacher_id) ?? 0) + count)
    }

    return load
  } catch {
    return load
  }
}
