/**
 * Mesin laporan keuangan — mengubah transaksi mentah menjadi seluruh tabel
 * bab 01 Laporan Keuangan (1.1 s.d. 2.1) yang selama ini disusun manual.
 *
 * Aturan tunggal yang mengikat semuanya: sebuah transaksi masuk hitungan
 * bulan M kalau statusnya 'lunas' DAN paid_at-nya jatuh di bulan M. Bulan
 * asal tagihan (period) hanya dipakai untuk melacak piutang. Ini menirukan
 * praktik yang sudah berjalan — MoU SMP Februari–Maret yang baru cair April
 * dilaporkan sebagai pemasukan April.
 *
 * Semua fungsi di sini murni: masuk data, keluar angka. Tidak ada query di
 * dalamnya supaya rekap year-to-date cukup sekali ambil data lalu diolah
 * berulang untuk tiap bulan, bukan 12 kali pergi ke database.
 */

import type {
  FinanceAccount, FinanceBudget, FinanceProgramPlan, FinanceTransaction,
  FinanceTrustEntry, FinanceTrustFund,
} from '@/types'
import { type PeriodKey, percentOf, percentOf1, periodsYearToDate, toPeriodKey } from './period'

/**
 * Pos pemasukan yang uangnya berasal dari Yayasan. Sisanya dihitung sebagai
 * pendapatan mandiri — dasar KPI rasio kemandirian di bab 1.7.
 */
export const YAYASAN_SLUGS = ['subsidi_yayasan', 'proposal_yayasan'] as const

/** Satu baris tabel Pemasukan (1.2) atau Pengeluaran (1.3). */
export interface ReportRow {
  slug: string
  name: string
  amount: number
  percent: number
  /** Keterangan yang dirangkai otomatis dari tiap transaksi di pos ini. */
  details: string[]
}

export interface TrustFundReport {
  slug: string
  name: string
  opening: number
  entries: FinanceTrustEntry[]
  closing: number
}

/** Satu baris tabel Anggaran vs Realisasi (1.5). */
export interface BudgetRow {
  slug: string
  name: string
  budget: number
  actual: number
  /** Realisasi terhadap anggaran. 0% saat anggaran belum diisi. */
  percent: number
  /** Alokasi dana sumber, hanya untuk pengeluaran: slug pos pemasukan → nominal. */
  funding: Record<string, number>
  /** Bagian realisasi yang belum ditandai sumber dananya. */
  unallocated: number
}

/** Satu kolom bulan di Rekapitulasi (1.6) dan Tren Bulanan (1.8). */
export interface MonthlyTotals {
  period: PeriodKey
  income: number
  expense: number
  mandiri: number
  subsidi: number
  subsidiPercent: number
}

export interface Receivable {
  transaction: FinanceTransaction
  accountName: string
}

/** Sumber data mentah untuk seluruh perhitungan di modul ini. */
export interface FinanceData {
  accounts: FinanceAccount[]
  transactions: FinanceTransaction[]
  budgets: FinanceBudget[]
  trustFunds: FinanceTrustFund[]
  trustEntries: FinanceTrustEntry[]
  programPlans: FinanceProgramPlan[]
}

// ── Penyaring dasar ──────────────────────────────────────────────────────────

/** Transaksi yang uangnya benar-benar berpindah pada bulan tersebut. */
export function settledIn(transactions: FinanceTransaction[], period: PeriodKey): FinanceTransaction[] {
  return transactions.filter(t => t.status === 'lunas' && t.paid_at && toPeriodKey(t.paid_at) === period)
}

function accountsOf(accounts: FinanceAccount[], kind: 'pemasukan' | 'pengeluaran'): FinanceAccount[] {
  return accounts
    .filter(a => a.kind === kind)
    .sort((a, b) => a.display_order - b.display_order)
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

// ── 1.2 & 1.3 — tabel pemasukan / pengeluaran ────────────────────────────────

/**
 * Baris laporan untuk satu jenis pos pada satu bulan.
 *
 * Pos yang bulan ini nihil tetap ditampilkan (nominal 0). Laporan cetak
 * memang selalu memuat baris "Proposal Yayasan — 0" supaya susunan barisnya
 * sama tiap bulan dan pembaca bisa membandingkan antar bulan sekilas.
 */
export function buildRows(
  data: FinanceData,
  period: PeriodKey,
  kind: 'pemasukan' | 'pengeluaran',
): { rows: ReportRow[]; total: number } {
  const posts = accountsOf(data.accounts, kind)
  const settled = settledIn(data.transactions, period)

  const raw = posts.map(account => {
    const items = settled.filter(t => t.account_id === account.id)
    return {
      slug: account.slug,
      name: account.name,
      amount: sum(items.map(t => t.amount)),
      details: items.filter(t => t.description).map(t => t.description),
    }
  })

  const total = sum(raw.map(r => r.amount))
  return { rows: raw.map(r => ({ ...r, percent: percentOf(r.amount, total) })), total }
}

// ── 1.4 — dana titipan ───────────────────────────────────────────────────────

/**
 * Saldo dana titipan pada satu bulan.
 *
 * Saldo awal tidak diketik ulang tiap bulan melainkan dihitung: saldo pembuka
 * buku ditambah seluruh mutasi sebelum bulan berjalan. Konsekuensinya, koreksi
 * mutasi lama otomatis merambat ke semua bulan sesudahnya — tidak mungkin lagi
 * ada saldo awal Mei yang tidak nyambung dengan saldo akhir April.
 */
export function buildTrustFunds(data: FinanceData, period: PeriodKey): TrustFundReport[] {
  return [...data.trustFunds]
    .filter(f => f.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map(fund => {
      const mine = data.trustEntries.filter(e => e.fund_id === fund.id)
      const before = mine.filter(e => toPeriodKey(e.entry_date) < period)
      const during = mine
        .filter(e => toPeriodKey(e.entry_date) === period)
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

      const opening = fund.opening_balance + sum(before.map(e => e.amount))
      return {
        slug: fund.slug,
        name: fund.name,
        opening,
        entries: during,
        closing: opening + sum(during.map(e => e.amount)),
      }
    })
}

// ── 1.5 — anggaran vs realisasi ──────────────────────────────────────────────

export function buildBudgetRows(
  data: FinanceData,
  period: PeriodKey,
  kind: 'pemasukan' | 'pengeluaran',
): { rows: BudgetRow[]; totalBudget: number; totalActual: number } {
  const posts = accountsOf(data.accounts, kind)
  const settled = settledIn(data.transactions, period)

  const rows = posts.map(account => {
    const items = settled.filter(t => t.account_id === account.id)
    const actual = sum(items.map(t => t.amount))
    const budget = data.budgets.find(
      b => b.account_id === account.id && toPeriodKey(b.period) === period,
    )?.amount ?? 0

    // Kumpulkan alokasi dana sumber seluruh transaksi pos ini jadi satu baris
    // matriks. Pemasukan tidak punya alokasi — uangnya justru sumbernya.
    const funding: Record<string, number> = {}
    let allocated = 0
    if (kind === 'pengeluaran') {
      for (const trx of items) {
        for (const f of trx.funding ?? []) {
          funding[f.source_slug] = (funding[f.source_slug] ?? 0) + f.amount
          allocated += f.amount
        }
      }
    }

    return {
      slug: account.slug,
      name: account.name,
      budget,
      actual,
      percent: percentOf(actual, budget),
      funding,
      unallocated: kind === 'pengeluaran' ? actual - allocated : 0,
    }
  })

  return {
    rows,
    totalBudget: sum(rows.map(r => r.budget)),
    totalActual: sum(rows.map(r => r.actual)),
  }
}

// ── 1.6 & 1.8 — rekap dan tren year-to-date ──────────────────────────────────

/** Total satu bulan, dipecah antara pendapatan mandiri dan subsidi Yayasan. */
export function monthlyTotals(data: FinanceData, period: PeriodKey): MonthlyTotals {
  const settled = settledIn(data.transactions, period)
  const byId = new Map(data.accounts.map(a => [a.id, a]))

  let income = 0
  let expense = 0
  let subsidi = 0

  for (const trx of settled) {
    const account = byId.get(trx.account_id)
    if (!account) continue
    if (account.kind === 'pemasukan') {
      income += trx.amount
      if ((YAYASAN_SLUGS as readonly string[]).includes(account.slug)) subsidi += trx.amount
    } else {
      expense += trx.amount
    }
  }

  return {
    period,
    income,
    expense,
    mandiri: income - subsidi,
    subsidi,
    subsidiPercent: percentOf1(subsidi, income),
  }
}

/** Januari s.d. bulan terpilih — satu entri per bulan, urut. */
export function buildTrend(data: FinanceData, period: PeriodKey): MonthlyTotals[] {
  return periodsYearToDate(period).map(p => monthlyTotals(data, p))
}

/** Satu baris tabel Rekapitulasi (1.6): nominal per bulan + total + porsi. */
export interface RecapRow {
  slug: string
  name: string
  perMonth: Record<PeriodKey, number>
  total: number
  percent: number
}

export function buildRecap(
  data: FinanceData,
  period: PeriodKey,
  kind: 'pemasukan' | 'pengeluaran',
): { periods: PeriodKey[]; rows: RecapRow[]; totals: Record<PeriodKey, number>; grandTotal: number } {
  const periods = periodsYearToDate(period)
  const posts = accountsOf(data.accounts, kind)

  // Sekali saring per bulan, lalu dipakai ulang untuk semua pos — menyaring
  // ulang di dalam loop pos membuat biayanya jadi bulan × pos.
  const settledByPeriod = new Map(periods.map(p => [p, settledIn(data.transactions, p)]))

  const rows: RecapRow[] = posts.map(account => {
    const perMonth: Record<PeriodKey, number> = {}
    for (const p of periods) {
      perMonth[p] = sum(
        (settledByPeriod.get(p) ?? [])
          .filter(t => t.account_id === account.id)
          .map(t => t.amount),
      )
    }
    return { slug: account.slug, name: account.name, perMonth, total: sum(Object.values(perMonth)), percent: 0 }
  })

  const grandTotal = sum(rows.map(r => r.total))
  for (const row of rows) row.percent = percentOf1(row.total, grandTotal)

  const totals: Record<PeriodKey, number> = {}
  for (const p of periods) totals[p] = sum(rows.map(r => r.perMonth[p]))

  return { periods, rows, totals, grandTotal }
}

// ── Piutang ──────────────────────────────────────────────────────────────────

/**
 * Tagihan yang belum tertunaikan sampai bulan terpilih.
 *
 * Piutang bulan-bulan sebelumnya ikut terbawa selama belum ditandai lunas —
 * inilah yang membuat catatan seperti "piutang Ekstra ±5 juta perlu dikejar
 * bulan Mei" bisa dihitung, bukan sekadar diingat.
 */
export function buildReceivables(data: FinanceData, period: PeriodKey): Receivable[] {
  const byId = new Map(data.accounts.map(a => [a.id, a]))
  return data.transactions
    .filter(t => t.status === 'piutang' && toPeriodKey(t.period) <= period)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(t => ({ transaction: t, accountName: byId.get(t.account_id)?.name ?? '—' }))
}

// ── 2.1 — rencana program bulan depan ────────────────────────────────────────

export function buildProgramPlans(data: FinanceData, period: PeriodKey): FinanceProgramPlan[] {
  return data.programPlans
    .filter(p => toPeriodKey(p.period) === period)
    .sort((a, b) => a.name.localeCompare(b.name))
}
