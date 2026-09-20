'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { simpanRaporIsianAction } from '@/app/actions/rapor-isian'
import { MEDAN_PER_KODE, type KodeMedan } from '@/lib/rapor/medan'
import { cn } from '@/lib/utils'

export interface TetanggaRapor {
  id: string
  nama: string
}

interface Props {
  studentId: string
  termId: string
  templateId: string | null
  nama: string
  deskripsiAwal: string
  timpaanAwal: Record<string, string>
  /** Angka hitungan sistem per medan — pembanding saat guru menimpa. */
  asli: Record<KodeMedan, string>
  /** Medan yang dipakai template ini dan boleh ditimpa guru. */
  bisaDitimpa: KodeMedan[]
  sebelum: TetanggaRapor | null
  sesudah: TetanggaRapor | null
  urutan: { ke: number; dari: number }
}

/**
 * Layar isi rapor seorang anak.
 *
 * Guru berjalan menyusuri satu sesi dengan panah ◀ ▶, bukan kembali ke
 * daftar tiap selesai satu anak: mengisi rapor adalah satu duduk untuk
 * seluruh halaqoh, dan tiap kembali ke daftar berarti mencari lagi sampai
 * mana tadi. Perpindahan menawarkan simpan dulu bila masih ada yang belum
 * tersimpan — kehilangan satu paragraf deskripsi berarti menulisnya ulang.
 */
export function IsiRapor({
  studentId, termId, templateId, nama, deskripsiAwal, timpaanAwal, asli, bisaDitimpa, sebelum, sesudah, urutan,
}: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [deskripsi, setDeskripsi] = useState(deskripsiAwal)
  const [timpaan, setTimpaan] = useState<Record<string, string>>(timpaanAwal)
  const [kotor, setKotor] = useState(false)

  function simpan(lalu?: () => void) {
    mulai(async () => {
      const hasil = await simpanRaporIsianAction(studentId, termId, templateId, deskripsi, timpaan)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      setKotor(false)
      toast.success(`Rapor ${nama} tersimpan.`)
      if (lalu) lalu()
      else router.refresh()
    })
  }

  function pindah(ke: TetanggaRapor | null) {
    if (!ke) return
    const tuju = () => router.push(`/guru/rapor-quran/${ke.id}`)
    if (!kotor) {
      tuju()
      return
    }
    if (confirm(`Deskripsi ${nama} belum tersimpan. Simpan dulu sebelum pindah?`)) simpan(tuju)
    else tuju()
  }

  return (
    <div className="space-y-4">
      {/* ── Penjelajah sesi ── */}
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2">
        <Button type="button" variant="outline" size="sm" disabled={!sebelum || pending} onClick={() => pindah(sebelum)}>
          <ChevronLeft />
          <span className="max-w-[9rem] truncate">{sebelum?.nama ?? 'Awal'}</span>
        </Button>
        <span className="shrink-0 text-xs text-muted-foreground">{urutan.ke} dari {urutan.dari}</span>
        <Button type="button" variant="outline" size="sm" disabled={!sesudah || pending} onClick={() => pindah(sesudah)}>
          <span className="max-w-[9rem] truncate">{sesudah?.nama ?? 'Akhir'}</span>
          <ChevronRight />
        </Button>
      </div>

      {/* ── Deskripsi ── */}
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="font-semibold" htmlFor="deskripsi">Deskripsi perkembangan</label>
          <span className="text-xs text-muted-foreground">{deskripsi.trim().length} huruf</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Yang tidak bisa dibaca dari angka: sikapnya selama halaqoh, apa yang sudah lancar, apa yang masih perlu
          dibimbing. Angka-angka di lembar rapor sudah terisi sendiri.
        </p>
        <textarea
          id="deskripsi"
          value={deskripsi}
          disabled={pending}
          rows={9}
          onChange={e => { setDeskripsi(e.target.value); setKotor(true) }}
          placeholder={`Alhamdulillah, selama pembelajaran Al-Qur'an Ananda ${nama.split(' ')[0]}…`}
          className="w-full rounded-md border bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {/* ── Timpaan angka ── */}
      {bisaDitimpa.length > 0 && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Timpa angka</summary>
          <p className="mt-1 text-sm text-muted-foreground">
            Kosongkan untuk memakai hitungan sistem. Diisi hanya bila ada pertimbangan lain — anak yang lama sakit,
            misalnya, yang rata-ratanya turun bukan karena kemampuannya.
          </p>
          <ul className="mt-3 space-y-2">
            {bisaDitimpa.map(kode => (
              <li key={kode} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[13rem] flex-1 text-sm">{MEDAN_PER_KODE.get(kode)?.label ?? kode}</span>
                <span className={cn('text-sm tabular-nums', timpaan[kode] ? 'text-muted-foreground line-through' : 'font-medium')}>
                  {asli[kode] || '—'}
                </span>
                <Input
                  value={timpaan[kode] ?? ''}
                  disabled={pending}
                  placeholder="timpa"
                  onChange={e => { setTimpaan({ ...timpaan, [kode]: e.target.value }); setKotor(true) }}
                  className="h-9 w-24"
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" variant="outline" onClick={() => window.print()} disabled={pending}>
          <Printer /> Cetak
        </Button>
        <Button type="button" className="flex-1" onClick={() => simpan()} disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        {sesudah && (
          <Button type="button" variant="secondary" disabled={pending}
            onClick={() => simpan(() => router.push(`/guru/rapor-quran/${sesudah.id}`))}>
            Simpan & lanjut <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  )
}
