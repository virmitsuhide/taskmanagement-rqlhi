import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { KartuBooking, type BookingTampil, type InfoSlot } from '@/components/ekstra/KartuBooking'
import {
  getBookingEkstra, getCalonSiswa, getDataEkstra, HARI_PENDEK, jam, LABEL_STATUS_BOOKING, labelSlot, nomorWa, rupiah,
  type SlotEkstra, type StatusBooking,
} from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

/**
 * Ekstra · booking — kotak masuk permintaan orang tua dan jadwal pekanan.
 * Orang tua memesan dari /daftar-ekstra; koordinator menerima, menawarkan
 * jadwal lain, atau menolak, lalu mengabari lewat WhatsApp.
 */

const TAB: StatusBooking[] = ['baru', 'ditawarkan', 'aktif', 'ditolak', 'berhenti']

export default async function EkstraPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { status: diminta } = await searchParams
  const status: StatusBooking = TAB.includes(diminta as StatusBooking) ? (diminta as StatusBooking) : 'baru'

  const [data, semua] = await Promise.all([getDataEkstra(), getBookingEkstra()])

  const info = (s: SlotEkstra | undefined): InfoSlot | null => s ? {
    id: s.id, label: labelSlot(s), guru: s.guru ?? '—', jenis: s.jenis?.nama ?? '—',
    biaya: s.jenis ? `${rupiah(s.jenis.biaya)} ${s.jenis.biaya ? s.jenis.satuan_biaya : ''}`.trim() : '—',
    sisa: s.kuotaEfektif - s.peserta,
  } : null
  const slotById = new Map(data.slot.map(s => [s.id, s]))

  const tampil = semua.filter(b => b.status === status)
  if (status === 'aktif' || status === 'berhenti') tampil.reverse()
  const hitung = Object.fromEntries(TAB.map(t => [t, semua.filter(b => b.status === t).length])) as Record<StatusBooking, number>

  // Calon siswa untuk ditautkan: permintaan LHI yang terbuka, atau aktif tapi belum tertaut.
  const perluCalon = tampil.filter(b => b.asal === 'lhi' && (b.status === 'baru' || b.status === 'ditawarkan' || (b.status === 'aktif' && !b.student_id)))
  const calon = new Map(await Promise.all(perluCalon.map(async b => [b.id, await getCalonSiswa(b.nama_anak)] as const)))
  const idTertaut = tampil.filter(b => b.student_id).map(b => b.student_id!)
  const { data: siswaTertaut } = idTertaut.length
    ? await createServerClient().from('students').select('id, full_name').in('id', idTertaut)
    : { data: [] }
  const namaTertaut = new Map(((siswaTertaut ?? []) as { id: string; full_name: string }[]).map(s => [s.id, s.full_name]))

  const aktifSlot = data.slot.filter(s => s.aktif)
  const sisaTotal = aktifSlot.reduce((n, s) => n + Math.max(0, s.kuotaEfektif - s.peserta), 0)
  const guruJadwal = [...new Set(aktifSlot.map(s => s.guru ?? '—'))].sort()

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · booking</p>
          <h1 className="mt-1 text-3xl leading-tight">Permintaan ekstra yang perlu dijadwalkan</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Orang tua memesan lewat halaman <Link href="/daftar-ekstra" className="font-medium text-primary hover:underline">Daftar Ekstra</Link>.
            Terima untuk mengunci slot, atau tawarkan jam lain — pesan WhatsApp untuk orang tua disiapkan otomatis.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Angka label="Permintaan baru" nilai={hitung.baru} nada={hitung.baru ? 'warm' : undefined} />
              <Angka label="Menunggu balasan ortu" nilai={hitung.ditawarkan} />
              <Angka label="Peserta aktif" nilai={hitung.aktif} nada="primary" />
              <Angka label="Kursi kosong" nilai={sisaTotal} ket={`${aktifSlot.length} slot aktif`} />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <section className="min-w-0 rounded-2xl border bg-card p-4 md:p-5">
                <nav aria-label="Status" className="flex flex-wrap gap-1.5">
                  {TAB.map(t => (
                    <Link key={t} href={t === 'baru' ? '/ekstra' : `/ekstra?status=${t}`}
                      aria-current={t === status ? 'page' : undefined}
                      className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold',
                        t === status ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                      {LABEL_STATUS_BOOKING[t]} <span className="tabular-nums opacity-70">{hitung[t]}</span>
                    </Link>
                  ))}
                </nav>
                {tampil.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                    Tidak ada permintaan berstatus {LABEL_STATUS_BOOKING[status].toLowerCase()}.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {tampil.map(b => {
                      const slot = slotById.get(b.slot_id)
                      const bt: BookingTampil = {
                        id: b.id, status: b.status, nama_anak: b.nama_anak, asal: b.asal, student_id: b.student_id,
                        kelas: b.kelas, posisi_bacaan: b.posisi_bacaan, nama_ortu: b.nama_ortu, wa: nomorWa(b.wa_ortu),
                        catatan_ortu: b.catatan_ortu, catatan_koor: b.catatan_koor,
                        dibuat: new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }),
                        slot: info(slot), tawaran: info(b.slot_tawaran_id ? slotById.get(b.slot_tawaran_id) : undefined),
                      }
                      const alternatif = data.slot
                        .filter(s => s.aktif && s.id !== b.slot_id && (!slot || s.jenis_id === slot.jenis_id))
                        .map(s => info(s)!)
                      return (
                        <KartuBooking key={b.id} b={bt} alternatif={alternatif} calon={calon.get(b.id) ?? []}
                          namaSiswaTertaut={b.student_id ? namaTertaut.get(b.student_id) : undefined} />
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border bg-card p-4 md:p-5">
                <h2 className="font-heading text-xl">Jadwal ekstra pekanan</h2>
                <p className="text-xs text-muted-foreground">Per guru · angka = peserta / kuota</p>
                {aktifSlot.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Belum ada slot aktif. <Link href="/ekstra/atur" className="font-medium text-primary hover:underline">Buka slot</Link>
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[440px] text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="pb-2 text-left font-semibold">Guru</th>
                          {[1, 2, 3, 4, 5, 6, 7].filter(h => aktifSlot.some(s => s.hari === h)).map(h => (
                            <th key={h} className="pb-2 font-semibold">{HARI_PENDEK[h]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {guruJadwal.map(g => (
                          <tr key={g} className="border-t align-top">
                            <td className="py-2 pr-2 font-medium">{g}</td>
                            {[1, 2, 3, 4, 5, 6, 7].filter(h => aktifSlot.some(s => s.hari === h)).map(h => (
                              <td key={h} className="px-1 py-2">
                                <div className="flex flex-col gap-1">
                                  {aktifSlot.filter(s => s.guru === g && s.hari === h).map(s => {
                                    const penuh = s.peserta >= s.kuotaEfektif
                                    return (
                                      <span key={s.id} title={`${s.jenis?.nama} · ${labelSlot(s)}`}
                                        className={cn('rounded-md px-1.5 py-1 text-center font-semibold',
                                          penuh ? 'bg-primary text-primary-foreground' : 'border border-dashed border-primary/40 text-primary')}>
                                        {jam(s.jam_mulai)} · {s.peserta}/{s.kuotaEfektif}
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Angka({ label, nilai, ket, nada }: { label: string; nilai: number; ket?: string; nada?: 'warm' | 'primary' }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-3xl leading-none tabular-nums', nada === 'warm' && 'text-accent-warm', nada === 'primary' && 'text-primary')}>{nilai}</p>
      {ket && <p className="mt-1.5 text-[11px] text-muted-foreground">{ket}</p>}
    </div>
  )
}
