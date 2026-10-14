import type { MateriEkstra, StatusHadirEkstra } from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

const HARI = ['Ahad', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const HURUF_ABSEN: Partial<Record<StatusHadirEkstra, string>> = { izin: 'I', sakit: 'S', alfa: 'A' }

export interface PesertaMateri {
  /** id booking ekstra */
  id: string
  nama: string
  slotId: string
  keterangan: string | null
}

/**
 * Progres ekstra bidang materi (Bahasa Arab, pelatihan guru): peserta × tanggal
 * pertemuan. Peserta yang hadir di pertemuan bermateri mendapat kode "M";
 * arahkan kursor untuk membaca materinya, atau klik untuk melompat ke daftar
 * materi di bawah tabel. Izin/sakit/alfa memakai huruf yang sama dengan sesi
 * sekolah. Tanpa catatan kehadiran, peserta dianggap hadir — sama dengan
 * bawaan formulir presensi ekstra.
 */
export function TabelMateriEkstra({ peserta, materi, hadir, namaSlot }: {
  peserta: PesertaMateri[]
  materi: MateriEkstra[]
  hadir: { booking_id: string; tanggal: string; status: StatusHadirEkstra }[]
  /** slotId → nama halaqoh ekstra, untuk daftar materi bila lebih dari satu halaqoh. */
  namaSlot: Record<string, string>
}) {
  if (materi.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
        Belum ada materi yang dicatat di bulan ini.
      </div>
    )
  }
  const tanggal = [...new Set(materi.map(m => m.tanggal))].sort()
  const materiDi = new Map(materi.map(m => [`${m.slot_id}|${m.tanggal}`, m.deskripsi]))
  const status = new Map(hadir.map(h => [`${h.booking_id}|${h.tanggal}`, h.status]))
  const banyakSlot = new Set(materi.map(m => m.slot_id)).size > 1
  const jangkar = (slotId: string, t: string) => `materi-${slotId.slice(0, 8)}-${t}`

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold">Peserta</th>
              {tanggal.map(t => {
                const d = new Date(`${t}T00:00:00Z`)
                return (
                  <th key={t} className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground">
                    <span className="block">{HARI[d.getUTCDay()]}</span>
                    <span className="block font-semibold text-foreground">{d.getUTCDate()}</span>
                  </th>
                )
              })}
              <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">Materi diterima</th>
            </tr>
          </thead>
          <tbody>
            {peserta.map(p => {
              let jumlah = 0
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                    <span className="block font-medium">{p.nama}</span>
                    {p.keterangan && <span className="block text-[11px] text-muted-foreground">{p.keterangan}</span>}
                  </td>
                  {tanggal.map(t => {
                    const isi = materiDi.get(`${p.slotId}|${t}`)
                    if (!isi) return <td key={t} className="px-2 py-2 text-center text-muted-foreground/40">·</td>
                    const st = status.get(`${p.id}|${t}`) ?? 'hadir'
                    const absen = HURUF_ABSEN[st]
                    if (absen) {
                      return (
                        <td key={t} className="px-2 py-2 text-center">
                          <span title={`Tidak hadir (${st})`} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">{absen}</span>
                        </td>
                      )
                    }
                    jumlah++
                    return (
                      <td key={t} className="px-2 py-2 text-center">
                        <a href={`#${jangkar(p.slotId, t)}`} title={isi}
                          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold',
                            'bg-primary-wash text-primary ring-primary/40 hover:ring-2')}>
                          M
                        </a>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right tabular-nums">{jumlah.toLocaleString('id-ID')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h3 className="font-heading text-lg">Materi yang diberikan</h3>
        <ul className="mt-2 divide-y text-sm">
          {materi.map(m => (
            <li key={`${m.slot_id}|${m.tanggal}`} id={jangkar(m.slot_id, m.tanggal)} className="scroll-mt-24 py-2 target:bg-primary-wash">
              <span className="font-semibold">
                {new Date(`${m.tanggal}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
              </span>
              {banyakSlot && <span className="text-xs text-muted-foreground"> · {namaSlot[m.slot_id] ?? 'Ekstra'}</span>}
              <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{m.deskripsi}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground"><b className="text-primary">M</b> = menerima materi (arahkan kursor untuk membaca, klik untuk melompat ke sini) · I/S/A = izin/sakit/alfa.</p>
      </section>
    </div>
  )
}
