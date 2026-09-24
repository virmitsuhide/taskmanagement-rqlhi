'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BadgeCheck, CalendarClock, Flag, Hourglass, Lock, Plus, Repeat, Target, X } from 'lucide-react'
import {
  lepasTugasSprintAction, sahkanSprintGoalAction, sanggupiTugasAction, simpanReviewSprintAction,
  simpanSprintGoalAction, tutupSprintAction, type IsiReview,
} from '@/app/actions/sprint'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { shortDate } from '@/lib/tasks/gantt'
import type { AlasanSaran, GoalJabatan, ItemSprint, SaranTugas } from '@/lib/data/sprint'
import type { RingkasDependensi } from '@/lib/data/dependensi'
import type { UserRole } from '@/types'

type Hasil = { error?: string }

function useJalankan() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const jalankan = (fn: () => Promise<Hasil>, sukses: string, sesudah?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(sukses)
      sesudah?.()
      router.refresh()
    })
  return { pending, jalankan }
}

// ─── Sprint Goal ──────────────────────────────────────────────────────────────

export function KartuGoal({ periode, jabatan, labelJabatan, goal, bisaUbah, productOwner, terkunci }: {
  periode: string
  jabatan: UserRole
  labelJabatan: string
  goal: GoalJabatan | null
  bisaUbah: boolean
  productOwner: boolean
  terkunci: boolean
}) {
  const { pending, jalankan } = useJalankan()
  const [teks, setTeks] = useState(goal?.goal ?? '')
  const [menyunting, setMenyunting] = useState(!goal?.goal && bisaUbah && !terkunci)
  const disahkan = !!goal?.disahkanAt

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-lg font-medium flex items-center gap-2"><Target className="h-4 w-4" /> Sprint Goal · {labelJabatan}</h2>
        {goal?.goal && (
          disahkan ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--success-wash)', color: 'var(--success)' }}>
              <BadgeCheck className="h-3 w-3" /> Disahkan Kepala RQ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
              <Hourglass className="h-3 w-3" /> Menunggu pengesahan
            </span>
          )
        )}
      </div>

      {menyunting ? (
        <div className="space-y-2">
          <Textarea
            value={teks} onChange={e => setTeks(e.target.value)} rows={3} maxLength={1000}
            placeholder="1–3 kalimat: apa yang ingin dicapai jabatan ini bulan ini, bukan daftar tugasnya. Mis. &quot;Seluruh halaqoh SD punya rekap capaian Agustus sebelum rapat BPH.&quot;"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">{disahkan ? 'Mengubah goal yang sudah disahkan akan melepas pengesahannya.' : 'Setelah disimpan, Kepala RQ mengesahkannya.'}</p>
            <div className="flex gap-2">
              {goal?.goal && <Button size="sm" variant="ghost" onClick={() => { setTeks(goal.goal); setMenyunting(false) }}>Batal</Button>}
              <Button size="sm" disabled={pending} onClick={() => jalankan(() => simpanSprintGoalAction(periode, jabatan, teks), 'Sprint Goal disimpan', () => setMenyunting(false))}>
                Simpan goal
              </Button>
            </div>
          </div>
        </div>
      ) : goal?.goal ? (
        <p className="whitespace-pre-line text-sm">{goal.goal}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Belum ada Sprint Goal untuk bulan ini.</p>
      )}

      {!menyunting && !terkunci && (
        <div className="mt-3 flex flex-wrap gap-2">
          {bisaUbah && <Button size="sm" variant="outline" onClick={() => setMenyunting(true)}>{goal?.goal ? 'Ubah goal' : 'Tulis goal'}</Button>}
          {productOwner && goal?.goal && (
            <Button
              size="sm" variant={disahkan ? 'ghost' : 'default'} disabled={pending}
              onClick={() => jalankan(() => sahkanSprintGoalAction(periode, jabatan, !disahkan), disahkan ? 'Pengesahan dicabut' : 'Sprint Goal disahkan')}
            >
              {disahkan ? 'Cabut pengesahan' : 'Sahkan goal'}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Komitmen ─────────────────────────────────────────────────────────────────

function ChipDependensi({ d }: { d?: RingkasDependensi }) {
  if (!d || (d.menunggu === 0 && d.ditunggu === 0)) return null
  return (
    <>
      {d.menunggu > 0 && (
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={d.bentrok ? { background: 'var(--destructive-wash)', color: 'var(--destructive)' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
          ⏳ menunggu {d.menunggu}{d.bentrok ? ' · bentrok' : ''}
        </span>
      )}
      {d.ditunggu > 0 && (
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
          ditunggu {d.ditunggu}
        </span>
      )}
    </>
  )
}

export function DaftarKomitmen({ items, dependensi, bisaUbah, terkunci }: {
  items: ItemSprint[]
  dependensi: Record<string, RingkasDependensi>
  bisaUbah: boolean
  terkunci: boolean
}) {
  const { pending, jalankan } = useJalankan()
  const confirm = useConfirm()

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada tugas yang disanggupi.{bisaUbah && !terkunci ? ' Pilih dari saran di bawah.' : ''}</p>
  }
  return (
    <ul className="divide-y rounded-lg border">
      {items.map(i => (
        <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/tasks/${i.task.id}`} className={`text-sm font-medium hover:underline ${i.status === 'done' ? 'text-muted-foreground line-through decoration-1' : ''}`}>
              {i.task.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <span>{i.task.due_date ? `tenggat ${shortDate(i.task.due_date)}` : 'tanpa tenggat'}</span>
              <span>· {i.poin} poin</span>
              {i.tengahSprint && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">masuk tengah sprint</span>}
              {i.terbawa > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
                  <Repeat className="mr-0.5 inline h-2.5 w-2.5" />terbawa {i.terbawa} bulan
                </span>
              )}
              {i.lewatSprint && i.status !== 'done' && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--destructive-wash)', color: 'var(--destructive)' }}>
                  tenggat lewat akhir bulan
                </span>
              )}
              <ChipDependensi d={dependensi[i.task.id]} />
            </div>
          </div>
          <TaskStatusBadge status={i.status} />
          {bisaUbah && !terkunci && (
            <button
              type="button" disabled={pending} aria-label={`Lepas ${i.task.title} dari sprint`}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Lepas dari sprint?',
                  description: `"${i.task.title}" kembali ke backlog. Tugasnya sendiri tidak berubah.`,
                  confirmText: 'Lepas',
                })
                if (ok) jalankan(() => lepasTugasSprintAction(i.id), 'Tugas dilepas dari sprint')
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// ─── Saran dari Gantt ─────────────────────────────────────────────────────────

const LABEL_ALASAN: Record<AlasanSaran, { judul: string; keterangan: string; ikon: React.ComponentType<{ className?: string }> }> = {
  terbawa:         { judul: 'Terbawa dari sprint lalu', keterangan: 'Disanggupi bulan lalu tapi belum selesai — putuskan lagi dengan sadar.', ikon: Repeat },
  lewat_tenggat:   { judul: 'Sudah lewat tenggat', keterangan: 'Tenggatnya jatuh sebelum bulan ini.', ikon: Flag },
  jatuh_bulan_ini: { judul: 'Jatuh di bulan ini menurut Gantt', keterangan: 'Batangnya menyentuh bulan sprint.', ikon: CalendarClock },
  lainnya:         { judul: 'Tugas terbuka lainnya', keterangan: 'Di luar bulan ini atau belum bertanggal.', ikon: Plus },
}

export function DaftarSaran({ periode, saran, dependensi, komitmenPoin, rataSelesai }: {
  periode: string
  saran: SaranTugas[]
  dependensi: Record<string, RingkasDependensi>
  komitmenPoin: number
  /** Rata-rata poin selesai sprint tertutup sebelumnya; null bila belum ada riwayat. */
  rataSelesai: number | null
}) {
  const { pending, jalankan } = useJalankan()
  const [semua, setSemua] = useState(false)
  const kelompok = (['terbawa', 'lewat_tenggat', 'jatuh_bulan_ini', 'lainnya'] as AlasanSaran[])
    .map(a => ({ alasan: a, isi: saran.filter(s => s.alasan === a) }))
    .filter(k => k.isi.length > 0 && (semua || k.alasan !== 'lainnya'))
  const jumlahLainnya = saran.filter(s => s.alasan === 'lainnya').length

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Disanggupi sekarang: <strong className="text-foreground tabular-nums">{komitmenPoin} poin</strong>
        {rataSelesai !== null
          ? <> · rata-rata selesai 3 sprint terakhir: <strong className="text-foreground tabular-nums">{rataSelesai.toLocaleString('id-ID', { maximumFractionDigits: 1 })} poin</strong>{komitmenPoin > rataSelesai * 1.3 && <span style={{ color: 'var(--warning)' }}> — komitmen jauh di atas kebiasaan</span>}</>
          : ' · patokan kapasitas muncul setelah ada sprint yang ditutup'}
        {' · '}bobot mudah = 1, sedang = 2, sulit = 3 poin
      </p>

      {saran.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada tugas terbuka lain untuk jabatan ini.</p>}

      {kelompok.map(k => {
        const meta = LABEL_ALASAN[k.alasan]
        const Ikon = meta.ikon
        return (
          <div key={k.alasan}>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold"><Ikon className="h-3.5 w-3.5" />{meta.judul} <span className="font-normal text-muted-foreground">· {k.isi.length}</span></h4>
            <p className="mb-1.5 text-[11px] text-muted-foreground">{meta.keterangan}</p>
            <ul className="divide-y rounded-lg border">
              {k.isi.map(s => (
                <li key={s.task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/tasks/${s.task.id}`} className="text-sm hover:underline">{s.task.title}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{s.task.due_date ? `tenggat ${shortDate(s.task.due_date)}` : 'tanpa tenggat'}</span>
                      <span>· {s.poin} poin</span>
                      {s.task.horizon === 'panjang' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">jangka panjang</span>}
                      {s.terbawa > 0 && <span className="text-[10px] font-medium" style={{ color: 'var(--warning)' }}>terbawa {s.terbawa} bulan</span>}
                      <ChipDependensi d={dependensi[s.task.id]} />
                    </div>
                  </div>
                  <TaskStatusBadge status={s.task.status} />
                  <Button size="sm" variant="outline" className="h-7" disabled={pending}
                    onClick={() => jalankan(() => sanggupiTugasAction(periode, s.task.id), `"${s.task.title}" disanggupi`)}>
                    Sanggupi
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {!semua && jumlahLainnya > 0 && (
        <Button size="sm" variant="ghost" onClick={() => setSemua(true)}>Tampilkan {jumlahLainnya} tugas terbuka lainnya</Button>
      )}
    </div>
  )
}

// ─── Review & retrospektif ────────────────────────────────────────────────────

export function FormReview({ periode, jabatan, goal, bisaUbah, terkunci }: {
  periode: string
  jabatan: UserRole
  goal: GoalJabatan | null
  bisaUbah: boolean
  terkunci: boolean
}) {
  const { pending, jalankan } = useJalankan()
  const [isi, setIsi] = useState<IsiReview>({
    hasil: goal?.hasil ?? '', catatanReview: goal?.catatanReview ?? '',
    retroBaik: goal?.retroBaik ?? '', retroHambatan: goal?.retroHambatan ?? '', retroUbah: goal?.retroUbah ?? '',
  })
  const boleh = bisaUbah && !terkunci
  const ubah = (k: keyof IsiReview) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setIsi(v => ({ ...v, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Apakah Sprint Goal tercapai?</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([['tercapai', 'Tercapai', 'var(--success)'], ['sebagian', 'Sebagian', 'var(--warning)'], ['tidak', 'Tidak tercapai', 'var(--destructive)']] as const).map(([k, label, warna]) => (
            <button
              key={k} type="button" disabled={!boleh} aria-pressed={isi.hasil === k}
              onClick={() => setIsi(v => ({ ...v, hasil: v.hasil === k ? '' : k }))}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-default"
              style={isi.hasil === k ? { background: warna, borderColor: warna, color: 'var(--background)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Isian label="Catatan review — apa yang dihasilkan bulan ini" value={isi.catatanReview} onChange={ubah('catatanReview')} disabled={!boleh} />
      <div className="grid gap-3 md:grid-cols-3">
        <Isian label="Retro: yang berjalan baik" value={isi.retroBaik} onChange={ubah('retroBaik')} disabled={!boleh} />
        <Isian label="Retro: yang menghambat" value={isi.retroHambatan} onChange={ubah('retroHambatan')} disabled={!boleh} />
        <Isian label="Retro: yang diubah bulan depan" value={isi.retroUbah} onChange={ubah('retroUbah')} disabled={!boleh} />
      </div>
      {boleh && (
        <div className="flex justify-end">
          <Button size="sm" disabled={pending} onClick={() => jalankan(() => simpanReviewSprintAction(periode, jabatan, isi), 'Review disimpan')}>
            Simpan review
          </Button>
        </div>
      )}
    </div>
  )
}

function Isian({ label, value, onChange, disabled }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; disabled: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={onChange} disabled={disabled} rows={3} maxLength={2000} />
    </div>
  )
}

// ─── Tutup sprint ─────────────────────────────────────────────────────────────

export function TombolTutupSprint({ periode, label }: { periode: string; label: string }) {
  const { pending, jalankan } = useJalankan()
  const confirm = useConfirm()
  return (
    <Button
      size="sm" disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Tutup sprint ${label}?`,
          description: 'Status setiap tugas yang disanggupi dipotret apa adanya dan sprint dikunci. Laporan bulan ini tidak akan berubah lagi walau tugasnya selesai kemudian.',
          confirmText: 'Tutup sprint',
          tone: 'default',
        })
        if (ok) jalankan(() => tutupSprintAction(periode), `Sprint ${label} ditutup`)
      }}
    >
      <Lock className="mr-1 h-3.5 w-3.5" />Tutup sprint
    </Button>
  )
}
