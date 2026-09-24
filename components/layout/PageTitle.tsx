import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  title: ReactNode
  /** Keterangan di bawah judul. */
  children?: ReactNode
  /** Tombol/aksi di kanan judul; turun ke bawah di layar sempit. */
  actions?: ReactNode
}

/**
 * Judul halaman berikon untuk halaman pengurus yang memakai `ownH1` di
 * DashboardHeader. Satu bentuk untuk semua, supaya judul tak berubah-ubah
 * ukuran & jaraknya dari halaman ke halaman.
 */
export function PageTitle({ icon, title, children, actions }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-xl font-bold leading-tight md:text-2xl">{title}</h1>
          {children && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}
