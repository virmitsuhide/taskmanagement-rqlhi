import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CalendarDays, ChevronLeft, Clock, MessageCircle, Pencil, UsersRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav } from '@/components/ekstra/EkstraSubNav'
import { FormSlotEkstra } from '@/components/ekstra/FormEkstra'
import { AksiPesertaEkstra } from '@/components/ekstra/AksiPesertaEkstra'
import { Panel } from '@/components/dashboard/kit'
import { bolehGuruEkstra, getCalonSiswa, getDataEkstra, getGuruEkstra, getHalaqohEkstra, HARI_PENDEK, labelSlot, nomorWa, rupiah, type StatusHadirEkstra } from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

const HURUF: Record<StatusHadirEkstra, { h: string; k: string }> = {
  hadir: { h: 'H', k: 'bg-primary text-primary-foreground' },
  izin: { h: 'I', k: 'bg-info-wash text-info' },
  sakit: { h: 'S', k: 'bg-accent-warm-wash text-accent-warm' },
  alfa: { h: 'A', k: 'bg-destructive-wash text-destructive' },
}
const tglPendek = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

/**
 * Satu halaqoh ekstra — padanan halaman detail Halaqoh: siapa pengampunya,
 * kapan, di mana, dan siapa pesertanya beserta kehadiran & setoran bulan ini.
 */
export default async function DetailHalaqohEkstraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { id } = await params
  const [detail, data, guruRes, { ids: guruEkstra }] = await Promise.all([
    getHalaqohEkstra(id),
    getDataEkstra(),
    createServerClient().from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name'),
    getGuruEkstra(),
  ])
  if (!detail) notFound()
  const { slot, peserta, berhenti, pertemuan } = detail
  // Pilihan pengampu: guru ekstra, ditambah pengampu halaqoh ini sendiri.
  const guru = ((guruRes.data ?? []) as { id: string; full_name: string }[])
    .filter(g => g.id === slot.teacher_id || bolehGuruEkstra(guruEkstra, g.id))

  // Tujuan pindah: halaqoh lain berjenis sama yang masih berjalan dan masih ada kursi.
  const tujuan = data.slot
    .filter(s => s.id !== slot.id && s.aktif && s.jenis_id === slot.jenis_id && s.peserta < s.kuotaEfektif)
    .map(s => ({ id: s.id, label: `${s.guru} · ${labelSlot(s)} · sisa ${s.kuotaEfektif - s.peserta}` }))
  // Calon data siswa hanya untuk siswa LHI yang belum tertaut.
  const calon = new Map(await Promise.all(peserta.filter(p => p.asal === 'lhi' && !p.student_id).map(async p => [
    p.id, await getCalonSiswa(p.nama_anak, p.kelas),
  ] as const)))

  const j = slot.jenis
  const bulan = labelBulanIni()
  const lhi = peserta.filter(p => p.asal === 'lhi').length
  const nHadir = peserta.reduce((n, p) => n + p.hadir, 0)
  const nCatat = peserta.reduce((n, p) => n + p.pertemuan, 0)
  const penuh = slot.peserta >= slot.kuotaEfektif
  const mulaiPaling = peserta.map(p => p.mulai).filter((x): x is string => !!x).sort()[0]

  const baris: [string, string][] = [
    ['Pengampu', slot.guru ?? '—'],
    ['Jenis', j?.nama ?? '—'],
    ['Jadwal', labelSlot(slot)],
    ['Tempat', slot.tempat || '—'],
    ['Kuota', slot.kuota ? String(slot.kuota) : `${slot.kuotaEfektif} (ikut jenis)`],
    ['Biaya', j ? `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}` : '—'],
    ['Status', slot.aktif ? 'Berjalan' : 'Nonaktif'],
  ]

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Halaqoh Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <EkstraSubNav />

        <header className="grid items-center gap-6 rounded-2xl border bg-card p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-7">
          <div className="min-w-0 space-y-1.5">
            <Link href="/ekstra/halaqoh" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <ChevronLeft className="h-4 w-4" />Semua halaqoh ekstra
            </Link>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-warm">{j?.nama ?? 'Ekstra'} · {labelSlot(slot)}</p>
            <h1 className="font-heading text-3xl leading-tight md:text-[40px]">
              {slot.guru}
              {!slot.aktif && <span className="ml-2 align-middle rounded bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-muted-foreground">nonaktif</span>}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[slot.tempat, mulaiPaling ? `peserta pertama mulai ${new Date(`${mulaiPaling}T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : null, `${pertemuan.length} pertemuan tercatat ${bulan}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Angka nilai={`${slot.peserta}/${slot.kuotaEfektif}`} label={penuh ? 'peserta · penuh' : 'peserta'} kelas={penuh ? 'text-primary' : ''} />
            <Angka nilai={String(lhi)} label="siswa LHI" />
            <Angka nilai={nCatat ? `${Math.round((nHadir / nCatat) * 100)}%` : '—'} label={`hadir ${bulan.split(' ')[0]}`} />
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <section className="rounded-2xl border bg-card lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-wash text-primary"><UsersRound className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-xl">Peserta</h2>
                <p className="text-xs text-muted-foreground">Hadir &amp; setoran: {bulan} · setoran hanya untuk siswa LHI yang tertaut</p>
              </div>
            </div>
            {peserta.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Belum ada peserta. Masukkan dari kotak masuk <Link href="/ekstra" className="font-medium text-primary hover:underline">Booking</Link>.
              </p>
            ) : (
              <ul className="divide-y">
                {peserta.map(p => (
                  <li key={p.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.5fr)_150px_minmax(0,1fr)] md:items-center">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5">
                        {p.asal === 'lhi' && p.student_id
                          ? <Link href={`/ekstra/siswa/${p.id}`} className="font-semibold hover:underline">{p.nama_anak}</Link>
                          : <span className="font-semibold">{p.nama_anak}</span>}
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
                          p.asal !== 'lhi' ? 'bg-muted text-muted-foreground' : p.student_id ? 'bg-primary-wash text-primary' : 'bg-accent-warm-wash text-accent-warm')}>
                          {p.asal !== 'lhi' ? 'Non LHI' : p.student_id ? 'Siswa LHI' : 'LHI · belum tertaut'}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{[p.kelas, p.posisi_bacaan].filter(Boolean).join(' · ') || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.nama_ortu || 'Orang tua —'}
                        {p.wa_ortu && <> · <a href={`https://wa.me/${nomorWa(p.wa_ortu)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"><MessageCircle className="h-3 w-3" />{p.wa_ortu}</a></>}
                      </p>
                    </div>
                    <div>
                      {p.riwayat.length === 0 ? <span className="text-xs text-muted-foreground">Belum ada presensi</span> : (
                        <span className="flex flex-wrap gap-1" aria-label={`Hadir ${p.hadir} dari ${p.pertemuan} pertemuan`}>
                          {p.riwayat.map(r => (
                            <span key={r.tanggal} title={`${tglPendek(r.tanggal)} · ${r.status}`}
                              className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', HURUF[r.status].k)}>{HURUF[r.status].h}</span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 text-xs">
                        {p.asal === 'lhi' && p.student_id ? (
                          <>
                            <p className="font-bold">{p.setoran} setoran</p>
                            {p.setoranTerakhir && <p className="text-muted-foreground">{p.setoranTerakhir.ringkas} · {tglPendek(p.setoranTerakhir.tanggal)}</p>}
                          </>
                        ) : <p className="text-muted-foreground">{p.asal === 'lhi' ? 'Tautkan dulu untuk mencatat setoran' : 'Hanya presensi & posisi bacaan'}</p>}
                      </div>
                      <AksiPesertaEkstra id={p.id} nama={p.nama_anak} tujuan={tujuan} calon={calon.get(p.id) ?? null} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-5 lg:col-span-4">
            <Panel title={`Pertemuan ${bulan.split(' ')[0]}`} icon={<CalendarDays className="h-4 w-4" />} sub="Hadir / tercatat · diisi guru dari portalnya">
              {pertemuan.length === 0 ? <p className="text-sm text-muted-foreground">Guru belum mencatat presensi bulan ini.</p> : (
                <div className="grid grid-cols-4 gap-1.5">
                  {pertemuan.map(t => {
                    const d = new Date(`${t.tanggal}T00:00:00+07:00`)
                    return (
                      <div key={t.tanggal} className={cn('flex flex-col items-center rounded-xl py-2', t.hadir === t.total ? 'bg-primary-wash' : 'bg-accent-warm-wash')}>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{HARI_PENDEK[((d.getUTCDay() + 6) % 7) + 1] ?? ''}</span>
                        <span className="font-heading text-xl leading-none">{t.tanggal.slice(8).replace(/^0/, '')}</span>
                        <span className={cn('text-[10.5px] font-semibold', t.hadir === t.total ? 'text-primary' : 'text-accent-warm')}>{t.hadir}/{t.total}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            <section className="rounded-2xl border bg-card">
              <div className="flex items-center gap-3 px-5 pt-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-wash text-primary"><Pencil className="h-4 w-4" /></span>
                <h2 className="flex-1 font-heading text-xl">Data halaqoh</h2>
              </div>
              <dl className="px-5 pb-2 pt-2">
                {baris.map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-3 border-t py-2 first:border-t-0">
                    <dt className="text-sm text-muted-foreground">{l}</dt>
                    <dd className="text-right text-sm font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <details className="group border-t">
                <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-primary">Ubah pengampu, jadwal, tempat, kuota, status</summary>
                <div className="border-t p-4"><FormSlotEkstra slot={slot} jenis={data.jenis} guru={guru} /></div>
              </details>
            </section>

            {berhenti.length > 0 && (
              <Panel title="Pernah ikut" icon={<Clock className="h-4 w-4" />}>
                <ul className="divide-y">
                  {berhenti.map(b => (
                    <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                      <span>{b.nama_anak}</span>
                      <span className="text-xs text-muted-foreground">berhenti {b.berhenti ? tglPendek(b.berhenti) : '—'}{b.catatan_koor ? ` · ${b.catatan_koor}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 'September 2026' menurut WIB — bulan yang dipakai kehadiran & setoran di atas. */
function labelBulanIni(): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date())
}

function Angka({ nilai, label, kelas }: { nilai: string; label: string; kelas?: string }) {
  return (
    <div className="min-w-[96px] rounded-xl bg-muted/60 px-3.5 py-3">
      <p className={cn('font-heading text-[28px] leading-none tabular-nums', kelas)}>{nilai}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
