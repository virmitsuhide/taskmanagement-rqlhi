'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays } from 'lucide-react'
import { simpanKalenderTahfidzAction } from '@/app/actions/target-tahfidz'
import { Button } from '@/components/ui/button'
import type { BulanKalender } from '@/lib/rq/target-tahfidz'

interface Props {
  tahunAjaran: string
  bulan: BulanKalender[]
  sumber: 'tersimpan' | 'bawaan'
  bisaUbah: boolean
  tabelAda: boolean
}

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Pekan efektif tiap bulan — satu-satunya masukan manusia bagi target bulanan.
 *
 * Jumlah per semester dihitung ulang selagi diketik: angka itulah yang paling
 * mudah dicocokkan dengan kalender pendidikan ("ganjil kita 18 pekan"), jauh
 * lebih mudah daripada memeriksa dua belas angka satu per satu.
 */
export function KalenderPekanForm({ tahunAjaran, bulan, sumber, bisaUbah, tabelAda }: Props) {
  const [state, action, pending] = useActionState(simpanKalenderTahfidzAction, null)
  const [nilai, setNilai] = useState<Record<string, string>>(
    () => Object.fromEntries(bulan.map(b => [b.bulan, String(b.pekan)])),
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    else if (state?.success) toast.success('Kalender pekan efektif disimpan — target ikut dihitung ulang.')
  }, [state])

  const bolehUbah = bisaUbah && tabelAda
  const jumlah = (semester: 1 | 2) =>
    bulan.filter(b => b.semester === semester).reduce((t, b) => t + (Number((nilai[b.bulan] ?? '').replace(',', '.')) || 0), 0)

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Kalender Pekan Efektif · TA {tahunAjaran}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pekan yang benar-benar ada pertemuan Qur&apos;an, setelah dipotong MPLS, ujian, dan libur. Berlaku untuk semua program.
          </p>
        </div>
        {sumber === 'bawaan' && (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
            Masih perkiraan
          </span>
        )}
      </div>

      <form action={action}>
        <input type="hidden" name="tahun_ajaran" value={tahunAjaran} />
        <div className="grid gap-4 sm:grid-cols-2">
          {([1, 2] as const).map(semester => (
            <fieldset key={semester} className="rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium">
                Semester {semester === 1 ? 'ganjil' : 'genap'} ·{' '}
                <span className="tabular-nums">{jumlah(semester).toLocaleString('id-ID')} pekan</span>
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {bulan.filter(b => b.semester === semester).map(b => (
                  <label key={b.bulan} className="text-[11px] text-muted-foreground">
                    {NAMA_BULAN[Number(b.bulan.slice(5, 7)) - 1]} {b.bulan.slice(2, 4)}
                    <input
                      name={`pekan_${b.bulan}`}
                      inputMode="decimal"
                      value={nilai[b.bulan] ?? ''}
                      onChange={e => setNilai(v => ({ ...v, [b.bulan]: e.target.value }))}
                      disabled={!bolehUbah}
                      className="mt-0.5 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground tabular-nums disabled:opacity-70"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        {bolehUbah ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">Boleh pecahan setengah pekan, mis. 2,5.</p>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan kalender'}</Button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {!tabelAda
              ? 'Kalender belum bisa disimpan: jalankan migrasi 0070 di Supabase.'
              : 'Hanya Kepala RQ dan Kumik yang dapat mengubah kalender.'}
          </p>
        )}
      </form>
    </section>
  )
}
