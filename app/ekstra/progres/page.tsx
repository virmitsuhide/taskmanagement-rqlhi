import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { rentangBulan } from '@/components/ekstra/LaporanEkstra'
import { SetoranKoreksi } from '@/components/siswa/SetoranKoreksi'
import { getDataEkstra, getMateriEkstra, getSetoranEkstraSunting, labelSlot } from '@/lib/data/ekstra'
import { currentPeriod, isValidPeriod, shiftPeriod } from '@/lib/finance/period'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ bulan?: string; guru?: string }>
}

/**
 * Progres ekstra — seluruh setoran ekstra sebulan, dikelompokkan per halaqoh
 * ekstra dan bisa disaring per pengampu. Koordinator ekstra menyunting dan
 * menghapus dari sini (penjagaan di app/actions/setoran-koreksi.ts); posisi
 * anak dihitung ulang setiap ada perubahan.
 */
export default async function ProgresEkstraPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const kini = currentPeriod()
  const bulan = isValidPeriod(sp.bulan ?? '') && sp.bulan! <= kini ? sp.bulan! : kini
  const { dari, sampai, label } = rentangBulan(bulan)

  const data = await getDataEkstra()
  // Semua slot, termasuk yang sudah ditutup — setoran lamanya tetap perlu bisa dikoreksi.
  const guruList = [...new Map(data.slot.map(s => [s.teacher_id, s.guru ?? '—'])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'id'))
  const guru = guruList.some(([id]) => id === sp.guru) ? sp.guru! : null
  const slot = data.slot.filter(s => !guru || s.teacher_id === guru)
  const [setoran, { materi }] = data.tabelAda
    ? await Promise.all([
        getSetoranEkstraSunting(slot.map(s => s.id), dari, sampai),
        getMateriEkstra(slot.filter(s => s.jenis?.bidang === 'materi').map(s => s.id), dari, sampai),
      ])
    : [[], { materi: [] }]

  const perSlot = slot
    .map(s => ({ s, item: setoran.filter(x => x.slotId === s.id), mat: materi.filter(m => m.slot_id === s.id) }))
    .filter(x => x.item.length > 0 || x.mat.length > 0 || x.s.aktif)
    .sort((a, b) => b.item.length + b.mat.length - a.item.length - a.mat.length || (a.s.guru ?? '').localeCompare(b.s.guru ?? '', 'id'))
  const nTahsin = setoran.filter(x => x.table === 'tahsin_logs').length
  const nTahfidz = setoran.length - nTahsin

  const href = (ganti: { bulan?: string | null; guru?: string | null }) => {
    const q = new URLSearchParams()
    const b = ganti.bulan === undefined ? bulan : ganti.bulan
    const g = ganti.guru === undefined ? guru : ganti.guru
    if (b && b !== kini) q.set('bulan', b)
    if (g) q.set('guru', g)
    const s = q.toString()
    return `/ekstra/progres${s ? `?${s}` : ''}`
  }
  const chip = (aktif: boolean) => cn('inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors',
    aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · progres</p>
            <h1 className="mt-1 text-3xl leading-tight">Setoran ekstra {label}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Seluruh setoran yang dicatat di halaqoh ekstra. Ubah atau hapus setoran yang salah input — posisi jilid/juz anak dihitung ulang dari riwayatnya.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={href({ bulan: shiftPeriod(bulan, -1) })} className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">← Bulan lalu</Link>
            {bulan !== kini && <Link href={href({ bulan: shiftPeriod(bulan, 1) })} className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">Bulan berikutnya →</Link>}
          </div>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pengampu</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={href({ guru: null })} className={chip(!guru)}>Semua</Link>
                {guruList.map(([id, nama]) => (
                  <Link key={id} href={href({ guru: id })} className={chip(guru === id)}>{nama}</Link>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              <b className="text-foreground">{setoran.length.toLocaleString('id-ID')} setoran</b> ({nTahsin} tahsin · {nTahfidz} tahfidz)
              dari {new Set(setoran.map(x => x.studentId)).size} anak di {perSlot.filter(x => x.item.length > 0).length} halaqoh ekstra.
            </p>

            {perSlot.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada halaqoh ekstra{guru ? ' untuk pengampu ini' : ''}.
              </p>
            ) : (
              <div className="space-y-5">
                {perSlot.map(({ s, item, mat }) => (
                  <section key={s.id} className="rounded-2xl border bg-card p-4 md:p-5">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
                      <h2 className="font-heading text-lg">
                        {s.guru ?? '—'} · {s.jenis?.nama ?? 'Ekstra'}
                        {!s.aktif && <span className="ml-2 text-xs font-normal text-muted-foreground">(sudah ditutup)</span>}
                      </h2>
                      <Link href={`/ekstra/halaqoh/${s.id}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                        {labelSlot(s)} · {s.peserta} peserta →
                      </Link>
                    </div>
                    {s.jenis?.bidang === 'materi' ? (
                      mat.length === 0
                        ? <p className="text-sm text-muted-foreground">Belum ada materi yang dicatat di bulan ini.</p>
                        : (
                          <ul className="divide-y rounded-lg border text-sm">
                            {mat.map(m => (
                              <li key={m.tanggal} className="p-3">
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">Materi</span>{' '}
                                <span className="font-medium">{m.tanggal}</span>
                                <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{m.deskripsi}</p>
                              </li>
                            ))}
                          </ul>
                        )
                    ) : item.length === 0
                      ? <p className="text-sm text-muted-foreground">Belum ada setoran di bulan ini.</p>
                      : <SetoranKoreksi items={item} />}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
