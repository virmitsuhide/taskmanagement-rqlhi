'use client'

import { useState, useActionState } from 'react'
import { Pencil } from 'lucide-react'
import { saveReportNoteAction } from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  period: string
  section: string
  title: string
  /** Narasi tersimpan. Kosong = pakai draf otomatis. */
  content: string
  /** Draf dari angka (lib/finance/narasi.ts) — tampil selama belum ada narasi tersimpan. */
  draf?: string
  canManage: boolean
  /** Kotak: 'hijau' (sorotan, ringkasan KPI), 'emas' (evaluasi anggaran), 'biru' (catatan); 'polos' = paragraf tanpa kotak. */
  varian?: 'hijau' | 'emas' | 'biru' | 'polos'
  /** Paragraf (analisis diagram) alih-alih butir. */
  prosa?: boolean
  /** Awalan tebal paragraf, mis. "Analisis:". */
  awalan?: string
  /** @deprecated pakai varian="emas". */
  gold?: boolean
}

/**
 * Bagian naratif laporan — sorotan, analisis diagram, evaluasi anggaran.
 * Sistem menulis draf dari angka; bendahara/Kepala RQ menyunting. Yang
 * tersimpan selalu menang, dan mengosongkannya kembali ke draf otomatis.
 */
export function NarrativeEditor({ period, section, title, content, draf = '', canManage, varian, prosa, awalan, gold }: Props) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveReportNoteAction(prev, formData)
      if (result.success) setEditing(false)
      return result
    },
    null,
  )
  const v = varian ?? (gold ? 'emas' : 'biru')
  const teks = content || draf
  const dariDraf = !content && !!draf

  if (editing && canManage) {
    return (
      <form action={action} className="my-2 space-y-2 rounded-md border p-3 print:hidden">
        <input type="hidden" name="period" value={period} />
        <input type="hidden" name="section" value={section} />
        <p className="text-xs font-medium">{title}</p>
        <Textarea name="content" rows={prosa ? 6 : 5} defaultValue={teks} placeholder={prosa ? 'Paragraf analisis…' : 'Satu poin per baris…'} />
        <p className="text-[11px] text-muted-foreground">Kosongkan lalu simpan untuk kembali ke draf otomatis.</p>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-8" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan'}</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Batal</Button>
        </div>
      </form>
    )
  }

  const baris = teks.split('\n').map(s => s.trim()).filter(Boolean)
  const isi = !teks ? (
    <p style={{ opacity: 0.6 }}>Belum ditulis.</p>
  ) : prosa ? (
    baris.map((line, i) => (
      <p key={i} className="report-prosa">{i === 0 && awalan ? <><strong>{awalan}</strong> </> : null}{line}</p>
    ))
  ) : (
    // Tiap baris jadi satu poin, seperti kotak sorotan di template.
    <ul style={{ margin: 0, paddingLeft: 16 }}>
      {baris.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  )

  const tombol = canManage && (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 print:hidden">
      {dariDraf && <span className="rounded bg-[#fff3cd] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d1a]">draf otomatis</span>}
      <Button size="sm" variant="ghost" className="-mt-0.5 h-6 px-2 text-xs" onClick={() => setEditing(true)}>
        <Pencil className="mr-1 h-3 w-3" />Ubah
      </Button>
    </span>
  )

  if (v === 'polos') {
    return (
      <div className="report-analisis">
        {canManage && <div className="flex">{tombol}</div>}
        {isi}
      </div>
    )
  }
  return (
    <div className={`report-callout ${v === 'emas' ? 'gold' : v === 'hijau' ? 'green' : ''} mt-2`}>
      <div className="flex items-start gap-2">
        <p className="caption">{title}</p>
        {tombol}
      </div>
      {isi}
    </div>
  )
}
