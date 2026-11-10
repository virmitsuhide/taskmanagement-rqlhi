import { ChevronDown } from 'lucide-react'
import { renderMarkdown } from '@/lib/markdown'
import { hariTerbit, LABEL_JENIS, LABEL_PEMBACA, tanggalTerbit, type EntriChangelog, type JenisChangelog } from '@/lib/rq/changelog'
import { cn } from '@/lib/utils'

const KELAS_JENIS: Record<JenisChangelog, string> = {
  baru: 'bg-primary/10 text-primary',
  perubahan: 'bg-info-wash text-info',
  perbaikan: 'bg-muted text-muted-foreground',
}

export function LencanaJenis({ jenis }: { jenis: JenisChangelog }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', KELAS_JENIS[jenis])}>
      {LABEL_JENIS[jenis]}
    </span>
  )
}

/** Isi satu entri — dipakai daftar pembaca dan layar kelola. */
export function IsiChangelog({ e, tampilPembaca = false, akanTerbit = false }: { e: EntriChangelog; tampilPembaca?: boolean; akanTerbit?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <LencanaJenis jenis={e.jenis} />
        <time dateTime={e.terbit_at}>{tanggalTerbit(e.terbit_at)}</time>
        {akanTerbit && <span className="font-semibold text-warning">· terjadwal</span>}
        {tampilPembaca && <span>· untuk {e.untuk.map(p => LABEL_PEMBACA[p]).join(', ')}</span>}
      </div>
      <h3 className="mt-1.5 text-[15px] font-bold leading-snug">{e.judul}</h3>
      {e.isi && (
        <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(e.isi) }} />
      )}
    </>
  )
}

/** Kelompok per tanggal terbit (WIB), urutan masukan dipertahankan (terbaru di atas). */
function perTanggal(daftar: EntriChangelog[]): { hari: string; entri: EntriChangelog[] }[] {
  const kelompok: { hari: string; entri: EntriChangelog[] }[] = []
  for (const e of daftar) {
    const hari = hariTerbit(e.terbit_at)
    const akhir = kelompok[kelompok.length - 1]
    if (akhir?.hari === hari) akhir.entri.push(e)
    else kelompok.push({ hari, entri: [e] })
  }
  return kelompok
}

/**
 * Daftar pembaruan untuk pembaca (pengurus, guru, karyawan), bergaya catatan
 * patch: satu blok per tanggal, terbaru di atas. Isi pembaruan di tanggal
 * terbaru terbuka; yang lampau hanya judul, diklik baru terbuka. Memakai
 * <details> bawaan peramban — tanpa JavaScript, tetap jalan di HP lemah.
 */
export function DaftarChangelog({ daftar }: { daftar: EntriChangelog[] | null }) {
  if (daftar === null) {
    return <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">Pembaruan sistem belum tersedia.</p>
  }
  if (daftar.length === 0) {
    return <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">Belum ada kabar pembaruan sistem.</p>
  }
  return (
    <ol className="space-y-6">
      {perTanggal(daftar).map((k, ki) => (
        <li key={k.hari}>
          <div className="mb-2 flex items-baseline gap-2 border-b pb-1.5">
            <h2 className={cn('font-bold tracking-tight', ki === 0 ? 'text-lg' : 'text-[15px]')}>
              <time dateTime={k.hari}>{tanggalTerbit(k.entri[0].terbit_at)}</time>
            </h2>
            {ki === 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Terbaru</span>}
            <span className="ml-auto text-xs text-muted-foreground">{k.entri.length} pembaruan</span>
          </div>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {k.entri.map(e => (
              <li key={e.id} id={`pembaruan-${e.id}`}>
                {e.isi ? (
                  <details open={ki === 0} className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-2.5 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                      <LencanaJenis jenis={e.jenis} />
                      <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{e.judul}</span>
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(e.isi) }} />
                  </details>
                ) : (
                  <div className="flex items-start gap-2.5 px-4 py-3">
                    <LencanaJenis jenis={e.jenis} />
                    <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{e.judul}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
