/**
 * Keanggotaan halaqoh — satu-satunya tempat perpindahan santri dicatat.
 *
 * `students.halaqoh_id` tetap dipertahankan sebagai penunjuk penempatan yang
 * berlaku sekarang: puluhan layar memakainya untuk pertanyaan "halaqoh anak
 * ini apa?", dan menjadikannya JOIN di semua tempat tidak sepadan. Sumber
 * kebenaran RIWAYATNYA ada di `halaqoh_members`, yang disegarkan di sini.
 *
 * Karena halaqoh sendiri milik satu semester (halaqoh.term_id), keanggotaan
 * ini ikut bersemester dengan sendirinya. Jadi setelah pengacakan semester
 * berikutnya, pertanyaan "anak ini di halaqoh mana pada Semester 1" tetap
 * terjawab — dan rapor bulan lampau tetap menyebut ustadz yang benar.
 *
 * Dipakai bersama oleh formulir siswa satuan, pemindahan dari layar halaqoh,
 * dan impor kelompok. Ketiganya WAJIB lewat sini: kalau salah satu menulis
 * langsung ke students.halaqoh_id, riwayatnya bolong tanpa ada yang tahu
 * sampai rapor bulan itu disusun.
 */
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServerClient>

/** Tanggal hari ini menurut waktu lokal server, 'YYYY-MM-DD'. */
export function hariIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Satu perpindahan: santri, halaqoh tujuan, dan halaqoh asalnya. */
export interface Perpindahan {
  student_id: string
  /** null = dikeluarkan dari halaqoh tanpa tujuan baru. */
  ke: string | null
  /** null/undefined = sebelumnya memang belum punya halaqoh. */
  dari?: string | null
}

/** Baris dikirim per potongan agar satu perintah tidak melebihi batas payload. */
const UKURAN_POTONGAN = 100

/**
 * Catat perpindahan halaqoh sebagai riwayat, bukan sekadar mengganti pointer.
 *
 * Menerima banyak baris sekaligus karena impor kelompok memindahkan ratusan
 * santri dalam satu tekan tombol; memanggilnya satu per satu berarti ratusan
 * bolak-balik ke basis data untuk satu operasi yang sama.
 *
 * Tidak menyentuh `students.halaqoh_id` — itu urusan pemanggilnya, yang lebih
 * tahu apakah perubahannya bagian dari INSERT, UPDATE, atau impor massal.
 */
export async function syncHalaqohMemberships(
  supabase: Supabase,
  pindah: Perpindahan[],
  tanggal = hariIni(),
): Promise<void> {
  // Keanggotaan lama ditutup, bukan dihapus: kepindahan di tengah semester
  // adalah fakta yang perlu terbaca saat rapor bulan itu disusun.
  //
  // Ditutup per halaqoh asal, bukan per santri, supaya seluruh anak yang
  // meninggalkan satu kelompok selesai dalam satu perintah — bentuk yang
  // lazim terjadi saat pengacakan semester.
  const keluarDari = new Map<string, string[]>()
  for (const p of pindah) {
    if (!p.dari || p.dari === p.ke) continue
    const daftar = keluarDari.get(p.dari) ?? []
    daftar.push(p.student_id)
    keluarDari.set(p.dari, daftar)
  }
  for (const [halaqohId, siswa] of keluarDari) {
    for (let i = 0; i < siswa.length; i += UKURAN_POTONGAN) {
      await supabase
        .from('halaqoh_members')
        .update({ left_at: tanggal })
        .eq('halaqoh_id', halaqohId)
        .in('student_id', siswa.slice(i, i + UKURAN_POTONGAN))
        .is('left_at', null)
    }
  }

  // Kembali ke halaqoh yang pernah ditinggalkan: buka lagi barisnya alih-alih
  // membuat baris kedua — kunci utamanya sepasang (halaqoh, santri).
  const masuk = pindah
    .filter(p => p.ke && p.ke !== p.dari)
    .map(p => ({ halaqoh_id: p.ke as string, student_id: p.student_id, joined_at: tanggal, left_at: null }))
  for (let i = 0; i < masuk.length; i += UKURAN_POTONGAN) {
    await supabase
      .from('halaqoh_members')
      .upsert(masuk.slice(i, i + UKURAN_POTONGAN), { onConflict: 'halaqoh_id,student_id' })
  }
}

/** Bentuk satuan — pembungkus tipis untuk formulir siswa. */
export async function syncHalaqohMembership(
  supabase: Supabase,
  studentId: string,
  nextHalaqohId: string | null,
  previousHalaqohId?: string | null,
): Promise<void> {
  await syncHalaqohMemberships(supabase, [
    { student_id: studentId, ke: nextHalaqohId, dari: previousHalaqohId ?? null },
  ])
}
