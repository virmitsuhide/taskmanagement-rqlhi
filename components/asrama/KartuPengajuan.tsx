'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { putuskanPengajuanAction } from '@/app/actions/asrama-status'
import type { PengajuanNonaktif } from '@/lib/data/asrama-status'
import { LABEL_ALASAN, LABEL_STATUS_PENGAJUAN, kelasFullday, tglPendek } from '@/lib/rq/asrama-status'
import { PROGRAMS_BY_JENJANG } from '@/lib/rq/programs'
import { cn } from '@/lib/utils'

const PROGRAM_FULLDAY = PROGRAMS_BY_JENJANG.smp.filter(p => p.code === 'reguler_fd' || p.code === 'fullday_quls')
const LABEL_PROGRAM = Object.fromEntries(PROGRAMS_BY_JENJANG.smp.map(p => [p.code, p.label]))

const WARNA: Record<string, string> = {
  menunggu: 'bg-accent-warm-wash text-accent-warm',
  disetujui: 'bg-success-wash text-success',
  ditolak: 'bg-destructive-wash text-destructive',
}

/**
 * Satu pengajuan nonaktif di halaman verifikasi Koor SMP. Yang masih menunggu
 * bisa dibuka untuk diputuskan: konfirmasi kesiswaan wajib dicentang sebelum
 * Setujui, tolak wajib bercatatan.
 */
export function KartuPengajuan({ p, bisaVerifikasi, terbukaAwal }: {
  p: PengajuanNonaktif
  bisaVerifikasi: boolean
  terbukaAwal: boolean
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [buka, setBuka] = useState(terbukaAwal)
  const [program, setProgram] = useState(p.program === 'boarding_quls' ? 'fullday_quls' : 'reguler_fd')
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [catatan, setCatatan] = useState('')
  const kelasBaru = p.alasan === 'fullday' ? kelasFullday(p.kelas, p.gender) : null
  const menunggu = p.status === 'menunggu'

  function putuskan(setujui: boolean) {
    startTransition(async () => {
      if (setujui && p.alasan === 'pindah_sekolah') {
        const ok = await confirm({
          title: `Nonaktifkan ${p.nama}?`,
          description: `Pada ${tglPendek(p.tanggal_efektif, true)} siswa ini dinonaktifkan di seluruh sistem dan keluar dari kelompok asrama. Riwayat setorannya tetap tersimpan.`,
          confirmText: 'Setujui & nonaktifkan',
        })
        if (!ok) return
      }
      const r = await putuskanPengajuanAction({ id: p.id, setujui, sudahKonfirmasi: konfirmasi, catatan, programBaru: program })
      if (r.error) { toast.error(r.error); return }
      toast.success(setujui ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.')
      router.refresh()
    })
  }

  return (
    <article className={cn('rounded-xl border bg-card p-5', menunggu && buka && 'border-2 border-accent-warm')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-2xl leading-tight">
            {p.nama}
            <span className="ml-2 font-sans text-sm text-muted-foreground">{p.kelas ?? ''}{p.program ? ` · ${LABEL_PROGRAM[p.program] ?? p.program}` : ''}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {p.gender === 'L' ? 'Asrama Putra' : 'Asrama Putri'}{p.kelompok_nama ? ` · ${p.kelompok_nama}` : ''} · diajukan oleh {p.diajukan_oleh ?? '—'} · {tglPendek(p.diajukan_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-accent-warm-wash px-2 py-0.5 text-xs font-bold text-accent-warm">{LABEL_ALASAN[p.alasan]}</span>
          {!menunggu && <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', WARNA[p.status])}>{LABEL_STATUS_PENGAJUAN[p.status]}</span>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted-foreground">Tanggal efektif</dt>
        <dd className="font-bold">{tglPendek(p.tanggal_efektif, true)}</dd>
        <dt className="text-muted-foreground">Catatan pengaju</dt>
        <dd>{p.catatan || '—'}</dd>
        {!menunggu && (
          <>
            <dt className="text-muted-foreground">{p.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}</dt>
            <dd>
              {p.diputuskan_oleh ?? '—'}, {tglPendek(p.diputuskan_at)}
              {p.catatan_verifikasi && <> · “{p.catatan_verifikasi}”</>}
            </dd>
            {p.status === 'disetujui' && (
              <>
                <dt className="text-muted-foreground">Hasil</dt>
                <dd>
                  {p.alasan === 'fullday'
                    ? `Program → ${LABEL_PROGRAM[p.program_baru ?? ''] ?? p.program_baru ?? '—'}${p.kelas_baru ? `, kelas ${p.kelas_baru}` : ''}`
                    : p.alasan === 'pindah_sekolah' ? 'Siswa dinonaktifkan' : 'Keluar dari asrama'}
                  {' · '}{p.diterapkan_at ? `diterapkan ${tglPendek(p.diterapkan_at)}` : `berlaku ${tglPendek(p.tanggal_efektif)}`}
                </dd>
              </>
            )}
          </>
        )}
      </dl>

      {menunggu && bisaVerifikasi && !buka && (
        <Button variant="outline" className="mt-3" onClick={() => setBuka(true)}>Verifikasi</Button>
      )}

      {menunggu && bisaVerifikasi && buka && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          <div className="space-y-3">
            {p.alasan === 'fullday' && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Program setelah pindah</span>
                <select value={program} onChange={e => setProgram(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-bold">
                  {PROGRAM_FULLDAY.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
                </select>
                {kelasBaru && kelasBaru !== p.kelas && (
                  <span className="mt-1 block text-xs text-muted-foreground">Kelas ikut berganti: {p.kelas} → <b>{kelasBaru}</b></span>
                )}
              </label>
            )}
            {p.alasan === 'pindah_sekolah' && (
              <p className="flex gap-2 rounded-lg bg-destructive-wash px-3 py-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Disetujui = siswa dinonaktifkan di seluruh sistem.
              </p>
            )}
            <button type="button" role="checkbox" aria-checked={konfirmasi} onClick={() => setKonfirmasi(v => !v)}
              className={cn('flex w-full items-center gap-3 rounded-lg border-2 px-3 py-3 text-left text-sm font-bold',
                konfirmasi ? 'border-primary bg-primary-wash' : 'border-border hover:bg-muted/60')}>
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border-2', konfirmasi ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                {konfirmasi && <Check className="h-3.5 w-3.5" />}
              </span>
              Sudah dikonfirmasi ke kesiswaan SMP
            </button>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">Catatan verifikasi <span className="font-normal text-muted-foreground">(wajib bila ditolak)</span></span>
              <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={3}
                placeholder="Contoh: dikonfirmasi ke kesiswaan, surat orang tua sudah masuk." />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={pending || !catatan.trim()} onClick={() => putuskan(false)}>Tolak</Button>
              <Button disabled={pending || !konfirmasi} onClick={() => putuskan(true)}>Setujui</Button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
