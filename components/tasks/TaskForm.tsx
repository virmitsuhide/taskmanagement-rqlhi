'use client'

import { useActionState } from 'react'
import { createTaskAction } from '@/app/actions/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROLE_LABELS, TASK_PRIORITY_LABELS, TASK_WEIGHT_LABELS } from '@/lib/auth/permissions'
import type { User, TaskPriority, TaskWeight, TaskHorizon } from '@/types'

interface Props {
  assignableUsers: User[]
  defaults?: {
    title?: string
    meetingId?: string
    agendaId?: string
  }
  /** Mode tugas pribadi: assignee = creator, tidak ada dropdown penerima. */
  personalMode?: { selfUserId: string; selfName: string; horizon?: TaskHorizon }
}

const PRIORITY_OPTIONS: TaskPriority[] = ['high', 'middle', 'low']
const WEIGHT_OPTIONS: TaskWeight[] = ['easy', 'medium', 'hard']

export function TaskForm({ assignableUsers, defaults, personalMode }: Props) {
  const [state, action, isPending] = useActionState(createTaskAction, null)

  return (
    <form action={action} className="space-y-5">
      {personalMode && (
        <>
          <input type="hidden" name="assigned_to" value={personalMode.selfUserId} />
          <input type="hidden" name="horizon" value={personalMode.horizon ?? 'pendek'} />
        </>
      )}
      {defaults?.meetingId && (
        <>
          <input type="hidden" name="source_type" value="rapat" />
          <input type="hidden" name="source_meeting_id" value={defaults.meetingId} />
          {defaults.agendaId && (
            <input type="hidden" name="source_agenda_id" value={defaults.agendaId} />
          )}
        </>
      )}
      {!defaults?.meetingId && (
        <input type="hidden" name="source_type" value="mandiri" />
      )}

      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Isi Tugas</CardTitle>
          <CardDescription>Apa yang harus dikerjakan dan oleh siapa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-5">

      <div className="space-y-1.5">
        <Label htmlFor="title">Judul Task</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults?.title ?? ''}
          required
          placeholder="Deskripsi singkat task..."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Keterangan (opsional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Detail lebih lanjut tentang task ini..."
        />
      </div>

      {personalMode ? (
        <div className="space-y-1.5">
          <Label>Untuk</Label>
          <div className="px-3 py-2 rounded-md bg-muted text-sm">
            👤 Diri sendiri ({personalMode.selfName})
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="assigned_to">Didelegasikan Kepada</Label>
          <Select name="assigned_to" required>
            <SelectTrigger>
              <SelectValue placeholder="Pilih penerima tugas" />
            </SelectTrigger>
            <SelectContent>
              {assignableUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.display_name} <span className="text-muted-foreground">({ROLE_LABELS[user.role]})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {personalMode?.horizon && (
        <div className="space-y-1.5">
          <Label>Horizon</Label>
          <div className="px-3 py-2 rounded-md bg-muted text-sm">
            {personalMode.horizon === 'panjang' ? '🎯 Jangka Panjang' : '⚡ Jangka Pendek'}
          </div>
        </div>
      )}

        </CardContent>
      </Card>

      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Prioritas & Tenggat</CardTitle>
          <CardDescription>Menentukan urutan dan warna kartu di papan tugas.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioritas</Label>
          <Select name="priority" defaultValue="middle">
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
          <Select name="weight" defaultValue="medium">
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
          <Label htmlFor="due_date">Deadline (opsional)</Label>
          <Input id="due_date" name="due_date" type="date" />
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
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Menyimpan...' : (personalMode ? 'Buat Tugas Pribadi' : 'Delegasikan Tugas')}
          </Button>
        </div>
      </div>
    </form>
  )
}
