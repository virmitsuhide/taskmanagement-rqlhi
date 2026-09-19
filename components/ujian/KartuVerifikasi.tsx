'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, Loader2, X, BookOpenCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { labelKewajiban as labelButir } from '@/lib/rq/hafalan'
import { simpanVerifikasiAction, type KeputusanVerifikasi } from '@/app/actions/verifikasi-riwayat'
import type { StatusHafalanSiswa, ButirUjian } from '@/lib/data/verifikasi-riwayat'

type Pilihan = 'sudah' | 'belum' | 'batal' | null

const CHIP: Record<ButirUjian['status'], { teks: string; gaya: React.CSSProperties }> = {
  tercatat:      { teks: 'Tercatat',        gaya: { background: 'var(--success-wash)', color: 'var(--success)' } },
  terverifikasi: { teks: 'Terverifikasi',   gaya: { background: 'var(--success-wash)', color: 'var(--success)' } },
  belum:         { teks: 'Belum ujian',     gaya: { background: 'var(--destructive-wash)', color: 'var(--destructive)' } },
  perlu:         { teks: 'Perlu verifikasi', gaya: { background: 'var(--warning-wash)', color: 'var(--warning)' } },
}

/**
 * Checklist ujian yang semestinya sudah ditempuh seorang anak. Butir yang
 * tercatat lewat jalur lain hanya ditampilkan; butir lainnya bisa ditandai
 * Sudah / Belum, atau dicabut keputusannya.
 */
export function KartuVerifikasi({ s, terbuka = false }: { s: StatusHafalanSiswa; terbuka?: boolean }) {
  const [buka, setBuka] = useState(terbuka)
  const [pilih, setPilih] = useState<Record<string, Pilihan>>({})
  const [bulan, setBulan] = useState('')
  const [catatan, setCatatan] = useState('')
  const [pending, start] = useTransition()

  const kunci = (b: ButirUjian) => `${b.tipe}|${b.juz}`
  const bisaDiubah = s.butir.filter(b => b.status !== 'tercatat')
  const nPerlu = s.butir.filter(b => b.status === 'perlu').length
  const nBelum = s.butir.filter(b => b.status === 'belum').length
  const nOk = s.butir.length - nPerlu - nBelum
  const dipilih = Object.entries(pilih).filter(([, v]) => v !== null) as [string, Exclude<Pilihan, null>][]

  const setSemua = (v: Pilihan) =>
    setPilih(Object.fromEntries(s.butir.filter(b => b.status === 'perlu').map(b => [kunci(b), v])))

  const simpan = () => start(async () => {
    const keputusan: KeputusanVerifikasi[] = dipilih.map(([k, hasil]) => {
      const [tipe, juz] = k.split('|') as [KeputusanVerifikasi['tipe'], string]
      return { tipe, juz, hasil }
    })
    const r = await simpanVerifikasiAction({ studentId: s.id, keputusan, bulan: bulan || null, catatan })
    if (r.error) { toast.error(r.error); return }
    toast.success(`${r.tersimpan ?? 0} keputusan tersimpan untuk ${s.nama}`)
    setPilih({})
  })

  return (
    <article className="rounded-xl border bg-card">
      <button type="button" onClick={() => setBuka(b => !b)} aria-expanded={buka}
        className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{s.nama}</p>
          <p className="truncate text-xs text-muted-foreground">
            {s.unitLabel}{s.kelas ? ` · Kelas ${s.kelas}` : ''}{s.halaqoh ? ` · ${s.halaqoh}` : ''}
          </p>
          <p className="mt-1 text-xs">
            {s.juzSetoran !== null
              ? <>Setoran sekarang di <b>juz {s.juzSetoran}</b> · </>
              : null}
            semestinya sudah <b>{s.sampaiPosisi} juz</b> diujikan
          </p>
        </div>
        {/* Ringkasan status: angka + warna, bukan warna saja. */}
        <div className="hidden shrink-0 gap-1.5 text-[11px] sm:flex">
          {nPerlu > 0 && <span className="rounded-full px-2 py-0.5" style={CHIP.perlu.gaya}>{nPerlu} perlu</span>}
          {nBelum > 0 && <span className="rounded-full px-2 py-0.5" style={CHIP.belum.gaya}>{nBelum} belum ujian</span>}
          {nOk > 0 && <span className="rounded-full px-2 py-0.5" style={CHIP.tercatat.gaya}>{nOk} beres</span>}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', buka && 'rotate-180')} />
      </button>

      {buka && (
        <div className="border-t p-4">
          {nPerlu > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Tandai semua yang perlu verifikasi:</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSemua('sudah')}>
                <Check className="mr-1 h-3 w-3" />Sudah dilaksanakan
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPilih({})}>Kosongkan</Button>
            </div>
          )}

          <ol className="divide-y rounded-lg border">
            {s.butir.map(b => {
              const k = kunci(b)
              const v = pilih[k] ?? null
              const tasmi = b.tipe !== '1_juz'
              return (
                <li key={k} className={cn('flex flex-wrap items-center gap-2 px-3 py-2', tasmi && 'bg-muted/40')}>
                  {tasmi && <BookOpenCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                  <span className={cn('min-w-0 flex-1 text-sm', tasmi && 'font-medium')}>{labelButir(b)}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px]" style={CHIP[b.status].gaya}>
                    {CHIP[b.status].teks}{b.bulanLabel ? ` · ${b.bulanLabel}` : ''}
                  </span>
                  {b.status !== 'tercatat' && (
                    <div className="flex gap-1" role="group" aria-label={`Keputusan ${labelButir(b)}`}>
                      {b.status !== 'terverifikasi' && (
                        <Pil aktif={v === 'sudah'} onClick={() => setPilih(p => ({ ...p, [k]: v === 'sudah' ? null : 'sudah' }))}>
                          <Check className="h-3 w-3" />Sudah
                        </Pil>
                      )}
                      {b.status !== 'belum' && (
                        <Pil aktif={v === 'belum'} bahaya onClick={() => setPilih(p => ({ ...p, [k]: v === 'belum' ? null : 'belum' }))}>
                          <X className="h-3 w-3" />Belum
                        </Pil>
                      )}
                      {(b.status === 'terverifikasi' || b.status === 'belum') && (
                        <Pil aktif={v === 'batal'} onClick={() => setPilih(p => ({ ...p, [k]: v === 'batal' ? null : 'batal' }))}>
                          Batalkan
                        </Pil>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {bisaDiubah.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Perkiraan bulan ujian (opsional)</span>
                <Input type="month" value={bulan} onChange={e => setBulan(e.target.value)} className="h-8 text-xs" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Catatan (opsional)</span>
                <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="mis. dicek dari buku mutaba'ah"
                  className="h-8 text-xs" />
              </label>
              <Button type="button" size="sm" disabled={pending || dipilih.length === 0} onClick={simpan} className="h-8">
                {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Simpan{dipilih.length > 0 ? ` (${dipilih.length})` : ''}
              </Button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            &ldquo;Sudah&rdquo; langsung tercatat sebagai ujian selesai dan terhitung juz teruji. Tanpa bulan, ujiannya tidak
            masuk rekap bulanan. &ldquo;Belum&rdquo; berarti anak perlu diajukan ujian seperti biasa.
          </p>
        </div>
      )}
    </article>
  )
}

function Pil({ aktif, bahaya, onClick, children }: { aktif: boolean; bahaya?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={aktif}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        aktif
          ? bahaya ? 'border-destructive bg-destructive text-white' : 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:text-foreground',
      )}>
      {children}
    </button>
  )
}
