'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { simpanAbsensiAction } from '@/app/actions/absensi'
import { ABSENSI_META, STATUS_ABSENSI, hitungRekap, type StatusAbsensi } from '@/lib/rq/absensi'
import { cn } from '@/lib/utils'

export interface SiswaAbsensi {
  id: string
  full_name: string
  kelas: string | null
}

interface Props {
  halaqohId: string
  tanggal: string
  siswa: SiswaAbsensi[]
  /** Yang sudah tersimpan untuk tanggal ini; kosong = pertemuan belum diabsen. */
  awal: Record<string, { status: StatusAbsensi; catatan: string }>
}

/**
 * Daftar hadir satu pertemuan.
 *
 * Bawaannya HADIR untuk semua anak. Pertemuan yang lazim adalah pertemuan
 * yang semua anaknya datang, jadi guru cukup mengubah yang berbeda lalu
 * menyimpan — pola yang sama dengan layar setoran per sesi. Bawaan ini bukan
 * klaim sistem: tidak ada baris yang tersimpan sampai guru menekan Simpan.
 */
export function AbsensiSesi({ halaqohId, tanggal, siswa, awal }: Props) {
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
      toast.success(sudahTersimpan ? 'Absensi diperbarui.' : `Absensi ${siswa.length} anak tersimpan.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {STATUS_ABSENSI.filter(s => rekap[s] > 0)
            .map(s => `${rekap[s]} ${ABSENSI_META[s].label.toLowerCase()}`)
            .join(' · ')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={semuaHadir} disabled={pending}>
          Tandai semua hadir
        </Button>
      </div>

      <ul className="space-y-2">
        {siswa.map(s => {
          const v = isian[s.id]
          return (
            <li key={s.id} className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.full_name}</p>
                  {s.kelas && <p className="text-xs text-muted-foreground">{s.kelas}</p>}
                </div>

                <div className="flex gap-1" role="group" aria-label={`Kehadiran ${s.full_name}`}>
                  {STATUS_ABSENSI.map(st => {
                    const aktif = v.status === st
                    return (
                      <button
                        key={st}
                        type="button"
                        aria-pressed={aktif}
                        title={ABSENSI_META[st].label}
                        disabled={pending}
                        onClick={() => ubah(s.id, { status: st, catatan: st === 'hadir' ? '' : v.catatan })}
                        className={cn(
                          'h-11 w-11 rounded-lg border text-sm font-bold transition-colors',
                          aktif ? 'text-white' : 'bg-card hover:bg-accent',
                        )}
                        style={aktif ? { background: ABSENSI_META[st].warna, borderColor: ABSENSI_META[st].warna } : undefined}
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
                  className="mt-2 h-9"
                />
              )}
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending}>
          {pending ? 'Menyimpan…' : sudahTersimpan ? 'Perbarui absensi' : `Simpan absensi ${siswa.length} anak`}
        </Button>
      </div>
    </div>
  )
}
