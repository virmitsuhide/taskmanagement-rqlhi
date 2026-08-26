import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AntrianUjian } from '@/components/ujian/AntrianUjian'
import { UjianTabPublik } from '@/components/ujian/UjianTabPublik'
import { getAntrianUjian } from '@/lib/data/ujian'
import { getSession } from '@/lib/auth/session'
import { canViewUjian } from '@/lib/auth/permissions'
import { Settings2 } from 'lucide-react'

export const metadata: Metadata = {
  title: "Antrian Ujian — Rumah Qur'an LHI",
  description: 'Antrian ujian tahsin & tahfidz SDIT dan SMPIT LHI yang sedang berjalan.',
}

export default async function AntrianUjianPage() {
  const [{ tahfidz, tahsin }, session] = await Promise.all([getAntrianUjian(), getSession()])
  const total = tahfidz.length + tahsin.length
  const bolehKelola = Boolean(session && canViewUjian(session.role))

  return (
    <div>
      <PublicHeader />

      <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-[50vh]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold leading-tight">Ujian Tahsin &amp; Tahfidz</h1>
              <Badge variant="success">{total} antrian aktif</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pengajuan yang menunggu jadwal maupun sudah dijadwalkan, unit SDIT &amp; SMPIT LHI
            </p>
          </div>
          {bolehKelola && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/ujian/kelola">
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Kelola Pengajuan
              </Link>
            </Button>
          )}
        </div>

        <UjianTabPublik aktif="antrian" />

        <div className="pb-10">
          <AntrianUjian tahfidz={tahfidz} tahsin={tahsin} />
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
