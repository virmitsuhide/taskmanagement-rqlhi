import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canSetujuiLaporanKurikulum, canSusunLaporanKurikulum, canViewLaporanKurikulum } from '@/lib/auth/permissions'
import { getEdisi, getEdisiSebelum, namaPeriode, nomorBab, periodeSah, susunBab } from '@/lib/data/laporan-kurikulum'
import { susunLaporan } from '@/lib/laporan-kurikulum/susun'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PratinjauBab } from '@/components/laporan-kurikulum/PratinjauBab'
import { FormNarasi } from '@/components/laporan-kurikulum/FormNarasi'
import { AksiLaporan } from '@/components/laporan-kurikulum/AksiLaporan'
import { cn } from '@/lib/utils'

const LABEL_STATUS = { draf: 'Draf', diajukan: 'Menunggu persetujuan Kepala RQ', disetujui: 'Disetujui' } as const

export default async function EdisiLaporanPage({ params, searchParams }: {
  params: Promise<{ periode: string }>
  searchParams: Promise<{ tampil?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewLaporanKurikulum(session.role)) redirect('/dashboard')

  const { periode } = await params
  if (!periodeSah(periode)) notFound()
  const [edisi, lalu] = await Promise.all([getEdisi(periode), getEdisiSebelum(periode)])
  if (!edisi) notFound()

  const bisaSusun = canSusunLaporanKurikulum(session.role)
  const bisaSetujui = canSetujuiLaporanKurikulum(session.role)
  const tampil = (await searchParams).tampil === 'narasi' ? 'narasi' : 'pratinjau'
  const model = susunLaporan(edisi.data, edisi.narasi, lalu?.data ?? null)
  const { sub } = susunBab(edisi.data)
  const jam = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title={`Laporan ${namaPeriode(periode)}`} showBack ownH1 />
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8 print:max-w-none print:p-0">
        <header className="space-y-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Laporan Eksekutif BPH · Bab 02</p>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              edisi.status === 'disetujui' ? 'bg-success/10 text-success' : edisi.status === 'diajukan' ? 'bg-accent-warm-wash text-accent-warm' : 'bg-muted text-muted-foreground')}>
              {LABEL_STATUS[edisi.status]}
            </span>
          </div>
          <h1 className="font-heading text-3xl leading-tight">Kurikulum &amp; Pembelajaran Al-Qur&apos;an — {namaPeriode(periode)}</h1>
          <p className="text-xs text-muted-foreground">
            Posisi siswa per {edisi.data.sampai.split('-').reverse().join('-')} · angka dihitung {jam(edisi.dihitung_at)}
            {edisi.disetujui_at && <> · disetujui {jam(edisi.disetujui_at)}</>}
            {lalu ? <> · pembanding: laporan {namaPeriode(lalu.periode)}</> : <> · belum ada laporan bulan lalu sebagai pembanding</>}
          </p>
          {edisi.catatan_kepala && (
            <p className="rounded-xl border border-accent-warm/40 bg-accent-warm-wash p-3 text-sm"><b>Catatan Kepala RQ:</b> {edisi.catatan_kepala}</p>
          )}
          <AksiLaporan periode={periode} status={edisi.status} bisaSusun={bisaSusun} bisaSetujui={bisaSetujui} />
          <nav className="inline-flex gap-0.5 rounded-[10px] bg-muted p-[3px]" aria-label="Tampilan">
            {([['pratinjau', 'Pratinjau'], ['narasi', 'Isi narasi']] as const).map(([k, l]) => (
              <Link key={k} href={k === 'pratinjau' ? `/laporan-kurikulum/${periode}` : `/laporan-kurikulum/${periode}?tampil=narasi`} scroll={false}
                aria-current={tampil === k ? 'page' : undefined}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tampil === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {l}
              </Link>
            ))}
          </nav>
        </header>

        {tampil === 'narasi'
          ? <FormNarasi periode={periode} awal={edisi.narasi} sub={sub} nomorMasalah={nomorBab(edisi.data, '2.9')} bisaUbah={bisaSusun && edisi.status === 'draf'} />
          : <PratinjauBab m={model} />}
      </div>
    </div>
  )
}
