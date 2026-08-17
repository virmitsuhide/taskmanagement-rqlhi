'use client'

import { useActionState, useState } from 'react'
import { createPublicPostAction } from '@/app/actions/public-posts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Markdown } from '@/components/ui/markdown'
import { Eye, EyeOff } from 'lucide-react'

const CONTENT_PLACEHOLDER =
  'Isi pengumuman atau tugas yang akan tampil di beranda publik...\n\nGunakan **tebal**, *miring*, ~~coret~~, daftar, dan emoji 😊'

export function PublicPostForm() {
  const [state, action, isPending] = useActionState(createPublicPostAction, null)
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)

  return (
    <form action={action} className="space-y-5">
      {/* ── Jenis & sasaran ──────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Jenis & Sasaran</CardTitle>
          <CardDescription>Menentukan di bagian mana post ini muncul di beranda.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">Jenis Post</Label>
              <Select name="type" defaultValue="pengumuman" required>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pengumuman">Pengumuman</SelectItem>
                  <SelectItem value="tugas_guru">Tugas Guru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Target</Label>
              <Select name="target" defaultValue="all" required>
                <SelectTrigger id="target" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="sd">SD</SelectItem>
                  <SelectItem value="smp">SMP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Isi post ─────────────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Isi Post</CardTitle>
          <CardDescription>
            Judul yang tampil di beranda; isi lengkapnya terbuka saat judul diklik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" required placeholder="Judul pengumuman atau tugas..." />
            <p className="text-xs text-muted-foreground">
              Ini yang terbaca lebih dulu di beranda — buat ringkas dan jelas.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="content">Isi</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPreview(p => !p)}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                {preview ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                {preview ? 'Tutup pratinjau' : 'Pratinjau'}
              </Button>
            </div>

            <RichTextEditor
              name="content"
              value={content}
              onChange={setContent}
              rows={8}
              required
              placeholder={CONTENT_PLACEHOLDER}
            />

            {preview && (
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pratinjau tampilan publik
                </p>
                {content.trim() ? (
                  <Markdown content={content} className="text-sm" />
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada isi.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due_date">Deadline (opsional)</Label>
            <Input id="due_date" name="due_date" type="date" />
          </div>
        </CardContent>
      </Card>

      {/* ── Aksi ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Memposting...' : 'Publikasikan'}
          </Button>
        </div>
      </div>
    </form>
  )
}
