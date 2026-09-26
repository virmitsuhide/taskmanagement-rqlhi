import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookOpen, CalendarCheck, CalendarHeart, MessageCircle, NotebookPen, UsersRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, canViewStudents, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav } from '@/components/ekstra/EkstraSubNav'
import { KpiCard, Panel } from '@/components/dashboard/kit'
import {
  getBookingEkstra, getDataEkstra, getHadirEkstra, hariIniWIB, getRiwayatSetoranEkstra, kunciOrang, labelPreferensi, labelSlot,
  LABEL_STATUS_BOOKING, nomorWa, type StatusHadirEkstra,
} from '@/lib/data/ekstra'
import type { Jenjang } from '@/types'
import { cn } from '@/lib/utils'

const WARNA_HADIR: Record<StatusHadirEkstra, string> = {
  hadir: 'bg-success/15 text-success', izin: 'bg-warning/15 text-warning', sakit: 'bg-warning/15 text-warning', alfa: 'bg-destructive/15 text-destructive',
}
const tgl = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })

/**
 * Halaman satu siswa ekstra: identitas bertanda "Siswa ekstra", ekstra yang
 * diikuti (termasuk yang sudah berhenti), kehadiran, dan riwayat setoran
 * ekstra. `id` = salah satu booking anak itu; booking lain anak yang sama
 * ikut dikumpulkan.
 */
export default async function DetailSiswaEkstraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { id } = await params
  const [semua, data] = await Promise.all([getBookingEkstra(), getDataEkstra()])
  const inti = semua.find(b => b.id === id)
  if (!inti) notFound()
  const kunci = kunciOrang(inti)
  const booking = semua.filter(b => kunciOrang(b) === kunci && ['aktif', 'berhenti'].includes(b.status))
    .sort((a, b) => (a.status === 'aktif' ? 0 : 1) - (b.status === 'aktif' ? 0 : 1) || (b.mulai ?? '').localeCompare(a.mulai ?? ''))
  if (booking.length === 0) booking.push(inti)

  const slotById = new Map(data.slot.map(s => [s.id, s]))
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))
  const hariIni = hariIniWIB()
  const [siswaRes, hadir, setoran] = await Promise.all([
    inti.student_id
      ? createServerClient().from('students').select('id, full_name, kelas, jenjang, program, halaqoh:halaqoh!students_halaqoh_id_fkey(name)').eq('id', inti.student_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getHadirEkstra(booking.map(b => b.id), '2000-01-01', hariIni),
    inti.student_id ? getRiwayatSetoranEkstra(inti.student_id) : Promise.resolve([]),
  ])
  const siswa = siswaRes.data as { id: string; full_name: string; kelas: string | null; jenjang: Jenjang; program: string | null; halaqoh: { name: string } | null } | null
  const lhi = inti.asal === 'lhi'
  const nama = siswa?.full_name ?? inti.nama_anak
  const aktif = booking.filter(b => b.status === 'aktif')
  const hadirUrut = [...hadir].sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  const nHadir = hadir.filter(h => h.status === 'hadir').length
  const namaSlot = (slotId: string) => {
    const s = slotById.get(slotId)
    return s ? `${s.guru} · ${labelSlot(s)}` : 'Halaqoh ekstra'
  }
  const slotBooking = new Map(booking.map(b => [b.id, b.slot_id]))

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Siswa Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
            <Link href="/ekstra/siswa" className="hover:underline">Siswa ekstra</Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl leading-tight">{nama}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-warm-wash px-2.5 py-1 text-xs font-semibold text-accent-warm">
              <CalendarHeart className="h-3.5 w-3.5" />Siswa ekstra
            </span>
            {aktif.length === 0 && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">sudah berhenti</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {siswa
              ? [lhi ? 'Siswa LHI' : null, siswa.kelas ? `Kelas ${siswa.kelas}` : null, JENJANG_LABELS[siswa.jenjang] ?? siswa.jenjang, siswa.halaqoh ? `halaqoh sekolah ${siswa.halaqoh.name}` : null].filter(Boolean).join(' · ')
              : [lhi ? 'Siswa LHI — belum tertaut ke data siswa' : 'Non siswa LHI', inti.kelas].filter(Boolean).join(' · ')}
            {siswa && canViewStudents(session.role, siswa.jenjang, siswa.program) && (
              <> · <Link href={`/siswa/${siswa.id}`} className="font-medium text-primary hover:underline">buka data siswa</Link></>
            )}
          </p>
        </div>
        <EkstraSubNav />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={<UsersRound className="h-3.5 w-3.5" />} label="Ekstra diikuti" value={aktif.length}
            sub={booking.length > aktif.length ? `${booking.length - aktif.length} sudah berhenti` : 'Semua masih berjalan'} />
          <KpiCard icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Kehadiran" value={hadir.length ? `${Math.round((nHadir / hadir.length) * 100)}%` : '—'}
            sub={hadir.length ? `${nHadir} hadir dari ${hadir.length} pertemuan tercatat` : 'Guru belum mencatat kehadiran'}
            ratio={hadir.length ? nHadir / hadir.length : undefined} />
          <KpiCard icon={<NotebookPen className="h-3.5 w-3.5" />} label="Setoran ekstra" value={inti.student_id ? setoran.length : '—'}
            sub={inti.student_id ? 'Tahsin & tahfidz di halaqoh ekstra — ikut capaian sekolah' : 'Hanya siswa LHI yang tertaut punya catatan setoran'} />
          <KpiCard icon={<BookOpen className="h-3.5 w-3.5" />} label="Setoran terakhir" value={setoran[0] ? tgl(setoran[0].tanggal) : '—'}
            sub={setoran[0]?.ringkas ?? (inti.posisi_bacaan ? `Posisi bacaan: ${inti.posisi_bacaan}` : 'Belum ada setoran ekstra')} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Panel className="lg:col-span-7" title="Riwayat setoran ekstra" icon={<NotebookPen className="h-4 w-4" />}
            sub="Setoran yang dicatat guru ekstra di halaqoh ekstra, terbaru di atas">
            {!inti.student_id ? (
              <p className="text-sm text-muted-foreground">
                {lhi
                  ? 'Anak ini belum ditautkan ke data siswa LHI, jadi guru belum bisa mencatat setorannya. Tautkan dari kotak masuk Booking.'
                  : 'Peserta non siswa LHI tidak punya catatan setoran di aplikasi; perkembangannya tercatat lewat posisi bacaan dan kehadiran.'}
              </p>
            ) : setoran.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada setoran ekstra.</p>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[11px] text-muted-foreground">
                      <th className="pb-2 font-medium">Tanggal</th>
                      <th className="pb-2 font-medium">Setoran</th>
                      <th className="pb-2 text-right font-medium">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setoran.map((s, i) => (
                      <tr key={i} className="border-t align-top">
                        <td className="whitespace-nowrap py-2 pr-3 text-xs tabular-nums">{tgl(s.tanggal)}</td>
                        <td className="py-2 pr-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', s.jenis === 'tahsin' ? 'bg-primary-wash text-primary' : 'bg-accent-warm-wash text-accent-warm')}>
                              {s.jenis === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
                            </span>
                            {s.ringkas}
                          </span>
                          <span className="block text-xs text-muted-foreground">{namaSlot(s.slot_id)}</span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{s.nilai ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="space-y-5 lg:col-span-5">
            <Panel title="Ekstra yang diikuti" icon={<UsersRound className="h-4 w-4" />}>
              <ul className="divide-y">
                {booking.map(b => {
                  const sl = b.slot_id ? slotById.get(b.slot_id) : undefined
                  return (
                    <li key={b.id} className={cn('py-2.5', b.status === 'berhenti' && 'opacity-60')}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{jenisById.get(b.jenis_id)?.nama ?? '—'}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{LABEL_STATUS_BOOKING[b.status]}</span>
                      </div>
                      {sl ? (
                        <Link href={`/ekstra/halaqoh/${sl.id}`} className="block text-xs text-primary hover:underline">{sl.guru} · {labelSlot(sl)}{sl.tempat ? ` · ${sl.tempat}` : ''}</Link>
                      ) : <span className="block text-xs text-muted-foreground">Belum ada halaqoh · {labelPreferensi(b)}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {b.mulai ? `Mulai ${tgl(b.mulai)}` : 'Tanggal mulai belum dicatat'}{b.berhenti ? ` · berhenti ${tgl(b.berhenti)}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel title="Kehadiran" icon={<CalendarCheck className="h-4 w-4" />} sub="30 pertemuan terakhir">
              {hadirUrut.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada presensi ekstra.</p> : (
                <ul className="flex flex-wrap gap-1.5">
                  {hadirUrut.slice(0, 30).map(h => (
                    <li key={`${h.booking_id}-${h.tanggal}`} title={`${namaSlot(slotBooking.get(h.booking_id) ?? '')}${h.catatan ? ` · ${h.catatan}` : ''}`}
                      className={cn('rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums', WARNA_HADIR[h.status])}>
                      {tgl(h.tanggal).replace(/ \d{4}$/, '')} · {h.status}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Orang tua" icon={<MessageCircle className="h-4 w-4" />}>
              <p className="text-sm font-medium">{inti.nama_ortu || '—'}</p>
              {inti.wa_ortu && (
                <a href={`https://wa.me/${nomorWa(inti.wa_ortu)}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{inti.wa_ortu}</a>
              )}
              {inti.catatan_ortu && <p className="mt-2 text-xs text-muted-foreground">&ldquo;{inti.catatan_ortu}&rdquo;</p>}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
