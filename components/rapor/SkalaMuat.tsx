'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus, ZoomIn } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Perkecil satu halaman rapor supaya muat utuh di layar — lebar kolomnya
 * DAN tinggi jendela — untuk pratinjau koordinator dan guru.
 *
 * Lembar ber-tata-letak Word berukuran kertas sungguhan (F4 ≈ 795 × 1248 px),
 * lebih besar dari layar mana pun. Tanpa pengecil, orang hanya melihat
 * sepotong halaman dan harus menggulir ke dua arah untuk menilai hasilnya.
 * Halaman yang sudah kecil bisa diklik untuk dibuka besar, seperti foto:
 * sekali lihat untuk tata letak, sekali klik untuk membaca isinya.
 *
 * transform: scale tidak mengubah ukuran tata letak, jadi pembungkusnya
 * diberi ukuran hasil skala secara eksplisit. Saat dicetak skalanya lepas:
 * kertas harus tetap seukuran aslinya.
 */
export function SkalaMuat({
  children,
  sisaTinggi = 150,
  pasTinggi = true,
  bisaDiperbesar = true,
  kali = 1,
}: {
  children: ReactNode
  /** Tinggi layar yang dipakai hal lain (header, label) — px. */
  sisaTinggi?: number
  /** false = hanya menyesuaikan lebar (dipakai tampilan besar). */
  pasTinggi?: boolean
  /** Klik untuk membuka tampilan besar. */
  bisaDiperbesar?: boolean
  /** Pengali sesudah disesuaikan — perbesaran di tampilan besar. */
  kali?: number
}) {
  const luar = useRef<HTMLDivElement>(null)
  const dalam = useRef<HTMLDivElement>(null)
  const [ukur, setUkur] = useState<{ skala: number; lebar: number; tinggi: number } | null>(null)
  const [besar, setBesar] = useState(false)

  useLayoutEffect(() => {
    const el = luar.current
    const isi = dalam.current
    if (!el || !isi) return
    const hitung = () => {
      // offsetWidth/Height = ukuran asli, tidak terpengaruh transform.
      const lebar = isi.offsetWidth
      const tinggi = isi.offsetHeight
      if (!lebar || !tinggi) return
      const muatLebar = el.clientWidth / lebar
      const muatTinggi = pasTinggi ? Math.max(320, window.innerHeight - sisaTinggi) / tinggi : Infinity
      const skala = Math.min(1, muatLebar, muatTinggi) * kali
      setUkur(u => (u && Math.abs(u.skala - skala) < 0.001 && u.lebar === lebar && u.tinggi === tinggi ? u : { skala, lebar, tinggi }))
    }
    hitung()
    const ro = new ResizeObserver(hitung)
    ro.observe(el)
    ro.observe(isi)
    window.addEventListener('resize', hitung)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', hitung)
    }
  }, [sisaTinggi, pasTinggi, kali])

  const kotak = (
    <div
      className="mx-auto print:!h-auto print:!w-auto"
      style={ukur ? { width: ukur.lebar * ukur.skala, height: ukur.tinggi * ukur.skala } : undefined}
    >
      <div
        ref={dalam}
        className="w-max origin-top-left print:!transform-none"
        style={ukur ? { transform: `scale(${ukur.skala})` } : { visibility: 'hidden' }}
      >
        {children}
      </div>
    </div>
  )

  if (!bisaDiperbesar) return <div ref={luar} className="w-full print:!h-auto">{kotak}</div>

  // Diperbesar hanya bila memang terlihat lebih kecil dari aslinya.
  const kecil = ukur !== null && ukur.skala < 0.98
  return (
    <div ref={luar} className="w-full print:!h-auto">
      <div
        role={kecil ? 'button' : undefined}
        tabIndex={kecil ? 0 : undefined}
        aria-label={kecil ? 'Perbesar halaman rapor' : undefined}
        onClick={kecil ? () => setBesar(true) : undefined}
        onKeyDown={kecil ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBesar(true) } } : undefined}
        className={kecil ? 'group relative mx-auto w-fit cursor-zoom-in rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring print:cursor-auto' : undefined}
      >
        {kotak}
        {kecil && (
          // Selalu terlihat, bukan hanya saat disorot: layar sentuh tidak mengenal hover.
          <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-80 transition-opacity group-hover:opacity-100 print:hidden">
            <ZoomIn className="size-3.5" aria-hidden /> Perbesar
          </span>
        )}
      </div>
      {kecil && <TampilanBesar buka={besar} setBuka={setBesar}>{children}</TampilanBesar>}
    </div>
  )
}

const LANGKAH = [1, 1.25, 1.5, 2]

/** Halaman yang sama, selebar layar, bisa diperbesar lagi dan digulir. */
function TampilanBesar({ buka, setBuka, children }: { buka: boolean; setBuka: (b: boolean) => void; children: ReactNode }) {
  const [tingkat, setTingkat] = useState(0)
  return (
    <Dialog open={buka} onOpenChange={b => { setBuka(b); if (!b) setTingkat(0) }}>
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-[960px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px] print:hidden">
        <div className="flex items-center gap-2 border-b py-2 pl-4 pr-12">
          <DialogTitle className="text-sm font-medium">Pratinjau lembar rapor</DialogTitle>
          <DialogDescription className="sr-only">Halaman rapor ukuran besar. Gulir untuk membaca, tombol plus dan minus untuk memperbesar.</DialogDescription>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="outline" size="icon-sm" aria-label="Perkecil" disabled={tingkat === 0} onClick={() => setTingkat(t => Math.max(0, t - 1))}>
              <Minus />
            </Button>
            <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{Math.round(LANGKAH[tingkat] * 100)}%</span>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Perbesar" disabled={tingkat === LANGKAH.length - 1} onClick={() => setTingkat(t => Math.min(LANGKAH.length - 1, t + 1))}>
              <Plus />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/50 p-2 sm:p-4">
          <SkalaMuat pasTinggi={false} bisaDiperbesar={false} kali={LANGKAH[tingkat]}>{children}</SkalaMuat>
        </div>
      </DialogContent>
    </Dialog>
  )
}
