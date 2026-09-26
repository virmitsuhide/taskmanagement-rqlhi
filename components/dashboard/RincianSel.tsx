'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { SiswaSel } from '@/lib/data/capaian-kelas'

/**
 * Isi sebuah sel matriks capaian: angkanya menjadi tombol yang membuka daftar
 * siswa di baliknya — nama, pengampu, dan setoran terakhirnya.
 *
 * Satu-satunya bagian klien dari tabel capaian; tabelnya sendiri tetap
 * dirender di server. Tiap sel hanya membawa siswanya sendiri.
 */
export function RincianSel({ judul, siswa, children, className }: {
  judul: string
  siswa: SiswaSel[]
  children: React.ReactNode
  className?: string
}) {
  const bertarget = siswa.filter(s => s.capai !== null)
  const capai = bertarget.filter(s => s.capai).length

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title={`Lihat ${siswa.length} siswa`}
          className={cn(
            'w-full cursor-pointer rounded-sm tabular-nums underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary',
            className,
          )}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{judul}</DialogTitle>
          <DialogDescription>
            {siswa.length.toLocaleString('id-ID')} siswa
            {bertarget.length > 0 && <> · {capai.toLocaleString('id-ID')} mencapai target</>}
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-4 divide-y overflow-y-auto border-t px-4">
          {siswa.map((s, i) => (
            <li key={`${s.nama}-${i}`} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">
                  {s.nama}
                  {s.kelas && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{s.kelas}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.pengampu ?? <span className="italic">Pengampu belum diatur</span>}
                </p>
                <p className="mt-0.5 text-xs">
                  {s.posisi ?? <span className="italic text-warning">Belum ada setoran</span>}
                  {s.tanggal && <span className="text-muted-foreground"> · {s.tanggal}</span>}
                </p>
              </div>
              {s.capai !== null && (
                <span
                  className={cn(
                    'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    s.capai ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {s.capai ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {s.capai ? 'Target' : 'Belum target'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
