import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData, getFinanceNotes } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { IsianBulanan, type NilaiIsian, type PosIsian } from '@/components/keuangan/IsianBulanan'
import { periodeLaporanBawaan, formatPeriod, isValidPeriod, toPeriodKey } from '@/lib/finance/period'
import { buildPiutangBulan, monthlyTotals } from '@/lib/finance/report'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Isian Bulanan — pengganti pencatatan per transaksi. Bendahara mengisi
 * total akhir bulan per pos; seluruh tabel, diagram, KPI, dan draf narasi
 * Laporan BPH disusun dari isian ini.
 */
export default async function IsianPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : periodeLaporanBawaan()
  const [data, notes] = await Promise.all([getFinanceData(period), getFinanceNotes(period)])

  const m = monthlyTotals(data, period)
  const piutang = buildPiutangBulan(data, period)
  const pos: PosIsian[] = data.accounts
    .filter(a => a.is_active)
    .sort((a, b) => (a.kind === b.kind ? a.display_order - b.display_order : a.kind === 'pemasukan' ? -1 : 1))
    .map(a => ({ kind: a.kind, slug: a.slug, name: a.name, hint: a.hint }))
  const awal: Record<string, NilaiIsian> = Object.fromEntries(pos.map(p => {
    const k = `${p.kind}_${p.slug}`
    return [k, {
      jumlah: (p.kind === 'pemasukan' ? m.pemasukan : m.pengeluaran)[p.slug] ?? 0,
      piutang: p.kind === 'pemasukan' ? piutang[p.slug]?.amount ?? 0 : 0,
      ket: notes[`ket_${k}`] ?? '',
    }]
  }))
  const anggaran: Record<string, number> = {}
  for (const b of data.budgets) {
    if (toPeriodKey(b.period) !== period) continue
    const a = data.accounts.find(x => x.id === b.account_id)
    if (a) anggaran[`${a.kind}_${a.slug}`] = b.amount
  }

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Isian Bulanan"
        breadcrumbs={[{ label: 'Keuangan', href: `/keuangan?periode=${period}` }, { label: 'Isian Bulanan' }]}
        showBack
        ownH1
      />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Keuangan · isian akhir bulan</p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">Isian <em>{formatPeriod(period)}</em></h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Isi total yang diterima dan dibayar bulan ini per pos. Laporan BPH — tabel, diagram, KPI, dan draf
              analisisnya — disusun otomatis dari isian ini.{' '}
              <Link href={`/keuangan/laporan?periode=${period}`} className="font-semibold text-primary hover:underline">Lihat laporan</Link>
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>
        <FinanceNav period={period} />
        <IsianBulanan
          period={period}
          namaBulan={formatPeriod(period)}
          pos={pos}
          awal={awal}
          anggaran={anggaran}
          canManage={canManageFinance(session.role)}
        />
        <p className="text-xs text-muted-foreground">
          Dana titipan, anggaran, dan rencana program diisi di tab masing-masing. Sumber dana tiap pengeluaran (tabel
          1.5.3) dihitung otomatis: tiap unit membiayai gaji OS-nya, kekurangan ditutup sisa unit lain, sisa unit
          membiayai Gaji YYS, lalu Subsidi Yayasan menutup kekurangannya.
        </p>
      </div>
    </div>
  )
}
