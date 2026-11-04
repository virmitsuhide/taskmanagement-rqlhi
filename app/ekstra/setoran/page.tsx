import { tolakAkses } from '@/lib/auth/tolak-akses'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { rentangBulan } from '@/components/ekstra/LaporanEkstra'
import { PindahTanggalEkstra, type PertemuanEkstra } from '@/components/ekstra/PindahTanggalEkstra'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { PilihGuruSetoran } from '@/components/setoran/PilihGuruSetoran'
import { getDataEkstra, getHadirEkstra, getSetoranEkstraSunting, hariIniWIB, labelSlot } from '@/lib/data/ekstra'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod, shiftPeriod } from '@/lib/finance/period'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ guru?: string; slot?: string; bulan?: string; jenis?: string }>
}

/**
 * Setoran ekstra — padanan /setoran milik koordinator unit, untuk
 * koordinator ekstra: tabel siswa × tanggal per halaqoh ekstra, klik sel untuk
 * mengoreksi atau menghapus.
 *
 * Tabel hanya memuat setoran bertanda halaqoh ekstra ini (ekstra_slot_id),
 * jadi setoran sekolah anak tidak pernah tampil di sini; server menolaknya
 * juga (guard di app/actions/setoran-koreksi.ts). Pertemuan yang salah
 * tanggal dipindah sekaligus satu halaqoh lewat PindahTanggalEkstra.
 *
 * ?guru=semua: semua halaqoh ekstra yang punya peserta/setoran bulan itu
 * dalam satu tabel, dikelompokkan per halaqoh ekstra.
 */
export default async function SetoranEkstraKoorPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) await tolakAkses()

  const sp = await searchParams
  const kini = currentPeriod()
  const bulan = isValidPeriod(sp.bulan ?? '') && sp.bulan! <= kini ? sp.bulan! : kini
  const jenis: JenisRekap = sp.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'
  const { dari, sampai, label } = rentangBulan(bulan)
  const hariIni = hariIniWIB()

  const data = await getDataEkstra()
  // Halaqoh materi tidak bersetoran. Yang sudah ditutup tetap ada — setoran lamanya masih bisa dikoreksi.
  const semuaSlot = data.slot.filter(s => s.jenis?.bidang !== 'materi')
  const guruList = [...new Map(semuaSlot.map(s => [s.teacher_id, s.guru ?? '—'])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'id'))
  const semua = sp.guru === 'semua'
  const guru = semua ? 'semua' : guruList.find(([id]) => id === sp.guru)?.[0] ?? guruList[0]?.[0] ?? null
  const slotGuru = semuaSlot.filter(s => s.teacher_id === guru)
    .sort((a, b) => Number(b.aktif) - Number(a.aktif))
  const slot = slotGuru.find(s => s.id === sp.slot) ?? slotGuru[0] ?? null

  let isi: { progres: Awaited<ReturnType<typeof getProgresSesi>>; pertemuan: PertemuanEkstra[] } | null = null
  // ── Semua guru: tiap halaqoh ekstra dihitung sendiri lalu disambung ──
  let semuaIsi: { progres: Awaited<ReturnType<typeof getProgresSesi>>; kelompok: { id: string; judul: string; keterangan: string }[] } | null = null
  if (semua && semuaSlot.length) {
    const ids = semuaSlot.map(s => s.id)
    const [{ data: bRows }, setoran] = await Promise.all([
      createServerClient().from('ekstra_booking').select('student_id, slot_id, status').in('slot_id', ids),
      getSetoranEkstraSunting(ids, dari, sampai),
    ])
    const booking = (bRows ?? []) as { student_id: string | null; slot_id: string; status: string }[]
    const anggota = new Map<string, Set<string>>()
    const tambah = (slotId: string, siswa: string | null) => { if (siswa) (anggota.get(slotId) ?? anggota.set(slotId, new Set()).get(slotId)!).add(siswa) }
    // Peserta aktif, ditambah siapa pun yang punya setoran di halaqoh itu bulan ini.
    for (const b of booking) if (b.status === 'aktif') tambah(b.slot_id, b.student_id)
    for (const x of setoran) tambah(x.slotId, x.studentId)
    const dipakai = semuaSlot.filter(s => anggota.get(s.id)?.size)
      .sort((a, b) => (a.guru ?? '').localeCompare(b.guru ?? '', 'id') || labelSlot(a).localeCompare(labelSlot(b)))
    // Bertahap 10 sekaligus: puluhan halaqoh × beberapa kueri tidak dilepas serentak.
    const hasil: Awaited<ReturnType<typeof getProgresSesi>>[] = []
    for (let i = 0; i < dipakai.length; i += 10) {
      hasil.push(...await Promise.all(dipakai.slice(i, i + 10).map(s =>
        getProgresSesi({ siswa: [...anggota.get(s.id)!] }, bulan, jenis, { ekstraSlot: [s.id] }))))
    }
    semuaIsi = {
      progres: {
        tanggal: [...new Set(hasil.flatMap(h => h.tanggal))].sort(),
        // halaqohId diganti id halaqoh ekstra supaya baris terkelompok per halaqoh ekstra.
        baris: hasil.flatMap((h, i) => h.baris.map(b => ({ ...b, halaqohId: dipakai[i].id }))),
      },
      kelompok: dipakai.map((s, i) => ({
        id: s.id,
        judul: `${s.guru ?? '—'} · ${s.jenis?.nama ?? 'Ekstra'}`,
        keterangan: `${labelSlot(s)}${!s.aktif ? ' (ditutup)' : ''} · ${hasil[i].baris.length} peserta LHI`,
      })),
    }
  }

  if (slot && !semua) {
    const [{ data: bRows }, setoran] = await Promise.all([
      createServerClient().from('ekstra_booking').select('id, student_id').eq('slot_id', slot.id),
      getSetoranEkstraSunting(slot.id, dari, sampai),
    ])
    const booking = (bRows ?? []) as { id: string; student_id: string | null }[]
    // Peserta yang sudah berhenti tetap tampil bila bulan ini masih punya setoran di halaqoh ini.
    const ids = [...new Set([...booking.map(b => b.student_id), ...setoran.map(x => x.studentId)].filter((x): x is string => !!x))]
    const [progres, hadir] = await Promise.all([
      getProgresSesi({ siswa: ids }, bulan, jenis, { ekstraSlot: [slot.id] }),
      getHadirEkstra(booking.map(b => b.id), dari, sampai),
    ])
    const per = new Map<string, PertemuanEkstra>()
    const ambil = (t: string) => per.get(t) ?? per.set(t, { tanggal: t, setoran: 0, hadir: 0 }).get(t)!
    for (const x of setoran) ambil(x.tanggal).setoran++
    for (const h of hadir) ambil(h.tanggal).hadir++
    isi = { progres, pertemuan: [...per.values()].sort((a, b) => b.tanggal.localeCompare(a.tanggal)) }
  }

  const href = (ganti: Partial<Record<'guru' | 'slot' | 'bulan' | 'jenis', string | null>>) => {
    const q = new URLSearchParams()
    const nilai = { guru, slot: slot?.id ?? null, bulan, jenis, ...ganti }
    if (nilai.guru) q.set('guru', nilai.guru)
    if (nilai.slot) q.set('slot', nilai.slot)
    if (nilai.bulan && nilai.bulan !== kini) q.set('bulan', nilai.bulan)
    if (nilai.jenis && nilai.jenis !== 'tahsin') q.set('jenis', nilai.jenis)
    const s = q.toString()
    return `/ekstra/setoran${s ? `?${s}` : ''}`
  }
  const chip = (aktif: boolean) => cn('inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors',
    aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · setoran</p>
            <h1 className="mt-1 text-3xl leading-tight">Setoran ekstra {label}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Hanya setoran yang dicatat di halaqoh ekstra (bertanda <b className="text-primary">E</b>) — setoran sekolah anak tidak tampil
              dan tidak bisa diubah dari sini. Klik angka di sel untuk mengoreksi atau menghapus.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={href({ bulan: shiftPeriod(bulan, -1) })} className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">← Bulan lalu</Link>
            {bulan !== kini && <Link href={href({ bulan: shiftPeriod(bulan, 1) })} className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">Bulan berikutnya →</Link>}
          </div>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : !guru ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Belum ada halaqoh ekstra tahsin/tahfidz.
          </p>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pengampu</p>
              <PilihGuruSetoran
                basePath="/ekstra/setoran"
                satuan="halaqoh"
                daftar={guruList.map(([id, nama]) => ({ id, nama, jumlahSesi: semuaSlot.filter(s => s.teacher_id === id).length }))}
                terpilih={guru}
                query={[bulan !== kini ? `bulan=${bulan}` : '', jenis !== 'tahsin' ? `jenis=${jenis}` : ''].filter(Boolean).join('&')}
              />
            </div>
            {!semua && <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Halaqoh ekstra</p>
              <div className="flex flex-wrap gap-1.5">
                {slotGuru.map(s => (
                  <Link key={s.id} href={href({ slot: s.id })} className={chip(slot?.id === s.id)}>
                    {s.jenis?.nama ?? 'Ekstra'} · {labelSlot(s)}{!s.aktif && ' (ditutup)'}
                  </Link>
                ))}
              </div>
            </div>}
            <div className="flex gap-1.5">
              {(['tahsin', 'tahfidz'] as const).map(j => (
                <Link key={j} href={href({ jenis: j })} aria-current={j === jenis ? 'page' : undefined}
                  className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    j === jenis ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent')}>
                  {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
                </Link>
              ))}
            </div>

            {semua && (
              !semuaIsi || semuaIsi.progres.baris.length === 0 ? (
                <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                  Belum ada peserta LHI tertaut atau setoran ekstra pada {label}.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{semuaIsi.kelompok.length} halaqoh ekstra · {label}. Pilih satu pengampu untuk mengubah tanggal pertemuan.</p>
                  <TabelProgres data={semuaIsi.progres} jenis={jenis} hariIni={hariIni} bisaSunting kelompok={semuaIsi.kelompok} />
                </>
              )
            )}

            {slot && isi && !semua && (
              <>
                {isi.progres.baris.length === 0 ? (
                  <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                    Belum ada peserta LHI yang tertaut di halaqoh ekstra ini.
                  </p>
                ) : (
                  <TabelProgres data={isi.progres} jenis={jenis} hariIni={hariIni} bisaSunting />
                )}

                <section className="rounded-2xl border bg-card p-4 md:p-5">
                  <h2 className="font-heading text-lg">Ubah tanggal pertemuan</h2>
                  <p className="mb-3 mt-1 max-w-3xl text-sm text-muted-foreground">
                    Guru salah memilih tanggal? Pindahkan satu pertemuan halaqoh ini sekaligus — setoran tahsin &amp; tahfidz,
                    presensi, dan setoran peserta non-LHI ikut pindah. Setoran sekolah anak di tanggal itu tidak tersentuh.
                  </p>
                  <PindahTanggalEkstra key={`${slot.id}|${bulan}`} slotId={slot.id} pertemuan={isi.pertemuan} maks={hariIni} />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
