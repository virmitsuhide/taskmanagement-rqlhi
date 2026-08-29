import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getPengajuanGuru, getUnitUjianGuru } from '@/lib/data/ujian'
import { Button } from '@/components/ui/button'
import { PengajuanGuru } from '@/components/ujian/PengajuanGuru'

export default async function UjianGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const [unit, { tahfidz, tahsin }] = await Promise.all([
    getUnitUjianGuru(session.teacherId),
    getPengajuanGuru(session.teacherId),
  ])

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Pengajuan Ujian
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unit
                ? `Unit ${unit} · pengajuan Anda beserta jadwal dan hasilnya.`
                : 'Ajukan ujian tahsin & tahfidz untuk santri Anda.'}
            </p>
          </div>
          {unit && (
            <Button asChild size="lg">
              <Link href="/guru/ujian/baru"><Plus className="mr-1 h-4 w-4" />Ajukan ujian</Link>
            </Button>
          )}
        </div>

        {/* Antrian ujian hanya berjalan di SDIT & SMPIT. Guru unit lain
            diberi tahu alasannya, bukan sekadar disodori halaman kosong. */}
        {!unit ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Akun Anda belum terhubung ke unit SD atau SMP</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground">
              Pengajuan ujian tahsin &amp; tahfidz baru berjalan di SDIT dan SMPIT LHI, dan
              dijadwalkan oleh koordinator masing-masing unit. Hubungi koordinator bila unit
              pada akun Anda perlu diperbarui.
            </p>
          </div>
        ) : (
          <PengajuanGuru tahfidz={tahfidz} tahsin={tahsin} />
        )}
      </div>
    </div>
  )
}
