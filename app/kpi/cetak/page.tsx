import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canPrintKpiRapor } from '@/lib/auth/permissions'
import { getKpiRapor } from '@/lib/data/kpi-rapor'
import { KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KpiRaporSheet } from '@/components/kpi/KpiRaporSheet'
import { KpiPrintButton } from '@/components/kpi/KpiPrintButton'
import { Button } from '@/components/ui/button'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ teacher?: string; unit?: string; year?: string; month?: string }>
}

/**
 * Pratinjau & cetak rapor KPI bulanan seorang guru.
 *
 * Khusus SDM (canPrintKpiRapor). Halaman ini menghasilkan dokumen yang keluar
 * dari lingkaran pengurus dan diserahkan kepada guru dengan kolom tanda
 * tangan — lebih sempit daripada halaman pemantauan KPI biasa.
 *
 * Seluruh chrome aplikasi (sidebar, header, tombol) memakai print:hidden,
 * sehingga yang keluar dari mesin cetak hanya lembar rapornya sendiri.
 */
export default async function CetakKpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPrintKpiRapor(session.role)) redirect('/kpi')

  const p = await searchParams
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const now = new Date()
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) || now.getMonth() + 1
  const kembali = `/kpi?unit=${unit}&year=${year}&month=${month}`

  if (!p.teacher) redirect(kembali)

  const rapor = await getKpiRapor(p.teacher, unit, year, month)

  return (
    <div>
      <div className="print:hidden">
        <DashboardHeader
          displayName={session.displayName}
          role={session.role}
          title="Cetak Rapor KPI"
          showBack
          ownH1
          breadcrumbs={[{ label: 'KPI Bulanan', href: kembali }, { label: 'Cetak Rapor' }]}
        />
      </div>

      <div className="bg-muted/50 p-4 dark:bg-background md:p-6 print:bg-white print:p-0">
        <div className="mx-auto max-w-[860px]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
            <div>
              <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
                <Link href={kembali}>
                  <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke KPI bulanan
                </Link>
              </Button>
              <h1 className="text-2xl font-bold leading-tight">Rapor KPI Bulanan</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {MONTH_NAMES[month - 1]} {year} · {KPI_UNITS.find(u => u.key === unit)?.label}
                {rapor && <> · {rapor.teacher.fullName}</>}
              </p>
            </div>
            {rapor && <KpiPrintButton nama={rapor.teacher.fullName} />}
          </div>

          {rapor === null ? (
            <div className="rounded-xl border border-dashed bg-card py-14 text-center print:hidden">
              <p className="text-sm font-medium">Rapor belum bisa dicetak</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Guru ini belum dinilai untuk {MONTH_NAMES[month - 1]} {year} di unit tersebut.
                Isi dulu KPI bulanannya — rapor tanpa nilai bukan dokumen yang layak
                diserahkan.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href={kembali}>Kembali ke daftar KPI</Link>
              </Button>
            </div>
          ) : (
            <>
              <KpiRaporSheet rapor={rapor} terbit={new Date()} />

              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground print:hidden">
                <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tombol <b className="text-foreground">Unduh PDF</b> membuka dialog cetak —
                pilih tujuan <b className="text-foreground">&ldquo;Simpan sebagai PDF&rdquo;</b>.
                Hasilnya satu halaman A4 dengan teks vektor yang tetap tajam saat dicetak,
                dan tata letaknya sama persis dengan yang terlihat di sini.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
