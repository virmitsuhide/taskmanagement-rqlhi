import { Info, Megaphone, BellRing, ClipboardList } from 'lucide-react'
import type { PublicPost, PostIcon } from '@/types'

/**
 * Ikon yang bisa dipilih penulis untuk post di beranda.
 *
 * Satu daftar dipakai bersama oleh form /home-post dan papan pengumuman, supaya
 * yang terlihat saat memilih persis sama dengan yang tampil ke publik — dua
 * daftar terpisah pasti menyimpang begitu salah satunya diubah.
 *
 * Di sini hanya gambar dan namanya. Warnanya sengaja tidak ikut: warna di papan
 * pengumuman berasal dari `priority`, dan kalau ikon ikut membawa warna sendiri
 * pembaca akan melihat dua sistem warna bertabrakan pada satu kartu.
 */
export const POST_ICONS: Record<PostIcon, { label: string; icon: typeof Info; hint: string }> = {
  info: {
    label: 'Info',
    icon: Info,
    hint: 'Kabar biasa yang tidak menuntut tindakan.',
  },
  pengumuman: {
    label: 'Pengumuman',
    icon: Megaphone,
    hint: 'Diumumkan ke banyak orang sekaligus.',
  },
  pengingat: {
    label: 'Pengingat',
    icon: BellRing,
    hint: 'Mengingatkan sesuatu yang sudah pernah disampaikan.',
  },
  tugas: {
    label: 'Tugas',
    icon: ClipboardList,
    hint: 'Ada yang harus dikerjakan penerimanya.',
  },
}

/** Urutan tampil di form. Ditulis eksplisit, tidak mengandalkan urutan kunci objek. */
export const POST_ICON_ORDER: PostIcon[] = ['info', 'pengumuman', 'pengingat', 'tugas']

/** Pilihan saat penulis membuat post baru dan belum menyentuh apa pun. */
export const DEFAULT_POST_ICON: PostIcon = 'pengumuman'

/**
 * Ikon sebuah post — pilihan penulis kalau ada, kalau tidak diterka.
 *
 * Post yang dibuat sebelum migrasi 0030 tidak punya `icon`. Untuk post itu
 * jenisnya didahulukan daripada prioritasnya: "tugas guru" adalah pernyataan
 * tentang isi post, sedangkan prioritas hanya soal seberapa mendesak — sebuah
 * tugas tetaplah tugas, baik yang penting maupun yang santai.
 */
export function postIconOf(post: Pick<PublicPost, 'icon' | 'type' | 'priority'>): PostIcon {
  if (post.icon) return post.icon
  if (post.type === 'tugas_guru') return 'tugas'
  return post.priority === 'pengingat' ? 'pengingat'
    : post.priority === 'penting' ? 'pengumuman'
    : 'info'
}
