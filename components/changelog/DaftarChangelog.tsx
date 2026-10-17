import { renderMarkdown } from '@/lib/markdown'
import { LABEL_JENIS, LABEL_PEMBACA, tanggalTerbit, type EntriChangelog, type JenisChangelog } from '@/lib/rq/changelog'
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

/** Daftar pembaruan untuk pembaca (pengurus, guru, karyawan). */
export function DaftarChangelog({ daftar }: { daftar: EntriChangelog[] | null }) {
  if (daftar === null) {
    return <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">Pembaruan sistem belum tersedia.</p>
  }
  if (daftar.length === 0) {
    return <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">Belum ada kabar pembaruan sistem.</p>
  }
  return (
    <ol className="space-y-3">
      {daftar.map(e => (
        <li key={e.id} id={`pembaruan-${e.id}`} className="rounded-2xl border bg-card p-4">
          <IsiChangelog e={e} />
        </li>
      ))}
    </ol>
  )
}
