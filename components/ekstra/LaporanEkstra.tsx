import { MessageCircle } from 'lucide-react'
import {
  getHadirEkstra, getSetoranEkstra, labelSlot, nomorWa,
  type BookingEkstra, type SlotEkstra,
} from '@/lib/data/ekstra'

/**
 * Laporan ekstra per slot untuk satu bulan: kehadiran dan setoran pertemuan
 * ekstra tiap peserta, plus pesan WhatsApp siap kirim ke orang tuanya.
 * Dipakai koordinator (/ekstra/laporan) dan guru pengampu (/guru/ekstra).
 *
 * Setoran yang dihitung hanya yang bertanda ekstra_slot_id slot ini — setoran
 * halaqoh sekolah anak yang sama tidak ikut, dan sebaliknya.
 */

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function rentangBulan(bulan: string): { dari: string; sampai: string; label: string } {
  const [y, m] = bulan.split('-').map(Number)
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { dari: `${bulan}-01`, sampai: `${bulan}-${String(akhir).padStart(2, '0')}`, label: `${BULAN[m - 1]} ${y}` }
}

export async function LaporanEkstra({ slot, peserta, bulan }: { slot: SlotEkstra[]; peserta: BookingEkstra[]; bulan: string }) {
  const { dari, sampai, label } = rentangBulan(bulan)
  const [hadir, setoran] = await Promise.all([
    getHadirEkstra(peserta.map(p => p.id), dari, sampai),
    getSetoranEkstra(slot.map(s => s.id), dari, sampai),
  ])

  if (slot.length === 0) {
    return <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">Belum ada slot ekstra.</p>
  }

  return (
    <div className="space-y-5">
      {slot.map(s => {
        const anggota = peserta.filter(p => p.slot_id === s.id)
        return (
          <section key={s.id} className="rounded-2xl border bg-card p-4 md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-xl">{s.jenis?.nama ?? 'Ekstra'} · {s.guru}</h2>
              <p className="text-xs text-muted-foreground">{labelSlot(s)} · {label}</p>
            </div>
            {anggota.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Belum ada peserta aktif.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="pb-2">Peserta</th>
                      <th className="pb-2 text-center">Hadir</th>
                      <th className="pb-2 text-center">Izin/sakit</th>
                      <th className="pb-2 text-center">Alfa</th>
                      <th className="pb-2">Setoran ekstra</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {anggota.map(p => {
                      const h = hadir.filter(x => x.booking_id === p.id)
                      const nH = h.filter(x => x.status === 'hadir').length
                      const nIS = h.filter(x => x.status === 'izin' || x.status === 'sakit').length
                      const nA = h.filter(x => x.status === 'alfa').length
                      const st = p.student_id ? setoran.filter(x => x.student_id === p.student_id && x.slot_id === s.id) : []
                      const akhir = st[st.length - 1]
                      const nilai = st.map(x => x.nilai).filter((n): n is number => n !== null)
                      const rata = nilai.length ? Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null
                      const pesan = [
                        `Assalamu'alaikum Bapak/Ibu ${p.nama_ortu}.`,
                        '',
                        `Laporan ekstra ananda ${p.nama_anak} — ${s.jenis?.nama ?? 'Ekstra'} bersama ${s.guru}, ${label}:`,
                        `• Kehadiran: ${nH} hadir${nIS ? `, ${nIS} izin/sakit` : ''}${nA ? `, ${nA} alfa` : ''}`,
                        ...(p.student_id ? [`• Setoran ekstra: ${st.length} kali${akhir ? ` · terakhir ${akhir.ringkas}` : ''}`] : []),
                        ...(rata !== null ? [`• Rata-rata nilai: ${rata}`] : []),
                        '',
                        "Jazakumullahu khairan.",
                      ].join('\n')
                      return (
                        <tr key={p.id} className="border-t align-top">
                          <td className="py-2.5 pr-3">
                            <span className="block font-semibold">{p.nama_anak}</span>
                            <span className="block text-xs text-muted-foreground">{p.asal === 'lhi' ? (p.student_id ? 'Siswa LHI' : 'Siswa LHI · belum ditautkan') : 'Luar LHI'}</span>
                          </td>
                          <td className="py-2.5 text-center tabular-nums">{nH}</td>
                          <td className="py-2.5 text-center tabular-nums">{nIS}</td>
                          <td className="py-2.5 text-center tabular-nums">{nA}</td>
                          <td className="py-2.5 pr-3 text-xs">
                            {!p.student_id ? <span className="text-muted-foreground">Tidak dicatat (bukan siswa LHI / belum ditautkan)</span>
                              : st.length === 0 ? <span className="text-muted-foreground">Belum ada</span>
                              : <><b>{st.length}×</b> · terakhir {akhir.ringkas}{rata !== null ? ` · rata-rata ${rata}` : ''}</>}
                          </td>
                          <td className="py-2.5 text-right">
                            <a href={`https://wa.me/${nomorWa(p.wa_ortu)}?text=${encodeURIComponent(pesan)}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-primary hover:bg-muted">
                              <MessageCircle className="h-3.5 w-3.5" />Kirim
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
