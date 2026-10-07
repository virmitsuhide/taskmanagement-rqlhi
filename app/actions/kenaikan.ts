'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageStudents } from '@/lib/auth/permissions'
import { syncHalaqohMemberships } from '@/lib/data/halaqoh-membership'
import { rapikanAnggotaAsrama } from '@/lib/data/asrama'
import { galatRombelSmp, kelasBerikutnya, kelasJelas } from '@/lib/rq/kelas'
import { programLanjutan, programNaikSd, UNIT_LANJUTAN } from '@/lib/rq/kenaikan'
import { tanggalWIB } from '@/lib/rq/ujian'
import type { Gender, Jenjang } from '@/types'

/*
 * Kenaikan kelas antar tahun ajaran.
 *
 * Kelas berikutnya & tingkat akhir tiap unit dibaca dari lib/rq/kelas.ts
 * (kelasBerikutnya), satu tempat bersama halaman pembenahan kelas. Selama
 * keduanya memakai aturan yang sama, tidak mungkin ada anak yang dinyatakan
 * beres di satu layar tapi tetap dilewati di layar lain.
 *
 * Anak kelas TERATAS tiap unit tidak lagi otomatis dinonaktifkan: kumik
 * memutuskan per anak siapa yang lanjut ke unit LHI berikutnya (0113), dan
 * lulusan SMA LHI dicentang dulu sebelum menjadi alumni.
 */

export interface SiswaKelasAkhir {
  id: string
  nama: string
  jenjang: Jenjang
  kelas: string
  gender: Gender | null
  program: string | null
}

export interface RencanaKenaikan {
  naik: number
  /** Anak kelas teratas tiap unit — keputusannya diambil di layar. */
  kelasAkhir: SiswaKelasAkhir[]
  /** Kelas yang tidak berpola <angka><rombel> — dilewati, tidak ditebak. */
  dilewati: { kelas: string; jumlah: number }[]
}

/** Keputusan kumik untuk anak kelas teratas. Yang tidak disebut: lulus & keluar (SMA: tetap 12). */
export interface KeputusanKelasAkhir {
  lanjut: { id: string; ke: Jenjang; kelas: string }[]
  /** Lulusan SMA LHI yang dicentang — menjadi alumni. */
  alumni: string[]
}

interface BarisKenaikan {
  id: string
  full_name: string
  jenjang: Jenjang
  kelas: string | null
  gender: Gender | null
  program: string | null
  halaqoh_id: string | null
}

/**
 * Memilah siswa aktif menjadi tiga: naik, kelas teratas, dan dilewati.
 *
 * Dipakai bersama oleh pratinjau dan pelaksanaan, supaya angka yang dilihat
 * sebelum menekan tombol adalah angka yang benar-benar dikerjakan sesudahnya.
 */
function pilah(rows: BarisKenaikan[]) {
  const naik: { id: string; kelas: string; dari: BarisKenaikan }[] = []
  const akhir: BarisKenaikan[] = []
  const dilewati = new Map<string, number>()

  for (const s of rows) {
    const berikut = kelasBerikutnya(s.jenjang, s.kelas)
    if (!berikut) {
      // Termasuk '4.0' dan kawan-kawannya yang lolos dari impor Excel. Ditolak,
      // BUKAN ditebak: tidak ada rombel yang bisa dipertahankan dari '4.0', dan
      // menebaknya berarti memindahkan anak ke kelas yang tak pernah diputuskan
      // siapa pun. Yang benar diperbaiki manusia lewat sunting siswa.
      const k = s.kelas?.trim() || '(kelas kosong)'
      dilewati.set(k, (dilewati.get(k) ?? 0) + 1)
      continue
    }
    if (berikut === 'lulus') akhir.push(s)
    else naik.push({ id: s.id, kelas: berikut.naik, dari: s })
  }

  return { naik, akhir, dilewati }
}

const KOLOM = 'id, full_name, jenjang, kelas, gender, program, halaqoh_id'

function bolehMenjalankan(role: string): boolean {
  // Kenaikan menyentuh seluruh unit sekaligus, jadi yang boleh menjalankannya
  // hanya yang berwenang atas seluruh unit — bukan koor satu jenjang.
  return role === 'kepala_rq' || role === 'kumik'
}

/** Angka & daftar kelas teratas yang ditampilkan sebelum kenaikan dijalankan. Tidak mengubah apa pun. */
export async function pratinjauKenaikanAction(): Promise<
  { error: string } | { rencana: RencanaKenaikan }
> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageStudents(session.role) || !bolehMenjalankan(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('students')
    .select(KOLOM)
    .eq('is_active', true)
    .order('full_name')

  if (error) return { error: 'Gagal membaca data siswa.' }

  const { naik, akhir, dilewati } = pilah((data ?? []) as BarisKenaikan[])
  return {
    rencana: {
      naik: naik.length,
      kelasAkhir: akhir.map(s => ({
        id: s.id, nama: s.full_name, jenjang: s.jenjang, kelas: s.kelas!.trim(), gender: s.gender, program: s.program,
      })),
      dilewati: [...dilewati].map(([kelas, jumlah]) => ({ kelas, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah),
    },
  }
}

export interface HasilKenaikan {
  naik: number
  lanjut: number
  lulus: number
  alumni: number
  tetap: number
  gagal: number
}

/**
 * Menjalankan kenaikan menuju tahun ajaran `termId`.
 *
 *   1A → 2A, 5C → 6C       — angkanya naik, rombelnya tetap; program ikut,
 *                            kecuali QULS Takhassus SD yang berakhir (→ CLIL)
 *   kelas teratas, lanjut  — pindah unit LHI: jenjang, kelas, program baru;
 *                            halaqoh lama dilepas (halaqoh milik unit lama)
 *   kelas teratas, lainnya — lulus & nonaktif (keluar_status 'lulus')
 *   SMA 12 dicentang       — alumni & nonaktif (keluar_status 'alumni')
 *   SMA 12 tidak dicentang — tetap kelas 12, aktif
 *   4.0                    — dilewati dan dilaporkan, tidak ditebak
 *
 * TIDAK ditempelkan pada setCurrentTermAction meski itu yang paling menggoda.
 * Menetapkan semester berjalan adalah tindakan yang wajar diulang — koor
 * berpindah ke semester lalu untuk memeriksa rekap, lalu kembali. Kalau
 * kenaikan ikut menempel di sana, satu kali menengok arsip akan menaikkan
 * seluruh angkatan untuk kedua kalinya.
 *
 * Penjaga sesungguhnya ada di kolom academic_terms.kenaikan_at (0055): sekali
 * terisi, kenaikan menuju tahun itu ditolak. Konfirmasi di layar hanya menahan
 * orang yang ragu — ia tidak menahan tombol yang terklik dua kali.
 */
export async function naikkanKelasAction(
  termId: string,
  keputusan: KeputusanKelasAkhir,
): Promise<{ error: string } | ({ success: true } & HasilKenaikan)> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageStudents(session.role) || !bolehMenjalankan(session.role)) {
    return { error: 'Hanya Kepala RQ dan Kumik yang bisa menjalankan kenaikan kelas.' }
  }
  if (!termId) return { error: 'Tahun ajaran tujuan tidak dikenali.' }

  const supabase = createServerClient()

  const { data: term } = await supabase
    .from('academic_terms')
    .select('id, year_label, semester, kenaikan_at')
    .eq('id', termId)
    .maybeSingle()

  if (!term) return { error: 'Tahun ajaran tujuan tidak ditemukan.' }
  if (term.kenaikan_at) {
    return {
      error: `Kenaikan menuju ${term.year_label} sudah pernah dijalankan pada ` +
        `${new Date(term.kenaikan_at as string).toLocaleString('id-ID')}. ` +
        'Menjalankannya lagi akan menaikkan seluruh angkatan dua tingkat.',
    }
  }

  // Kolom 0113 diperiksa SEBELUM apa pun ditulis: tanpa keluar_status,
  // lulusan dan alumni tidak bisa dibedakan dari siswa yang dihapus.
  const { error: kolomError } = await supabase.from('kenaikan_riwayat').select('id').limit(1)
  const { error: kolomSiswaError } = await supabase.from('students').select('keluar_status').limit(1)
  if (kolomError || kolomSiswaError) {
    return { error: 'Kenaikan lintas unit belum aktif: jalankan drizzle/0113_kenaikan_lintas_unit_PASTE_TO_SUPABASE.sql di Supabase.' }
  }

  const { data, error: bacaError } = await supabase
    .from('students')
    .select(KOLOM)
    .eq('is_active', true)

  if (bacaError) return { error: 'Gagal membaca data siswa.' }

  const { naik, akhir } = pilah((data ?? []) as BarisKenaikan[])

  /*
    Keputusan dari layar diperiksa ulang di sini: hanya anak kelas teratas
    yang boleh dipindah unit, hanya ke unit lanjutannya, dan hanya ke kelas
    yang sah di unit tujuan. Request buatan tangan tidak bisa memindahkan
    anak kelas 3 ke SMA.
  */
  const akhirPer = new Map(akhir.map(s => [s.id, s]))
  const lanjut: { s: BarisKenaikan; ke: Jenjang; kelas: string; program: string | null }[] = []
  for (const k of keputusan.lanjut) {
    const s = akhirPer.get(k.id)
    if (!s) return { error: 'Ada siswa lanjut yang bukan kelas teratas unitnya. Muat ulang rencana.' }
    if (!UNIT_LANJUTAN[s.jenjang].includes(k.ke)) {
      return { error: `${s.full_name} tidak bisa lanjut ke unit itu.` }
    }
    const kelas = k.kelas.trim().toUpperCase()
    const program = programLanjutan(k.ke, kelas, s.program)
    if (!kelasJelas(k.ke, kelas)) return { error: `Kelas tujuan ${s.full_name} (${k.kelas}) tidak sah.` }
    const galat = galatRombelSmp(k.ke, kelas, program, s.gender)
    if (galat) return { error: `${s.full_name}: ${galat}` }
    lanjut.push({ s, ke: k.ke, kelas, program })
  }
  const idLanjut = new Set(lanjut.map(l => l.s.id))
  const alumni = new Set(keputusan.alumni)
  for (const id of alumni) {
    if (akhirPer.get(id)?.jenjang !== 'sma') return { error: 'Ada siswa alumni yang bukan kelas 12 SMA. Muat ulang rencana.' }
  }
  const lulus = akhir.filter(s => s.jenjang !== 'sma' && !idLanjut.has(s.id))
  const alumniBaris = akhir.filter(s => s.jenjang === 'sma' && alumni.has(s.id))
  const tetap = akhir.filter(s => s.jenjang === 'sma' && !alumni.has(s.id))

  // Penanda dipasang LEBIH DULU. Kalau pemasangannya gagal, tidak satu baris
  // pun siswa tersentuh — lebih baik kenaikan tidak jadi berjalan daripada
  // berjalan tanpa penjaga yang menahan pengulangannya.
  const { error: tandaError } = await supabase
    .from('academic_terms')
    .update({ kenaikan_at: new Date().toISOString() })
    .eq('id', termId)
    .is('kenaikan_at', null)

  if (tandaError) {
    return tandaError.message.includes('kenaikan_at')
      ? { error: 'Kenaikan kelas belum aktif: jalankan drizzle/0055_kenaikan_kelas_PASTE_TO_SUPABASE.sql di Supabase.' }
      : { error: 'Gagal menandai tahun ajaran; kenaikan dibatalkan.' }
  }

  const kini = new Date().toISOString()
  const hariIni = tanggalWIB(new Date())
  let gagal = 0

  // Dikelompokkan menurut perubahan yang SAMA, bukan satu update per anak:
  // 694 baris berarti 694 perjalanan ke database, dan putus di tengahnya
  // meninggalkan separuh angkatan naik dan separuh tidak.
  async function perbaruiKelompok(kunci: (x: Record<string, unknown>) => string, baris: { id: string; ubah: Record<string, unknown> }[]) {
    const kelompok = new Map<string, { ubah: Record<string, unknown>; ids: string[] }>()
    for (const b of baris) {
      const k = kunci(b.ubah)
      const g = kelompok.get(k) ?? { ubah: b.ubah, ids: [] }
      g.ids.push(b.id)
      kelompok.set(k, g)
    }
    for (const { ubah, ids } of kelompok.values()) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase.from('students').update({ ...ubah, updated_at: kini }).in('id', ids.slice(i, i + 200))
        if (error) gagal += Math.min(200, ids.length - i)
      }
    }
  }
  const json = (x: Record<string, unknown>) => JSON.stringify(x)

  // QULS Takhassus SD berakhir tahun ini — anaknya naik sebagai CLIL.
  await perbaruiKelompok(json, naik.map(n => {
    const program = n.dari.jenjang === 'sd' ? programNaikSd(n.dari.program) : n.dari.program
    return { id: n.id, ubah: { kelas: n.kelas, ...(program !== n.dari.program ? { program } : {}) } }
  }))

  await perbaruiKelompok(json, lanjut.map(l => ({
    id: l.s.id,
    ubah: {
      jenjang: l.ke,
      kelas: l.kelas,
      program: l.program,
      // Halaqoh milik unit lama — anak ditempatkan ulang oleh koor unit barunya.
      halaqoh_id: null,
      // Lulusan SDIT LHI di SMP menentukan rencana target internal (0070).
      ...(l.s.jenjang === 'sd' && l.ke === 'smp' ? { asal_sd_lhi: true } : {}),
    },
  })))

  await perbaruiKelompok(json, [
    ...lulus.map(s => ({ id: s.id, ubah: { is_active: false, keluar_status: 'lulus', keluar_at: hariIni } })),
    ...alumniBaris.map(s => ({ id: s.id, ubah: { is_active: false, keluar_status: 'alumni', keluar_at: hariIni } })),
  ])

  // Keanggotaan halaqoh unit lama ditutup sebagai riwayat, bukan dihapus.
  await syncHalaqohMemberships(
    supabase,
    lanjut.filter(l => l.s.halaqoh_id).map(l => ({ student_id: l.s.id, ke: null, dari: l.s.halaqoh_id })),
  )
  // Anak asrama SMP yang lanjut ke SMA keluar dari kelompok asramanya (0110).
  for (const l of lanjut.filter(x => x.s.jenjang === 'smp')) {
    await rapikanAnggotaAsrama(l.s.id, { jenjang: l.ke, program: l.program, gender: l.s.gender, is_active: true })
  }

  // Riwayat: kelas & unit LAMA tiap anak — satu-satunya jejak sesudah ditimpa.
  const riwayat = [
    ...naik.map(n => ({ s: n.dari, ke_jenjang: n.dari.jenjang, ke_kelas: n.kelas, hasil: 'naik' })),
    ...lanjut.map(l => ({ s: l.s, ke_jenjang: l.ke, ke_kelas: l.kelas, hasil: 'lanjut' })),
    ...lulus.map(s => ({ s, ke_jenjang: null, ke_kelas: null, hasil: 'lulus' })),
    ...alumniBaris.map(s => ({ s, ke_jenjang: null, ke_kelas: null, hasil: 'alumni' })),
    ...tetap.map(s => ({ s, ke_jenjang: s.jenjang, ke_kelas: s.kelas, hasil: 'tetap' })),
  ].map(r => ({
    term_id: termId, student_id: r.s.id, dari_jenjang: r.s.jenjang, dari_kelas: r.s.kelas,
    ke_jenjang: r.ke_jenjang, ke_kelas: r.ke_kelas, hasil: r.hasil, oleh: session.userId ?? null,
  }))
  for (let i = 0; i < riwayat.length; i += 500) {
    const { error } = await supabase.from('kenaikan_riwayat').insert(riwayat.slice(i, i + 500))
    if (error) console.error('kenaikan_riwayat', error.message)
  }

  revalidatePath('/siswa')
  revalidatePath('/tahun-ajaran')
  revalidatePath('/halaqoh')
  revalidatePath('/asrama')

  return {
    success: true,
    naik: naik.length,
    lanjut: lanjut.length,
    lulus: lulus.length,
    alumni: alumniBaris.length,
    tetap: tetap.length,
    gagal,
  }
}
