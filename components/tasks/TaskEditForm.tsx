'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateTaskAction } from '@/app/actions/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TASK_PRIORITY_LABELS, TASK_WEIGHT_LABELS } from '@/lib/auth/permissions'
import type { Task, TaskPriority, TaskWeight } from '@/types'

const PRIORITY_OPTIONS: TaskPriority[] = ['high', 'middle', 'low']
const WEIGHT_OPTIONS: TaskWeight[] = ['easy', 'medium', 'hard']

/**
 * Form sunting tugas.
 *
 * Sengaja terpisah dari TaskForm: yang boleh berubah di sini hanya isi tugas.
 * Penerima tidak ikut disunting — memindahkan tugas ke orang lain adalah
 * pendelegasian baru, bukan koreksi. Status juga tidak, karena perpindahan
 * kolom kanban punya aturan transisinya sendiri.
 */
export function TaskEditForm({ task }: { task: Task }) {
  const [state, action, isPending] = useActionState(updateTaskAction, null)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="task_id" value={task.id} />

      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Isi Tugas</CardTitle>
          <CardDescription>Perubahan tercatat di riwayat dan diberitahukan ke manajemen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Judul Task</Label>
            <Input id="title" name="title" defaultValue={task.title} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Keterangan (opsional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={task.description ?? ''}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="horizon">Jangka</Label>
            <Select name="horizon" defaultValue={task.horizon}>
              <SelectTrigger id="horizon" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendek">⚡ Jangka Pendek</SelectItem>
                <SelectItem value="panjang">🎯 Jangka Panjang</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Prioritas & Tenggat</CardTitle>
          <CardDescription>Menentukan urutan dan warna kartu di papan tugas.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioritas</Label>
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Bobot Tugas</Label>
              <Select name="weight" defaultValue={task.weight}>
                <SelectTrigger id="weight" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEIGHT_OPTIONS.map(w => (
                    <SelectItem key={w} value={w}>{TASK_WEIGHT_LABELS[w]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Mulai (opsional)</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={task.start_date ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Deadline (opsional)</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={task.due_date ?? ''} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex gap-2 p-4">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
          <Button asChild type="button" variant="outline" disabled={isPending}>
            <Link href={`/tasks/${task.id}`}>Batal</Link>
          </Button>
        </div>
      </div>
    </form>
  )
}
