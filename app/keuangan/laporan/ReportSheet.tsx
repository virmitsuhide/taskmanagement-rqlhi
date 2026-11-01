import { NarrativeEditor } from '@/components/keuangan/NarrativeEditor'
import { ProgramPlanEditor } from '@/components/keuangan/ProgramPlanEditor'
import { BatangBerkelompok, BatangBertumpuk, DonatKomposisi, GarisKpi, warnaPos } from '@/components/keuangan/TrendCharts'
import {
  formatAngka, formatJuta, formatJuta1, formatPeriod, lastDayOf, monthName, percentOf, percentOf1,
} from '@/lib/finance/period'
import type { BudgetRow, MonthlyTotals, ReportRow, TrustFundReport } from '@/lib/finance/report'
import { KPI_STATUS_LABEL, KPI_TARGETS, type KpiMetric } from '@/lib/finance/kpi'
import type { BagianNarasi } from '@/lib/finance/narasi'
import type { FinanceAccount, FinanceProgramPlan } from '@/types'

export interface ReportSheetProps {
  period: string
  nextPeriod: string
  /** Narasi tersimpan + keterangan pos ('ket_<kind>_<slug>'). */
  notes: Record<string, string>
  draf: Record<BagianNarasi, string>
  canManage: boolean
  income: { rows: ReportRow[]; total: number }
  expense: { rows: ReportRow[]; total: number }
  budgetIncome: { rows: BudgetRow[]; totalBudget: number; totalActual: number }
  budgetExpense: { rows: BudgetRow[]; totalBudget: number; totalActual: number }
  trust: TrustFundReport[]
  /** Juli s.d. bulan laporan, hanya bulan yang terisi. */
  trend: MonthlyTotals[]
  kpi: KpiMetric[]
  plans: FinanceProgramPlan[]
  incomeAccounts: FinanceAccount[]
  expenseAccounts: FinanceAccount[]
}

const tgl = (iso: string) => iso.split('-').reverse().join('/')
const selisihTeks = (n: number) => (n === 0 ? '0' : `${n > 0 ? '+' : '-'}${formatAngka(Math.abs(n))}`)

/**
 * Laporan Keuangan BPH (Executive Management Report bab 01) — tata letak
 * mengikuti laporan September 2026. Satu lembar untuk layar dan cetak:
 * kontrol sunting disembunyikan saat dicetak (print:hidden).
 */
export function ReportSheet(props: ReportSheetProps) {
  const {
    period, nextPeriod, notes, draf, canManage, income, expense, budgetIncome, budgetExpense,
    trust, trend, kpi, plans, incomeAccounts, expenseAccounts,
  } = props
  const bulan = formatPeriod(period)
  const balance = income.total - expense.total
  const narasi = (s: BagianNarasi) => ({ period, section: s, content: notes[s] ?? '', draf: draf[s], canManage })
  const ket = (kind: 'pemasukan' | 'pengeluaran', slug: string) => notes[`ket_${kind}_${slug}`]?.trim() || '-'
  const akhir = lastDayOf(period)
  const nBulan = trend.map(t => monthName(t.period))
  const rentang = trend.length ? `${monthName(trend[0].period)} – ${monthName(trend[trend.length - 1].period)} ${period.slice(0, 4)}` : bulan
  const rentangPendek = trend.length ? `${monthName(trend[0].period).slice(0, 3)}–${monthName(trend[trend.length - 1].period).slice(0, 3)} ${period.slice(0, 4)}` : bulan

  // Kolom tabel 1.5.3: sumber yang membiayai sesuatu bulan ini.
  const sumberAktif = incomeAccounts.filter(a => budgetExpense.rows.some(r => (r.funding[a.slug] ?? 0) > 0))
  const belumTerdanai = budgetExpense.rows.reduce((n, r) => n + r.unallocated, 0)
  const singkat = (nama: string) => nama.replace('Subsidi Yayasan', 'Subsidi YYS')

  return (
    <div className="report-sheet mx-auto max-w-[900px] border shadow-sm print:max-w-none print:border-0 print:shadow-none">
      {/* ── Sampul ── */}
      <section className="report-sampul">
        <div className="kepala">
          <div className="yayasan">YAYASAN PIONIR PENDIDIKAN INDONESIA</div>
          <div className="rq">Rumah Qur&apos;an LHI</div>
          <div className="moto">Membumikan Al-Qur&apos;an, Menanamkan Adab, Membangun Peradaban</div>
        </div>
        <h1 className="judul">EXECUTIVE MANAGEMENT REPORT</h1>
        <p className="periode">Periode: {bulan}</p>
        <table className="report-meta2">
          <tbody>
            <tr><td>Disampaikan Kepada</td><td>Badan Pengurus Harian (BPH)</td></tr>
            <tr><td>Disampaikan Oleh</td><td>Kepala Rumah Qur&apos;an</td></tr>
            <tr><td>Isi Laporan</td><td>Laporan Keuangan</td></tr>
            <tr><td>Periode Pelaporan</td><td>{bulan} (1—{Number(akhir.slice(8))} {bulan})</td></tr>
            <tr><td>Tanggal Laporan</td><td>{bulan}</td></tr>
            <tr><td>Klasifikasi</td><td>TERBATAS</td></tr>
          </tbody>
        </table>
        <div className="kaki">— Membumikan Al-Qur&apos;an, Menanamkan Adab, Membangun Peradaban —</div>
      </section>

      <div className="report-isi">
        <div className="report-band">
          <div className="num">01</div>
          <div className="title">
            <strong>LAPORAN KEUANGAN</strong>
            <em>Financial Performance Report — {bulan}</em>
          </div>
        </div>

        {/* ── 1.1 ── */}
        <H no="1.1" title={`Ringkasan Keuangan Bulan ${bulan}`} besar />
        <div className="report-stat3">
          <div className="emas">
            <b>{formatJuta1(income.total)}</b>
            <span>Total Pemasukan</span>
            <em>{budgetIncome.totalBudget ? `${percentOf(income.total, budgetIncome.totalBudget)}% dari Anggaran` : 'Anggaran belum diisi'}</em>
          </div>
          <div className="biru">
            <b>{formatJuta1(expense.total)}</b>
            <span>Total Pengeluaran</span>
            <em>{budgetExpense.totalBudget ? `Anggaran: ${formatJuta(budgetExpense.totalBudget)}` : 'Anggaran belum diisi'}</em>
          </div>
          <div className={balance === 0 ? 'hijau' : balance > 0 ? 'hijau' : 'merah'}>
            <b>{balance === 0 ? 'BALANCE' : formatJuta1(Math.abs(balance))}</b>
            <span>Surplus / Defisit</span>
            <em>{balance === 0 ? 'Pengeluaran = Pemasukan' : balance > 0 ? 'Pemasukan > Pengeluaran' : 'Pengeluaran > Pemasukan'}</em>
          </div>
        </div>
        <NarrativeEditor {...narasi('sorotan')} title={`Sorotan Utama ${bulan}`} varian="hijau" />

        {/* ── 1.2 ── */}
        <H no="1.2" title="Pemasukan" besar />
        <H no="1.2.1" title="Tabel Pemasukan" />
        <TabelArus rows={income.rows} total={income.total} head="Sumber Pemasukan" totalLabel="TOTAL PEMASUKAN" ket={s => ket('pemasukan', s)} />
        <H no="1.2.2" title="Diagram Pemasukan" />
        <DonatKomposisi
          judul={`Komposisi Pemasukan ${bulan}`}
          potongan={income.rows.map(r => ({ label: r.name, nilai: r.amount, warna: warnaPos(r.slug, 'pemasukan') }))}
        />
        <NarrativeEditor {...narasi('catatan_pemasukan')} title="Analisis diagram pemasukan" varian="polos" prosa />

        {/* ── 1.3 ── */}
        <H no="1.3" title="Pengeluaran" besar />
        <H no="1.3.1" title="Tabel Pengeluaran" />
        <TabelArus rows={expense.rows} total={expense.total} head="Sumber Pengeluaran" totalLabel="TOTAL PENGELUARAN" ket={s => ket('pengeluaran', s)} />
        <H no="1.3.2" title="Diagram Pengeluaran" />
        <DonatKomposisi
          judul={`Komposisi Pengeluaran ${bulan}`}
          potongan={expense.rows.map(r => ({ label: r.name, nilai: r.amount, warna: warnaPos(r.slug, 'pengeluaran') }))}
        />
        <NarrativeEditor {...narasi('catatan_pengeluaran')} title="Analisis diagram pengeluaran" varian="polos" prosa />

        {/* ── 1.4 ── */}
        <H no="1.4" title="Dana Titipan" besar />
        <p className="report-prosa">Dana titipan <strong>dicatat terpisah</strong> dari arus kas operasional.</p>
        {trust.map((fund, i) => (
          <div key={fund.slug} className="report-blok">
            <H no={`1.4.${i + 1}`} title={fund.name} />
            <table className="report-table">
              <thead><tr><th>Keterangan</th><th className="num-cell">Jumlah (Rp)</th></tr></thead>
              <tbody>
                <tr className="tebal"><td>Saldo Awal {tgl(`${period}-01`)}</td><td className="num-cell">{formatAngka(fund.opening)}</td></tr>
                {fund.entries.length === 0 ? (
                  <tr><td>Tidak ada transaksi pada bulan {bulan}.</td><td className="num-cell">0</td></tr>
                ) : fund.entries.map(e => (
                  <tr key={e.id}>
                    <td>({e.amount < 0 ? '-' : '+'}) {e.description}</td>
                    <td className="num-cell">{e.amount < 0 ? `(${formatAngka(-e.amount)})` : formatAngka(e.amount)}</td>
                  </tr>
                ))}
                <tr className="total"><td>Saldo Akhir {tgl(akhir)}</td><td className="num-cell">{formatAngka(fund.closing)}</td></tr>
              </tbody>
            </table>
          </div>
        ))}
        {trust.length > 0 && <NarrativeEditor {...narasi('catatan_titipan')} title="Catatan Dana Titipan" varian="biru" />}

        {/* ── 1.5 ── */}
        <H no="1.5" title="Anggaran VS Realisasi" besar />
        <H no="1.5.1" title="Anggaran VS Realisasi Pemasukan" />
        <TabelAnggaran rows={budgetIncome.rows} head="Sumber Pemasukan" totalBudget={budgetIncome.totalBudget} totalActual={budgetIncome.totalActual} />
        <H no="1.5.2" title="Anggaran VS Realisasi Pengeluaran" />
        <TabelAnggaran rows={budgetExpense.rows} head="Sumber Pengeluaran" totalBudget={budgetExpense.totalBudget} totalActual={budgetExpense.totalActual} />
        <H no="1.5.3" title="Sumber Dana Pengeluaran" />
        <table className="report-table">
          <thead>
            <tr>
              <th>Sumber Pengeluaran</th>
              {sumberAktif.map(s => <th key={s.slug} className="num-cell">{singkat(s.name)}</th>)}
              {belumTerdanai > 0 && <th className="num-cell">Belum terdanai</th>}
            </tr>
          </thead>
          <tbody>
            {budgetExpense.rows.map(r => (
              <tr key={r.slug}>
                <td className="tebal">{r.name}</td>
                {sumberAktif.map(s => <td key={s.slug} className="num-cell">{r.funding[s.slug] ? formatAngka(r.funding[s.slug]) : '-'}</td>)}
                {belumTerdanai > 0 && <td className="num-cell">{r.unallocated ? formatAngka(r.unallocated) : '-'}</td>}
              </tr>
            ))}
            <tr className="total">
              <td>TOTAL</td>
              {sumberAktif.map(s => (
                <td key={s.slug} className="num-cell">{formatAngka(budgetExpense.rows.reduce((n, r) => n + (r.funding[s.slug] ?? 0), 0))}</td>
              ))}
              {belumTerdanai > 0 && <td className="num-cell">{formatAngka(belumTerdanai)}</td>}
            </tr>
          </tbody>
        </table>
        {belumTerdanai > 0 && (
          <p className="report-peringatan">
            Rp{formatAngka(belumTerdanai)} pengeluaran tidak tertutup pemasukan bulan ini — laporan belum balance. Periksa angka Subsidi Yayasan di Isian Bulanan.
          </p>
        )}
        <NarrativeEditor {...narasi('evaluasi_anggaran')} title={`💡 Evaluasi Anggaran ${bulan}`} varian="emas" />

        {/* ── 1.6 ── */}
        <H no="1.6" title={`Analisis Keuangan Key Performance Indicator (KPI) — ${bulan}`} besar />
        <table className="report-table">
          <thead><tr><th>Indikator</th><th className="num-cell">Nilai</th><th>Keterangan</th><th className="tengah">Status</th></tr></thead>
          <tbody>
            {kpi.map(m => (
              <tr key={m.id} className={m.tebal ? 'tebal' : undefined}>
                <td>{m.label}</td>
                <td className="num-cell">{m.display}</td>
                <td>{m.note}</td>
                <td className="tengah"><span className="report-badge" data-status={m.status}>{KPI_STATUS_LABEL[m.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <NarrativeEditor {...narasi('ringkasan_kpi')} title="Ringkasan KPI" varian="hijau" />

        {/* ── 1.7 ── */}
        <H no="1.7" title={`Tren Bulanan ${rentang} (Detail Breakdown)`} besar />
        {trend.length === 0 ? <p className="report-prosa">Belum ada isian bulan ini.</p> : (
          <table className="report-table">
            <thead>
              <tr>
                <th>Bulan</th><th className="num-cell">Total Pemasukan</th><th className="num-cell">Pendapatan Mandiri</th>
                <th className="num-cell">Subsidi Yayasan</th><th className="num-cell">% Subsidi</th><th className="num-cell">Kemandirian</th>
              </tr>
            </thead>
            <tbody>
              {trend.map(t => (
                <tr key={t.period}>
                  <td className="tebal">{monthName(t.period)}</td>
                  <td className="num-cell">{formatAngka(t.income)}</td>
                  <td className="num-cell">{formatAngka(t.mandiri)}</td>
                  <td className="num-cell">{formatAngka(t.subsidi)}</td>
                  <td className="num-cell">{t.subsidiPercent.toLocaleString('id-ID')}%</td>
                  <td className="num-cell">{t.kemandirian.toLocaleString('id-ID')}%</td>
                </tr>
              ))}
              {trend.length > 1 && (() => {
                const inc = trend.reduce((n, t) => n + t.income, 0), man = trend.reduce((n, t) => n + t.mandiri, 0), sub = trend.reduce((n, t) => n + t.subsidi, 0)
                return (
                  <tr className="total">
                    <td>TOTAL / RATA-RATA</td>
                    <td className="num-cell">{formatAngka(inc)}</td><td className="num-cell">{formatAngka(man)}</td><td className="num-cell">{formatAngka(sub)}</td>
                    <td className="num-cell">{percentOf1(sub, inc).toLocaleString('id-ID')}%</td><td className="num-cell">{percentOf1(man, inc).toLocaleString('id-ID')}%</td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        )}
        <NarrativeEditor {...narasi('analisis_tren')} title="Analisis tren bulanan" varian="polos" prosa />

        {/* ── 1.8 ── */}
        <H no="1.8" title={`Diagram Tren ${rentang}`} besar />
        <H no="1.8.1" title="Komposisi Pemasukan per Bulan" />
        <BatangBertumpuk
          judul={`Komposisi Pemasukan per Bulan (${rentangPendek})`}
          bulan={nBulan}
          seri={[...incomeAccounts.filter(a => a.slug !== 'subsidi_yayasan'), ...incomeAccounts.filter(a => a.slug === 'subsidi_yayasan')]
            .map(a => ({ label: a.name, warna: warnaPos(a.slug, 'pemasukan'), nilai: trend.map(t => t.pemasukan[a.slug] ?? 0) }))}
        />
        <NarrativeEditor {...narasi('analisis_komposisi')} title="Analisis komposisi pemasukan" varian="polos" prosa awalan="Analisis:" />

        <H no="1.8.2" title="Mandiri vs Subsidi" />
        <BatangBertumpuk
          judul="Mandiri vs Subsidi: Komposisi Cashflow per Bulan"
          bulan={nBulan}
          persenDalam
          total={t => `Total ${(t / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}`}
          seri={[
            { label: 'Pendapatan Mandiri', warna: '#2a7d65', nilai: trend.map(t => t.mandiri) },
            { label: 'Subsidi Yayasan', warna: '#c9a227', nilai: trend.map(t => t.subsidi) },
          ]}
        />
        <NarrativeEditor {...narasi('analisis_mandiri')} title="Analisis mandiri vs subsidi" varian="polos" prosa awalan="Analisis:" />

        <H no="1.8.3" title="Tren Pemasukan per Sumber" />
        <BatangBerkelompok
          judul={`Tren Pemasukan per Sumber (${rentangPendek})`}
          bulan={nBulan}
          kategori={[...incomeAccounts.filter(a => a.slug === 'subsidi_yayasan'), ...incomeAccounts.filter(a => a.slug !== 'subsidi_yayasan')]
            .map(a => ({ label: a.name.replace(/ (Yayasan|Takhassus)$/, '\n$1').replace('SD Quls\n', 'SD Quls\n'), nilai: trend.map(t => t.pemasukan[a.slug] ?? 0) }))}
        />
        <NarrativeEditor {...narasi('analisis_sumber')} title="Analisis tren per sumber" varian="polos" prosa awalan="Analisis:" />

        <H no="1.8.4" title="Komposisi Pengeluaran per Bulan" />
        <BatangBertumpuk
          judul={`Komposisi Pengeluaran per Bulan (${rentangPendek})`}
          bulan={nBulan}
          seri={expenseAccounts.map(a => ({ label: a.name, warna: warnaPos(a.slug, 'pengeluaran'), nilai: trend.map(t => t.pengeluaran[a.slug] ?? 0) }))}
        />
        <NarrativeEditor {...narasi('analisis_pengeluaran_tren')} title="Analisis komposisi pengeluaran" varian="polos" prosa awalan="Analisis:" />

        <H no="1.8.5" title="Tren KPI Kemandirian" />
        <p className="report-judul-grafik">Tren KPI Kemandirian ({rentangPendek})</p>
        <GarisKpi
          bulan={nBulan}
          kemandirian={trend.map(t => t.kemandirian)}
          porsiGaji={trend.map(t => t.porsiGaji)}
          targetMandiri={KPI_TARGETS.rasioMandiri.value}
          targetGaji={KPI_TARGETS.porsiGajiYys.value}
        />
        <NarrativeEditor {...narasi('analisis_kpi_tren')} title="Analisis tren KPI" varian="polos" prosa awalan="Analisis:" />

        {/* ── 1.9 ── */}
        <H no="1.9" title={`Rencana Pengeluaran Program ${formatPeriod(nextPeriod)}`} besar />
        {plans.length === 0 && !canManage ? (
          <p className="report-prosa">Bulan {monthName(nextPeriod)} tidak ada rencana program khusus.</p>
        ) : (
          <>
            {plans.length === 0 && <p className="report-prosa">Bulan {monthName(nextPeriod)} tidak ada rencana program khusus.</p>}
            <div className={plans.length === 0 ? 'print:hidden' : undefined}>
              <ProgramPlanEditor period={nextPeriod} plans={plans} canManage={canManage} />
            </div>
          </>
        )}

        <div className="report-footer">
          © Yayasan Pionir Pendidikan Indonesia | Rumah Qur&apos;an LHI — Laporan Keuangan {bulan}
        </div>
      </div>
    </div>
  )
}

function H({ no, title, besar }: { no: string; title: string; besar?: boolean }) {
  return <p className={besar ? 'report-h1' : 'report-h2'}>{no}&nbsp;&nbsp;{title}</p>
}

/** Tabel 1.2.1 / 1.3.1 — keterangan dari isian bendahara. */
function TabelArus({ rows, total, head, totalLabel, ket }: {
  rows: ReportRow[]; total: number; head: string; totalLabel: string; ket: (slug: string) => string
}) {
  return (
    <table className="report-table">
      <thead>
        <tr><th style={{ width: '24%' }}>{head}</th><th className="tengah">Keterangan</th><th className="num-cell" style={{ width: '17%' }}>Jumlah (Rp)</th><th className="num-cell" style={{ width: '8%' }}>%</th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.slug}>
            <td className="tebal">{r.name}</td>
            <td style={{ whiteSpace: 'pre-line' }}>{ket(r.slug)}</td>
            <td className="num-cell">{formatAngka(r.amount)}</td>
            <td className="num-cell">{r.percent}</td>
          </tr>
        ))}
        <tr className="total"><td>{totalLabel}</td><td /><td className="num-cell">{formatAngka(total)}</td><td className="num-cell">100</td></tr>
      </tbody>
    </table>
  )
}

/** Tabel 1.5.1 / 1.5.2 — anggaran, realisasi, selisih, % realisasi. */
function TabelAnggaran({ rows, head, totalBudget, totalActual }: { rows: BudgetRow[]; head: string; totalBudget: number; totalActual: number }) {
  const persen = (a: number, b: number) => (b ? `${percentOf1(a, b).toLocaleString('id-ID')}%` : '-')
  return (
    <table className="report-table">
      <thead>
        <tr><th>{head}</th><th className="num-cell">Anggaran (Rp)</th><th className="num-cell">Realisasi (Rp)</th><th className="num-cell">Selisih (Rp)</th><th className="num-cell">% Realisasi</th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.slug}>
            <td className="tebal">{r.name}</td>
            <td className="num-cell">{formatAngka(r.budget)}</td>
            <td className="num-cell">{formatAngka(r.actual)}</td>
            <td className="num-cell">{selisihTeks(r.actual - r.budget)}</td>
            <td className="num-cell">{persen(r.actual, r.budget)}</td>
          </tr>
        ))}
        <tr className="total">
          <td>TOTAL</td>
          <td className="num-cell">{formatAngka(totalBudget)}</td>
          <td className="num-cell">{formatAngka(totalActual)}</td>
          <td className="num-cell">{selisihTeks(totalActual - totalBudget)}</td>
          <td className="num-cell">{persen(totalActual, totalBudget)}</td>
        </tr>
      </tbody>
    </table>
  )
}
