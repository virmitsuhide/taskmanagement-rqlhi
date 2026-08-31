'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { resetRaporAction } from '@/app/actions/kpi-rapor'
import { STATUS_LABELS } from '@/lib/kpi/alur'
import { Button } from '@/components/ui/button'
import type { KpiRaporStatus } from '@/types'

interface Props {
  kpiId: string
  fullName: string
  status: KpiRaporStatus
  rapot: number
}

/**
 * Hapus penilaian KPI seorang guru untuk satu periode — khusus Kepala RQ.
 *
 * Duduk sebaris dengan tombol Isi dan Cetak, bukan tersembunyi di panel atas.
 * Alasannya sederhana: yang dihapus adalah penilaian SATU orang, jadi
 * perintahnya semestinya berada pada baris orang itu. Memilih nama dari daftar
 * turun di tempat lain memindahkan sasaran menjauh dari matanya, dan menghapus
 * penilaian guru yang salah adalah kesalahan yang tidak bisa dibatalkan.
 *
 * Konfirmasinya mengulang nama dan nilainya. Ikon panah melingkar mudah
 * tertukar dengan "muat ulang", dan satu ketukan yang keliru menghapus
 * pekerjaan SDM sebulan penuh.
 */
export function ResetRaporButton({ kpiId, fullName, status, rapot }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [buka, setBuka] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  const jalankan = () =>
    start(async () => {
      const hasil = await resetRaporAction(kpiId, alasan)
      if ('error' in hasil) {
        setGalat(hasil.error)
        return
      }
      setBuka(false)
      setAlasan('')
      setGalat(null)
      router.refresh()
    })

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        title="Hapus penilaian bulan ini"
        aria-label={`Hapus penilaian KPI ${fullName}`}
        className="inline-flex rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <>
      {/* Latar gelap: penghapusan tidak boleh terjadi sambil lalu. */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => !pending && setBuka(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Hapus penilaian KPI ${fullName}`}
        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-lg"
      >
        <p className="text-sm font-semibold text-destructive">Hapus penilaian KPI?</p>
        <p className="mt-1.5 text-sm">
          <b>{fullName}</b> — nilai <b className="tabular-nums">{rapot.toFixed(1)}</b>,
          status {STATUS_LABELS[status].toLowerCase()}.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Seluruh isiannya dihapus dan guru ini kembali tercatat{' '}
          <b className="text-foreground">belum dinilai</b> untuk periode ini — bukan bernilai
          nol. Tanda tangan koordinator dan guru ikut gugur. Riwayatnya tetap tersimpan,
          termasuk catatan penghapusan ini.
        </p>

        <textarea
          value={alasan}
          onChange={e => setAlasan(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Alasan penghapusan — tercatat di riwayat periode ini."
          className="mt-3 w-full rounded-md border bg-background px-2.5 py-2 text-sm"
        />

        {galat && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {galat}
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setBuka(false)}>
            Batal
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={jalankan}>
            {pending ? 'Menghapus…' : 'Hapus penilaian'}
          </Button>
        </div>
      </div>
    </>
  )
}
