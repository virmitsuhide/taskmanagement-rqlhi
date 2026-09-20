'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { unggahTemplateAction } from '@/app/actions/rapor-template'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import type { Jenjang } from '@/types'

/**
 * Unggah berkas Word yang sudah dipakai sekolah.
 *
 * Tidak ada yang perlu disunting di Word lebih dulu: sistem menerjemahkan
 * berkasnya, menebak tempat-tempat isiannya, lalu membawa koordinator ke
 * layar pemetaan untuk membenarkan tebakan itu.
 */
export function UnggahTemplate({ jenjang }: { jenjang: Jenjang[] }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [berkas, setBerkas] = useState<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function kirim(formData: FormData) {
    mulai(async () => {
      const hasil = await unggahTemplateAction(formData)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success('Template terbaca. Periksa pemetaannya.')
      formRef.current?.reset()
      setBerkas(null)
      if (hasil.id) router.push(`/rapor-quran/template/${hasil.id}`)
    })
  }

  return (
    <form ref={formRef} action={kirim} className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Unggah template baru</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Berkas Word (.docx) yang sudah dipakai sekolah, lengkap dengan contoh isinya. Contoh nilainya tidak ikut
          tercetak — ia hanya dipakai menebak baris mana yang diisi data.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="tpl-nama">Nama template</label>
          <Input id="tpl-nama" name="nama" placeholder="Rapor Qur'an SDIT — Semester Genap" disabled={pending} />
          <p className="text-[11px] text-muted-foreground">Kosongkan untuk memakai nama berkasnya.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="tpl-jenjang">Unit</label>
          <select
            id="tpl-jenjang" name="jenjang" disabled={pending} required
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {jenjang.map(j => <option key={j} value={j}>{JENJANG_LABELS[j]}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="tpl-min">Dipakai kelas</label>
          <div className="flex items-center gap-2">
            <Input id="tpl-min" name="tingkat_min" type="number" min={1} max={12} defaultValue={1} disabled={pending} className="h-9 w-20" />
            <span className="text-muted-foreground">sampai</span>
            <Input name="tingkat_max" type="number" min={1} max={12} defaultValue={6} disabled={pending} className="h-9 w-20" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tingkatnya saja, tanpa rombel — &quot;1 sampai 5&quot; mencakup 1A hingga 5D.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="tpl-file">Berkas .docx</label>
          <input
            id="tpl-file" name="file" type="file" accept=".docx" required disabled={pending}
            onChange={e => setBerkas(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5 file:text-sm"
          />
          {berkas && <p className="text-[11px] text-muted-foreground">{berkas.name} · {Math.round(berkas.size / 1024)} KB</p>}
        </div>
      </div>

      <Button type="submit" disabled={pending || !berkas}>
        <Upload /> {pending ? 'Membaca berkas…' : 'Unggah & baca'}
      </Button>
    </form>
  )
}
