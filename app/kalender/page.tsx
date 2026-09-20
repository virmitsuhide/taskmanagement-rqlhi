import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageKaldik } from '@/lib/auth/permissions'
import { getKaldikTahun, KALDIK_UNIT, type KaldikUnit } from '@/lib/data/kaldik'
import { tanggalWIB } from '@/lib/rq/ujian'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KelolaKaldik } from '@/components/kalender/KelolaKaldik'

interface PageProps {
  searchParams: Promise<{ bulan?: string }>
}

/**
 * Kalender pendidikan — satu alamat untuk seluruh agenda sekolah.
 *
 * Menggantikan aplikasi kaldikrqlhi yang berdiri sendiri (0085). Agenda di
 * sini dibaca beranda publik dan menjadi usulan hari kosong di Kalender
 * Qur'an, jadi satu perubahan di halaman ini terbaca di keduanya seketika —
 * bukan setelah singgahan lima menit seperti saat ia masih dipanggil lewat
 * HTTP dari aplikasi lain.
 */
export default async function KalenderPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const hariIni = tanggalWIB(new Date())
  const bulanKode = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') ? sp.bulan! : hariIni.slice(0, 7)
  const tahun = Number(bulanKode.slice(0, 4))
  const bulan = Number(bulanKode.slice(5, 7))

  const { tabelAda, events } = await getKaldikTahun(tahun)
  const unitBoleh = KALDIK_UNIT.filter(u => canManageKaldik(session.role, u)) as KaldikUnit[]

  const geser = (n: number) => {
    const d = new Date(Date.UTC(tahun, bulan - 1 + n, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Kalender Pendidikan" showBack ownH1 />

      <div className="max-w-3xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Kalender Pendidikan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Agenda dan hari libur sekolah. Tampil di beranda publik, dan menjadi usulan hari kosong di Kalender
            Qur&apos;an.
          </p>
        </div>

        {!tabelAda && (
          <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            Tabel agenda belum ada di basis data, jadi yang tampil masih dibaca dari aplikasi kaldik lama dan belum
            bisa disunting di sini. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0085_kaldik_events_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <Link href={`/kalender?bulan=${geser(-1)}`} className="rounded-lg border bg-card px-2 py-1.5 hover:bg-accent" aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={`/kalender?bulan=${geser(1)}`} className="rounded-lg border bg-card px-2 py-1.5 hover:bg-accent" aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" />
          </Link>
          {bulanKode !== hariIni.slice(0, 7) && (
            <Link href="/kalender" className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              Bulan ini
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {events.length} agenda sepanjang {tahun}
          </span>
        </div>

        <KelolaKaldik
          key={bulanKode}
          tahun={tahun}
          bulan={bulan}
          events={events}
          unitBoleh={tabelAda ? unitBoleh : []}
        />
      </div>
    </div>
  )
}
