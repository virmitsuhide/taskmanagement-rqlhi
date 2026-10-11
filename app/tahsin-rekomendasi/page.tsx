import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageTahsinRekomendasi } from '@/lib/auth/permissions'
import { getKandidatTR, getKelompokTR, getPesertaTR } from '@/lib/data/tahsin-rekomendasi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KelolaTR } from '@/components/tahsin-rekomendasi/KelolaTR'

/**
 * Tahsin Rekomendasi SDIT LHI — kelompok tahsin tambahan Jum'at sore, milik
 * koordinator SD. Di sini kelompok (akun TR bersama) dan pesertanya diatur;
 * kehadiran dan setorannya dicatat pengampu di Portal Guru.
 */
export default async function TahsinRekomendasiPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageTahsinRekomendasi(session.role)) redirect('/dashboard')

  const [kelompok, peserta, kandidat] = await Promise.all([getKelompokTR(), getPesertaTR(), getKandidatTR()])

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Tahsin Rekomendasi" showBack ownH1 />

      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Pembinaan Qur&apos;an · SDIT LHI · Jum&apos;at sore
            </p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">
              Tahsin Rekomendasi —{' '}
              <em>{kelompok ? `${kelompok.length} kelompok, ${peserta.length} siswa.` : 'belum aktif.'}</em>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tahsin tambahan tiap Jum&apos;at sore untuk siswa yang direkomendasikan. Pengampunya bisa wali kelas — mereka masuk
              dengan akun kelompok (TR1, TR2, …), mencatat kehadiran dan setoran tahsin. Setorannya ikut menjadi capaian tahsin
              sekolah anak, jadi guru halaqohnya melanjutkan dari situ.
            </p>
          </div>
          <Link href="/tahsin-rekomendasi/analitik" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-muted">
            <BarChart3 className="h-4 w-4" />Analitik
          </Link>
        </div>

        {kelompok === null ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Tabel Tahsin Rekomendasi belum ada di basis data. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0115_tahsin_rekomendasi_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor lebih dulu.
          </div>
        ) : (
          <KelolaTR kelompok={kelompok} peserta={peserta} kandidat={kandidat} />
        )}
      </div>
    </div>
  )
}
