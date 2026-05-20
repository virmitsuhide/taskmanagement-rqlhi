'use client'

import { useState, useActionState } from 'react'
import { createNoteAction, updateNoteAction, deleteNoteAction } from '@/app/actions/notes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import type { PrivateNote } from '@/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function NoteEditor({ notes }: { notes: PrivateNote[] }) {
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createState, createAction, isCreating] = useActionState(createNoteAction, null)
  const [updateState, updateAction, isUpdating] = useActionState(updateNoteAction, null)

  return (
    <div className="space-y-4">
      {!showNew && (
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1" />Catatan Baru
        </Button>
      )}

      {showNew && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Catatan Baru</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* useActionState dispatch takes (FormData) — not (prevState, FormData) */}
            <form action={createAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-title">Judul</Label>
                <Input id="new-title" name="title" required placeholder="Judul catatan..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-content">Isi</Label>
                <Textarea id="new-content" name="content" rows={4} required placeholder="Isi catatan..." />
              </div>
              {createState?.error && (
                <p className="text-sm text-destructive">{createState.error}</p>
              )}
              {createState?.success && (
                <p className="text-sm text-green-600">Catatan disimpan.</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowNew(false)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {notes.length === 0 && !showNew && (
        <p className="text-sm text-muted-foreground py-8 text-center">Belum ada catatan.</p>
      )}

      {notes.map(note => (
        <Card key={note.id}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">{note.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(note.updated_at)}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(editingId === note.id ? null : note.id)}
                  className="h-7 w-7 p-0"
                >
                  {editingId === note.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
                <form action={deleteNoteAction.bind(null, note.id) as unknown as (fd: FormData) => void}>
                  <Button size="sm" variant="ghost" type="submit" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {editingId === note.id ? (
              <form action={updateAction} className="space-y-3">
                <input type="hidden" name="note_id" value={note.id} />
                <Input name="title" defaultValue={note.title} required />
                <Textarea name="content" defaultValue={note.content} rows={4} required />
                {updateState?.error && <p className="text-sm text-destructive">{updateState.error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isUpdating}>
                    {isUpdating ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Batal</Button>
                </div>
              </form>
            ) : (
              <p className="text-sm whitespace-pre-line">{note.content}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
