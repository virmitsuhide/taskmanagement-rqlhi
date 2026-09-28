'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canKelolaTargetBulanan } from '@/lib/auth/permissions'
import { kelompokTarget, type JenisTarget } from '@/lib/rq/target-bulanan'
import type { Jenjang } from '@/types'

type Hasil = { error?: string; success?: boolean }

const JENJANG: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

export interface InputTargetBulanan {
  tahun_ajaran: string
  bulan: string
  jenjang: Jenjang
  kelompok: string
  tingkat: number
  jenis: JenisTarget
  awal_tahap?: string | null
  awal_halaman?: number | null
  akhir_tahap?: string | null
  akhir_halaman?: number | null
  awal_surat?: number | null
  awal_ayat?: number | null
  akhir_surat?: number | null
  akhir_ayat?: number | null
  keterangan?: string | null
}

const bulat = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** Kunci baris dibaca ulang dari konfigurasi kelompok — bukan dipercaya dari peramban. */
function kunciSah(i: InputTargetBulanan) {
  if (!/^\d{4}\/\d{4}$/.test(i.tahun_ajaran) || !/^\d{4}-\d{2}$/.test(i.bulan)) return null
  if (!JENJANG.includes(i.jenjang) || (i.jenis !== 'tahsin' && i.jenis !== 'tahfidz')) return null
  const kel = kelompokTarget(i.jenjang, i.jenis).find(k => k.kode === i.kelompok)
  if (!kel || !kel.tingkat.includes(i.tingkat)) return null
  return kel
}

export async function simpanTargetBulananAction(i: InputTargetBulanan): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canKelolaTargetBulanan(session.role)) return { error: 'Anda tidak berwenang mengubah target.' }
  const kel = kunciSah(i)
  if (!kel) return { error: 'Unit, kelompok, kelas, atau bulan tidak sah.' }

  const keterangan = (i.keterangan ?? '').trim().slice(0, 300)
  const baris: Record<string, unknown> = {
    tahun_ajaran: i.tahun_ajaran, bulan: i.bulan, jenjang: i.jenjang, kelompok: i.kelompok,
    tingkat: i.tingkat, jenis: i.jenis, keterangan,
    updated_by: session.userId, updated_at: new Date().toISOString(),
  }

  if (i.jenis === 'tahsin') {
    const awal = (i.awal_tahap ?? '').trim(), akhir = (i.akhir_tahap ?? '').trim()
    if (!awal || !akhir) return { error: 'Isi tahap awal dan akhir rentang.' }
    Object.assign(baris, {
      metode: kel.metode?.(i.tingkat) ?? null,
      awal_tahap: awal, awal_halaman: i.awal_halaman == null ? null : bulat(i.awal_halaman, 1, 99),
      akhir_tahap: akhir, akhir_halaman: i.akhir_halaman == null ? null : bulat(i.akhir_halaman, 1, 99),
      awal_surat: null, awal_ayat: null, akhir_surat: null, akhir_ayat: null,
    })
  } else {
    const as = bulat(i.awal_surat, 1, 114), aa = bulat(i.awal_ayat, 1, 286)
    const zs = bulat(i.akhir_surat, 1, 114), za = bulat(i.akhir_ayat, 1, 286)
    // Tahfidz boleh tanpa posisi bila bulannya murojaah — asal keterangannya diisi.
    if ((as === null || aa === null || zs === null || za === null) && !keterangan) {
      return { error: 'Isi surat & ayat awal dan akhir, atau tulis keterangan (mis. murojaah).' }
    }
    Object.assign(baris, {
      metode: null, awal_tahap: null, awal_halaman: null, akhir_tahap: null, akhir_halaman: null,
      awal_surat: as, awal_ayat: aa, akhir_surat: zs, akhir_ayat: za,
    })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('target_bulanan')
    .upsert(baris, { onConflict: 'tahun_ajaran,bulan,jenjang,kelompok,tingkat,jenis' })
  if (error) {
    return { error: /target_bulanan/.test(error.message) ? 'Tabel target belum ada: jalankan drizzle/0103_target_bulanan_PASTE_TO_SUPABASE.sql.' : 'Gagal menyimpan target.' }
  }
  revalidatePath('/target-bulanan')
  return { success: true }
}

export async function hapusTargetBulananAction(id: string): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canKelolaTargetBulanan(session.role)) return { error: 'Anda tidak berwenang mengubah target.' }
  const { error } = await createServerClient().from('target_bulanan').delete().eq('id', id)
  if (error) return { error: 'Gagal mengosongkan target.' }
  revalidatePath('/target-bulanan')
  return { success: true }
}

export async function simpanAmbangAction(jenjang: Jenjang, jenis: JenisTarget, bawah: number, atas: number): Promise<Hasil> {
  const session = await getSession()
  if (!session || !canKelolaTargetBulanan(session.role)) return { error: 'Anda tidak berwenang mengubah ambang.' }
  if (!JENJANG.includes(jenjang) || (jenis !== 'tahsin' && jenis !== 'tahfidz')) return { error: 'Unit atau jenis tidak sah.' }
  const b = Number(bawah), a = Number(atas)
  if (!(b >= 0 && b <= 200) || !(a >= 0 && a <= 200)) return { error: 'Ambang harus 0–200 halaman.' }
  const { error } = await createServerClient().from('target_bulanan_ambang')
    .upsert({ jenjang, jenis, bawah: b, atas: a, updated_by: session.userId, updated_at: new Date().toISOString() })
  if (error) return { error: 'Gagal menyimpan ambang.' }
  revalidatePath('/target-bulanan')
  return { success: true }
}
