import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, FileText } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canSusunLaporanKurikulum, canViewLaporanKurikulum } from '@/lib/auth/permissions'
import { daftarEdisi, namaPeriode } from '@/lib/data/laporan-kurikulum'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop } from '@/components/dashboard/kit'
import { BuatLaporan } from '@/components/laporan-kurikulum/AksiLaporan'
import { cn } from '@/lib/utils'

/** Bulan pertama yang datanya ada di aplikasi (setoran harian mulai berjalan). */
const BULAN_PERTAMA = '2026-09'

const LABEL_STATUS = { draf: 'Draf', diajukan: 'Menunggu persetujuan', disetujui: 'Disetujui' } as const

function daftarBulan(sampai: string): string[] {
  const hasil: string[] = []
  let [y, m] = BULAN_PERTAMA.split('-').map(Number)
  for (let i = 0; i < 60; i++) {
    const p = `${y}-${String(m).padStart(2, '0')}`
    if (p > sampai) break
    hasil.push(p)
    m++; if (m > 12) { m = 1; y++ }
  }
  return hasil.reverse()
}

/**
 * Laporan bulanan Kurikulum & Pembelajaran Al-Qur'an — Bab 02 Laporan
 * Eksekutif BPH. Kumik membuat edisi tiap awal bulan; Kepala RQ menyetujui.
 */
export default async function LaporanKurikulumPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewLaporanKurikulum(session.role)) redirect('/dashboard')

  const edisi = await daftarEdisi()
  const bulanIni = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date())
  const ada = new Set((edisi ?? []).map(e => e.periode))
  const pilihan = daftarBulan(bulanIni).filter(p => !ada.has(p))
    .map(p => ({ periode: p, label: `${namaPeriode(p)}${p === bulanIni ? ' (bulan berjalan)' : ''}` }))
  // Bulan lalu lebih dulu: laporan dibuat awal bulan untuk bulan sebelumnya.
  pilihan.sort((a, b) => (a.periode === bulanIni ? 1 : 0) - (b.periode === bulanIni ? 1 : 0))

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Laporan Kurikulum" ownH1 />
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow="Laporan Eksekutif BPH · Bab 02"
          title="Laporan Kurikulum & Pembelajaran Al-Qur'an"
          context={<>Disusun Kumik tiap awal bulan dari data aplikasi, disetujui Kepala RQ, lalu diunduh sebagai .docx.</>}
          filters={null}
        />

        {edisi === null ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
            Tabel laporan belum ada. Jalankan <code className="text-xs">drizzle/0092_laporan_kurikulum_PASTE_TO_SUPABASE.sql</code> di Supabase.
          </p>
        ) : (
          <>
            {canSusunLaporanKurikulum(session.role) && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold">Buat laporan baru</h2>
                <BuatLaporan pilihan={pilihan} />
              </section>
            )}

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Edisi</h2>
              {edisi.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada laporan. Edisi pertama dari aplikasi: {namaPeriode(BULAN_PERTAMA)}.</p>
              ) : (
                <ul className="divide-y">
                  {edisi.map(e => (
                    <li key={e.id}>
                      <Link href={`/laporan-kurikulum/${e.periode}`} className="flex items-center gap-3 py-3 hover:text-primary">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{namaPeriode(e.periode)}</span>
                          <span className="block text-xs text-muted-foreground">
                            Dihitung {new Date(e.dihitung_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          e.status === 'disetujui' ? 'bg-success/10 text-success' : e.status === 'diajukan' ? 'bg-accent-warm-wash text-accent-warm' : 'bg-muted text-muted-foreground')}>
                          {LABEL_STATUS[e.status]}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
