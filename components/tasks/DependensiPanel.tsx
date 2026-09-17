'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, CheckCircle2, Hourglass, Link2, Plus, Search, X } from 'lucide-react'
import {
  cariTugasDitungguAction, geserJadwalSetelahDitungguAction, hapusDependensiAction, tambahDependensiAction,
  type KandidatDependensi,
} from '@/app/actions/dependensi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { shortDate } from '@/lib/tasks/gantt'
import type { TugasTerkait } from '@/lib/data/dependensi'
import type { KeadaanRelasi } from '@/lib/tasks/dependensi'

export interface RelasiTampil {
  relasiId: string
  keadaan: KeadaanRelasi
  tugas: TugasTerkait
}

interface Props {
  taskId: string
  menunggu: RelasiTampil[]
  ditunggu: RelasiTampil[]
  /** Boleh menambah/menghapus relasi tugas ini (izin merinci tugas). */
  bisaAtur: boolean
  /** Boleh menggeser tanggal tugas ini (izin sunting). */
  bisaGeser: boolean
  tabelAda: boolean
}

const KEADAAN: Record<KeadaanRelasi, { label: string; warna: string; wash: string; ikon: React.ComponentType<{ className?: string }> }> = {
  bentrok:       { label: 'Jadwal bentrok', warna: 'var(--destructive)', wash: 'var(--destructive-wash)', ikon: AlertTriangle },
  aman:          { label: 'Jadwal aman',    warna: 'var(--success)',     wash: 'var(--success-wash)',     ikon: CalendarClock },
  tanpa_tenggat: { label: 'Belum bertenggat', warna: 'var(--warning)',   wash: 'var(--warning-wash)',     ikon: Hourglass },
  selesai:       { label: 'Sudah selesai',  warna: 'var(--success)',     wash: 'var(--success-wash)',     ikon: CheckCircle2 },
}

/**
 * Ketergantungan sebuah tugas: apa yang ia tunggu, dan siapa yang menunggunya.
 *
 * Dua daftar itu sengaja tidak setara. "Menunggu" milik tugas ini — di sinilah
 * relasi ditambah, dihapus, dan jadwalnya digeser. "Ditunggu oleh" hanya
 * dibaca: relasinya milik tugas lain, dan pemegang tugas ini cukup tahu bahwa
 * pekerjaannya sedang menahan orang lain.
 */
export function DependensiPanel({ taskId, menunggu, ditunggu, bisaAtur, bisaGeser, tabelAda }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [mencari, setMencari] = useState(false)

  const aktif = menunggu.filter(r => r.keadaan !== 'selesai')
  const bentrok = aktif.filter(r => r.keadaan === 'bentrok').length

  function run(fn: () => Promise<{ error?: string }>, sukses: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(sukses)
      router.refresh()
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-5 py-3">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Ketergantungan</h2>
        {aktif.length > 0 && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            menunggu {aktif.length} tugas
          </span>
        )}
        {bentrok > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--destructive-wash)', color: 'var(--destructive)' }}>
            {bentrok} bentrok
          </span>
        )}
        {bisaAtur && tabelAda && !mencari && (
          <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => setMencari(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />Menunggu tugas…
          </Button>
        )}
      </div>

      <div className="space-y-4 p-5">
        {!tabelAda && (
          <p className="text-sm text-muted-foreground">Fitur ketergantungan belum aktif — jalankan migrasi 0071 di Supabase.</p>
        )}

        {mencari && (
          <CariTugas
            taskId={taskId}
            sudah={new Set(menunggu.map(r => r.tugas.id))}
            onPilih={k => run(() => tambahDependensiAction(taskId, k.id), `Tugas ini kini menunggu "${k.title}"`)}
            onTutup={() => setMencari(false)}
            pending={pending}
          />
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Tugas ini menunggu</h3>
          {menunggu.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak menunggu tugas lain.{bisaAtur && tabelAda ? ' Tambahkan bila tugas ini baru bisa dimulai setelah tugas lain selesai.' : ''}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {menunggu.map(r => (
                <BarisRelasi key={r.relasiId} r={r}>
                  {r.keadaan === 'bentrok' && bisaGeser && r.tugas.due_date && (
                    <Button
                      size="sm" variant="outline" className="h-7 text-[11px]" disabled={pending}
                      onClick={() => run(() => geserJadwalSetelahDitungguAction(r.relasiId), 'Jadwal tugas ini sudah digeser')}
                    >
                      Geser mulai ke setelah {shortDate(r.tugas.due_date)}
                    </Button>
                  )}
                  {bisaAtur && (
                    <button
                      type="button" aria-label={`Hapus relasi dengan ${r.tugas.title}`} disabled={pending}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Hapus ketergantungan?',
                          description: `Tugas ini tidak lagi tercatat menunggu "${r.tugas.title}".`,
                          confirmText: 'Hapus',
                        })
                        if (ok) run(() => hapusDependensiAction(r.relasiId), 'Ketergantungan dihapus')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </BarisRelasi>
              ))}
            </ul>
          )}
          {bentrok > 0 && !bisaGeser && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Tanggal tugas delegasi hanya bisa digeser Kepala RQ — sampaikan lewat diskusi di bawah.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Ditunggu oleh</h3>
          {ditunggu.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada tugas lain yang menunggu tugas ini.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {ditunggu.map(r => <BarisRelasi key={r.relasiId} r={r} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function BarisRelasi({ r, children }: { r: RelasiTampil; children?: React.ReactNode }) {
  const k = KEADAAN[r.keadaan]
  const Ikon = k.ikon
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {r.tugas.bisaDibuka ? (
          <Link href={`/tasks/${r.tugas.id}`} className="text-sm font-medium hover:underline">{r.tugas.title}</Link>
        ) : (
          <span className="text-sm font-medium">{r.tugas.title}</span>
        )}
        <p className="text-[11px] text-muted-foreground">
          {r.tugas.jabatan ? ROLE_LABELS[r.tugas.jabatan] : 'Pelaksana tidak diketahui'}
          {' · '}{r.tugas.due_date ? `tenggat ${shortDate(r.tugas.due_date)}` : 'tanpa tenggat'}
        </p>
      </div>
      <TaskStatusBadge status={r.tugas.status} />
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: k.wash, color: k.warna }}>
        <Ikon className="h-3 w-3" />{k.label}
      </span>
      {children}
    </li>
  )
}

function CariTugas({ taskId, sudah, onPilih, onTutup, pending }: {
  taskId: string
  sudah: Set<string>
  onPilih: (k: KandidatDependensi) => void
  onTutup: () => void
  pending: boolean
}) {
  const [kueri, setKueri] = useState('')
  const [hasil, setHasil] = useState<KandidatDependensi[]>([])
  const [memuat, setMemuat] = useState(false)

  useEffect(() => {
    const q = kueri.trim()
    if (q.length < 2) return
    let batal = false
    const t = setTimeout(async () => {
      setMemuat(true)
      const r = await cariTugasDitungguAction(taskId, q)
      if (!batal) { setHasil(r); setMemuat(false) }
    }, 250)
    return () => { batal = true; clearTimeout(t) }
  }, [kueri, taskId])

  const tampil = kueri.trim().length < 2 ? [] : hasil.filter(h => !sudah.has(h.id))

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          autoFocus value={kueri} onChange={e => setKueri(e.target.value)}
          placeholder="Cari judul tugas yang ditunggu — milik siapa pun" className="h-9"
        />
        <button type="button" onClick={onTutup} aria-label="Tutup pencarian" className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {kueri.trim().length >= 2 && (
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {memuat && tampil.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Mencari…</li>}
          {!memuat && tampil.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Tidak ada tugas aktif yang cocok.</li>}
          {tampil.map(k => (
            <li key={k.id}>
              <button
                type="button" disabled={pending}
                onClick={() => onPilih(k)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{k.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {k.jabatan ? ROLE_LABELS[k.jabatan] : '—'} · {k.due_date ? `tenggat ${shortDate(k.due_date)}` : 'tanpa tenggat'}
                  </span>
                </span>
                <TaskStatusBadge status={k.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
