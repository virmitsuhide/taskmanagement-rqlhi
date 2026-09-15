import { getSession } from '@/lib/auth/session'
import { getNotifications, type NotificationFeed } from '@/lib/data/notifications'
import { getNotifUjianKoor } from '@/lib/data/ujian-notifikasi'
import { NotificationBell } from './NotificationBell'

const EMPTY: NotificationFeed = { items: [], unseenCount: 0 }

/**
 * Pembungkus server: mengambil data notifikasi lalu menyerahkannya ke komponen
 * klien. Dipisah supaya DashboardHeader tetap sinkron dan bisa dipakai halaman
 * mana pun tanpa ikut memikirkan pengambilan datanya.
 *
 * Kalau query gagal — mis. migrasi 0013 belum dijalankan — lonceng tetap
 * tampil dalam keadaan kosong, bukan menjatuhkan seluruh header.
 */
export async function NotificationBellSlot() {
  const session = await getSession()
  if (!session) return null

  const [feed, ujian] = await Promise.all([
    getNotifications(session.userId, session.role).catch(() => EMPTY),
    getNotifUjianKoor(session.userId, session.role),
  ])

  return (
    <NotificationBell
      items={feed.items}
      unseenCount={feed.unseenCount}
      ujian={ujian.items}
      ujianBaru={ujian.baruCount}
    />
  )
}
