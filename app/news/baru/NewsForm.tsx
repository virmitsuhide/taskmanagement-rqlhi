'use client'

import { useActionState, useState } from 'react'
import { createNewsAction } from '@/app/actions/news'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { ImagePlus, X } from 'lucide-react'
import Image from 'next/image'
import type { NewsArticle, NewsCategory, NewsType } from '@/types'

const CATEGORIES = [
  { value: 'sdit_lhi',     label: 'SDIT LHI' },
  { value: 'smpit_lhi',    label: 'SMPIT LHI' },
  { value: 'sma_lhi',      label: 'SMA LHI' },
  { value: 'paud_lhi',     label: 'PAUD LHI' },
  { value: 'sd_lhi_juara', label: 'SD LHI Juara' },
] as const

type FormState = { error?: string } | null
type FormAction = (state: FormState, fd: FormData) => Promise<FormState>

interface Props {
  action?: FormAction
  defaultValues?: NewsArticle
  submitLabel?: string
}

export function NewsForm({
  action: actionProp,
  defaultValues,
  submitLabel,
}: Props = {}) {
  const action = actionProp ?? (createNewsAction as unknown as FormAction)
  const isEdit = !!defaultValues
  const [state, formAction, isPending] = useActionState(action, null)

  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState(defaultValues?.title ?? '')
  const [excerpt, setExcerpt] = useState(defaultValues?.excerpt ?? '')
  const [type, setType] = useState<NewsType>(defaultValues?.type ?? 'berita')
  const [category, setCategory] = useState<string>(defaultValues?.category ?? '')
  const [removeThumbnail, setRemoveThumbnail] = useState(false)

  const existingThumb = !removeThumbnail && !preview ? defaultValues?.thumbnail_url ?? null : null

  function handleThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPreview(URL.createObjectURL(file))
      setRemoveThumbnail(false)
    } else {
      setPreview(null)
    }
  }

  function clearThumbnail() {
    setPreview(null)
    const input = document.getElementById('thumbnail') as HTMLInputElement | null
    if (input) input.value = ''
    if (isEdit && defaultValues?.thumbnail_url) setRemoveThumbnail(true)
  }

  function restoreExisting() {
    setRemoveThumbnail(false)
    setPreview(null)
    const input = document.getElementById('thumbnail') as HTMLInputElement | null
    if (input) input.value = ''
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="remove_thumbnail" value={removeThumbnail ? '1' : '0'} />

      {/* Tipe + Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tipe <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            {(['berita', 'artikel'] as const).map(t => (
              <label
                key={t}
                className={`flex-1 cursor-pointer text-center px-3 py-2 rounded-md border text-sm font-medium capitalize transition-colors ${
                  type === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card hover:bg-muted border-border'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                {t}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">
            Kategori Unit {type === 'berita' && <span className="text-destructive">*</span>}
          </Label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            required={type === 'berita'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{type === 'artikel' ? '(opsional)' : 'Pilih unit…'}</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value as NewsCategory}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Judul */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Judul Berita <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Tulis judul berita yang informatif..."
          className="text-base font-medium"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      {/* Thumbnail */}
      <div className="space-y-1.5">
        <Label htmlFor="thumbnail">Thumbnail</Label>
        {preview || existingThumb ? (
          <div className="relative w-full h-52 rounded-xl overflow-hidden border bg-muted">
            <Image
              src={preview ?? existingThumb!}
              alt="Preview thumbnail"
              fill
              className="object-cover"
              unoptimized={!!preview}
            />
            <button
              type="button"
              onClick={clearThumbnail}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition"
              title={existingThumb ? 'Hapus thumbnail' : 'Batalkan pilihan'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="thumbnail"
              className="flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition"
            >
              <ImagePlus className="h-7 w-7 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Klik untuk pilih gambar</span>
              <span className="text-xs text-muted-foreground/70 mt-1">JPG, PNG, WebP · maks 5 MB</span>
            </label>
            {isEdit && removeThumbnail && defaultValues?.thumbnail_url && (
              <button
                type="button"
                onClick={restoreExisting}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Batalkan hapus — pakai thumbnail lama
              </button>
            )}
          </div>
        )}
        <input
          id="thumbnail"
          name="thumbnail"
          type="file"
          accept="image/*"
          onChange={handleThumbnail}
          className="sr-only"
        />
        <p className="text-xs text-muted-foreground">
          Gambar akan tampil di halaman News dan carousel homepage.
        </p>
      </div>

      {/* Ringkasan */}
      <div className="space-y-1.5">
        <Label htmlFor="excerpt">Ringkasan Isi</Label>
        <Textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          maxLength={280}
          placeholder="Ringkasan singkat yang tampil di bawah thumbnail di halaman beranda..."
          className="resize-none"
          value={excerpt ?? ''}
          onChange={e => setExcerpt(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Ditampilkan di bawah thumbnail pada halaman News dan carousel. Maks 280 karakter.
        </p>
      </div>

      {/* Isi */}
      <div className="space-y-1.5">
        <Label>Isi Berita <span className="text-destructive">*</span></Label>
        <RichTextEditor
          name="content"
          rows={20}
          required
          defaultValue={defaultValues?.content ?? ''}
          placeholder="Tulis isi berita lengkap di sini. Gunakan **tebal**, *miring*, - daftar, atau 1. nomor..."
        />
        <p className="text-xs text-muted-foreground">
          Isi akan ditampilkan dengan format rata kanan-kiri (justified) di halaman publik.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-1 pb-8">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending
            ? (isEdit ? 'Menyimpan...' : 'Mempublikasikan...')
            : (submitLabel ?? (isEdit ? 'Simpan Perubahan' : 'Publikasikan Berita'))}
        </Button>
      </div>
    </form>
  )
}
