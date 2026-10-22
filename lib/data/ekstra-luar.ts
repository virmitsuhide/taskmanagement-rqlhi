import { createServerClient } from '@/lib/supabase/server'
import { teksBaris } from '@/lib/rq/status-tahsin'
import type { TahsinStatus } from '@/types'

/**
 * Peserta ekstra dari luar LHI (0122) — data & setoran tahsinnya terpisah dari
 * students/tahsin_logs: mereka bukan siswa dan tidak masuk capaian sekolah.
 *
 * Posisi TIDAK disimpan. Ia dibaca dari setoran terbaru menurut tanggal
 * (lalu waktu input), atau penempatan awal bila belum pernah setor — jadi
 * setoran susulan tidak bisa memundurkan posisi, dan menghapus setoran
 * langsung mengembalikannya.
 */

const tabelHilang = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703')

export interface JilidLuar { id: string; method_id: string; label: string; order_num: number; total_pages: number | null; is_quran: boolean }
export interface MetodeLuar { id: string; name: string; jilid: JilidLuar[] }

export interface SetoranLuar {
  id: string
  tanggal: string
  jilid_id: string | null
  jilid: string | null
  halaman: number | null
  baris_dari: number | null
  baris_ke: number | null
  status: TahsinStatus
  catatan: string
  slot_id: string | null
  created_at: string
}

export interface PosisiLuar { method_id: string | null; jilid_id: string | null; halaman: number | null }

export interface PesertaLuar {
  id: string
  nama: string
  method_id: string | null
  /** Posisi sekarang — halaman yang dibaca pertemuan berikutnya. */
  posisi: PosisiLuar
  /** Teks pendek posisi, mis. "Jilid 2 hal. 14" / "Belum ditempatkan". */
  teksPosisi: string
  setoran: SetoranLuar[]
}

/** Metode tahsin aktif beserta tahapnya (tanpa tahap akhir "Lulus Tahsin"). */
export async function getMetodeLuar(): Promise<MetodeLuar[]> {
  const supabase = createServerClient()
  const [{ data: m }, { data: j }] = await Promise.all([
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('created_at'),
    supabase.from('jilid_levels').select('id, method_id, label, order_num, total_pages, is_quran').eq('is_terminal', false).order('order_num'),
  ])
  const jilid = (j ?? []) as JilidLuar[]
  return ((m ?? []) as { id: string; name: string }[]).map(x => ({ ...x, jilid: jilid.filter(y => y.method_id === x.id) }))
}

/** Posisi sesudah satu setoran: lulus maju satu halaman (berhenti di halaman terakhir buku), lainnya menahan. */
export function posisiSesudah(s: Pick<SetoranLuar, 'jilid_id' | 'halaman' | 'status'>, totalHalaman: number | null): Pick<PosisiLuar, 'jilid_id' | 'halaman'> {
  if (s.status !== 'lulus' || s.halaman === null) return { jilid_id: s.jilid_id, halaman: s.halaman }
  const batas = totalHalaman ?? 604
  return { jilid_id: s.jilid_id, halaman: Math.min(s.halaman + 1, batas) }
}

/**
 * Peserta luar untuk sekumpulan booking (kunci = booking id), beserta setoran
 * sejak `dari` (kosongkan untuk semua). `tabelAda` false bila 0122 belum dijalankan.
 */
export async function getPesertaLuar(bookingIds: string[], dari?: string): Promise<{ tabelAda: boolean; peserta: Map<string, PesertaLuar> }> {
  const hasil = new Map<string, PesertaLuar>()
  if (bookingIds.length === 0) return { tabelAda: true, peserta: hasil }
  const supabase = createServerClient()
  const { data: bRows, error } = await supabase.from('ekstra_booking').select('id, peserta_luar_id').in('id', bookingIds)
  if (tabelHilang(error)) return { tabelAda: false, peserta: hasil }
  const tautan = ((bRows ?? []) as { id: string; peserta_luar_id: string | null }[]).filter(b => b.peserta_luar_id)
  const pids = [...new Set(tautan.map(b => b.peserta_luar_id!))]
  if (pids.length === 0) return { tabelAda: true, peserta: hasil }

  const [{ data: pRows }, { data: sRows }, { data: jRows }] = await Promise.all([
    supabase.from('ekstra_peserta_luar').select('id, nama, method_id, jilid_id, halaman').in('id', pids),
    // Semua setoran dibaca untuk posisi; `dari` hanya menyaring daftar yang dikembalikan.
    supabase.from('ekstra_setoran_luar')
      .select('id, peserta_id, tanggal, jilid_id, halaman, baris_dari, baris_ke, status, catatan, slot_id, created_at')
      .in('peserta_id', pids).order('tanggal').order('created_at'),
    supabase.from('jilid_levels').select('id, method_id, label, total_pages'),
  ])
  const jilid = new Map(((jRows ?? []) as { id: string; method_id: string; label: string; total_pages: number | null }[]).map(j => [j.id, j]))
  type Baris = Omit<SetoranLuar, 'jilid'> & { peserta_id: string }
  const semua = (sRows ?? []) as Baris[]

  for (const p of (pRows ?? []) as { id: string; nama: string; method_id: string | null; jilid_id: string | null; halaman: number | null }[]) {
    const milik = semua.filter(s => s.peserta_id === p.id)
    const akhir = milik.at(-1)
    const lanjut = akhir ? posisiSesudah(akhir, akhir.jilid_id ? jilid.get(akhir.jilid_id)?.total_pages ?? null : null) : null
    const posisi: PosisiLuar = lanjut
      ? { method_id: (lanjut.jilid_id && jilid.get(lanjut.jilid_id)?.method_id) || p.method_id, ...lanjut }
      : { method_id: p.method_id, jilid_id: p.jilid_id, halaman: p.halaman }
    const label = posisi.jilid_id ? jilid.get(posisi.jilid_id)?.label ?? null : null
    const isi: PesertaLuar = {
      id: p.id,
      nama: p.nama,
      method_id: p.method_id,
      posisi,
      teksPosisi: label ? `${label}${posisi.halaman ? ` hal. ${posisi.halaman}` : ''}` : 'Belum ditempatkan',
      setoran: milik.filter(s => !dari || s.tanggal >= dari).map(s => ({ ...s, jilid: s.jilid_id ? jilid.get(s.jilid_id)?.label ?? null : null })),
    }
    for (const b of tautan.filter(t => t.peserta_luar_id === p.id)) hasil.set(b.id, isi)
  }
  return { tabelAda: true, peserta: hasil }
}

/** Ringkas satu setoran, mis. "Jilid 2 hal. 14 baris 1–5 · Tetap". */
export function ringkasSetoranLuar(s: Pick<SetoranLuar, 'jilid' | 'halaman' | 'baris_dari' | 'baris_ke'>): string {
  return [s.jilid, s.halaman ? `hal. ${s.halaman}` : null, teksBaris(s.baris_dari, s.baris_ke)].filter(Boolean).join(' ')
}
