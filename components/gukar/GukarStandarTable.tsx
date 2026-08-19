'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setGukarProfilPesertaAction } from '@/app/actions/gukar'
import { Input } from '@/components/ui/input'
import { LABEL_STATUS_PEGAWAI, STANDAR_PERAN } from '@/lib/rq/gukar-standar'
import type { KesiapanPeserta } from '@/lib/data/gukar-standar'
import type { GukarStatusPegawai } from '@/types'

interface Props {
  peserta: KesiapanPeserta[]
  /** SDM & Kepala RQ boleh menetapkan status; peran lain hanya melihat. */
  dapatMenyunting: boolean
}

type Saringan = 'semua' | 'belum_terdata' | 'belum_inti' | 'calon_tetap' | 'tetap'

const SARINGAN: { key: Saringan; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'belum_terdata', label: 'Belum terdata' },
  { key: 'belum_inti', label: 'Belum penuhi inti' },
  { key: 'calon_tetap', label: 'Calon pegawai tetap' },
  { key: 'tetap', label: 'Pegawai tetap' },
]

/**
 * Rincian seluruh peserta beserta penetapan status kepegawaian.
 *
 * Daftarnya panjang — 161 orang pada semester berjalan — jadi penyaring dan
 * pencarian ada di sini, bukan di server: SDM menelusuri daftar ini sambil
 * menandai orang per orang, dan memuat ulang halaman tiap kali menyaring
 * akan memutus alur kerja itu.
 */
export function GukarStandarTable({ peserta, dapatMenyunting }: Props) {
  const [cari, setCari] = useState('')
  const [saringan, setSaringan] = useState<Saringan>('semua')

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase()
    return peserta.filter(p => {
      if (kata && !`${p.nama} ${p.kelompok} ${p.pengampu} ${p.unit}`.toLowerCase().includes(kata)) {
        return false
      }
      switch (saringan) {
        case 'belum_terdata': return !p.terdata
        case 'belum_inti': return p.terdata && !p.inti
        case 'calon_tetap': return p.statusPegawai === 'calon_tetap'
        case 'tetap': return p.statusPegawai === 'tetap'
        default: return true
      }
    })
  }, [peserta, cari, saringan])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari nama, kelompok, atau pengampu…"
          className="h-9 max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {SARINGAN.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSaringan(s.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                saringan === s.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {tampil.length} dari {peserta.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 px-3 font-medium">Nama</th>
              <th className="py-2 px-3 font-medium">Tahsin</th>
              <th className="py-2 px-3 font-medium">Tahfidz</th>
              <th className="py-2 px-3 font-medium">Status vs standar</th>
              <th className="py-2 px-3 font-medium">Kepegawaian</th>
              <th className="py-2 px-3 font-medium">Kategori peran</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map(p => (
              <BarisPeserta key={p.id} peserta={p} dapatMenyunting={dapatMenyunting} />
            ))}
            {tampil.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Tidak ada peserta yang cocok dengan saringan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BarisPeserta({
  peserta, dapatMenyunting,
}: {
  peserta: KesiapanPeserta
  dapatMenyunting: boolean
}) {
  const [status, setStatus] = useState<GukarStatusPegawai | ''>(peserta.statusPegawai ?? '')
  const [peran, setPeran] = useState(peserta.kategoriPeran)
  const [pending, startTransition] = useTransition()

  function simpan(statusBaru: GukarStatusPegawai | '', peranBaru: string) {
    setStatus(statusBaru)
    setPeran(peranBaru)
    startTransition(async () => {
      const hasil = await setGukarProfilPesertaAction(peserta.id, statusBaru, peranBaru)
      if (hasil?.error) {
        toast.error(hasil.error)
        setStatus(peserta.statusPegawai ?? '')
        setPeran(peserta.kategoriPeran)
      } else {
        toast.success(`${peserta.nama} diperbarui`)
      }
    })
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 px-3">
        <p className="font-medium">{peserta.nama}</p>
        <p className="text-xs text-muted-foreground">
          {[peserta.unit, peserta.pengampu].filter(Boolean).join(' · ')}
        </p>
      </td>
      <td className="py-2 px-3">
        <span className={peserta.tahsin.memenuhi ? 'text-emerald-600 dark:text-emerald-400' : ''}>
          {peserta.tahsin.tahap || '—'}
        </span>
        {peserta.tahsin.tersirat && peserta.tahsin.tahap && (
          <span className="ml-1 text-[10px] text-muted-foreground">(tersirat)</span>
        )}
      </td>
      <td className="py-2 px-3">
        <span className={peserta.tahfidz.memenuhi ? 'text-emerald-600 dark:text-emerald-400' : ''}>
          {peserta.tahfidz.label || '—'}
        </span>
        {peserta.tahfidz.predikat && (
          <p className="text-xs text-muted-foreground">{peserta.tahfidz.predikat}</p>
        )}
      </td>
      <td className="py-2 px-3">
        <span className={peserta.status.memenuhi ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
          {peserta.terdata ? peserta.status.teks : 'Belum ada catatan'}
        </span>
      </td>
      <td className="py-2 px-3">
        {dapatMenyunting ? (
          <select
            value={status}
            disabled={pending}
            onChange={e => simpan(e.target.value as GukarStatusPegawai | '', peran)}
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
            aria-label={`Status kepegawaian ${peserta.nama}`}
          >
            <option value="">— belum ditetapkan —</option>
            {Object.entries(LABEL_STATUS_PEGAWAI).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground">
            {status ? LABEL_STATUS_PEGAWAI[status] : '—'}
          </span>
        )}
      </td>
      <td className="py-2 px-3">
        {dapatMenyunting ? (
          <select
            value={peran}
            disabled={pending}
            onChange={e => simpan(status, e.target.value)}
            className="h-8 max-w-52 rounded-md border bg-transparent px-2 text-xs"
            aria-label={`Kategori peran ${peserta.nama}`}
          >
            <option value="">— ambang inti —</option>
            {STANDAR_PERAN.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground">
            {STANDAR_PERAN.find(s => s.key === peran)?.label ?? '—'}
          </span>
        )}
      </td>
    </tr>
  )
}
