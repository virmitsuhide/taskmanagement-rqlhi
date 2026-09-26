import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { FormSlotEkstra } from '@/components/ekstra/FormEkstra'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { bolehGuruEkstra, getBookingEkstra, getDataEkstra, getGuruEkstra, HARI_EKSTRA, labelSlot } from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

const PATH = '/ekstra/halaqoh'

/**
 * Halaqoh ekstra — padanan halaman Halaqoh untuk ekstra: satu baris per
 * halaqoh (pengampu + hari + jam + tempat), dengan jumlah pesertanya.
 * Pesertanya dibuka di halaman detail.
 */
export default async function HalaqohEkstraPage({ searchParams }: {
  searchParams: Promise<{ hari?: string; jenis?: string; q?: string; status?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const [data, peserta, guruRes, { ids: guruEkstra }] = await Promise.all([
    getDataEkstra(),
    getBookingEkstra(['aktif']),
    createServerClient().from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name'),
    getGuruEkstra(),
  ])
  // Calon pengampu halaqoh baru: hanya guru ekstra.
  const guru = ((guruRes.data ?? []) as { id: string; full_name: string }[]).filter(g => bolehGuruEkstra(guruEkstra, g.id))

  const tampilNonaktif = sp.status === 'semua'
  const q = (sp.q ?? '').trim().toLowerCase()
  // Pencarian juga menembus nama peserta: koordinator sering mencari "anak ini di halaqoh mana".
  const pesertaPerSlot = new Map<string, typeof peserta>()
  for (const p of peserta) if (p.slot_id) pesertaPerSlot.set(p.slot_id, [...(pesertaPerSlot.get(p.slot_id) ?? []), p])

  const dasar = data.slot
    .filter(s => tampilNonaktif || s.aktif)
    .filter(s => !sp.jenis || s.jenis_id === sp.jenis)
    .filter(s => !q
      || (s.guru ?? '').toLowerCase().includes(q)
      || s.tempat.toLowerCase().includes(q)
      || (pesertaPerSlot.get(s.id) ?? []).some(p => p.nama_anak.toLowerCase().includes(q)))
  const hariAda = [1, 2, 3, 4, 5, 6, 7].filter(h => dasar.some(s => s.hari === h))
  const hari = Number(sp.hari)
  const hariDipilih = hariAda.includes(hari) ? hari : null
  const daftar = dasar.filter(s => !hariDipilih || s.hari === hariDipilih)
    .sort((a, b) => a.hari - b.hari || a.jam_mulai.localeCompare(b.jam_mulai) || (a.guru ?? '').localeCompare(b.guru ?? ''))

  const param = { hari: sp.hari, jenis: sp.jenis, q: sp.q, status: sp.status }
  const jenisDipakai = data.jenis.filter(j => data.slot.some(s => s.jenis_id === j.id))
  const totalPeserta = daftar.reduce((n, s) => n + s.peserta, 0)

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Halaqoh Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · halaqoh</p>
          <h1 className="mt-1 text-3xl leading-tight">Halaqoh ekstra</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Satu halaqoh = satu pengampu pada satu jadwal pekanan. Halaqoh biasanya terbentuk saat memasukkan anak dari kotak masuk Booking;
            buka halaqoh untuk melihat pesertanya, kehadiran, dan setoran bulan ini.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div className="space-y-3">
              <Slicer label="Hari" options={[
                { label: 'Semua', href: hrefDengan(PATH, param, { hari: undefined }), active: !hariDipilih, count: dasar.length },
                ...hariAda.map(h => ({
                  label: HARI_EKSTRA[h], href: hrefDengan(PATH, param, { hari: String(h) }),
                  active: hariDipilih === h, count: dasar.filter(s => s.hari === h).length,
                })),
              ]} />
              <form action={PATH} className="flex min-w-0 flex-wrap items-end gap-2">
                {sp.hari && <input type="hidden" name="hari" value={sp.hari} />}
                {sp.status && <input type="hidden" name="status" value={sp.status} />}
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis</span>
                  <select name="jenis" defaultValue={sp.jenis ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="">Semua jenis</option>
                    {jenisDipakai.map(j => <option key={j.id} value={j.id}>{j.nama}</option>)}
                  </select>
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-sm">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Cari</span>
                  <span className="flex h-9 items-center gap-2 rounded-md border bg-background px-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input name="q" defaultValue={sp.q ?? ''} placeholder="Guru, tempat, atau peserta" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </span>
                </label>
                <button type="submit" className="h-9 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-muted">Terapkan</button>
              </form>
            </div>

            <details className="group rounded-2xl border bg-card">
              <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold">
                <Plus className="h-4 w-4 text-primary" />Buat halaqoh ekstra
                <span className="ml-auto text-xs font-normal text-muted-foreground">tanpa menunggu permintaan orang tua</span>
              </summary>
              <div className="border-t p-5">
                {data.jenis.length === 0
                  ? <p className="text-sm text-muted-foreground">Buat jenis ekstra lebih dulu di tab Jenis ekstra.</p>
                  : <FormSlotEkstra jenis={data.jenis} guru={guru} />}
              </div>
            </details>

            <section className="rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                <p className="text-sm font-semibold">
                  {daftar.length} halaqoh · {totalPeserta} peserta aktif
                </p>
                <Link href={hrefDengan(PATH, param, { status: tampilNonaktif ? undefined : 'semua' })} className="text-xs font-medium text-primary hover:underline">
                  {tampilNonaktif ? 'Sembunyikan halaqoh nonaktif' : 'Tampilkan juga halaqoh nonaktif'}
                </Link>
              </div>
              {daftar.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada halaqoh ekstra yang cocok dengan saringan ini.</p>
              ) : (
                <ul className="divide-y">
                  {daftar.map(s => {
                    const anggota = pesertaPerSlot.get(s.id) ?? []
                    const lhi = anggota.filter(p => p.asal === 'lhi').length
                    const isi = s.kuotaEfektif ? Math.min(1, s.peserta / s.kuotaEfektif) : 0
                    return (
                      <li key={s.id}>
                        <Link href={`${PATH}/${s.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/40 md:grid-cols-[130px_minmax(0,1.3fr)_minmax(0,1fr)_150px_20px]">
                          <span className="text-sm font-semibold tabular-nums">
                            {labelSlot(s)}
                            {!s.aktif && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">nonaktif</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground md:order-last" />
                          <span className="col-span-2 min-w-0 md:col-span-1">
                            <span className="block truncate text-sm font-medium">{s.guru}</span>
                            <span className="block truncate text-xs text-muted-foreground">{s.jenis?.nama ?? '—'}</span>
                          </span>
                          <span className="col-span-2 min-w-0 truncate text-xs text-muted-foreground md:col-span-1">{s.tempat || '—'}</span>
                          <span className="col-span-2 md:col-span-1">
                            <span className="flex items-baseline justify-between text-xs">
                              <b className={cn('tabular-nums', s.peserta >= s.kuotaEfektif && 'text-primary')}>{s.peserta}/{s.kuotaEfektif}</b>
                              <span className="text-muted-foreground">{lhi} LHI · {anggota.length - lhi} non</span>
                            </span>
                            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${isi * 100}%` }} />
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
