'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { simpanAbsensiAction } from '@/app/actions/absensi'
import { ABSENSI_META, STATUS_ABSENSI, hitungRekap, type StatusAbsensi } from '@/lib/rq/absensi'
import { cn } from '@/lib/utils'

export interface SiswaHadir {
  id: string
  full_name: string
  kelas: string | null
}

interface Props {
  halaqohId: string
  tanggal: string
  siswa: SiswaHadir[]
  /** Yang sudah tersimpan untuk tanggal ini; kosong = pertemuan belum diabsen. */
  awal: Record<string, { status: StatusAbsensi; catatan: string }>
}

/** Warna tiap status — ubin ringkasan (wash) dan tombol terpilih (penuh). */
const NADA: Record<StatusAbsensi, { ubin: string; aktif: string }> = {
  hadir: { ubin: 'bg-primary-wash text-primary', aktif: 'border-primary bg-primary text-primary-foreground' },
  izin: { ubin: 'bg-info-wash text-info', aktif: 'border-info bg-info text-info-foreground' },
  sakit: { ubin: 'bg-warning-wash text-warning', aktif: 'border-warning bg-warning text-warning-foreground' },
  alfa: { ubin: 'bg-destructive-wash text-destructive', aktif: 'border-destructive bg-destructive text-white' },
}

/**
 * Daftar hadir satu pertemuan — tampilan ponsel.
 *
 * Bawaannya HADIR untuk semua anak: pertemuan yang lazim adalah pertemuan
 * yang semua anaknya datang, jadi guru cukup mengubah yang berbeda lalu
 * menyimpan. Bawaan ini bukan klaim sistem: tidak ada baris yang tersimpan
 * sampai guru menekan Simpan.
 */
export function DaftarHadirHarian({ halaqohId, tanggal, siswa, awal }: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const sudahTersimpan = Object.keys(awal).length > 0

  const [isian, setIsian] = useState<Record<string, { status: StatusAbsensi; catatan: string }>>(() =>
    Object.fromEntries(siswa.map(s => [s.id, awal[s.id] ?? { status: 'hadir' as StatusAbsensi, catatan: '' }])),
  )

  const rekap = useMemo(() => hitungRekap(siswa.map(s => isian[s.id]?.status ?? 'hadir')), [siswa, isian])

  function ubah(id: string, perubahan: Partial<{ status: StatusAbsensi; catatan: string }>) {
    setIsian(prev => ({ ...prev, [id]: { ...prev[id], ...perubahan } }))
  }

  function semuaHadir() {
    setIsian(prev => Object.fromEntries(Object.keys(prev).map(id => [id, { status: 'hadir' as StatusAbsensi, catatan: '' }])))
  }

  function simpan() {
    mulai(async () => {
      const hasil = await simpanAbsensiAction(
        halaqohId,
        tanggal,
        siswa.map(s => ({ student_id: s.id, status: isian[s.id].status, catatan: isian[s.id].catatan })),
      )
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(sudahTersimpan ? 'Presensi diperbarui.' : `Presensi ${siswa.length} anak tersimpan.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan hidup — berubah seketika setiap tombol diketuk. */}
      <div className="grid grid-cols-4 gap-1.5">
        {STATUS_ABSENSI.map(st => (
          <div key={st} className={cn('flex flex-col items-center rounded-xl px-1.5 py-2.5', NADA[st].ubin)}>
            <span className="font-heading text-2xl leading-none tabular-nums">{rekap[st]}</span>
            <span className="mt-0.5 text-[11px] font-bold">{ABSENSI_META[st].singkat} · {ABSENSI_META[st].label.toLowerCase()}</span>
          </div>
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Keterangan huruf">
        {STATUS_ABSENSI.map(st => (
          <li key={st} className="flex items-center gap-1.5">
            <span className={cn('flex size-5 items-center justify-center rounded-md border text-[11px] font-bold', NADA[st].aktif)}>
              {ABSENSI_META[st].singkat}
            </span>
            {ABSENSI_META[st].label}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <p className="flex-1 text-[13px] text-muted-foreground">
          {sudahTersimpan ? 'Sudah tersimpan — ubah yang keliru lalu perbarui' : 'Bawaannya H — ketuk huruf untuk yang tidak datang'}
        </p>
        <button
          type="button"
          onClick={semuaHadir}
          disabled={pending}
          className="shrink-0 text-[13px] font-bold text-primary hover:underline disabled:opacity-50"
        >
          Semua hadir
        </button>
      </div>

      <ul className="divide-y rounded-2xl border bg-card px-3.5">
        {siswa.map(s => {
          const v = isian[s.id]
          return (
            <li key={s.id} className="space-y-2.5 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{s.full_name}</p>
                  {s.kelas && <p className="text-xs text-muted-foreground">{s.kelas}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={`Kehadiran ${s.full_name}`}>
                  {STATUS_ABSENSI.map(st => {
                    const aktif = v.status === st
                    return (
                      <button
                        key={st}
                        type="button"
                        role="radio"
                        aria-checked={aktif}
                        aria-label={ABSENSI_META[st].label}
                        title={ABSENSI_META[st].label}
                        disabled={pending}
                        onClick={() => ubah(s.id, { status: st, catatan: st === 'hadir' ? '' : v.catatan })}
                        className={cn(
                          'size-11 rounded-xl border text-base font-extrabold transition-colors disabled:opacity-60',
                          aktif ? NADA[st].aktif : 'bg-card text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {ABSENSI_META[st].singkat}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Alasan hanya ditanyakan saat anaknya tidak hadir. */}
              {v.status !== 'hadir' && (
                <Input
                  value={v.catatan}
                  disabled={pending}
                  onChange={e => ubah(s.id, { catatan: e.target.value })}
                  placeholder={`Keterangan ${ABSENSI_META[v.status].label.toLowerCase()} (opsional)`}
                  aria-label={`Keterangan ${ABSENSI_META[v.status].label.toLowerCase()} ${s.full_name}`}
                  className="h-11 rounded-xl"
                />
              )}
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        <button
          type="button"
          onClick={simpan}
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Check className="size-4" />
          {pending ? 'Menyimpan…' : sudahTersimpan ? 'Perbarui presensi' : `Simpan presensi ${siswa.length} anak`}
        </button>
      </div>
    </div>
  )
}
