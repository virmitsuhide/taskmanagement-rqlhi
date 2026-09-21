import Link from 'next/link'
import { CalendarRange, ClipboardList } from 'lucide-react'
import { kelengkapanBulan } from '@/lib/data/analitik-cache'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { formatPeriod, monthName } from '@/lib/finance/period'
import { Panel } from '@/components/dashboard/kit'
import { Seksi, Kunci, type InfoSeksi } from './seksi'
import type { Jenjang } from '@/types'

const BATAS = 12

/**
 * Seksi 5 — halaqoh mana yang gurunya belum mengisi capaian bulan ini.
 *
 * Ditaruh sesudah seksi capaian dengan sengaja: angka capaian yang rendah
 * bisa berarti anaknya tertinggal, bisa juga berarti gurunya belum mengisi.
 * Seksi inilah yang membedakan keduanya.
 */
export async function SeksiKelengkapan({ info, jenjang, bulan }: {
  info: InfoSeksi
  jenjang: Jenjang | null
  bulan: string
}) {
  const { rows, trend } = await kelengkapanBulan(bulan)
  const aktif = rows.filter(r => r.totalSiswa > 0 && (!jenjang || r.jenjang === jenjang))
  const kosong = aktif.filter(r => r.terisi === 0)
  const sebagian = aktif.filter(r => r.terisi > 0 && r.terisi < r.totalSiswa)
  const tagih = [...kosong, ...sebagian.sort((a, b) => a.percent - b.percent)]
  const totalSiswa = aktif.reduce((n, r) => n + r.totalSiswa, 0)
  const terisi = aktif.reduce((n, r) => n + r.terisi, 0)
  const puncak = Math.max(1, ...trend.map(t => t.terisi))

  return (
    <Seksi
      info={info}
      judul="Kelengkapan Pengisian"
      pertanyaan="Halaqoh mana yang capaian bulanannya belum diisi guru?"
      catatan={formatPeriod(bulan)}
      kunci={
        <>
          <Kunci label="Belum diisi" nilai={kosong.length.toLocaleString('id-ID')} nada={kosong.length > 0 ? 'bahaya' : 'baik'} />
          <Kunci label="Sebagian" nilai={sebagian.length.toLocaleString('id-ID')} nada={sebagian.length > 0 ? 'waspada' : 'baik'} />
          <Kunci label="Siswa terisi" nilai={totalSiswa ? `${Math.round((terisi / totalSiswa) * 100)}%` : '—'} />
        </>
      }
    >
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          title="Perlu Ditagih"
          icon={<ClipboardList className="h-4 w-4" />}
          sub={`${tagih.length} dari ${aktif.length} halaqoh · yang belum sama sekali di atas`}
          action={{ href: `/dashboard/analitik/kelengkapan?periode=${bulan}`, label: 'Semua halaqoh' }}
        >
          {aktif.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada halaqoh berisi siswa pada cakupan ini.</p>
          ) : tagih.length === 0 ? (
            <p className="text-sm text-success">Semua halaqoh sudah lengkap mengisi capaian {monthName(bulan)}.</p>
          ) : (
            <>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Halaqoh</th>
                    <th className="hidden w-[30%] py-2 pr-2 font-medium sm:table-cell">Pengampu</th>
                    <th className="hidden w-24 py-2 pr-2 font-medium md:table-cell">Unit</th>
                    <th className="w-16 py-2 text-right font-medium">Terisi</th>
                    <th className="w-20 py-2 pl-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tagih.slice(0, BATAS).map(r => (
                    <tr key={r.halaqohId} className="border-b last:border-0">
                      <td className="truncate py-1.5 pr-2">
                        <Link href={`/halaqoh/${r.halaqohId}`} className="font-medium hover:underline">{r.halaqohName}</Link>
                        <span className="block truncate text-[11px] text-muted-foreground sm:hidden">{r.pengampu}</span>
                      </td>
                      <td className="hidden truncate py-1.5 pr-2 text-muted-foreground sm:table-cell">{r.pengampu}</td>
                      <td className="hidden truncate py-1.5 pr-2 text-muted-foreground md:table-cell">{JENJANG_LABELS[r.jenjang]}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.terisi}/{r.totalSiswa}</td>
                      <td className="py-1.5 pl-2 text-right">
                        {r.terisi === 0
                          ? <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">belum</span>
                          : <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">{r.percent}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tagih.length > BATAS && (
                <p className="mt-2 text-[11px] text-muted-foreground">+{tagih.length - BATAS} halaqoh lain di halaman rinciannya.</p>
              )}
            </>
          )}
        </Panel>

        <Panel
          className="lg:col-span-4"
          title="Pengisian per Bulan"
          icon={<CalendarRange className="h-4 w-4" />}
          sub="Seluruh unit — bulan yang kosong merata biasanya belum waktunya diisi."
        >
          <div className="space-y-2">
            {trend.map(t => (
              <div key={t.period} className="flex items-center gap-2">
                <span className={`w-9 shrink-0 text-xs ${t.period === bulan ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {monthName(t.period).slice(0, 3)}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(t.terisi / puncak) * 100}%`, background: 'var(--primary)' }} />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {t.terisi === 0 ? '—' : `${t.percent}%`}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Seksi>
  )
}
