'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, Send, Undo2 } from 'lucide-react'
import { terbitkanRaporAction, kembalikanRaporAction } from '@/app/actions/kpi-rapor'
import { STATUS_LABELS, STATUS_TONE, SEBAB_LABELS, sisaHari } from '@/lib/kpi/alur'
import type { BarisPublikasi } from '@/lib/data/kpi-pengesahan'
import { KPI_LEVEL_TONE } from '@/lib/kpi/parameter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface Props {
  rows: BarisPublikasi[]
  unit: Jenjang
  year: number
  month: number
  punyaTtd: boolean
}

/**
 * Tabel publikasi: centang, lalu terbitkan sebagian atau semuanya.
 *
 * Yang bisa dicentang hanya baris berstatus 'diajukan'. Baris lain tetap
 * ditampilkan — koordinator perlu melihat rapor yang sudah ia terbitkan dan
 * apakah gurunya sudah membukanya — tapi kotak centangnya tidak ada, sehingga
 * "pilih semua" tidak pernah bisa menyeret sesuatu yang tidak berhak ikut.
 */
export function PublikasiTabel({ rows, unit, year, month, punyaTtd }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  const [pesan, setPesan] = useState<{ jenis: 'ok' | 'galat'; teks: string } | null>(null)
  const [kembalikanId, setKembalikanId] = useState<string | null>(null)
  const [alasan, setAlasan] = useState('')

  const bisaDipilih = rows.filter(r => r.status === 'diajukan')
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

  const kembalikan = () => {
    if (!kembalikanId) return
    start(async () => {
      const hasil = await kembalikanRaporAction(kembalikanId, alasan)
      if ('error' in hasil) {
        setPesan({ jenis: 'galat', teks: hasil.error })
        return
      }
      setKembalikanId(null)
      setAlasan('')
      setPesan({ jenis: 'ok', teks: 'Rapor dikembalikan ke SDM beserta alasannya.' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {pesan && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm',
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
        <Button
          size="sm"
          disabled={pending || pilih.size === 0 || !punyaTtd}
          onClick={() => terbitkan([...pilih])}
        >
          <Send className="mr-1 h-4 w-4" />
          Terbitkan Terpilih{pilih.size > 0 && ` (${pilih.size})`}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || bisaDipilih.length === 0 || !punyaTtd}
          onClick={() => terbitkan(bisaDipilih.map(r => r.kpiId))}
        >
          Terbitkan Semua yang Menunggu ({bisaDipilih.length})
        </Button>
        {!punyaTtd && (
          <span className="text-xs text-muted-foreground">
            Tombol aktif setelah tanda tangan Anda terpasang.
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="w-9 px-2 py-2">
                <input
                  type="checkbox"
                  checked={semuaTercentang}
                  onChange={toggleSemua}
                  disabled={bisaDipilih.length === 0}
                  aria-label="Pilih semua rapor yang menunggu"
                  className="h-3.5 w-3.5 align-middle"
                />
              </th>
              <th className="px-2 py-2 text-left font-medium">Guru</th>
              <th className="px-2 py-2 text-center font-medium">Nilai</th>
              <th className="px-2 py-2 text-left font-medium">Status</th>
              <th className="px-2 py-2 text-left font-medium">Keterangan</th>
              <th className="px-2 py-2 text-right font-medium">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const menunggu = r.status === 'diajukan'
              const sisa = sisaHari(r.bandingBatas)
              return (
                <tr key={r.kpiId} className="border-t">
                  <td className="px-2 py-2 text-center">
                    {menunggu && (
                      <input
                        type="checkbox"
                        checked={pilih.has(r.kpiId)}
                        onChange={() => toggle(r.kpiId)}
                        aria-label={`Pilih rapor ${r.fullName}`}
                        className="h-3.5 w-3.5 align-middle"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className="font-medium">{r.fullName}</span>
                    {r.versi > 1 && (
                      <span className="ml-1.5 text-[10px] text-warning">rev. {r.versi - 1}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span
                      className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                        KPI_LEVEL_TONE[r.level],
                      )}
                    >
                      {r.rapot.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_TONE[r.status])}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {r.status === 'selesai' && r.selesaiSebab && SEBAB_LABELS[r.selesaiSebab]}
                    {r.status === 'terbit' && (
                      <>
                        {r.dibuka ? 'Sudah dibuka guru' : 'Belum dibuka guru'}
                        {sisa !== null && sisa >= 0 && ` · sisa ${sisa} hari banding`}
                      </>
                    )}
                    {r.status === 'banding' && 'Menunggu putusan banding'}
                    {r.status === 'draft' && 'Masih di SDM'}
                    {r.status === 'dikembalikan' && 'Anda kembalikan ke SDM'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                        <Link
                          href={`/kpi/cetak?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}
                          title="Lihat lembar rapornya"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {menunggu && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive"
                          onClick={() => { setKembalikanId(r.kpiId); setAlasan('') }}
                          title="Kembalikan ke SDM"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/*
        Formulir pengembalian muncul di tempat, bukan sebagai dialog: yang
        diketik adalah alasan yang akan dibaca SDM, dan koordinator perlu tetap
        melihat baris mana yang sedang ia kembalikan sambil menulisnya.
      */}
      {kembalikanId && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-wash/40 p-3.5">
          <p className="text-sm font-semibold">
            Kembalikan rapor {rows.find(r => r.kpiId === kembalikanId)?.fullName} ke SDM
          </p>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
            Tuliskan apa yang perlu dibetulkan. Alasan ini yang dibaca SDM — tanpa itu
            ia hanya tahu rapornya ditolak, bukan apa yang harus diperbaiki.
          </p>
          <textarea
            value={alasan}
            onChange={e => setAlasan(e.target.value)}
            rows={3}
            placeholder="Mis. Jumlah izin WA tidak sesuai catatan saya; tanggal 12 & 19 izin lisan ke saya."
            className="w-full rounded-md border bg-card px-2.5 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending} onClick={kembalikan}>
              Kembalikan ke SDM
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setKembalikanId(null)}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
