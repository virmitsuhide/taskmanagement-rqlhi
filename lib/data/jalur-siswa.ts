import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { ikutRiyadhoh } from '@/lib/rq/riyadhoh'
import { URUTAN_JALUR, type JalurTambahan } from '@/lib/rq/jalur'

/**
 * Siapa ikut jalur tambahan apa — bahan lencana di daftar siswa halaqoh dan
 * tabel progres. Lihat lib/rq/jalur.ts.
 *
 * Tiap tabel keanggotaan dibaca terpisah dan kegagalannya diabaikan: tabel
 * yang belum dipasang (migrasi belum ditempel) cukup berarti "tidak ada
 * lencana", bukan halaman yang gagal dimuat.
 */

type Supabase = ReturnType<typeof createServerClient>

async function idsEkstra(supabase: Supabase, ids: string[] | null): Promise<Set<string>> {
  let q = supabase.from('ekstra_booking').select('student_id').eq('status', 'aktif').not('student_id', 'is', null)
  if (ids) q = q.in('student_id', ids)
  const { data, error } = await q
  if (error) return new Set()
  return new Set(((data ?? []) as { student_id: string }[]).map(r => r.student_id))
}

async function idsTabel(supabase: Supabase, tabel: 'tr_peserta' | 'asrama_anggota', ids: string[] | null): Promise<Set<string>> {
  let q = supabase.from(tabel).select('student_id')
  if (ids) q = q.in('student_id', ids)
  const { data, error } = await q
  if (error) return new Set()
  return new Set(((data ?? []) as { student_id: string }[]).map(r => r.student_id))
}

/**
 * Riyadhoh tidak punya daftar peserta utuh: pesertanya aturan bawaan (kelas 9,
 * atau 7–8 QuLS) yang bisa dikecualikan koordinator lewat riyadhoh_peserta.
 */
async function idsRiyadhoh(
  supabase: Supabase,
  siswa: { id: string; jenjang: string; kelas: string | null; program: string | null }[],
): Promise<Set<string>> {
  if (siswa.length === 0) return new Set()
  const { data, error } = await supabase.from('riyadhoh_peserta').select('student_id, ikut').in('student_id', siswa.map(s => s.id))
  const ubah = new Map(error ? [] : ((data ?? []) as { student_id: string; ikut: boolean }[]).map(r => [r.student_id, r.ikut]))
  return new Set(siswa.filter(s => ikutRiyadhoh(s, ubah.get(s.id))).map(s => s.id))
}

/** siswa → jalur tambahan yang diikutinya (urut tampil). Siswa tanpa jalur tidak ada di peta. */
export async function getJalurSiswa(studentIds: string[]): Promise<Map<string, JalurTambahan[]>> {
  const hasil = new Map<string, JalurTambahan[]>()
  if (studentIds.length === 0) return hasil
  const supabase = createServerClient()
  const { data: siswaRows } = await supabase.from('students').select('id, jenjang, kelas, program').in('id', studentIds)
  const siswa = (siswaRows ?? []) as { id: string; jenjang: string; kelas: string | null; program: string | null }[]

  const [ekstra, tr, asrama, riyadhoh] = await Promise.all([
    idsEkstra(supabase, studentIds),
    idsTabel(supabase, 'tr_peserta', studentIds),
    idsTabel(supabase, 'asrama_anggota', studentIds),
    idsRiyadhoh(supabase, siswa),
  ])
  const anggota: Record<JalurTambahan, Set<string>> = { ekstra, tr, asrama, riyadhoh }
  for (const id of studentIds) {
    const ikut = URUTAN_JALUR.filter((j): j is JalurTambahan => j !== 'sekolah' && anggota[j].has(id))
    if (ikut.length) hasil.set(id, ikut)
  }
  return hasil
}

/**
 * Berapa peserta `jalur` di satu unit yang JUGA ikut jalur `lain` — keterangan
 * irisan di analitik (anak ekstra sekaligus TR). Hanya siswa aktif unit itu;
 * `program` = penyempitan program koordinator (koor QULS SD).
 */
export async function hitungIrisanJalur(
  jalur: 'ekstra' | 'tr',
  lain: 'ekstra' | 'tr',
  jenjang: string,
  program: readonly string[] | null,
): Promise<number> {
  const [a, b] = await Promise.all([getIdPesertaJalur(jalur), getIdPesertaJalur(lain)])
  const lainSet = new Set(b)
  const irisan = a.filter(id => lainSet.has(id))
  if (irisan.length === 0) return 0
  let q = createServerClient().from('students').select('id', { count: 'exact', head: true })
    .in('id', irisan).eq('is_active', true).eq('jenjang', jenjang)
  if (program) q = q.in('program', [...program])
  const { count } = await q
  return count ?? 0
}

/**
 * Seluruh siswa peserta aktif satu jalur — penyaring analitik capaian per kelas.
 * cache(): matriks dan hitungan irisan meminta daftar yang sama dalam satu render.
 */
export const getIdPesertaJalur = cache(async (jalur: 'ekstra' | 'tr'): Promise<string[]> => {
  const supabase = createServerClient()
  const ids = jalur === 'ekstra' ? await idsEkstra(supabase, null) : await idsTabel(supabase, 'tr_peserta', null)
  return [...ids]
})
