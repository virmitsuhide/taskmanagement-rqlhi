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
  content: string
  canManage: boolean
  /** Varian kuning template — dipakai kotak "💡 Evaluasi Anggaran" (1.5). */
  gold?: boolean
}

/**
 * Bagian laporan yang tidak bisa dihitung — evaluasi anggaran, analisis
 * kemandirian, komentar diagram. Sengaja dibiarkan sebagai teks bebas:
 * kesimpulan atas angka adalah penilaian manusia, dan memaksanya ke dalam
 * bentuk terstruktur hanya akan membuat bendahara menulis di tempat lain.
 */
export function NarrativeEditor({ period, section, title, content, canManage, gold }: Props) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveReportNoteAction(prev, formData)
      if (result.success) setEditing(false)
      return result
    },
    null,
  )

  if (editing && canManage) {
    return (
      <form action={action} className="space-y-2 rounded-md border p-3">
        <input type="hidden" name="period" value={period} />
        <input type="hidden" name="section" value={section} />
        <p className="text-xs font-medium">{title}</p>
        <Textarea
          name="content" rows={5} defaultValue={content}
          placeholder="Satu poin per baris…"
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-8" disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
            Batal
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className={`report-callout${gold ? ' gold' : ''} mt-2`}>
      <div className="flex items-start justify-between gap-2">
        <p className="caption">{title}</p>
        {canManage && (
          <Button
            size="sm" variant="ghost" className="-mt-1 h-6 px-2 text-xs print:hidden"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1 h-3 w-3" />{content ? 'Ubah' : 'Tulis'}
          </Button>
        )}
      </div>
      {content ? (
        // Tiap baris jadi satu poin — bendahara menulis evaluasi sebagai
        // daftar, dan template pun menampilkannya berbutir, bukan sebagai
        // satu paragraf panjang.
        <ul style={{ margin: 0, paddingLeft: 15 }}>
          {content.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      ) : (
        <p style={{ opacity: 0.6 }}>Belum ditulis.</p>
      )}
    </div>
  )
}
