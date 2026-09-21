import { AlertTriangle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LABEL_PERHATIAN, URUTAN_PERHATIAN,
  type GukarPerhatian, type PesertaPerhatian, type StatusPerhatian,
} from '@/lib/data/gukar'

const WARNA: Record<StatusPerhatian, string> = {
  belum_mengaji: 'bg-destructive/10 text-destructive border-destructive/30',
  tidak_hadir: 'bg-warning/10 text-warning border-warning/30',
  tanpa_capaian: 'bg-info/10 text-info border-info/30',
  belum_direkap: 'bg-muted text-muted-foreground border-border',
}

/**
 * Daftar nama gukar yang perlu ditindaklanjuti pada satu bulan — padanan
 * bab 3.7 Laporan SDM. Dikelompokkan per unit karena tindak lanjutnya lewat
 * koordinator unit masing-masing.
 *
 * "Belum direkap" dipisah dan dilipat: pada bulan berjalan hampir semua
 * orang masih berstatus itu, dan kalau ditaruh sejajar ia menenggelamkan
 * nama-nama yang benar-benar perlu didatangi.
 */
export function GukarPerhatianPanel({ data, bulan, berjalan, target }: {
  data: GukarPerhatian
  bulan: string
  berjalan: boolean
  target: number
}) {
  const hitung = new Map<StatusPerhatian, number>()
  for (const p of data.peserta) hitung.set(p.status, (hitung.get(p.status) ?? 0) + 1)

  const utama = data.peserta.filter(p => p.status !== 'belum_direkap')
  const belumDirekap = data.peserta.filter(p => p.status === 'belum_direkap')
  const kelompokKosong = data.kelompok.filter(k => k.direkap === 0)
  const kelompokRendah = data.kelompok
    .filter(k => k.slot > 0 && k.percent < target)
    .sort((a, b) => a.percent - b.percent)

  return (
    <section className="rounded-xl border border-warning/40 bg-card p-5">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Perlu Perhatian — {bulan}</h2>
          <p className="text-xs text-muted-foreground">
            {utama.length.toLocaleString('id-ID')} peserta perlu ditindaklanjuti dari {data.totalPeserta.toLocaleString('id-ID')} terdata
            {berjalan && ' · bulan berjalan, rekap kehadiran mungkin belum lengkap'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {URUTAN_PERHATIAN.map(s => (
          <span key={s} className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums', WARNA[s])}>
            {LABEL_PERHATIAN[s]} · {(hitung.get(s) ?? 0).toLocaleString('id-ID')}
          </span>
        ))}
      </div>

      {(kelompokKosong.length > 0 || kelompokRendah.length > 0) && (
        <div className="mb-4 space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
          <p className="font-semibold">Kelompok yang perlu didampingi</p>
          {kelompokKosong.length > 0 && (
            <p>
              <span className="font-medium text-destructive">Belum mengisi rekap {bulan}:</span>{' '}
              {kelompokKosong.map(k => `${k.pengampu} (${k.nama}, ${k.peserta} org)`).join(' · ')}
            </p>
          )}
          {kelompokRendah.length > 0 && (
            <p>
              <span className="font-medium text-warning">Kehadiran di bawah {target}%:</span>{' '}
              {kelompokRendah.map(k => `${k.pengampu} ${k.percent}% (${k.aktif}/${k.peserta} aktif)`).join(' · ')}
            </p>
          )}
        </div>
      )}

      {utama.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {belumDirekap.length === data.totalPeserta
            ? `Belum ada rekap ${bulan} yang masuk — daftar ini terisi begitu pengampu merekap kehadiran.`
            : `Tidak ada peserta yang belum mengaji, absen, atau tanpa capaian pada ${bulan}.`}
        </p>
      ) : (
        <DaftarPerUnit peserta={utama} />
      )}

      {belumDirekap.length > 0 && (
        <details className="group mt-4 rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium">
            <span>Belum direkap kehadirannya · {belumDirekap.length.toLocaleString('id-ID')} peserta</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t px-3 pb-3 pt-2">
            <DaftarPerUnit peserta={belumDirekap} />
          </div>
        </details>
      )}
    </section>
  )
}

function DaftarPerUnit({ peserta }: { peserta: PesertaPerhatian[] }) {
  const perUnit = new Map<string, PesertaPerhatian[]>()
  for (const p of peserta) perUnit.set(p.unit, [...(perUnit.get(p.unit) ?? []), p])
  // Unit dengan daftar terpanjang di atas: itulah yang paling perlu digerakkan.
  const unit = [...perUnit.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {unit.map(([nama, daftar]) => (
        <div key={nama}>
          <p className="mb-1 text-xs font-semibold text-primary">
            {nama} <span className="font-normal text-muted-foreground">· {daftar.length} peserta</span>
          </p>
          <ul className="divide-y">
            {daftar.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">{p.nama}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.pengampu} · {p.kelompok}
                    {p.slot > 0 && ` · hadir ${p.hadir}/${p.slot}`}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', WARNA[p.status])}>
                  {LABEL_PERHATIAN[p.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
