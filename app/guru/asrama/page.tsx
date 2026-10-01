import { redirect } from 'next/navigation'

/**
 * Dulu halaman tersendiri; sejak menu asrama digabung ke fitur yang sudah ada
 * (Tahsin/Tahfidz Asrama + Progres per Sesi), alamat lama diarahkan ke sana.
 */
export default function AsramaGuruLama() {
  redirect('/guru/setoran/tahfidz/asrama')
}
