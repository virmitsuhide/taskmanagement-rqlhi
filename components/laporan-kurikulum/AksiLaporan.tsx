'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileDown, Printer, RefreshCw, RotateCcw, Send, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ajukanLaporanAction, bukaKembaliLaporanAction, buatLaporanAction, hitungUlangLaporanAction,
  kembalikanLaporanAction, setujuiLaporanAction,
} from '@/app/actions/laporan-kurikulum'
import type { StatusLaporan } from '@/lib/data/laporan-kurikulum'

type Hasil = { error?: string; success?: string }

function useAksi() {
  const [pending, mulai] = useTransition()
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const jalankan = (f: () => Promise<Hasil>, sesudah?: () => void) => mulai(async () => {
    const r = await f()
    setPesan(r.error ? { ok: false, teks: r.error } : { ok: true, teks: r.success ?? 'Berhasil.' })
    if (!r.error) sesudah?.()
  })
  return { pending, pesan, jalankan }
}

export function AksiLaporan({ periode, status, bisaSusun, bisaSetujui }: {
  periode: string
  status: StatusLaporan
  bisaSusun: boolean
  bisaSetujui: boolean
}) {
  const { pending, pesan, jalankan } = useAksi()
  const [catatan, setCatatan] = useState('')

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="bg-accent-warm text-white hover:bg-accent-warm/90">
          <a href={`/laporan-kurikulum/${periode}/docx`}><FileDown className="mr-1.5 h-4 w-4" />Unduh .docx</a>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />Cetak / PDF
        </Button>
        {bisaSusun && status === 'draf' && (
          <>
            <Button type="button" size="sm" variant="outline" disabled={pending}
              onClick={() => { if (confirm('Hitung ulang semua angka dari data terbaru? Narasi yang sudah ditulis tetap dipertahankan.')) jalankan(() => hitungUlangLaporanAction(periode)) }}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Hitung ulang
            </Button>
            <Button type="button" size="sm" disabled={pending}
              onClick={() => { if (confirm('Ajukan laporan ke Kepala RQ? Narasi tidak bisa diubah sampai dikembalikan.')) jalankan(() => ajukanLaporanAction(periode)) }}>
              <Send className="mr-1.5 h-4 w-4" />Ajukan ke Kepala RQ
            </Button>
          </>
        )}
        {bisaSetujui && status === 'disetujui' && (
          <Button type="button" size="sm" variant="outline" disabled={pending}
            onClick={() => { if (confirm('Buka kembali laporan yang sudah disetujui sebagai draf?')) jalankan(() => bukaKembaliLaporanAction(periode)) }}>
            <RotateCcw className="mr-1.5 h-4 w-4" />Buka kembali
          </Button>
        )}
      </div>

      {bisaSetujui && status === 'diajukan' && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Catatan Kepala RQ (wajib bila dikembalikan)</span>
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} className="rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => jalankan(() => setujuiLaporanAction(periode, catatan))}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />Setujui
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => jalankan(() => kembalikanLaporanAction(periode, catatan))}>
              <Undo2 className="mr-1.5 h-4 w-4" />Kembalikan ke Kumik
            </Button>
          </div>
        </div>
      )}

      {pesan && <p className={pesan.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{pesan.teks}</p>}
    </div>
  )
}

/** Pilih bulan lalu buat edisinya; bulan yang sudah punya edisi tidak ditawarkan. */
export function BuatLaporan({ pilihan }: { pilihan: { periode: string; label: string }[] }) {
  const router = useRouter()
  const { pending, pesan, jalankan } = useAksi()
  const [periode, setPeriode] = useState(pilihan[0]?.periode ?? '')
  if (pilihan.length === 0) return <p className="text-sm text-muted-foreground">Semua bulan sudah punya laporan.</p>
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={periode} onChange={e => setPeriode(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Bulan laporan">
          {pilihan.map(p => <option key={p.periode} value={p.periode}>{p.label}</option>)}
        </select>
        <Button type="button" size="sm" disabled={pending || !periode}
          onClick={() => jalankan(() => buatLaporanAction(periode), () => router.push(`/laporan-kurikulum/${periode}`))}>
          {pending ? 'Menghitung…' : 'Buat laporan'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Angka dihitung per tanggal terakhir bulan yang dipilih (±5 detik).</p>
      {pesan && !pesan.ok && <p className="text-sm text-destructive">{pesan.teks}</p>}
    </div>
  )
}
