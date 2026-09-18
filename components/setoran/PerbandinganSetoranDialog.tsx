'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { bintangDariNilai } from '@/lib/rq/bintang'
import { cn } from '@/lib/utils'
import type { RingkasSetoran, SetoranGanda } from '@/lib/data/setoran-ganda'

/**
 * Peringatan "hari ini sudah ada setoran" — lama vs baru berdampingan.
 *
 * Muncul SEBELUM apa pun ditimpa. Penimpaan menggeser posisi anak dan
 * menyingkirkan setoran lama dari rekap, jadi guru harus melihat persis apa
 * yang akan hilang; baris yang berbeda ditandai supaya ralat satu angka tidak
 * tenggelam di antara isian yang sama.
 */

function tanggalPanjang(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function bintang(nilai: number | null): string {
  if (nilai === null) return '—'
  return `${bintangDariNilai(nilai)}★`
}

const BARIS: { label: string; ambil: (r: RingkasSetoran) => string }[] = [
  { label: 'Setoran', ambil: r => r.isi },
  { label: 'Status', ambil: r => (r.status === 'lulus' ? 'Lulus' : r.status === 'ulang' ? 'Ulang' : '—') },
  { label: 'Nilai', ambil: r => bintang(r.nilai) },
  { label: 'Adab', ambil: r => bintang(r.sikap) },
  { label: 'Catatan', ambil: r => r.catatan || '—' },
]

function Perbandingan({ g }: { g: SetoranGanda }) {
  // Umumnya hanya satu setoran lama; bila data lama sudah terlanjur ganda,
  // semuanya tampil dan semuanya ikut ditimpa.
  const kolom = [...g.lama.map((r, i) => ({ judul: `Lama${g.lama.length > 1 ? ` ${i + 1}` : ''}${r.waktu ? ` · ${r.waktu}` : ''}`, r })), { judul: 'Baru', r: g.baru }]
  const statusBerubah = g.lama.some(l => l.status !== null && g.baru.status !== null && l.status !== g.baru.status)

  return (
    <div className="rounded-lg border">
      <p className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">{g.nama}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="w-20 px-3 py-1.5 font-medium" />
              {kolom.map(k => (
                <th key={k.judul} className={cn('px-3 py-1.5 font-medium', k.judul === 'Baru' && 'text-primary')}>{k.judul}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BARIS.map(b => {
              const nilaiBaru = b.ambil(g.baru)
              const beda = g.lama.some(l => b.ambil(l) !== nilaiBaru)
              return (
                <tr key={b.label} className="border-t">
                  <td className="px-3 py-1.5 text-muted-foreground">{b.label}</td>
                  {kolom.map(k => (
                    <td
                      key={k.judul}
                      className={cn(
                        'px-3 py-1.5 align-top',
                        k.judul === 'Baru' && beda && 'bg-warning-wash font-semibold',
                        k.judul !== 'Baru' && beda && 'text-muted-foreground line-through decoration-muted-foreground/50',
                      )}
                    >
                      {b.ambil(k.r)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {statusBerubah && (
        <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          Status berubah — posisi halaman anak dihitung ulang mengikuti setoran baru.
        </p>
      )}
    </div>
  )
}

interface Props {
  daftar: SetoranGanda[]
  pending: boolean
  onTimpa: () => void
  onBatal: () => void
}

export function PerbandinganSetoranDialog({ daftar, pending, onTimpa, onBatal }: Props) {
  const tanggal = daftar[0]?.tanggal
  return (
    <Dialog open={daftar.length > 0} onOpenChange={buka => { if (!buka && !pending) onBatal() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {daftar.length === 1 ? 'Sudah ada setoran di tanggal ini' : `${daftar.length} anak sudah punya setoran di tanggal ini`}
          </DialogTitle>
          <DialogDescription>
            {tanggal ? `${tanggalPanjang(tanggal)}. ` : ''}
            Satu anak hanya punya satu setoran per hari. Bila ditimpa, setoran lama disimpan ke arsip
            dan yang dipakai untuk rekap, rapor, dan posisi halaman adalah setoran baru.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {daftar.map(g => <Perbandingan key={g.student_id} g={g} />)}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onBatal} disabled={pending}>
            Batal, jangan simpan
          </Button>
          <Button type="button" onClick={onTimpa} disabled={pending}>
            {pending ? 'Menimpa…' : daftar.length === 1 ? 'Timpa setoran lama' : `Timpa ${daftar.length} setoran`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
