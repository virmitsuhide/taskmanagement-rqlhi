'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PilihBerkas, SELECT_NATIF } from '@/components/rapor/kontrol'
import { JENIS_RAPOR, LABEL_JENIS_RAPOR } from '@/lib/rapor/jenis'
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
    <form ref={formRef} action={kirim} className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3 sm:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
          <Upload className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 pt-1">
          <h2 className="text-sm font-semibold leading-tight">Unggah template baru</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Berkas Word (.docx) yang sudah dipakai sekolah, lengkap dengan contoh isinya. Contoh nilainya tidak ikut
            tercetak — ia hanya dipakai menebak baris mana yang diisi data. Tulisan berhuruf{' '}
            <span className="font-medium text-destructive">merah</span> menjadi isian yang diubah guru; tulisan hitam terkunci.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <PilihBerkas
          id="tpl-file"
          name="file"
          accept=".docx"
          required
          disabled={pending}
          onPilih={setBerkas}
          ikon={<FileUp className="size-4" aria-hidden />}
          judul={berkas ? berkas.name : 'Pilih berkas .docx'}
          keterangan={berkas ? `${Math.round(berkas.size / 1024)} KB · ketuk untuk mengganti` : 'Format rapor Word yang dipakai sekolah'}
          className={berkas ? 'border-solid border-primary/40 bg-primary/5' : undefined}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tpl-nama">Nama template</Label>
            <Input id="tpl-nama" name="nama" placeholder="Rapor Qur'an SDIT — Semester Genap" disabled={pending} className="h-10 md:h-9" />
            <p className="text-xs text-muted-foreground">Kosongkan untuk memakai nama berkasnya.</p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tpl-jenis">Jenis laporan</Label>
            <select id="tpl-jenis" name="jenis" disabled={pending} defaultValue="semester" className={SELECT_NATIF}>
              {JENIS_RAPOR.map(j => <option key={j} value={j}>{LABEL_JENIS_RAPOR[j]}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">
              ATS dan rapor semester diisi guru secara terpisah — satu kelas boleh punya keduanya.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-jenjang">Unit</Label>
            <select id="tpl-jenjang" name="jenjang" disabled={pending} required className={SELECT_NATIF}>
              {jenjang.map(j => <option key={j} value={j}>{JENJANG_LABELS[j]}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-min">Dipakai kelas</Label>
            <div className="flex items-center gap-2">
              <Input id="tpl-min" name="tingkat_min" type="number" inputMode="numeric" min={1} max={12} defaultValue={1} disabled={pending} className="h-10 flex-1 text-center tabular-nums md:h-9" />
              <span className="text-sm text-muted-foreground">sampai</span>
              <Input name="tingkat_max" aria-label="Sampai kelas" type="number" inputMode="numeric" min={1} max={12} defaultValue={6} disabled={pending} className="h-10 flex-1 text-center tabular-nums md:h-9" />
            </div>
            <p className="text-xs text-muted-foreground">
              Tingkatnya saja, tanpa rombel — &quot;1 sampai 5&quot; mencakup 1A hingga 5D.
            </p>
          </div>
        </div>

        <Button type="submit" disabled={pending || !berkas} className="h-11 w-full sm:h-9 sm:w-auto sm:px-5">
          <Upload /> {pending ? 'Membaca berkas…' : 'Unggah & baca'}
        </Button>
      </div>
    </form>
  )
}
