'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { hapusTemplateWaAction, simpanTemplateWaAction } from '@/app/actions/laporan-ortu'
import { MAKS_TEMPLATE_WA, PENANDA_TEMPLATE, TEMPLATE_CONTOH, type TemplateWa } from '@/lib/rq/laporan-ortu'

/**
 * Pemilih template pesan WhatsApp: "Template dasar" + sampai 3 template guru
 * (0124). `pilih` 0 = template dasar, selebihnya nomor slot.
 */
export function PilihTemplateWa({ template, tabelAda, pilih, onPilih }: {
  template: TemplateWa[]
  tabelAda: boolean
  pilih: number
  onPilih: (slot: number) => void
}) {
  // null = penyunting tertutup; { slot } = menyunting slot itu (baru atau lama).
  const [sunting, setSunting] = useState<TemplateWa | null>(null)
  const slotKosong = [1, 2, 3].slice(0, MAKS_TEMPLATE_WA).find(s => !template.some(t => t.slot === s))
  const dipilih = template.find(t => t.slot === pilih)

  const chip = (aktif: boolean) => cn('h-8 rounded-full border px-3 text-xs font-semibold',
    aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Template pesan">
        <button type="button" className={chip(pilih === 0)} aria-pressed={pilih === 0} onClick={() => { onPilih(0); setSunting(null) }}>
          Template dasar
        </button>
        {template.map(t => (
          <button key={t.slot} type="button" className={chip(pilih === t.slot)} aria-pressed={pilih === t.slot}
            onClick={() => { onPilih(t.slot); setSunting(null) }}>
            {t.nama}
          </button>
        ))}
        {tabelAda && slotKosong && !sunting && (
          <button type="button" onClick={() => setSunting({ slot: slotKosong, nama: '', isi: TEMPLATE_CONTOH })}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Template baru
          </button>
        )}
        {dipilih && !sunting && (
          <button type="button" onClick={() => setSunting(dipilih)}
            className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground underline hover:text-foreground">
            <Pencil className="h-3 w-3" /> Ubah
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {tabelAda
          ? `Selain template dasar, Anda bisa menyimpan sampai ${MAKS_TEMPLATE_WA} template sendiri (${template.length}/${MAKS_TEMPLATE_WA} terpakai).`
          : 'Template sendiri belum bisa disimpan — fitur menunggu pembaruan basis data oleh admin.'}
      </p>
      {sunting && (
        <PenyuntingTemplate key={sunting.slot} awal={sunting} baru={!template.some(t => t.slot === sunting.slot)}
          tutup={(slotTersimpan) => { setSunting(null); if (slotTersimpan !== undefined) onPilih(slotTersimpan) }} />
      )}
    </div>
  )
}

function PenyuntingTemplate({ awal, baru, tutup }: {
  awal: TemplateWa
  baru: boolean
  /** slotTersimpan: pilih template ini sesudah disimpan (0 = kembali ke dasar sesudah dihapus). */
  tutup: (slotTersimpan?: number) => void
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [nama, setNama] = useState(awal.nama)
  const [isi, setIsi] = useState(awal.isi)
  const kotak = useRef<HTMLTextAreaElement>(null)

  // Sisipkan penanda di posisi kursor, lalu kembalikan fokus ke sana.
  function sisip(kode: string) {
    const el = kotak.current
    const awalPilih = el?.selectionStart ?? isi.length
    const akhirPilih = el?.selectionEnd ?? isi.length
    setIsi(isi.slice(0, awalPilih) + kode + isi.slice(akhirPilih))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(awalPilih + kode.length, awalPilih + kode.length)
    })
  }

  const simpan = () => mulai(async () => {
    const r = await simpanTemplateWaAction(awal.slot, nama, isi)
    if ('error' in r) { toast.error(r.error); return }
    toast.success(`Template "${nama.trim()}" tersimpan.`)
    router.refresh()
    tutup(awal.slot)
  })

  const hapus = () => {
    if (!window.confirm(`Hapus template "${awal.nama}"?`)) return
    mulai(async () => {
      const r = await hapusTemplateWaAction(awal.slot)
      if ('error' in r) { toast.error(r.error); return }
      toast.success('Template dihapus.')
      router.refresh()
      tutup(0)
    })
  }

  return (
    <div className="space-y-2.5 rounded-xl border bg-muted/30 p-3">
      <Input value={nama} onChange={e => setNama(e.target.value)} maxLength={40} placeholder="Nama template, mis. Laporan pekanan singkat"
        aria-label="Nama template" className="h-9" />
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Sisipkan data laporan — diisi otomatis saat pesan dibuat:</p>
        <div className="flex flex-wrap gap-1">
          {PENANDA_TEMPLATE.map(p => (
            <button key={p.kode} type="button" onClick={() => sisip(p.kode)} title={p.kode}
              className="rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-muted">
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <textarea ref={kotak} value={isi} onChange={e => setIsi(e.target.value)} rows={12} maxLength={4000}
        aria-label="Isi template"
        className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || !nama.trim() || !isi.trim()} onClick={simpan}>
          {pending ? 'Menyimpan…' : 'Simpan template'}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => tutup()}>Batal</Button>
        {!baru && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={hapus} className="ml-auto text-destructive hover:text-destructive">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
          </Button>
        )}
      </div>
    </div>
  )
}
