import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ClipboardCheck, Clock, PenLine } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getRaporGuru } from '@/lib/data/kpi-pengesahan'
import { getBandingGuru } from '@/lib/data/kpi-banding'
import {
  BANDING_STATUS_LABELS, BANDING_TONE, SEBAB_LABELS, STATUS_LABELS, STATUS_TONE, sisaHari,
} from '@/lib/kpi/alur'
import { cn } from '@/lib/utils'
import { HalamanGuru } from '@/components/guru/HalamanGuru'

/**
 * Daftar rapor KPI yang sudah diserahkan kepada guru ini.
 *
 * Rapor yang belum disahkan koordinator tidak muncul sama sekali — bukan
 * muncul dalam keadaan terkunci. Baris "belum bisa dibuka" hanya memberi tahu
 * guru bahwa nilainya sudah ada di suatu tempat tanpa memberinya apa pun untuk
 * dikerjakan, dan itu justru menerbitkan kegelisahan yang tidak perlu.
 */
export default async function RaporKpiGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const [rows, banding] = await Promise.all([
    getRaporGuru(session.teacherId),
    getBandingGuru(session.teacherId),
  ])

  return (
    <HalamanGuru judul="Rapor KPI Saya" keterangan="Rapor bulanan yang sudah disahkan koordinator unit Anda.">

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <ClipboardCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada rapor KPI untuk Anda</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Rapor muncul di sini setelah dinilai SDM dan ditandatangani koordinator unit Anda.
          </p>
        </div>
      ) : (
        <>
        <TrenKpi rows={rows} />
        <ul className="space-y-2.5">
          {rows.map(r => {
            const sisa = sisaHari(r.bandingBatas)
            const bandingRapor = banding.get(r.kpiId) ?? []
            const terakhir = bandingRapor[bandingRapor.length - 1]
            const perluTindakan = r.status === 'terbit' && !r.sudahTtd

            return (
              <li key={r.kpiId}>
                <Link
                  href={`/guru/rapor-kpi/${r.year}/${r.month}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/50',
                    // Rapor yang menunggu sikap guru diberi tepi berwarna, bukan
                    // sekadar lencana: inilah satu-satunya baris yang menuntut
                    // sesuatu darinya, dan ia harus terlihat sebelum dibaca.
                    perluTindakan && 'border-primary/40',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.label}</span>
                      {!r.sudahDibuka && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          Baru
                        </span>
                      )}
                      <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_TONE[r.status])}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.versi > 1 && (
                        <span className="text-[10px] font-medium text-warning">Revisi ke-{r.versi - 1}</span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Nilai akhir <b className="text-foreground tabular-nums">{r.rapot.toFixed(1)}</b> · level {r.level}
                      {r.status === 'selesai' && r.selesaiSebab && ` · ${SEBAB_LABELS[r.selesaiSebab]}`}
                    </p>

                    {perluTindakan && sisa !== null && sisa >= 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-primary">
                        <Clock className="h-3 w-3" />
                        Sisa {sisa} hari untuk menandatangani atau mengajukan banding
                      </p>
                    )}

                    {terakhir && (
                      <p className="mt-1 flex items-center gap-1 text-[11px]">
                        <PenLine className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Banding tingkat {terakhir.tingkat}:</span>
                        <span className={cn('rounded px-1 py-0.5 font-medium', BANDING_TONE[terakhir.status])}>
                          {BANDING_STATUS_LABELS[terakhir.status]}
                        </span>
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
        </>
      )}
    </HalamanGuru>
  )
}

/**
 * Tren nilai akhir beberapa bulan terakhir — dari rapor yang sama dengan
 * daftar di bawahnya, tidak ada data tambahan.
 */
function TrenKpi({ rows }: { rows: { kpiId: string; year: number; month: number; label: string; rapot: number; level: number | string }[] }) {
  const urut = [...rows].sort((a, b) => a.year - b.year || a.month - b.month).slice(-6)
  const akhir = urut[urut.length - 1]
  const sebelum = urut.length > 1 ? urut[urut.length - 2] : null
  const selisih = sebelum ? akhir.rapot - sebelum.rapot : null
  const min = Math.min(...urut.map(r => r.rapot))
  const dasar = Math.max(0, Math.floor((min - 10) / 10) * 10)
  const skala = (v: number) => Math.max(4, ((v - dasar) / (100 - dasar)) * 100)

  return (
    <section className="mb-5 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nilai akhir terbaru · {akhir.label}</p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="font-heading text-5xl leading-none tabular-nums">{akhir.rapot.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">level {akhir.level}</span>
          </p>
          {selisih !== null && (
            <p className={cn('mt-1.5 text-sm font-medium', selisih > 0 ? 'text-success' : selisih < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {selisih > 0 ? '▲ naik' : selisih < 0 ? '▼ turun' : 'tetap'}{selisih !== 0 ? ` ${Math.abs(selisih).toFixed(1)} poin` : ''} dari {sebelum!.label}
            </p>
          )}
        </div>
        {urut.length > 1 && (
          <div className="flex h-28 items-end gap-2" role="img" aria-label={`Tren nilai KPI ${urut.length} bulan`}>
            {urut.map((r, i) => (
              <div key={r.kpiId} className="flex h-full w-10 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">{r.rapot.toFixed(0)}</span>
                <div
                  className={cn('w-full rounded-t-md', i === urut.length - 1 ? 'bg-accent-warm' : 'bg-primary/70')}
                  style={{ height: `${skala(r.rapot)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{r.label.split(' ')[0].slice(0, 3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
