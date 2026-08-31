import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Scale } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewKpiBanding, canDecideKpiBanding } from '@/lib/auth/permissions'
import { getKotakBanding, namaIndikator } from '@/lib/data/kpi-banding'
import { BANDING_STATUS_LABELS, BANDING_TONE, MASA_PUTUSAN_HARI_KERJA, sisaHari } from '@/lib/kpi/alur'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PutusanForm } from './PutusanForm'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ arsip?: string }>
}

/**
 * Kotak masuk banding.
 *
 * Satu halaman untuk dua pemutus. Apa yang bisa ditindak ditentukan oleh
 * tingkat bandingnya — SDM memutus tingkat 1, Kepala RQ tingkat 2 — tapi
 * keduanya MELIHAT semuanya. Kepala RQ khususnya perlu melihat tingkat 1 yang
 * tenggatnya terlewat: itu persoalan yang justru tidak akan dilaporkan oleh
 * pihak yang melewatinya.
 *
 * Koordinator ikut membaca tanpa bisa memutus. Ia menandatangani rapor yang
 * disanggah, jadi ia berhak tahu — tapi menjadikannya hakim atas sanggahan
 * terhadap tanda tangannya sendiri tidak adil bagi kedua belah pihak.
 */
export default async function BandingKpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpiBanding(session.role)) redirect('/kpi')

  const p = await searchParams
  const arsip = p.arsip === '1'

  const rows = await getKotakBanding({ hanyaMenunggu: !arsip })
  const menunggu = rows.filter(r => r.banding.status === 'diajukan')
  const terlambat = menunggu.filter(r => r.terlambat)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Banding Rapor KPI"
        showBack
        ownH1
        breadcrumbs={[{ label: 'KPI Guru', href: '/kpi' }, { label: 'Banding' }]}
      />

      <div className="mx-auto max-w-[1000px] p-4 md:p-6">
        <Link
          href="/kpi"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke KPI bulanan
        </Link>

        <h1 className="text-2xl font-bold leading-tight">Banding Rapor KPI</h1>
        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
          Tingkat 1 diputus SDM (sengketa data), tingkat 2 diputus Kepala RQ (sengketa
          penilaian, final). Tenggat memutus {MASA_PUTUSAN_HARI_KERJA} hari kerja.
        </p>

        {terlambat.length > 0 && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-wash px-3.5 py-2.5 text-sm text-destructive">
            <b className="font-semibold">{terlambat.length} banding melewati tenggat putusan.</b>{' '}
            Guru yang menunggu jawaban tidak bisa menandatangani maupun menaikkan perkaranya
            selama rapornya beku.
          </div>
        )}

        <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1">
          <Link
            href="/kpi/banding"
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              !arsip ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Menunggu putusan ({menunggu.length})
          </Link>
          <Link
            href="/kpi/banding?arsip=1"
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              arsip ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Semua &amp; arsip
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-14 text-center">
            <Scale className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {arsip ? 'Belum ada banding sama sekali' : 'Tidak ada banding yang menunggu'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Guru mengajukan banding dari portalnya, dalam masa 7 hari kerja setelah rapor terbit.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(r => {
              const b = r.banding
              const sisa = sisaHari(b.putusan_batas)
              const bolehPutus = b.status === 'diajukan' && canDecideKpiBanding(session.role, b.tingkat)

              return (
                <li key={b.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{r.fullName}</span>
                        <span className="text-xs text-muted-foreground">{r.periode}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', BANDING_TONE[b.status])}>
                          Tingkat {b.tingkat} · {BANDING_STATUS_LABELS[b.status]}
                        </span>
                        {r.terlambat && (
                          <span className="rounded bg-destructive-wash px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                            Lewat tenggat
                          </span>
                        )}
                      </div>
                      {b.status === 'diajukan' && sisa !== null && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {sisa >= 0 ? `Sisa ${sisa} hari untuk memutus` : `Terlambat ${-sisa} hari`}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/kpi/cetak?teacher=${r.teacherId}&unit=${r.unit}&year=${r.year}&month=${r.month}`}
                      className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Lihat lembar rapornya
                    </Link>
                  </div>

                  <ul className="mt-2.5 space-y-1.5">
                    {b.items.map((it, i) => (
                      <li key={i} className="rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                        <p className="font-medium">
                          {namaIndikator(it.indikator)}
                          {' — '}
                          <span className="tabular-nums text-muted-foreground">
                            tercatat {it.nilaiTercatat}, diklaim {it.nilaiDiklaim}
                          </span>
                        </p>
                        <p className="mt-0.5 text-muted-foreground">{it.alasan}</p>
                      </li>
                    ))}
                  </ul>

                  {b.eskalasi_alasan && (
                    <p className="mt-2 rounded-md border-l-2 border-warning bg-warning-wash/40 px-2.5 py-1.5 text-xs">
                      <span className="font-medium">Keberatan atas putusan tingkat 1: </span>
                      {b.eskalasi_alasan}
                    </p>
                  )}

                  {b.putusan_alasan && (
                    <p className="mt-2 border-l-2 border-primary pl-2.5 text-xs">
                      <span className="font-medium">Putusan: </span>{b.putusan_alasan}
                    </p>
                  )}

                  {bolehPutus && <PutusanForm bandingId={b.id} tingkat={b.tingkat} />}

                  {b.status === 'diajukan' && !bolehPutus && (
                    <p className="mt-2.5 text-xs text-muted-foreground">
                      Menunggu {b.tingkat === 1 ? 'SDM' : 'Kepala RQ'} memutus.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
