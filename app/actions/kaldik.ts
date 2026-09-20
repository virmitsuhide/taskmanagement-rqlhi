'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageKaldik } from '@/lib/auth/permissions'
import { KALDIK_TIPE, KALDIK_UNIT, TIPE_WARNA, type KaldikTipe, type KaldikUnit } from '@/lib/data/kaldik'

type Hasil = { error?: string; success?: true }

export interface IsianAgenda {
  tanggal: string
  judul: string
  keterangan: string
  unit: KaldikUnit
  tipe: KaldikTipe
}

/** Semua tempat yang menampilkan agenda kaldik. */
function segarkan() {
  revalidatePath('/')
  revalidatePath('/kalender')
  revalidatePath('/kalender-quran')
}

function periksa(isi: IsianAgenda): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isi.tanggal)) return 'Tanggal tidak sah.'
  if (!isi.judul.trim()) return 'Judul agenda wajib diisi.'
  if (!(KALDIK_UNIT as readonly string[]).includes(isi.unit)) return 'Unit tidak dikenal.'
  if (!(KALDIK_TIPE as readonly string[]).includes(isi.tipe)) return 'Jenis agenda tidak dikenal.'
  return null
}

export async function simpanAgendaAction(id: string | null, isi: IsianAgenda): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageKaldik(session.role, isi.unit)) {
    return { error: `Tidak berwenang atas agenda unit ${isi.unit}.` }
  }
  const galat = periksa(isi)
  if (galat) return { error: galat }

  const supabase = createServerClient()

  // Saat memindahkan agenda ke unit lain, wewenang atas unit ASALNYA juga
  // diperiksa — tanpa itu, agenda SMP bisa "dipindah" keluar oleh koor SD
  // hanya dengan mengubah unitnya sambil menyimpan.
  if (id) {
    const { data: lama } = await supabase.from('kaldik_events').select('unit').eq('id', id).maybeSingle()
    if (lama && !canManageKaldik(session.role, lama.unit as string)) {
      return { error: `Agenda ini milik unit ${lama.unit}; Anda tidak berwenang mengubahnya.` }
    }
  }

  const baris = {
    date: isi.tanggal,
    title: isi.judul.trim().slice(0, 200),
    description: isi.keterangan.trim() || null,
    unit: isi.unit,
    type: isi.tipe,
    color: TIPE_WARNA[isi.tipe],
    year: Number(isi.tanggal.slice(0, 4)),
    updated_at: new Date().toISOString(),
  }

  const { error } = id
    ? await supabase.from('kaldik_events').update(baris).eq('id', id)
    : await supabase.from('kaldik_events').insert({ ...baris, created_by: session.userId })

  if (error) {
    if (error.code === '23505') return { error: 'Agenda dengan tanggal, judul, dan unit yang sama sudah ada.' }
    return { error: 'Gagal menyimpan agenda. Pastikan migrasi 0085 sudah dijalankan.' }
  }

  segarkan()
  return { success: true }
}

export async function hapusAgendaAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: agenda } = await supabase.from('kaldik_events').select('unit').eq('id', id).maybeSingle()
  if (!agenda) return { error: 'Agenda tidak ditemukan.' }
  if (!canManageKaldik(session.role, agenda.unit as string)) {
    return { error: `Agenda ini milik unit ${agenda.unit}; Anda tidak berwenang menghapusnya.` }
  }

  const { error } = await supabase.from('kaldik_events').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus agenda.' }

  segarkan()
  return { success: true }
}
