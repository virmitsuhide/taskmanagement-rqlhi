import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getUjianGuru, getUnitUjianGuru } from '@/lib/data/ujian'
import { Button } from '@/components/ui/button'
import { PengajuanGuru } from '@/components/ujian/PengajuanGuru'
import { getNotifUjianGuru } from '@/lib/data/ujian-notifikasi'
import { TandaiUjianGuruDilihat } from '@/components/guru/TandaiUjianGuruDilihat'
import { HalamanGuru } from '@/components/guru/HalamanGuru'

export default async function UjianGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const [unit, { tahfidz, tahsin }, notif] = await Promise.all([
    getUnitUjianGuru(session.teacherId),
    getUjianGuru(session.teacherId),
    getNotifUjianGuru(session.teacherId),
  ])

  return (
    <HalamanGuru
      judul="Pengajuan Ujian"
      keterangan={unit
        ? `Unit ${unit} · pengajuan Anda beserta jadwal dan hasilnya.`
        : 'Ajukan ujian tahsin & tahfidz untuk siswa Anda.'}
      aksi={unit && (
        <Button asChild>
          <Link href="/guru/ujian/baru"><Plus className="mr-1 h-4 w-4" />Ajukan ujian</Link>
        </Button>
      )}
    >
        <TandaiUjianGuruDilihat aktif={notif.baruCount > 0} />

        {/* Antrian ujian hanya berjalan di SDIT & SMPIT. Guru unit lain
            diberi tahu alasannya, bukan sekadar disodori halaman kosong. */}
        {!unit ? (
          <div className="rounded-2xl border border-dashed p-6 text-center bg-muted/30">
            <p className="text-sm font-medium">Akun Anda belum terhubung ke unit SD atau SMP</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground">
              Pengajuan ujian tahsin &amp; tahfidz baru berjalan di SDIT dan SMPIT LHI, dan
              dijadwalkan oleh koordinator masing-masing unit. Hubungi koordinator bila unit
              pada akun Anda perlu diperbarui.
            </p>
          </div>
        ) : (
          <PengajuanGuru teacherId={session.teacherId} tahfidz={tahfidz} tahsin={tahsin} />
        )}
    </HalamanGuru>
  )
}
