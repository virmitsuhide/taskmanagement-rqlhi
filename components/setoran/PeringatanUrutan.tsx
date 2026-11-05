import { AlertTriangle } from 'lucide-react'
import type { PeringatanUrutan } from '@/app/actions/setoran-koreksi'
import { cn } from '@/lib/utils'

function tanggalPendek(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/**
 * Pemindahan tanggal setoran tahsin yang membuat halaman tidak berurutan.
 * Tombol "Tetap pindahkan" ada di pemanggil, karena cara mengirim ulangnya
 * berbeda per formulir.
 */
export function KotakPeringatanUrutan({ p }: { p: PeringatanUrutan }) {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-warning/40 bg-warning-wash p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-warning">
        <AlertTriangle className="h-3.5 w-3.5" /> Urutan halaman {p.jilid} jadi tidak berurutan
      </p>
      <ul className="space-y-0.5">
        {p.baris.map((b, i) => (
          <li key={i} className={cn('flex gap-2 tabular-nums', b.ini && 'font-semibold text-foreground')}>
            <span className="w-16 text-muted-foreground">{tanggalPendek(b.tanggal)}</span>
            <span>hal. {b.halaman}{b.ini && ' (setoran ini)'}</span>
          </li>
        ))}
      </ul>
      <p>
        Posisi anak akan menjadi <b>{p.sesudah}</b> (sekarang {p.sebelum}). Periksa dulu mana yang salah —
        tanggal setoran ini, atau halaman setoran lainnya.
      </p>
    </div>
  )
}
