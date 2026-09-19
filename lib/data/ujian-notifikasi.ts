import { createServerClient } from '@/lib/supabase/server'
import { getUjianGuru } from '@/lib/data/ujian'
import { getTahfidzLabel, formatTahsinLevels } from '@/lib/rq/ujian'
import type { TahfidzTipe, UjianSiswa, UjianUnit, UserRole } from '@/types'

/**
 * Notifikasi ujian, diturunkan dari baris ujian itu sendiri (lihat 0063).
 *
 *   • Koordinator unit diberi tahu saat ada PENGAJUAN BARU di unitnya.
 *   • Guru pengaju diberi tahu saat pengajuannya DIJADWALKAN dan SELESAI.
 *
 * Tidak ada tabel notifikasi: peristiwanya dibaca dari created_at,
 * dijadwalkan_at, dan selesai_at. Kalau migrasi 0063 belum dijalankan, kueri
 * yang menyebut kolom barunya gagal dan setiap fungsi di sini menjawab kosong —
 * lonceng tetap tampil, hanya tanpa isi ujian.
 */

/** Rentang yang ditampilkan di lonceng. Yang lebih lama sudah basi. */
const JENDELA_HARI = 30
const BATAS_ITEM = 10

function batasWaktu(): string {
  return new Date(Date.now() - JENDELA_HARI * 24 * 60 * 60 * 1000).toISOString()
}

export type JenisNotifUjian = 'diajukan' | 'dijadwalkan' | 'selesai'

export interface NotifUjian {
  /** Unik per peristiwa: satu ujian bisa menghasilkan dua notifikasi. */
  id: string
  jenis: JenisNotifUjian
  ujian: 'tahfidz' | 'tahsin'
  /** Nama siswa (tahfidz) atau nama kelompok (tahsin). */
  judul: string
  /** Ringkasan singkat, mis. "Tasmi' Juz 29 · Kelas 8A". */
  rincian: string
  waktu: string
  /** Sudah pernah dilihat — mengendalikan titik penanda per baris. */
  dibaca: boolean
}

interface BarisTahfidz {
  id: string; unit: UjianUnit; tipe: TahfidzTipe; juz: string; nama_siswa: string; kelas: string
  status: string; jadwal: string | null; created_at: string
  created_by_teacher: string | null; created_by_user: string | null
  dijadwalkan_at: string | null; selesai_at: string | null
}

/**
 * Ujian selesai TANPA jadwal hanya lahir dari verifikasi riwayat (0078):
 * koordinator menyatakan ujian lama sudah dilaksanakan tanpa tahu tanggalnya.
 * Itu bukan peristiwa baru — tanpa pengecualian ini, memverifikasi tujuh ujian
 * lama seorang anak mengirim tujuh kabar "ujian selesai" ke gurunya hari itu.
 */
function riwayatTanpaTanggal(r: BarisTahfidz): boolean {
  return r.status === 'selesai' && !r.jadwal
}

interface BarisTahsin {
  id: string; unit: UjianUnit; nama_kelompok: string; sesi: string; level: string; siswa: UjianSiswa[]
  status: string; jadwal: string | null; created_at: string
  created_by_teacher: string | null; created_by_user: string | null
  dijadwalkan_at: string | null; selesai_at: string | null
}

const KOLOM_TAHFIDZ =
  'id, unit, tipe, juz, nama_siswa, kelas, status, jadwal, created_at, created_by_teacher, created_by_user, dijadwalkan_at, selesai_at'
const KOLOM_TAHSIN =
  'id, unit, nama_kelompok, sesi, level, siswa, status, jadwal, created_at, created_by_teacher, created_by_user, dijadwalkan_at, selesai_at'

function rincianTahfidz(r: BarisTahfidz): string {
  return `${getTahfidzLabel(r.tipe, r.juz)} · Kelas ${r.kelas}`
}

function rincianTahsin(r: BarisTahsin): string {
  return `${formatTahsinLevels(r)} · ${r.siswa.length} siswa · Sesi ${r.sesi}`
}

// ─── Guru ────────────────────────────────────────────────────────────────────

export interface NotifUjianGuru {
  items: NotifUjian[]
  /** Peristiwa sesudah terakhir kali guru membuka pengajuan/berandanya. */
  baruCount: number
}

/**
 * Kabar untuk guru: ujian yang menyangkut dirinya dijadwalkan atau selesai.
 *
 * "Menyangkut" mengikuti getUjianGuru — pengajuannya sendiri ATAU ujian anak
 * halaqohnya yang diajukan koordinator. Guru tetap perlu tahu anaknya
 * terjadwal walau pengajuannya tidak lewat dirinya.
 */
export async function getNotifUjianGuru(teacherId: string): Promise<NotifUjianGuru> {
  const kosong: NotifUjianGuru = { items: [], baruCount: 0 }
  try {
    const supabase = createServerClient()
    const sejak = batasWaktu()

    const [guru, ujian] = await Promise.all([
      supabase.from('teachers').select('ujian_notif_seen_at').eq('id', teacherId).maybeSingle(),
      getUjianGuru(teacherId),
    ])
    // Kolom penanda belum ada = migrasi 0063 belum jalan; cap waktunya pun
    // belum ada, jadi tidak ada yang bisa diberitahukan.
    if (guru.error) return kosong

    const seenAt = (guru.data?.ujian_notif_seen_at as string | null | undefined) ?? null
    const items: NotifUjian[] = []

    const tambah = (
      ujian: 'tahfidz' | 'tahsin', id: string, judul: string, rincian: string,
      dijadwalkanAt: string | null, selesaiAt: string | null,
    ) => {
      if (selesaiAt && selesaiAt >= sejak) {
        items.push({ id: `${ujian}:${id}:selesai`, jenis: 'selesai', ujian, judul, rincian, waktu: selesaiAt, dibaca: false })
      }
      // Jadwal yang sudah terlewati oleh "selesai" tidak perlu diberitahukan
      // lagi — kabar hasilnya sudah mencakup kabar jadwalnya.
      if (dijadwalkanAt && dijadwalkanAt >= sejak && !selesaiAt) {
        items.push({ id: `${ujian}:${id}:dijadwalkan`, jenis: 'dijadwalkan', ujian, judul, rincian, waktu: dijadwalkanAt, dibaca: false })
      }
    }

    const milik = new Set(ujian.idSiswa)
    for (const r of ujian.tahfidz as unknown as BarisTahfidz[]) {
      if (riwayatTanpaTanggal(r)) continue
      tambah('tahfidz', r.id, r.nama_siswa, rincianTahfidz(r), r.dijadwalkan_at ?? null, r.selesai_at ?? null)
    }
    for (const r of ujian.tahsin as unknown as BarisTahsin[]) {
      // Pada kelompok yang diajukan orang lain, sebut anak-anaknya sendiri —
      // nama kelompok ustadz lain tidak memberi tahu guru ini apa pun.
      const anakSaya = r.siswa.filter(s => s.student_id && milik.has(s.student_id)).map(s => s.nama)
      const judul = r.created_by_teacher === teacherId || anakSaya.length === 0
        ? r.nama_kelompok
        : anakSaya.join(', ')
      tambah('tahsin', r.id, judul, rincianTahsin(r), r.dijadwalkan_at ?? null, r.selesai_at ?? null)
    }

    items.sort((a, b) => b.waktu.localeCompare(a.waktu))
    for (const it of items) it.dibaca = seenAt !== null && it.waktu <= seenAt

    return {
      items: items.slice(0, BATAS_ITEM),
      baruCount: items.filter(i => !i.dibaca).length,
    }
  } catch {
    return kosong
  }
}

// ─── Koordinator unit ────────────────────────────────────────────────────────

/**
 * Role yang menerima kabar pengajuan baru, beserta unitnya.
 *
 * Sengaja hanya koordinator unit — merekalah yang menjadwalkan. Kepala RQ,
 * Kumik, dan BPA/BPI memang boleh mengelola antrian, tapi memberi tahu semua
 * yang berwenang berarti setiap pengajuan membunyikan lima lonceng untuk satu
 * pekerjaan yang cukup dikerjakan satu orang.
 */
const PENERIMA_PENGAJUAN: Partial<Record<UserRole, UjianUnit>> = {
  koor_sd: 'SD',
  koor_smp: 'SMP',
}

export interface NotifUjianKoor {
  items: NotifUjian[]
  /** Pengajuan sesudah lonceng terakhir dibuka — ikut angka merah lonceng. */
  baruCount: number
}

export async function getNotifUjianKoor(userId: string, role: UserRole): Promise<NotifUjianKoor> {
  const kosong: NotifUjianKoor = { items: [], baruCount: 0 }
  const unit = PENERIMA_PENGAJUAN[role]
  if (!unit) return kosong

  try {
    const supabase = createServerClient()
    const sejak = batasWaktu()

    const [user, tahfidz, tahsin] = await Promise.all([
      supabase.from('users').select('notifications_seen_at, ujian_seen_at').eq('id', userId).maybeSingle(),
      supabase.from('ujian_tahfidz').select(KOLOM_TAHFIDZ)
        .eq('unit', unit).gte('created_at', sejak).order('created_at', { ascending: false }).limit(BATAS_ITEM),
      supabase.from('ujian_tahsin').select(KOLOM_TAHSIN)
        .eq('unit', unit).gte('created_at', sejak).order('created_at', { ascending: false }).limit(BATAS_ITEM),
    ])
    if (tahfidz.error || tahsin.error) return kosong

    const loncengDibuka = (user.data?.notifications_seen_at as string | null | undefined) ?? null
    // Titik penanda padam begitu halaman kelola dibuka — di sanalah pengajuan
    // benar-benar ditindaklanjuti, bukan saat loncengnya dilirik.
    const kelolaDibuka = (user.data?.ujian_seen_at as string | null | undefined) ?? null

    const items: NotifUjian[] = []
    for (const r of (tahfidz.data ?? []) as unknown as BarisTahfidz[]) {
      if (r.created_by_user === userId || riwayatTanpaTanggal(r)) continue
      items.push({
        id: `tahfidz:${r.id}:diajukan`, jenis: 'diajukan', ujian: 'tahfidz',
        judul: r.nama_siswa, rincian: rincianTahfidz(r), waktu: r.created_at,
        dibaca: r.status !== 'diajukan' || (kelolaDibuka !== null && r.created_at <= kelolaDibuka),
      })
    }
    for (const r of (tahsin.data ?? []) as unknown as BarisTahsin[]) {
      if (r.created_by_user === userId) continue
      items.push({
        id: `tahsin:${r.id}:diajukan`, jenis: 'diajukan', ujian: 'tahsin',
        judul: r.nama_kelompok, rincian: rincianTahsin(r), waktu: r.created_at,
        dibaca: r.status !== 'diajukan' || (kelolaDibuka !== null && r.created_at <= kelolaDibuka),
      })
    }

    items.sort((a, b) => b.waktu.localeCompare(a.waktu))
    const tampil = items.slice(0, BATAS_ITEM)
    return {
      items: tampil,
      // Yang sudah dijadwalkan orang lain tidak lagi perlu membunyikan lonceng.
      baruCount: tampil.filter(i => !i.dibaca && (!loncengDibuka || i.waktu > loncengDibuka)).length,
    }
  } catch {
    return kosong
  }
}
