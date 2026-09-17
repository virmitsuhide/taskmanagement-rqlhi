import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { KonfirmasiRutin, UserRole } from '@/types'

/**
 * Aturan tugas rutin bersama — murni, tanpa basis data (lihat drizzle/0073).
 */

/** Paling banyak rekan dalam satu tugas rutin. Lebih dari itu biasanya rapat, bukan tugas. */
export const MAX_ANGGOTA = 5

export interface PengurusMention {
  userId: string
  role: UserRole
  nama: string
  /** Yang diketik setelah "@". Unik di antara seluruh pengurus. */
  label: string
}

/**
 * Label @ untuk tiap pengurus: nama jabatannya.
 *
 * Satu jabatan yang dipegang dua orang diberi nama depan di belakangnya —
 * "@SDM (Rina)" — karena label harus menunjuk tepat satu orang: undangan dan
 * konfirmasi selesai adalah urusan orangnya, bukan jabatannya.
 */
export function labelPengurus(users: { id: string; role: UserRole; display_name: string }[]): PengurusMention[] {
  const perJabatan = new Map<UserRole, number>()
  for (const u of users) perJabatan.set(u.role, (perJabatan.get(u.role) ?? 0) + 1)
  return users.map(u => {
    const jabatan = ROLE_LABELS[u.role] ?? u.role
    const depan = u.display_name.trim().split(/\s+/)[0] ?? u.display_name
    return {
      userId: u.id, role: u.role, nama: u.display_name,
      label: (perJabatan.get(u.role) ?? 0) > 1 ? `${jabatan} (${depan})` : jabatan,
    }
  })
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Pengurus yang disebut dengan "@label" di dalam teks.
 *
 * Label dicocokkan utuh dan tidak boleh langsung disambung huruf/angka:
 * "@Koor SD" tidak ikut cocok di dalam "@Koor SDM…". Label terpanjang diuji
 * lebih dulu supaya "@Koor QULS SD" tidak terbaca sebagai sesuatu yang lebih
 * pendek. Huruf besar-kecil diabaikan — orang mengetik "@sdm".
 */
export function pengurusDisebut(teks: string, kandidat: PengurusMention[]): PengurusMention[] {
  const hasil: PengurusMention[] = []
  let sisa = teks
  for (const p of [...kandidat].sort((a, b) => b.label.length - a.label.length)) {
    const re = new RegExp(`@${escapeRegex(p.label)}(?![\\p{L}\\p{N}])`, 'giu')
    if (re.test(sisa)) {
      hasil.push(p)
      // Bagian yang sudah cocok dihapus supaya label pendek tidak menumpang
      // pada sebutan label panjang yang sama.
      sisa = sisa.replace(re, ' ')
    }
  }
  return hasil
}

/**
 * Status konfirmasi sebuah laporan terlaksana.
 *
 * @param peserta  pemilik + anggota yang sudah menerima
 * @param pelapor  yang melapor terlaksana — tidak perlu mengonfirmasi dirinya
 * @param keputusan keputusan yang sudah masuk
 *
 * Satu penolakan cukup untuk 'ditolak'; 'selesai' butuh persetujuan SEMUA
 * rekan. Tugas yang tinggal pelapor sendirian (rekannya keluar) langsung
 * selesai — tidak ada lagi yang bisa ditunggu.
 */
export function statusKonfirmasi(
  peserta: string[],
  pelapor: string,
  keputusan: { userId: string; keputusan: 'setuju' | 'tolak' }[],
): KonfirmasiRutin {
  const wajib = [...new Set(peserta)].filter(p => p !== pelapor)
  if (wajib.length === 0) return 'selesai'
  const peta = new Map(keputusan.map(k => [k.userId, k.keputusan]))
  if (wajib.some(u => peta.get(u) === 'tolak')) return 'ditolak'
  return wajib.every(u => peta.get(u) === 'setuju') ? 'selesai' : 'menunggu'
}
