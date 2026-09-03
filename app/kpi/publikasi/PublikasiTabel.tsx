'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, Send, Undo2 } from 'lucide-react'
import { terbitkanRaporAction, kembalikanRaporAction } from '@/app/actions/kpi-rapor'
import { STATUS_LABELS, STATUS_TONE, keteranganRapor } from '@/lib/kpi/alur'
import type { BarisPublikasi } from '@/lib/data/kpi-pengesahan'
import type { RingkasBandingAktif } from '@/lib/data/kpi-banding'
import { KPI_LEVEL_TONE } from '@/lib/kpi/parameter'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

/** Sepadan dengan penjaga di kembalikanRaporAction — dicegah sebelum dikirim. */
const ALASAN_MIN = 10

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
              const menunggu = r.status === 'diajukan' && bisaTerbitkan[r.kpiId]
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
                  {/*
                    Keterangannya diambil dari keteranganRapor() supaya sama
                    persis dengan yang dibaca SDM di /kpi — dua salinan kalimat
                    untuk keadaan yang sama akan berselisih pada hari salah
                    satunya diperbaiki, dan selisihnya berupa dua peran yang
                    membicarakan rapor yang sama dengan pemahaman berbeda.

                    Yang 'dikembalikan' ditulis ulang dalam sudut pandang
                    koordinator: dialah yang melakukannya, dan kalimat pihak
                    ketiga di meja kerjanya sendiri terbaca seolah orang lain
                    yang mengembalikannya.
                  */}
                  <td className={cn(
                    'px-2 py-2 text-xs',
                    banding[r.kpiId]?.terlambat
                      ? 'font-medium text-destructive'
                      : 'text-muted-foreground',
                  )}>
                    {r.status === 'dikembalikan'
                      ? 'Anda kembalikan ke SDM — tidak bisa diterbitkan sampai SDM mengajukannya lagi'
                      : r.status === 'diajukan' && !bisaTerbitkan[r.kpiId]
                        // Baris ini tetap ditampilkan, hanya tanpa kotak centang.
                        // Menyembunyikannya akan membuat koordinator mengira
                        // gurunya belum dinilai dan menagih SDM untuk pekerjaan
                        // yang sudah selesai — sedangkan barisnya yang terlihat
                        // tapi tak bisa disentuh menjelaskan dirinya sendiri.
                        ? 'Menunggu Kepala RQ — guru berlingkup lintas yayasan, bukan meja tanda tangan Anda'
                        : keteranganRapor({
                          status: r.status,
                          selesaiSebab: r.selesaiSebab,
                          terbitAt: r.terbitAt,
                          bandingBatas: r.bandingBatas,
                          dibuka: r.dibuka,
                          banding: banding[r.kpiId] ?? null,
                        })}
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
