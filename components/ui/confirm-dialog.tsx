'use client'

import * as React from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConfirmOptions {
  /** Pertanyaannya, satu baris. Mis. `Hapus rapat "Evaluasi Bulanan"?` */
  title: string
  /** Akibat yang perlu diketahui sebelum menekan tombol merah. */
  description?: string
  /** Label tombol aksi. Pakai kata kerja spesifik, bukan "OK". */
  confirmText?: string
  cancelText?: string
  /** `danger` untuk yang merusak data (default). `default` untuk aksi biasa. */
  tone?: 'danger' | 'default'
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = React.createContext<Confirm | null>(null)

/**
 * Pengganti `window.confirm()` yang sinkron. Satu dialog dipasang di root,
 * lalu dipinjam siapa pun lewat `useConfirm()`.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null)
  const [open, setOpen] = React.useState(false)
  // Resolver disimpan di ref, bukan state: ia dipanggil dari event handler dan
  // tidak boleh ikut memicu render saat disetel.
  const resolverRef = React.useRef<((ok: boolean) => void) | null>(null)

  const confirm = React.useCallback<Confirm>((next) => {
    // Kalau ada permintaan yang masih menggantung, tutup sebagai "batal" supaya
    // pemanggil lamanya tidak menunggu selamanya.
    resolverRef.current?.(false)
    setOptions(next)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = React.useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setOpen(false)
    // `options` sengaja tidak dikosongkan supaya animasi menutupnya mulus.
  }, [])

  const danger = options?.tone !== 'default'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(next) => { if (!next) settle(false) }}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <div className="flex items-start gap-3">
              {danger && (
                <span
                  aria-hidden
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                >
                  <TriangleAlert className="size-4" />
                </span>
              )}
              <div className="flex flex-col gap-2">
                <DialogTitle>{options?.title}</DialogTitle>
                <DialogDescription className="whitespace-pre-line">
                  {options?.description ?? 'Tindakan ini tidak bisa dibatalkan.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            {/* Fokus awal jatuh ke Batal: kalau dialog muncul karena kepencet,
                menekan Enter refleks tidak jadi menghapus apa pun. */}
            <Button variant="outline" autoFocus onClick={() => settle(false)}>
              {options?.cancelText ?? 'Batal'}
            </Button>
            <Button
              variant={danger ? 'destructive' : 'default'}
              onClick={() => settle(true)}
            >
              {options?.confirmText ?? 'Ya, lanjutkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

/** `const confirm = useConfirm()` lalu `if (!(await confirm({ ... }))) return`. */
export function useConfirm(): Confirm {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm() harus dipakai di dalam <ConfirmProvider>')
  return ctx
}
