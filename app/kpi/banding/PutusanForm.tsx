'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { putusBandingAction } from '@/app/actions/kpi-banding'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { KpiBandingStatus } from '@/types'

/** Ketiga putusan yang tersedia, beserta akibatnya — ditulis di layar. */
const PILIHAN: { nilai: KpiBandingStatus; label: string; akibat: string; tone: string }[] = [
  {
    nilai: 'diterima',
    label: 'Diterima',
    akibat: 'Rapor kembali ke draf dengan versi baru; nilainya dibetulkan lalu diterbitkan ulang.',
    tone: 'border-success/40 bg-success-wash text-success',
  },
  {
    nilai: 'diterima_sebagian',
    label: 'Diterima sebagian',
    akibat: 'Sama seperti diterima, dan guru masih boleh menaikkan sisanya ke Kepala RQ.',
    tone: 'border-primary/40 bg-primary-wash text-primary',
  },
  {
    nilai: 'ditolak',
    label: 'Ditolak',
    akibat: 'Rapor kembali terbit; guru boleh menandatangani atau naik ke Kepala RQ.',
    tone: 'border-destructive/40 bg-destructive-wash text-destructive',
  },
]

/**
 * Formulir putusan banding.
 *
 * Akibat tiap pilihan ditulis di sebelah pilihannya, bukan disembunyikan di
 * dokumentasi. Yang memutus perlu tahu bahwa "diterima" menarik rapor kembali
 * ke SDM dan menggugurkan tanda tangan koordinator — kalau ia baru tahu
 * sesudahnya, ia akan memilih berdasarkan tebakan.
 *
 * Alasan wajib untuk ketiganya, termasuk saat menerima: itulah yang dibaca SDM
 * ketika membetulkan angkanya, dan yang dibaca guru sebagai jawaban.
 */
export function PutusanForm({ bandingId, tingkat }: { bandingId: string; tingkat: number }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(putusBandingAction, null)
  const [pilih, setPilih] = useState<KpiBandingStatus | null>(null)

  useEffect(() => {
    if (state && 'success' in state) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="mt-3 border-t pt-3">
      <input type="hidden" name="banding_id" value={bandingId} />

      <p className="text-xs font-medium">
        Putusan Anda {tingkat === 2 && <span className="text-warning">(final — tidak bisa dinaikkan lagi)</span>}
      </p>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {PILIHAN.map(o => (
          <label
            key={o.nilai}
            className={cn(
              'cursor-pointer rounded-md border px-2.5 py-2 text-xs transition-colors',
              pilih === o.nilai ? o.tone : 'hover:bg-muted',
            )}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <input
                type="radio"
                name="putusan"
                value={o.nilai}
                checked={pilih === o.nilai}
                onChange={() => setPilih(o.nilai)}
                className="h-3 w-3"
              />
              {o.label}
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{o.akibat}</span>
          </label>
        ))}
      </div>

      <textarea
        name="alasan"
        rows={3}
        required
        placeholder="Apa yang Anda periksa dan apa yang Anda temukan. Kalimat ini dibaca guru sebagai jawaban atas bandingnya."
        className="mt-2.5 w-full rounded-md border bg-background px-2.5 py-2 text-sm"
      />

      {state && 'error' in state && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <Button type="submit" size="sm" className="mt-2.5" disabled={pending || !pilih}>
        Simpan Putusan
      </Button>
    </form>
  )
}
