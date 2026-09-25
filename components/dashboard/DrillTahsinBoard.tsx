import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DrillUnit, SiswaDrill } from '@/lib/data/analytics'

const BATAS_TAMPIL = 12

const UJIAN: Record<SiswaDrill['ujian'], { label: string; kelas: string }> = {
  belum:       { label: 'Belum diajukan', kelas: 'bg-destructive/10 text-destructive' },
  diajukan:    { label: 'Diajukan',       kelas: 'bg-muted text-muted-foreground' },
  dijadwalkan: { label: 'Dijadwalkan',    kelas: 'bg-primary-wash text-primary' },
}

/**
 * Anak yang sedang DRILL tahsin, per unit.
 *
 * Diurutkan dari yang paling lama tertahan, dengan status ujiannya — supaya
 * yang terbaca pertama adalah anak yang menunggu paling lama tanpa ada yang
 * mengajukan ujiannya.
 */
export function DrillTahsinBoard({ units }: { units: DrillUnit[] }) {
  return (
    <section>
      <h2 className="font-heading text-lg font-medium mb-1 flex items-center gap-2">
        <Repeat className="h-4 w-4" /> Siswa Drill Tahsin
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Sudah lulus halaman terakhir jilidnya dan tertahan sampai lulus ujian tahsin. Jilid berikutnya
        hanya terbuka lewat ujian.
      </p>

      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-8 text-center bg-muted/30">
          <p className="text-sm text-muted-foreground">Tidak ada siswa yang sedang drill.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {units.map(u => (
            <div key={u.jenjang} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{u.label}</p>
                <p className="text-xs text-muted-foreground">
                  {u.siswa.length.toLocaleString('id-ID')} drill
                  {u.belumDiajukan > 0 && (
                    <> &middot; <span className="font-medium text-destructive">{u.belumDiajukan} belum diajukan</span></>
                  )}
                </p>
              </div>

              <ul className="mt-3 divide-y">
                {u.siswa.slice(0, BATAS_TAMPIL).map(s => (
                  <li key={s.id} className="flex items-center gap-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{s.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {s.jilid ?? '—'}{s.kelas ? ` · ${s.kelas}` : ''}{s.halaqoh ? ` · ${s.halaqoh}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{s.hari} hari</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', UJIAN[s.ujian].kelas)}>
                      {UJIAN[s.ujian].label}
                    </span>
                  </li>
                ))}
              </ul>
              {u.siswa.length > BATAS_TAMPIL && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  +{u.siswa.length - BATAS_TAMPIL} anak lainnya.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
