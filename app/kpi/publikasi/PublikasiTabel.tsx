'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, Eye, Search, Send, Undo2 } from 'lucide-react'
import { terbitkanRaporAction, kembalikanRaporAction } from '@/app/actions/kpi-rapor'
import { STATUS_LABELS, STATUS_TONE, keteranganRapor } from '@/lib/kpi/alur'
import type { BarisPublikasi } from '@/lib/data/kpi-pengesahan'
import type { RingkasBandingAktif } from '@/lib/data/kpi-banding'
import { KPI_LEVELS, KPI_LEVEL_TONE } from '@/lib/kpi/parameter'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

/** Sepadan dengan penjaga di kembalikanRaporAction — dicegah sebelum dikirim. */
const ALASAN_MIN = 10

type Filter = 'semua' | 'menunggu' | 'terbit' | 'dikembalikan'
/** Status yang sudah sampai ke guru. */
const TERBIT = new Set<string>(['terbit', 'banding', 'selesai'])

function inisial(nama: string): string {
  const kata = nama.replace(/^(ust(z|zh|adz|adzah)?\.?\s+)/i, '').split(/\s+/).filter(Boolean)
  return ((kata[0]?.[0] ?? '') + (kata[1]?.[0] ?? '')).toUpperCase() || '?'
}

function PipeTile({
  step, value, hint, tone,
}: { step: string; value: number; hint: string; tone?: 'warm' | 'primary' | 'bad' }) {
  return (
    <div className={cn(
      'rounded-2xl border p-4',
      tone === 'warm' ? 'border-[var(--accent-warm)] bg-accent-warm-wash'
        : tone === 'primary' ? 'bg-primary-wash' : 'bg-card',
    )}>
      <p className={cn(
        'text-xs font-bold',
        tone === 'warm' ? 'text-accent-warm' : tone === 'primary' ? 'text-primary' : tone === 'bad' ? 'text-destructive' : '',
      )}>
        {step}
      </p>
      <p className="mt-1 font-heading text-3xl leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

interface Props {
  rows: BarisPublikasi[]
  unit: Jenjang
  year: number
  month: number
  punyaTtd: boolean
  /**
   * Banding yang belum diputus, dikunci per kpiId. Objek biasa, bukan Map:
   * batas server/klien hanya melewatkan yang bisa diserialkan JSON, dan Map
   * sampai di sini sebagai `{}` tanpa satu pun peringatan.
   */
  banding: Record<string, RingkasBandingAktif>
  /**
   * Baris mana yang boleh DIA terbitkan, dihitung di server (0052).
   *
   * Sejak lingkup penugasan ada, "menunggu koordinator" tidak lagi sama dengan
   * "menunggu SAYA": rapor guru lintas yayasan tetap ber-unit sd/smp dan tetap
   * muncul di meja koor unitnya, tapi yang berhak menandatanganinya Kepala RQ.
   */
  bisaTerbitkan: Record<string, boolean>
}

/**
 * Tabel publikasi: centang, lalu terbitkan sebagian atau semuanya.
 *
 * Yang bisa dicentang hanya baris berstatus 'diajukan'. Baris lain tetap
 * ditampilkan — koordinator perlu melihat rapor yang sudah ia terbitkan dan
 * apakah gurunya sudah membukanya — tapi kotak centangnya tidak ada, sehingga
 * "pilih semua" tidak pernah bisa menyeret sesuatu yang tidak berhak ikut.
 */
export function PublikasiTabel({
  rows, unit, year, month, punyaTtd, banding, bisaTerbitkan,
}: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  const [pesan, setPesan] = useState<{ jenis: 'ok' | 'galat'; teks: string } | null>(null)
  const [kembalikanId, setKembalikanId] = useState<string | null>(null)
  const [alasan, setAlasan] = useState('')
  /**
   * Galat pengembalian ditahan di dalam dialog, tidak ikut `pesan` di puncak
   * halaman. Koordinator sedang menatap dialog saat gagal; pesan yang muncul di
   * belakangnya, di atas tabel sepanjang layar, tidak akan terbaca.
   */
  const [galatKembali, setGalatKembali] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>(() =>
    rows.some(r => r.status === 'diajukan' && bisaTerbitkan[r.kpiId]) ? 'menunggu' : 'semua')
  const [cari, setCari] = useState('')

  const bisaDipilih = rows.filter(r => r.status === 'diajukan' && bisaTerbitkan[r.kpiId])
  const sasaran = rows.find(r => r.kpiId === kembalikanId) ?? null
  const alasanCukup = alasan.trim().length >= ALASAN_MIN
  const semuaTercentang = bisaDipilih.length > 0 && bisaDipilih.every(r => pilih.has(r.kpiId))

  const toggle = (id: string) =>
    setPilih(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleSemua = () =>
    setPilih(semuaTercentang ? new Set() : new Set(bisaDipilih.map(r => r.kpiId)))

  const terbitkan = (ids: string[]) => {
    if (ids.length === 0) return
    start(async () => {
      const hasil = await terbitkanRaporAction(ids)
      if ('error' in hasil) {
        setPesan({ jenis: 'galat', teks: hasil.error })
        return
      }
      setPilih(new Set())
      setPesan({
        jenis: 'ok',
        teks: `${hasil.jumlah} rapor diterbitkan. Guru yang bersangkutan sudah bisa melihatnya di portal.`,
      })
      router.refresh()
    })
  }

  function tutupDialog() {
    setKembalikanId(null)
    setAlasan('')
    setGalatKembali(null)
  }

  const kembalikan = () => {
    if (!kembalikanId || !alasanCukup) return
    const nama = sasaran?.fullName ?? ''
    start(async () => {
      const hasil = await kembalikanRaporAction(kembalikanId, alasan)
      if ('error' in hasil) {
        setGalatKembali(hasil.error)
        return
      }
      tutupDialog()
      setPesan({
        jenis: 'ok',
        teks: `Rapor ${nama} berstatus Dikembalikan. SDM menerima alasannya dan bisa menyuntingnya lagi.`,
      })
      router.refresh()
    })
  }

  // ── Tampilan (murni presentasi) ──
  const nMenunggu = bisaDipilih.length
  const nTerbit = rows.filter(r => TERBIT.has(r.status)).length
  const nKembali = rows.filter(r => r.status === 'dikembalikan').length
  const tampil = rows.filter(r => {
    if (filter === 'menunggu' && !(r.status === 'diajukan' && bisaTerbitkan[r.kpiId])) return false
    if (filter === 'terbit' && !TERBIT.has(r.status)) return false
    if (filter === 'dikembalikan' && r.status !== 'dikembalikan') return false
    if (cari.trim() && !r.fullName.toLowerCase().includes(cari.trim().toLowerCase())) return false
    return true
  })
  const terpilih = rows.filter(r => pilih.has(r.kpiId))
  const rataTerpilih = terpilih.length
    ? terpilih.reduce((t, r) => t + r.rapot, 0) / terpilih.length
    : 0

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: 'semua', label: 'Semua', n: rows.length },
    { key: 'menunggu', label: 'Menunggu', n: nMenunggu },
    { key: 'terbit', label: 'Terbit', n: nTerbit },
    { key: 'dikembalikan', label: 'Dikembalikan', n: nKembali },
  ]

  return (
    <div className="space-y-4">
      {/* Alur: diisi SDM → menunggu Anda → terbit; dikembalikan terpisah */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PipeTile step="1 · Diisi SDM" value={rows.length} hint="rapor tersimpan periode ini" />
        <PipeTile step="2 · Menunggu Anda" value={nMenunggu} hint="tinjau lalu terbitkan" tone="warm" />
        <PipeTile step="3 · Terbit ke guru" value={nTerbit} hint="guru sudah bisa melihat" tone="primary" />
        <PipeTile step="Dikembalikan" value={nKembali} hint="menunggu revisi SDM" tone="bad" />
      </div>

      {pesan && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm',
            pesan.jenis === 'ok'
              ? 'border-success/30 bg-success-wash text-success'
              : 'border-destructive/30 bg-destructive-wash text-destructive',
          )}
        >
          {pesan.jenis === 'ok'
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{pesan.teks}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chips.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
              filter === c.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {c.label}
            <span className={cn('tabular-nums', filter === c.key ? 'opacity-80' : 'text-muted-foreground')}>{c.n}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={cari}
            onChange={e => setCari(e.target.value)}
            placeholder="Cari guru"
            aria-label="Cari guru"
            className="h-9 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={pending || bisaDipilih.length === 0 || !punyaTtd}
          onClick={() => terbitkan(bisaDipilih.map(r => r.kpiId))}
        >
          <Send className="mr-1 h-4 w-4" />
          Terbitkan Semua yang Menunggu ({bisaDipilih.length})
        </Button>
        {!punyaTtd && (
          <span className="text-xs text-muted-foreground">
            Tombol aktif setelah tanda tangan Anda terpasang.
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={semuaTercentang}
                    onChange={toggleSemua}
                    disabled={bisaDipilih.length === 0}
                    aria-label="Pilih semua rapor yang menunggu"
                    className="h-4 w-4 align-middle accent-[var(--primary)]"
                  />
                </th>
                <th className="px-2 py-3 font-bold">Guru</th>
                <th className="px-2 py-3 font-bold">Nilai</th>
                <th className="px-2 py-3 font-bold">Predikat</th>
                <th className="px-2 py-3 font-bold">Status &amp; keterangan</th>
                <th className="px-4 py-3 text-right font-bold"><span className="sr-only">Tindakan</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tampil.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Tidak ada rapor yang cocok dengan saringan ini.
                  </td>
                </tr>
              )}
              {tampil.map(r => {
                const menunggu = r.status === 'diajukan' && bisaTerbitkan[r.kpiId]
                const dipilih = pilih.has(r.kpiId)
                const predikat = KPI_LEVELS.find(l => l.level === r.level)?.predikat
                return (
                  <tr key={r.kpiId} className={cn(dipilih && 'bg-primary-wash')}>
                    <td className="px-4 py-3">
                      {menunggu && (
                        <input
                          type="checkbox"
                          checked={dipilih}
                          onChange={() => toggle(r.kpiId)}
                          aria-label={`Pilih rapor ${r.fullName}`}
                          className="h-4 w-4 align-middle accent-[var(--primary)]"
                        />
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                          dipilih ? 'bg-card text-primary' : 'bg-primary-wash text-primary',
                        )}>
                          {inisial(r.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{r.fullName}</p>
                          {r.versi > 1 && (
                            <p className="text-[11px] text-warning">rev. {r.versi - 1}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 font-heading text-xl tabular-nums">{r.rapot.toFixed(1)}</td>
                    <td className="px-2 py-3">
                      <span className={cn('inline-block whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold', KPI_LEVEL_TONE[r.level])}>
                        {predikat ?? `Level ${r.level}`}
                      </span>
                    </td>
                    {/*
                      Keterangannya diambil dari keteranganRapor() supaya sama
                      persis dengan yang dibaca SDM di /kpi. Yang 'dikembalikan'
                      ditulis ulang dalam sudut pandang koordinator.
                    */}
                    <td className="max-w-[320px] px-2 py-3">
                      <span className={cn('inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold', STATUS_TONE[r.status])}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <p className={cn(
                        'mt-1 text-xs',
                        banding[r.kpiId]?.terlambat ? 'font-medium text-destructive' : 'text-muted-foreground',
                      )}>
                        {r.status === 'dikembalikan'
                          ? 'Anda kembalikan ke SDM — tidak bisa diterbitkan sampai SDM mengajukannya lagi'
                          : r.status === 'diajukan' && !bisaTerbitkan[r.kpiId]
                            // Baris ini tetap ditampilkan, hanya tanpa kotak centang.
                            ? 'Menunggu Kepala RQ — guru berlingkup lintas yayasan, bukan meja tanda tangan Anda'
                            : keteranganRapor({
                              status: r.status,
                              selesaiSebab: r.selesaiSebab,
                              terbitAt: r.terbitAt,
                              bandingBatas: r.bandingBatas,
                              dibuka: r.dibuka,
                              banding: banding[r.kpiId] ?? null,
                            })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild size="sm" variant="outline" className="h-8 rounded-lg bg-card px-3 font-bold">
                          <Link
                            href={`/kpi/cetak?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}
                            title="Lihat lembar rapornya"
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />Rinci
                          </Link>
                        </Button>
                        {menunggu && (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-bold text-destructive hover:bg-destructive-wash"
                            onClick={() => { setKembalikanId(r.kpiId); setAlasan('') }}
                            title="Kembalikan ke SDM"
                          >
                            <Undo2 className="h-3.5 w-3.5" />Kembalikan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bilah aksi menempel di bawah saat ada yang dipilih */}
      {pilih.size > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-[#11352f] px-4 py-3 text-white shadow-lg dark:bg-primary dark:text-primary-foreground">
          <p className="min-w-0 flex-1 text-sm">
            <b className="mr-2">{pilih.size} dipilih</b>
            <span className="opacity-80">
              rata-rata {rataTerpilih.toLocaleString('id-ID', { maximumFractionDigits: 1 })} · akan terlihat di portal guru masing-masing
            </span>
          </p>
          <button
            type="button"
            className="text-sm font-bold opacity-90 hover:opacity-100"
            onClick={() => setPilih(new Set())}
            disabled={pending}
          >
            Batal pilih
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-[#11352f] disabled:opacity-50"
            disabled={pending || pilih.size === 0 || !punyaTtd}
            onClick={() => terbitkan([...pilih])}
          >
            <Check className="h-4 w-4" />
            {pending ? 'Memproses…' : `Terbitkan ${pilih.size}`}
          </button>
        </div>
      )}

      {/*
        Pengembalian dipastikan lewat dialog, bukan formulir sebaris.
        Sebelumnya formulirnya dirender di bawah tabel: pada daftar sepanjang
        satu unit, koordinator yang menekan ikon kembalikan di baris ke-25
        tidak melihat apa pun terjadi — begitu pula galatnya. Dialog memaksa
        satu langkah pemastian dan membawa nama gurunya ikut serta, sehingga
        alasan pemilihan formulir sebaris dulu — supaya baris yang dikembalikan
        tetap terlihat — tetap terpenuhi.
      */}
      <Dialog open={kembalikanId !== null} onOpenChange={open => !open && tutupDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kembalikan rapor ke SDM?</DialogTitle>
            <DialogDescription>
              {sasaran && (
                <>
                  Rapor <span className="font-medium text-foreground">{sasaran.fullName}</span>{' '}
                  (nilai {sasaran.rapot.toFixed(1)}) tidak jadi terbit dan berstatus{' '}
                  <span className="font-medium text-foreground">Dikembalikan</span>. Gurunya belum
                  pernah melihat rapor ini, jadi tidak ada yang perlu ditarik kembali darinya.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Tuliskan apa yang perlu dibetulkan. Alasan ini yang dibaca SDM — tanpa itu ia
              hanya tahu rapornya ditolak, bukan apa yang harus diperbaiki.
            </p>
            <Textarea
              value={alasan}
              onChange={e => setAlasan(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Mis. Jumlah izin WA tidak sesuai catatan saya; tanggal 12 & 19 izin lisan ke saya."
            />
            {!alasanCukup && (
              <p className="text-xs text-muted-foreground">
                Minimal {ALASAN_MIN} karakter — baru {alasan.trim().length}.
              </p>
            )}
            {galatKembali && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {galatKembali}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={pending} onClick={tutupDialog}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending || !alasanCukup}
              onClick={kembalikan}
            >
              <Undo2 className="mr-1 h-4 w-4" />
              Kembalikan ke SDM
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
