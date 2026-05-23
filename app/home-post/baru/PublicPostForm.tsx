'use client'

import { useActionState } from 'react'
import { createPublicPostAction } from '@/app/actions/public-posts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PublicPostForm() {
  const [state, action, isPending] = useActionState(createPublicPostAction, null)

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Jenis Post</Label>
          <Select name="type" defaultValue="pengumuman" required>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pengumuman">Pengumuman</SelectItem>
              <SelectItem value="tugas_guru">Tugas Guru</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Target</Label>
          <Select name="target" defaultValue="all" required>
            <SelectTrigger>
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

      <div className="space-y-1.5">
        <Label htmlFor="title">Judul</Label>
        <Input id="title" name="title" required placeholder="Judul pengumuman atau tugas..." />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Isi</Label>
        <Textarea
          id="content"
          name="content"
          rows={5}
          required
          placeholder="Isi pengumuman atau tugas yang akan ditampilkan di halaman publik..."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="due_date">Deadline (opsional)</Label>
        <Input id="due_date" name="due_date" type="date" />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Memposting...' : 'Publikasikan'}
      </Button>
    </form>
  )
}
