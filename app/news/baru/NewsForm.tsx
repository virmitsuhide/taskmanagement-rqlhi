'use client'

import { useActionState } from 'react'
import { createNewsAction } from '@/app/actions/news'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function NewsForm() {
  const [state, action, isPending] = useActionState(createNewsAction, null)

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Judul Berita</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Tulis judul berita yang informatif..."
          className="text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Isi Berita</Label>
        <Textarea
          id="content"
          name="content"
          rows={12}
          required
          placeholder="Tulis isi berita di sini. Anda bisa menggunakan paragraf, poin-poin, dll..."
          className="resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Tulis dengan jelas dan informatif. Berita akan langsung tampil di halaman publik.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Mempublikasikan...' : 'Publikasikan Berita'}
        </Button>
      </div>
    </form>
  )
}
