'use client'

import { useActionState } from 'react'
import { createTaskAction } from '@/app/actions/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { User } from '@/types'

interface Props {
  assignableUsers: User[]
  defaults?: {
    title?: string
    meetingId?: string
    agendaId?: string
  }
  /** Mode tugas pribadi: assignee = creator, tidak ada dropdown penerima. */
  personalMode?: { selfUserId: string; selfName: string; lockPriority?: 'normal' | 'jangka_panjang' }
}

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'mendesak', label: 'Mendesak' },
  { value: 'jangka_panjang', label: 'Jangka Panjang' },
]

export function TaskForm({ assignableUsers, defaults, personalMode }: Props) {
  const [state, action, isPending] = useActionState(createTaskAction, null)

  return (
    <form action={action} className="space-y-5">
      {personalMode && (
        <>
          <input type="hidden" name="assigned_to" value={personalMode.selfUserId} />
          {personalMode.lockPriority && (
            <input type="hidden" name="priority" value={personalMode.lockPriority} />
          )}
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioritas</Label>
          {personalMode?.lockPriority ? (
            <div className="px-3 py-2 rounded-md bg-muted text-sm">
              {personalMode.lockPriority === 'jangka_panjang' ? '🎯 Jangka Panjang' : '⚡ Jangka Pendek'}
            </div>
          ) : (
            <Select name="priority" defaultValue="normal">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Deadline (opsional)</Label>
          <Input id="due_date" name="due_date" type="date" />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Menyimpan...' : (personalMode ? 'Buat Tugas Pribadi' : 'Delegasikan Tugas')}
      </Button>
    </form>
  )
}
