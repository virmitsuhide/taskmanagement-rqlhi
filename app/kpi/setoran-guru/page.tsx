import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookMarked, ClipboardList, ScrollText } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canCatatSetoranGuru, canInputKpi, canViewKpi } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { getSetoranGuruUnit, labelPosisi, posisiHafalan, type SetoranGuru } from '@/lib/data/setoran-guru'
import { nilaiHafalanQuran, nilaiTuhfatulAthfal } from '@/lib/kpi/hitung'
import { paramFor } from '@/lib/kpi/parameter'
import { bintangDariNilai } from '@/lib/rq/bintang'
import { terkunci } from '@/lib/kpi/alur'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FormSetoranGuru, type SuratSetoran } from '@/components/kpi/FormSetoranGuru'
import { HapusSetoranGuru } from '@/components/kpi/HapusSetoranGuru'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

const PATH = '/kpi/setoran-guru'

function hariIniWIB(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}
const tgl = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
const bintang = (n: number | null) => (n === null ? '' : `${'★'.repeat(Math.floor(bintangDariNilai(n)))}${bintangDariNilai(n) % 1 ? '½' : ''}`)

/**
 * Setoran Guru Qur'an — SDM menyimak hafalan tahfidz & Tuhfatul Athfal guru
 * per unit. Setoran terakhir tiap jenis dalam sebulan otomatis menjadi posisi
 * hafalan di KPI bulan itu (lihat lib/data/setoran-guru.ts).
 */
export default async function SetoranGuruPage({ searchParams }: {
  searchParams: Promise<{ unit?: string; year?: string; month?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpi(session.role)) redirect('/dashboard')
  const bolehCatat = canCatatSetoranGuru(session.role)

  const p = await searchParams
  const hariIni = hariIniWIB()
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const year = Number(p.year) || Number(hariIni.slice(0, 4))
  const month = Number(p.month) >= 1 && Number(p.month) <= 12 ? Number(p.month) : Number(hariIni.slice(5, 7))
  const href = (ubah: { unit?: string; month?: number }) =>
    `${PATH}?unit=${ubah.unit ?? unit}&year=${year}&month=${ubah.month ?? month}`

  const [data, suratRes] = await Promise.all([
    getSetoranGuruUnit(unit, year, month),
    createServerClient().from('surat_master').select('id, name_latin, total_ayat').order('id'),
  ])
  const surat = (suratRes.data ?? []) as SuratSetoran[]
  const namaSurat = new Map(surat.map(s => [s.id, s.name_latin]))
  const P = paramFor(unit)

  // Tanggal isian: hari ini bila bulan terpilih bulan berjalan, selain itu akhir bulan terpilih.
  const mm = String(month).padStart(2, '0')
  const akhirBulan = `${year}-${mm}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`
  const tanggalAwal = hariIni.slice(0, 7) === `${year}-${mm}` ? hariIni : akhirBulan < hariIni ? akhirBulan : hariIni

  const ringkas = (s: SetoranGuru) => s.jenis === 'tahfidz'
    ? `${namaSurat.get(s.surat_id ?? 0) ?? `Surat ${s.surat_id}`} ${s.ayat_dari === s.ayat_ke ? s.ayat_ke : `${s.ayat_dari}–${s.ayat_ke}`}`
    : `Bait ${s.bait_dari === s.bait_ke ? s.bait_ke : `${s.bait_dari}–${s.bait_ke}`}`
  const sudahSetor = data.guru.filter(g => g.bulanIni.length > 0).length
  const riwayat = data.guru.flatMap(g => g.bulanIni.map(s => ({ ...s, nama: g.nama })))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at.localeCompare(a.created_at))

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Setoran Guru" showBack ownH1 />
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <Link href={`/kpi?unit=${unit}&year=${year}&month=${month}`} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />Buat KPI
        </Link>
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Kinerja guru · tersambung ke KPI</p>
          <h1 className="mt-2 text-3xl leading-tight md:text-4xl">Setoran Guru Qur&apos;an</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
            Setoran tahfidz &amp; Tuhfatul Athfal guru {KPI_UNITS.find(u => u.key === unit)?.label}. Setoran <b>terakhir</b> tiap jenis di
            {' '}{MONTH_NAMES[month - 1]} {year} otomatis menjadi posisi hafalan di KPI bulan itu; nilainya tetap dihitung rumus rubrik KPI.
            Bintang hanya catatan kualitas.
          </p>
        </div>

        <div role="group" aria-label="Unit" className="mb-4 flex w-fit gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-[3px]">
          {KPI_UNITS.map(u => (
            <Link key={u.key} href={href({ unit: u.key })} aria-current={unit === u.key ? 'page' : undefined}
              className={cn('whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                unit === u.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {u.label}
            </Link>
          ))}
        </div>
        <div className="mb-5 flex gap-1 overflow-x-auto border-b pb-px">
          {MONTH_NAMES.map((m, i) => (
            <Link key={m} href={href({ month: i + 1 })}
              className={cn('-mb-px whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors',
                month === i + 1 ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {m}
            </Link>
          ))}
        </div>

        {!data.tabelAda ? (
          <p className="rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Tabel setoran guru belum ada. Jalankan <code className="text-xs">drizzle/0096_setoran_guru_PASTE_TO_SUPABASE.sql</code> di Supabase.
          </p>
        ) : data.guru.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada guru aktif di unit ini.</p>
        ) : (
          <div className="space-y-6">
            {bolehCatat && (
              <FormSetoranGuru
                key={`${unit}-${year}-${month}`}
                guru={data.guru.map(g => ({
                  id: g.id, nama: g.nama,
                  tahfidz: g.terakhirTahfidz?.surat_id && g.terakhirTahfidz.ayat_ke
                    ? { surat_id: g.terakhirTahfidz.surat_id, ayat_ke: g.terakhirTahfidz.ayat_ke, juz_selesai: g.terakhirTahfidz.juz_selesai ?? 0 }
                    : null,
                  tuhfatul: g.terakhirTuhfatul?.bait_ke ? { bait_ke: g.terakhirTuhfatul.bait_ke } : null,
                }))}
                surat={surat}
                tanggalAwal={tanggalAwal}
                tanggalMaks={hariIni}
              />
            )}

            <section className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-primary" />Rekap {MONTH_NAMES[month - 1]} {year} → isian KPI</h2>
                <p className="text-xs text-muted-foreground">{sudahSetor} dari {data.guru.length} guru sudah setor bulan ini · nilai indikator memakai rubrik {unit === 'smp' ? 'SMP' : 'SD'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Guru</th>
                      <th className="px-2 py-2 font-medium"><span className="inline-flex items-center gap-1"><BookMarked className="h-3 w-3" />Tahfidz terakhir</span></th>
                      <th className="px-2 py-2 text-right font-medium">Nilai KPI</th>
                      <th className="px-2 py-2 font-medium"><span className="inline-flex items-center gap-1"><ScrollText className="h-3 w-3" />Tuhfatul terakhir</span></th>
                      <th className="px-2 py-2 text-right font-medium">Nilai KPI</th>
                      <th className="px-4 py-2 font-medium">KPI bulan ini</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.guru.map(g => {
                      const tf = g.isian.tahfidz
                      const tu = g.isian.tuhfatul
                      return (
                        <tr key={g.id} className="border-b last:border-0 align-top">
                          <td className="px-4 py-2.5 font-medium">{g.nama}<span className="block text-xs font-normal text-muted-foreground">{g.bulanIni.length} setoran</span></td>
                          <td className="px-2 py-2.5 text-xs">
                            {tf ? (
                              <>
                                <span className="block">{tgl(tf.tanggal)} · {ringkas(tf)} <span className="text-warning">{bintang(tf.nilai)}</span></span>
                                <span className="block font-semibold text-primary">{labelPosisi(posisiHafalan(tf))}</span>
                              </>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                            {g.isian.hafalan_juz !== undefined ? nilaiHafalanQuran(g.isian.hafalan_juz, g.isian.hafalan_pages ?? 0, P) : <span className="font-normal text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2.5 text-xs">
                            {tu ? <span className="block">{tgl(tu.tanggal)} · s.d. bait {tu.bait_ke} <span className="text-warning">{bintang(tu.nilai)}</span></span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                            {g.isian.tuhfatul_bait !== undefined ? Math.round(nilaiTuhfatulAthfal(g.isian.tuhfatul_bait, P) * 10) / 10 : <span className="font-normal text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {g.statusKpi === null ? (
                              <span className="text-muted-foreground">Belum diisi{canInputKpi(session.role) && g.bulanIni.length > 0 ? ' — terisi otomatis saat dibuka' : ''}</span>
                            ) : terkunci(g.statusKpi) ? (
                              <span className="text-warning">Terkunci ({g.statusKpi}) — tidak diubah</span>
                            ) : (
                              <span className="text-success">Tersambung</span>
                            )}
                            {canInputKpi(session.role) && (
                              <Link href={`/kpi/isi?teacher=${g.id}&unit=${unit}&year=${year}&month=${month}`} className="mt-0.5 block font-semibold text-primary hover:underline">Buka KPI</Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Riwayat setoran {MONTH_NAMES[month - 1]} {year}</h2>
              </div>
              {riwayat.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada setoran guru di bulan ini.</p>
              ) : (
                <ul className="divide-y">
                  {riwayat.map(s => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">{tgl(s.tanggal)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{s.nama}</span>
                        <span className="text-muted-foreground"> · {s.jenis === 'tahfidz' ? 'Tahfidz' : 'Tuhfatul'} {ringkas(s)}</span>
                        {s.catatan && <span className="block truncate text-xs text-muted-foreground">{s.catatan}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-warning">{bintang(s.nilai)}</span>
                      {bolehCatat && <HapusSetoranGuru id={s.id} label={`${s.nama} ${tgl(s.tanggal)}`} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
