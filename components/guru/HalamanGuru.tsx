import { cn } from '@/lib/utils'

const LEBAR = {
  sempit: 'max-w-2xl',
  sedang: 'max-w-3xl',
  lebar: 'max-w-5xl',
} as const

/**
 * Kerangka halaman portal guru: latar polos, judul tebal sans, keterangan
 * di bawahnya, tombol aksi di kanan. Satu tempat supaya Pengajuan Ujian,
 * Rapor KPI, dan Pembinaan Gukar tidak lagi berbeda gaya satu sama lain.
 */
export function HalamanGuru({ judul, keterangan, aksi, atas, lebar = 'sedang', className, children }: {
  judul: React.ReactNode
  keterangan?: React.ReactNode
  /** Tombol di kanan judul, mis. "Ajukan ujian". */
  aksi?: React.ReactNode
  /** Di atas judul — tautan kembali atau remah roti. */
  atas?: React.ReactNode
  lebar?: keyof typeof LEBAR
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('mx-auto p-4 md:p-6', LEBAR[lebar], className)}>
      {atas}
      <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', atas && 'mt-2')}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{judul}</h1>
          {keterangan && <p className="mt-0.5 text-sm text-muted-foreground">{keterangan}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </div>
  )
}
