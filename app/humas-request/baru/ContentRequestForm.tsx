'use client'

import { useActionState } from 'react'
import { createContentRequestAction } from '@/app/actions/content-requests'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const REQUEST_TYPES = [
  { value: 'flyer_ujian', label: 'Flyer Ujian' },
  { value: 'flyer_lain', label: 'Flyer Lainnya' },
  { value: 'video', label: 'Video' },
  { value: 'lain_lain', label: 'Lain-lain' },
]

export function ContentRequestForm() {
  const [state, action, isPending] = useActionState(createContentRequestAction, null)
  const today = new Date().toISOString().split('T')[0]

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="request_type">Jenis Konten</Label>
        <Select name="request_type" required>
          <SelectTrigger>
            <SelectValue placeholder="Pilih jenis konten" />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Keterangan</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          placeholder="Jelaskan konten yang dibutuhkan, detail, referensi, dll..."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="requested_date">Tanggal Dibutuhkan</Label>
        <Input id="requested_date" name="requested_date" type="date" defaultValue={today} required />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Mengirim...' : 'Kirim Request'}
      </Button>
    </form>
  )
}
