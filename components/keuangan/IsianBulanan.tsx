'use client'

import { useActionState, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { saveIsianBulananAction } from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PosIsian {
  kind: 'pemasukan' | 'pengeluaran'
  slug: string
  name: string
  hint: string
}

export interface NilaiIsian { jumlah: number; piutang: number; ket: string }

interface Props {
  period: string
  namaBulan: string
  pos: PosIsian[]
  awal: Record<string, NilaiIsian>
  /** Anggaran per pos bulan ini — pembanding di samping isian. */
  anggaran: Record<string, number>
  canManage: boolean
}

const kunci = (p: Pick<PosIsian, 'kind' | 'slug'>) => `${p.kind}_${p.slug}`
const angka = (s: string) => Number(s.replace(/\D/g, '')) || 0
const tampil = (n: number) => (n ? n.toLocaleString('id-ID') : '')
/** Pos pemasukan dari Yayasan tidak punya piutang. */
const tanpaPiutang = new Set(['subsidi_yayasan', 'proposal_yayasan'])

/**
 * Isian bulanan bendahara: total per pos, bukan per transaksi. Total dan
 * keseimbangan dihitung sambil mengetik supaya selisih ketahuan sebelum
 * laporan dicetak. Subsidi Yayasan tetap diisi bendahara (keputusan
 * 2026-11); tombol "Pakai" hanya mengisinya dengan angka penyeimbang.
 */
export function IsianBulanan({ period, namaBulan, pos, awal, anggaran, canManage }: Props) {
  const [nilai, setNilai] = useState<Record<string, { jumlah: string; piutang: string; ket: string }>>(() =>
    Object.fromEntries(pos.map(p => {
      const a = awal[kunci(p)]
      return [kunci(p), { jumlah: tampil(a?.jumlah ?? 0), piutang: tampil(a?.piutang ?? 0), ket: a?.ket ?? '' }]
    })),
  )
  const [state, action, pending] = useActionState(saveIsianBulananAction, null)
  const [berubah, setBerubah] = useState(false)

  const ubah = (k: string, field: 'jumlah' | 'piutang' | 'ket', v: string) => {
    setBerubah(true)
    setNilai(n => ({ ...n, [k]: { ...n[k], [field]: field === 'ket' ? v : tampil(angka(v)) } }))
  }

  const masuk = pos.filter(p => p.kind === 'pemasukan')
  const keluar = pos.filter(p => p.kind === 'pengeluaran')
  const total = (daftar: PosIsian[]) => daftar.reduce((n, p) => n + angka(nilai[kunci(p)]?.jumlah ?? ''), 0)
  const totalMasuk = total(masuk), totalKeluar = total(keluar)
  const selisih = totalMasuk - totalKeluar
  const kunciSubsidi = 'pemasukan_subsidi_yayasan'
  const subsidiSeimbang = Math.max(totalKeluar - (totalMasuk - angka(nilai[kunciSubsidi]?.jumlah ?? '')), 0)
  const adaSubsidi = masuk.some(p => p.slug === 'subsidi_yayasan')

  const Tabel = ({ judul, daftar, totalnya }: { judul: string; daftar: PosIsian[]; totalnya: number }) => (
    <section className="rounded-2xl border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-heading text-xl">{judul}</h2>
        <p className="text-sm tabular-nums">Total <b>Rp {totalnya.toLocaleString('id-ID')}</b></p>
      </header>
      <ul className="divide-y">
        {daftar.map(p => {
          const k = kunci(p)
          const v = nilai[k]
          const bisaPiutang = p.kind === 'pemasukan' && !tanpaPiutang.has(p.slug)
          const ang = anggaran[k] ?? 0
          return (
            <li key={k} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[minmax(0,13rem)_minmax(0,11rem)_minmax(0,10rem)_minmax(0,1fr)] md:items-start">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{ang ? `Anggaran Rp ${ang.toLocaleString('id-ID')}` : p.hint}</p>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.kind === 'pemasukan' ? 'Diterima (Rp)' : 'Dibayar (Rp)'}</span>
                <input name={`jumlah_${k}`} inputMode="numeric" value={v.jumlah} disabled={!canManage}
                  onChange={e => ubah(k, 'jumlah', e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-lg border bg-background px-2.5 text-right text-sm tabular-nums" placeholder="0" />
                {p.slug === 'subsidi_yayasan' && p.kind === 'pemasukan' && canManage && subsidiSeimbang !== angka(v.jumlah) && (
                  <button type="button" onClick={() => ubah(k, 'jumlah', String(subsidiSeimbang))}
                    className="mt-1 text-left text-xs font-semibold text-primary hover:underline">
                    Agar seimbang: Rp {subsidiSeimbang.toLocaleString('id-ID')} — pakai
                  </button>
                )}
              </label>
              <label className={cn('block', !bisaPiutang && 'hidden md:invisible md:block')}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Piutang belum masuk</span>
                <input name={`piutang_${k}`} inputMode="numeric" value={bisaPiutang ? v.piutang : ''} disabled={!canManage || !bisaPiutang}
                  onChange={e => ubah(k, 'piutang', e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-lg border bg-background px-2.5 text-right text-sm tabular-nums" placeholder="0" />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Keterangan (muncul di laporan)</span>
                <textarea name={`ket_${k}`} rows={2} value={v.ket} disabled={!canManage}
                  onChange={e => ubah(k, 'ket', e.target.value)}
                  className="mt-0.5 w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm"
                  placeholder={p.kind === 'pemasukan' ? 'mis. Piutang Agustus Rp2.022.000 sudah tertagih.' : 'mis. Tertunaikan tanggal 30.'} />
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <form action={action} onSubmit={() => setBerubah(false)} className="space-y-5">
      <input type="hidden" name="period" value={period} />
      <div className={cn('sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm',
        selisih === 0 ? 'border-success/40 bg-success-wash' : 'border-warning/40 bg-warning-wash')}>
        <div className="flex items-start gap-2 text-sm">
          {selisih === 0 ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
          <p>
            <b>{namaBulan}:</b> pemasukan Rp {totalMasuk.toLocaleString('id-ID')} · pengeluaran Rp {totalKeluar.toLocaleString('id-ID')} ·{' '}
            {selisih === 0 ? <b>BALANCE</b> : <b>{selisih > 0 ? 'surplus' : 'defisit'} Rp {Math.abs(selisih).toLocaleString('id-ID')}</b>}
            {selisih !== 0 && adaSubsidi && <span className="text-muted-foreground"> — periksa angka Subsidi Yayasan</span>}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state?.success && !berubah && <p className="text-sm text-success">Tersimpan.</p>}
            <Button type="submit" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan isian'}</Button>
          </div>
        )}
      </div>
      {Tabel({ judul: 'Pemasukan', daftar: masuk, totalnya: totalMasuk })}
      {Tabel({ judul: 'Pengeluaran', daftar: keluar, totalnya: totalKeluar })}
    </form>
  )
}
