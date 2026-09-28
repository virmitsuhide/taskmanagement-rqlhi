import { redirect } from 'next/navigation'

/**
 * Daftar pengumuman publik dicabut (2026-09-29): pengumuman guru Qur'an kini
 * hanya dibaca di dashboard guru. Alamat lamanya dialihkan ke sana — guru
 * yang belum login diminta login dulu oleh portalnya.
 */
export default function PengumumanLamaPage() {
  redirect('/guru')
}
