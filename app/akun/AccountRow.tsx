'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Copy, KeyRound, RotateCcw, X } from 'lucide-react'
import { setPasswordAction, resetPasswordAction } from '@/app/actions/accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  target: 'user' | 'teacher'
  id: string
  name: string
  username: string
  /** Role pengurus atau unit guru — apa pun yang paling menjelaskan barisnya. */
  keterangan: string
  nonaktif?: boolean
}

/**
 * Satu baris akun beserta aksi passwordnya.
 *
 * Password lama TIDAK pernah ditampilkan dan memang tidak bisa: yang tersimpan
 * hash bcrypt, dan bcrypt satu arah. Yang muncul di sini hanya password yang
 * BARU SAJA ditetapkan, sekali, supaya bisa disalin dan disampaikan ke orangnya.
 * Begitu baris ini ditutup atau halaman dimuat ulang, teksnya hilang untuk
 * selamanya — tidak ada tempat penyimpanannya.
 */
export function AccountRow({ target, id, name, username, keterangan, nonaktif }: Props) {
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [hasil, setHasil] = useState<string | null>(null)
  const [tersalin, setTersalin] = useState(false)

  function terapkan(fn: () => Promise<{ error?: string; success?: boolean; password?: string }>) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) { toast.error(res.error); return }
      setHasil(res.password ?? null)
      setEditing(false)
      setDraft('')
      setTersalin(false)
      toast.success(`Password ${name} diperbarui`)
    })
  }

  async function salin() {
    if (!hasil) return
    try {
      await navigator.clipboard.writeText(hasil)
      setTersalin(true)
      // Halaman artefak/peramban tertentu menolak akses papan klip. Kalau gagal,
      // teksnya tetap terlihat di layar untuk disalin manual — jadi kegagalan di
      // sini tidak boleh menghentikan apa pun.
    } catch {
      toast.message('Salin manual dari kotak di samping.')
    }
  }

  return (
    <div className={cn('border-t px-3 py-2.5', nonaktif && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">
            {name}
            {nonaktif && <span className="ml-2 text-[10px] font-normal text-muted-foreground">nonaktif</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            <span className="font-mono">{username}</span> · {keterangan}
          </p>
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Password baru (min. 8)"
              className="h-8 w-52 text-xs"
            />
            <Button
              size="sm" className="h-8"
              disabled={pending || draft.trim().length < 8}
              onClick={() => terapkan(() => setPasswordAction(target, id, draft))}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8"
              onClick={() => { setEditing(false); setDraft('') }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(true)} disabled={pending}>
              <KeyRound className="mr-1 h-3.5 w-3.5" />Atur
            </Button>
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Reset password ${name}?\n\nPassword lamanya langsung tidak berlaku. Password baru akan tampil sekali di layar untuk kamu salin dan sampaikan.`)) return
                terapkan(() => resetPasswordAction(target, id))
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />Reset
            </Button>
          </div>
        )}
      </div>

      {hasil && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-wash px-3 py-2">
          <span className="text-xs text-warning">Password baru — tampil sekali:</span>
          <code className="rounded bg-background px-2 py-1 font-mono text-sm font-semibold tracking-wide">{hasil}</code>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={salin}>
            {tersalin ? <><Check className="mr-1 h-3 w-3" />Tersalin</> : <><Copy className="mr-1 h-3 w-3" />Salin</>}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setHasil(null)}>
            Tutup
          </Button>
        </div>
      )}
    </div>
  )
}
