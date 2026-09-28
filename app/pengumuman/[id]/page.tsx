import { redirect } from 'next/navigation'

/**
 * Tautan pengumuman yang sudah terlanjur dibagikan (mis. ke grup WhatsApp
 * guru) tetap sampai: dialihkan ke halaman yang sama di portal guru, yang
 * sejak 2026-09-29 menjadi satu-satunya tempat membaca pengumuman.
 */
export default async function PengumumanLamaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/guru/pengumuman/${id}`)
}
