import { createServerClient } from '@/lib/supabase/server'
import { type PeriodKey, periodYear, toPeriodDate } from '@/lib/finance/period'
import type { FinanceData } from '@/lib/finance/report'
import type {
  FinanceAccount, FinanceBudget, FinanceFunding, FinanceProgramPlan,
  FinanceReportNote, FinanceTransaction, FinanceTrustEntry, FinanceTrustFund,
} from '@/types'

/**
 * Pengambilan data keuangan.
 *
 * Laporan bulanan selalu membutuhkan konteks setahun penuh — rekapitulasi
 * (1.6), tren (1.8), dan KPI (1.7) semuanya akumulatif sejak Januari. Karena
 * itu satu fungsi menarik seluruh transaksi tahun berjalan sekali, lalu
 * lib/finance/report.ts mengolahnya berulang untuk tiap bulan. Menarik per
 * bulan berarti dua belas kali perjalanan ke database untuk satu halaman.
 *
 * Volume datanya kecil (ratusan baris setahun), jadi memuat setahun penuh
 * jauh lebih murah daripada agregasi bertingkat di sisi SQL.
 */

export async function getFinanceAccounts(): Promise<FinanceAccount[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('finance_accounts')
      .select('*')
      .order('kind', { ascending: true })
      .order('display_order', { ascending: true })
    return (data ?? []) as FinanceAccount[]
  } catch {
    return []
  }
}

/**
 * Seluruh bahan laporan untuk tahun periode yang diminta.
 *
 * Piutang sengaja diambil tanpa batas tahun: tagihan Desember yang baru cair
 * Januari harus tetap terlihat di daftar piutang, kalau tidak ia hilang dari
 * pantauan persis pada saat paling mudah terlupakan.
 */
export async function getFinanceData(period: PeriodKey): Promise<FinanceData> {
  const empty: FinanceData = {
    accounts: [], transactions: [], budgets: [],
    trustFunds: [], trustEntries: [], programPlans: [],
  }

  try {
    const supabase = createServerClient()
    const year = periodYear(period)
    const from = `${year}-01-01`
    const to = `${year}-12-31`

    const [accounts, transactions, funding, budgets, trustFunds, trustEntries, plans] =
      await Promise.all([
        supabase.from('finance_accounts').select('*')
          .order('kind', { ascending: true }).order('display_order', { ascending: true }),
        // Transaksi tahun ini (menurut kapan dibayar) DITAMBAH semua piutang
        // yang belum tuntas, berapa pun umurnya.
        supabase.from('finance_transactions').select('*')
          .or(`and(paid_at.gte.${from},paid_at.lte.${to}),status.eq.piutang`)
          .order('paid_at', { ascending: true }),
        supabase.from('finance_funding').select('*'),
        supabase.from('finance_budgets').select('*')
          .gte('period', from).lte('period', to),
        supabase.from('finance_trust_funds').select('*')
          .order('display_order', { ascending: true }),
        // Mutasi titipan diambil sejak awal: saldo awal bulan berjalan
        // dihitung dari akumulasi seluruh mutasi sebelumnya.
        supabase.from('finance_trust_entries').select('*')
          .order('entry_date', { ascending: true }),
        supabase.from('finance_program_plans').select('*')
          .order('created_at', { ascending: true }),
      ])

    const fundingRows = (funding.data ?? []) as FinanceFunding[]
    const byTransaction = new Map<string, FinanceFunding[]>()
    for (const row of fundingRows) {
      const list = byTransaction.get(row.transaction_id)
      if (list) list.push(row)
      else byTransaction.set(row.transaction_id, [row])
    }

    const trx = ((transactions.data ?? []) as FinanceTransaction[]).map(t => ({
      ...t,
      funding: byTransaction.get(t.id) ?? [],
    }))

    return {
      accounts: (accounts.data ?? []) as FinanceAccount[],
      transactions: trx,
      budgets: (budgets.data ?? []) as FinanceBudget[],
      trustFunds: (trustFunds.data ?? []) as FinanceTrustFund[],
      trustEntries: (trustEntries.data ?? []) as FinanceTrustEntry[],
      programPlans: (plans.data ?? []) as FinanceProgramPlan[],
    }
  } catch {
    return empty
  }
}

/** Narasi laporan satu periode, dipetakan per bagian agar mudah dibaca UI. */
export async function getFinanceNotes(period: PeriodKey): Promise<Record<string, string>> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('finance_report_notes')
      .select('*')
      .eq('period', toPeriodDate(period))
    const notes = (data ?? []) as FinanceReportNote[]
    return Object.fromEntries(notes.map(n => [n.section, n.content]))
  } catch {
    return {}
  }
}

/**
 * Bulan-bulan yang sudah punya catatan, terbaru dulu — untuk pemilih periode.
 * Selalu menyertakan periode yang sedang dibuka walau masih kosong, supaya
 * bendahara bisa mulai mengisi bulan baru tanpa perlu membuatnya lebih dulu.
 */
export async function getFinancePeriods(current: PeriodKey): Promise<PeriodKey[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('finance_transactions')
      .select('paid_at, period')
      .order('period', { ascending: false })

    const keys = new Set<PeriodKey>([current])
    for (const row of (data ?? []) as { paid_at: string | null; period: string }[]) {
      keys.add((row.paid_at ?? row.period).slice(0, 7))
    }
    return [...keys].sort((a, b) => b.localeCompare(a))
  } catch {
    return [current]
  }
}
