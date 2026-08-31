import { createServerClient } from '@/lib/supabase/server'
import type { Jenjang, PublicPost, PublicTarget } from '@/types'

/**
 * Pengumuman yang ditujukan kepada seorang guru Qur'an.
 *
 * Sumbernya public_posts — papan yang sama yang tampil di beranda publik,
 * bukan saluran baru. Pengumuman yang sudah ditulis Kepala RQ atau Humas
 * dengan sendirinya sampai ke portal guru; kalau dibuatkan tabel sendiri,
 * setiap pengumuman harus ditulis dua kali dan cepat atau lambat yang satu
 * akan tertinggal dari yang lain.
 */

/**
 * Sasaran mana yang mengena untuk guru di unit tertentu.
 *
 * sd_juara ikut dalam sasaran 'sd': SD LHI Juara adalah unit SD, dan
 * pengumuman untuk guru SD memang menyangkut mereka juga. PAUD & SMA belum
 * punya sasarannya sendiri di publicTargetEnum, jadi keduanya hanya menerima
 * pengumuman umum — lebih baik daripada menyelipkannya ke 'sd' atau 'smp' dan
 * mengirimi mereka kabar yang bukan urusannya.
 */
export function sasaranUntukUnit(unit: Jenjang | null): PublicTarget[] {
  if (unit === 'sd' || unit === 'sd_juara') return ['all', 'sd']
  if (unit === 'smp') return ['all', 'smp']
  return ['all']
}

export interface PengumumanGuru {
  items: PublicPost[]
  /** Yang terbit setelah guru terakhir membuka beranda. */
  barusanCount: number
}

const KOSONG: PengumumanGuru = { items: [], barusanCount: 0 }

/**
 * Pengumuman aktif untuk satu guru, terbaru di atas.
 *
 * `seenAt` null (belum pernah membuka beranda) membuat semuanya terhitung
 * baru — itu memang keadaan yang sebenarnya bagi guru yang baru pertama masuk.
 */
export async function getPengumumanGuru(
  unit: Jenjang | null,
  seenAt: string | null,
  batas = 5,
): Promise<PengumumanGuru> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('public_posts')
      .select('*, creator:users!created_by(id, display_name, role)')
      .eq('is_active', true)
      .in('target', sasaranUntukUnit(unit))
      .order('created_at', { ascending: false })
      .limit(batas)

    if (error || !data) return KOSONG

    const items = data as PublicPost[]
    const ambang = seenAt ? new Date(seenAt).getTime() : 0
    return {
      items,
      barusanCount: items.filter(p => new Date(p.created_at).getTime() > ambang).length,
    }
  } catch {
    // Pengumuman adalah pelengkap beranda, bukan isinya. Kalau kuerinya gagal
    // — mis. kolom 0049 belum ada — berandanya tetap tampil utuh tanpa kartu
    // pengumuman, bukan jatuh seluruhnya.
    return KOSONG
  }
}

/** Unit & penanda terbaca seorang guru, untuk menyaring pengumumannya. */
export async function getKonteksPengumuman(
  teacherId: string,
): Promise<{ unit: Jenjang | null; seenAt: string | null }> {
  const supabase = createServerClient()

  const penuh = await supabase
    .from('teachers')
    .select('unit, announcements_seen_at')
    .eq('id', teacherId)
    .maybeSingle()

  if (penuh.data) {
    const row = penuh.data as { unit: Jenjang | null; announcements_seen_at: string | null }
    return { unit: row.unit, seenAt: row.announcements_seen_at }
  }

  // Migrasi 0049 belum jalan: unitnya tetap dibaca supaya penyaringan sasaran
  // sudah benar, hanya lencana "baru"-nya yang belum bisa padam.
  const dasar = await supabase.from('teachers').select('unit').eq('id', teacherId).maybeSingle()
  return { unit: (dasar.data as { unit: Jenjang | null } | null)?.unit ?? null, seenAt: null }
}
