import Link from 'next/link'
import { ArrowUpRight, Clock, Inbox, UsersRound } from 'lucide-react'
import { Panel } from '@/components/dashboard/kit'
import { getBookingEkstra, getDataEkstra, getHadirEkstra, hariIniWIB, jam, kiniWIB, labelPreferensi } from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

const hariSejak = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5))

/**
 * Bagian atas Dashboard Koordinator Ekstra: jawaban hari ini, halaqoh ekstra
 * yang berjalan hari ini beserta status presensinya, permintaan terlama, dan
 * halaqoh yang kursinya masih longgar. Hanya membaca data ekstra yang ada.
 */
export async function RingkasKoorEkstra() {
  const [data, terbuka, aktif] = await Promise.all([
    getDataEkstra(),
    getBookingEkstra(['baru', 'ditawarkan']),
    getBookingEkstra(['aktif']),
  ])
  if (!data.tabelAda) return null

  const tanggal = hariIniWIB()
  const kini = kiniWIB()
  const hariNo = ((kini.getUTCDay() + 6) % 7) + 1
  const jamKini = kini.toISOString().slice(11, 16)
  const halaqoh = data.slot.filter(s => s.aktif)
  const hariIni = halaqoh.filter(s => s.hari === hariNo).sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
  const pesertaHariIni = aktif.filter(b => b.slot_id && hariIni.some(s => s.id === b.slot_id))
  const hadir = await getHadirEkstra(pesertaHariIni.map(b => b.id), tanggal, tanggal)
  const slotTercatat = new Set(hadir.map(h => pesertaHariIni.find(b => b.id === h.booking_id)?.slot_id).filter(Boolean))

  const status = (s: (typeof hariIni)[number]) =>
    slotTercatat.has(s.id) ? 'tercatat' as const
      : s.peserta === 0 ? 'kosong' as const
      : s.jam_selesai.slice(0, 5) <= jamKini ? 'belum' as const
      : s.jam_mulai.slice(0, 5) <= jamKini ? 'berjalan' as const : 'nanti' as const
  const belumPresensi = hariIni.filter(s => status(s) === 'belum').length

  const baru = terbuka.filter(b => b.status === 'baru')
  const ditawarkan = terbuka.filter(b => b.status === 'ditawarkan')
  const lama = terbuka.filter(b => hariSejak(b.created_at) > 3)
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))
  const longgar = halaqoh.filter(s => s.peserta < s.kuotaEfektif)
    .sort((a, b) => a.peserta / a.kuotaEfektif - b.peserta / b.kuotaEfektif).slice(0, 4)
  const pesertaAktif = aktif.length
  const lhi = aktif.filter(b => b.asal === 'lhi').length
  const nGuru = new Set(halaqoh.map(s => s.teacher_id)).size

  // Kalimat jawaban — dari angka di atas, tanpa tafsiran.
  const judul = terbuka.length === 0
    ? <>Tidak ada permintaan yang menunggu.</>
    : <>{terbuka.length} permintaan menunggu{lama.length > 0 ? <> — <i>{lama.length} sudah lebih dari tiga hari.</i></> : '.'}</>
  const kalimat = [
    hariIni.length ? `${hariIni.length} halaqoh ekstra berjalan hari ini${belumPresensi ? `; ${belumPresensi} belum mencatat presensi` : ''}.` : 'Tidak ada halaqoh ekstra hari ini.',
    longgar[0] ? `Kursi paling longgar: ${longgar[0].guru} · ${longgar[0].jenis?.nama ?? ''} (${longgar[0].peserta}/${longgar[0].kuotaEfektif}).` : null,
  ].filter(Boolean).join(' ')

  const angka = [
    { n: baru.length, l: 'permintaan baru', warm: true, href: '/ekstra' },
    { n: ditawarkan.length, l: 'menunggu balasan ortu', href: '/ekstra?status=ditawarkan' },
    { n: pesertaAktif, l: `peserta aktif · ${lhi} LHI`, href: '/ekstra/siswa' },
    { n: halaqoh.length, l: `halaqoh · ${nGuru} guru`, href: '/ekstra/halaqoh' },
  ]

  return (
    <>
      <section className="grid items-center gap-6 rounded-[20px] bg-[#0E3531] p-6 text-white md:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F2B27A]">Jawaban hari ini · ekstra</p>
          <h2 className="font-heading text-[28px] font-normal leading-tight md:text-[34px]">{judul}</h2>
          <p className="text-sm leading-relaxed text-white/80">{kalimat}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {angka.map(a => (
            <Link key={a.l} href={a.href} className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5 transition-colors hover:bg-white/[0.12]">
              <p className={cn('font-heading text-[32px] leading-none tabular-nums', a.warm && a.n > 0 && 'text-[#F2B27A]')}>{a.n}</p>
              <p className="mt-1 text-xs text-white/75">{a.l}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Halaqoh ekstra hari ini" icon={<Clock className="h-4 w-4" />}
          sub="Presensi diisi guru dari portalnya" action={{ href: '/ekstra/halaqoh', label: 'Semua halaqoh' }}>
          {hariIni.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada halaqoh ekstra terjadwal hari ini.</p> : (
            <ul className="divide-y">
              {hariIni.map(s => {
                const st = status(s)
                const chip = {
                  tercatat: ['Presensi tercatat', 'bg-success-wash text-success'],
                  belum: ['Presensi belum dicatat', 'bg-destructive-wash text-destructive'],
                  berjalan: ['Sedang berjalan', 'bg-info-wash text-info'],
                  nanti: ['Nanti', 'bg-muted text-muted-foreground'],
                  kosong: ['Belum ada peserta', 'bg-accent-warm-wash text-accent-warm'],
                }[st]
                return (
                  <li key={s.id}>
                    <Link href={`/ekstra/halaqoh/${s.id}`} className="grid grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-muted/30 sm:grid-cols-[64px_minmax(0,1fr)_90px_auto]">
                      <span>
                        <span className="block font-heading text-xl leading-none">{jam(s.jam_mulai)}</span>
                        <span className="text-[11px] text-muted-foreground">s.d. {jam(s.jam_selesai)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{s.guru}</span>
                        <span className="block truncate text-xs text-muted-foreground">{s.jenis?.nama}{s.tempat ? ` · ${s.tempat}` : ''}</span>
                      </span>
                      <span className="hidden text-xs font-bold tabular-nums sm:block">{s.peserta}/{s.kuotaEfektif}</span>
                      <span className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', chip[1])}>{chip[0]}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="min-w-0 space-y-6 lg:col-span-5">
          <Panel title="Kotak masuk" icon={<Inbox className="h-4 w-4" />} sub="Terlama di atas">
            {terbuka.length === 0 ? <p className="text-sm text-muted-foreground">Semua permintaan sudah ditangani.</p> : (
              <>
                <ul className="divide-y">
                  {terbuka.slice(0, 4).map(b => {
                    const h = hariSejak(b.created_at)
                    return (
                      <li key={b.id}>
                        <Link href={`/ekstra?${b.status === 'ditawarkan' ? 'status=ditawarkan&' : ''}id=${b.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/30">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{b.nama_anak} <span className="font-normal text-muted-foreground">· {b.asal === 'lhi' ? (b.kelas || 'LHI') : 'Non LHI'}</span></span>
                            <span className="block truncate text-xs text-muted-foreground">{jenisById.get(b.jenis_id)?.nama ?? '—'} · {labelPreferensi(b)}</span>
                          </span>
                          <span className={cn('shrink-0 text-xs font-bold', h > 3 ? 'text-destructive' : 'text-muted-foreground')}>{h === 0 ? 'hari ini' : `${h} hari`}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <Link href="/ekstra" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Buka kotak masuk <ArrowUpRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </Panel>

          {longgar.length > 0 && (
            <Panel title="Kursi yang masih longgar" icon={<UsersRound className="h-4 w-4" />} sub="Tawarkan ke permintaan yang cocok">
              <ul className="space-y-3">
                {longgar.map(s => (
                  <li key={s.id}>
                    <Link href={`/ekstra/halaqoh/${s.id}`} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{s.guru} · {['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd'][s.hari]} {jam(s.jam_mulai)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{s.jenis?.nama}{s.peserta === 0 ? ' · belum ada peserta' : ''}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className={cn('block h-full rounded-full', s.peserta === 0 ? 'bg-accent-warm' : 'bg-primary')} style={{ width: `${(s.peserta / s.kuotaEfektif) * 100}%` }} />
                        </span>
                        <span className="text-xs font-bold tabular-nums">{s.peserta}/{s.kuotaEfektif}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
