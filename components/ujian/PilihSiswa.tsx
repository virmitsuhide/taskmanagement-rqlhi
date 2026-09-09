'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cariSiswaUjianAction, type SaranSiswa } from '@/app/actions/ujian'
import { ringkasHafalan } from '@/lib/rq/hafalan'
import type { UjianUnit } from '@/types'

interface Props {
  unit: UjianUnit
  terpilih: SaranSiswa | null
  onPilih: (siswa: SaranSiswa | null) => void
}

/**
 * Mencari siswa dari data yang sudah ada, alih-alih mengetik namanya bebas.
 *
 * Sebelum ini nama siswa adalah teks bebas, dan hasilnya terlihat di data:
 * dari 38 catatan ujian, hanya 2 yang namanya cocok dengan baris di students.
 * Selebihnya sudah tersingkat saat diketik, sehingga tidak ada cara mengetahui
 * anak mana yang dimaksud — riwayat per siswa dan hitungan juz sama-sama
 * mustahil dibangun di atasnya.
 *
 * Memilih dari daftar menyelesaikan tiga hal sekaligus: tautan ke siswa,
 * kelas yang terisi sendiri (jadi tidak ada lagi "VII A" vs "7A"), dan capaian
 * juz yang langsung diketahui sehingga pilihan juz bisa disaring.
 */
export function PilihSiswa({ unit, terpilih, onPilih }: Props) {
  const [kueri, setKueri] = useState('')
  const [hasil, setHasil] = useState<SaranSiswa[]>([])
  const [mencari, setMencari] = useState(false)
  const [buka, setBuka] = useState(false)
  const wadah = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function keluar(e: MouseEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false)
    }
    if (buka) document.addEventListener('mousedown', keluar)
    return () => document.removeEventListener('mousedown', keluar)
  }, [buka])

  const kueriBersih = kueri.trim()
  const cukupPanjang = kueriBersih.length >= 2

  // Hasil TIDAK dikosongkan lewat setState saat ketikan memendek — ia cukup
  // diturunkan dari kuerinya. Mengosongkannya di dalam effect memicu render
  // beruntun untuk sesuatu yang sudah bisa dihitung saat render.
  const tampil = cukupPanjang ? hasil : []

  // Jeda 250 ms: mengetik "Muhammad" tanpa ini menembakkan delapan permintaan,
  // dan yang datang belakangan belum tentu jawaban ketikan terakhir.
  useEffect(() => {
    if (!cukupPanjang) return
    let batal = false
    const timer = setTimeout(async () => {
      setMencari(true)
      const data = await cariSiswaUjianAction(unit, kueriBersih)
      if (batal) return
      setHasil(data)
      setMencari(false)
      setBuka(true)
    }, 250)
    return () => {
      batal = true
      clearTimeout(timer)
    }
  }, [kueriBersih, cukupPanjang, unit])

  if (terpilih) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <Check className="h-4 w-4 shrink-0 text-success" />
            {terpilih.full_name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kelas {terpilih.kelas ?? '—'} &middot; {ringkasHafalan(terpilih.sudahSampai)}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => onPilih(null)}>
          <X className="h-3.5 w-3.5" />
          Ganti
        </Button>
      </div>
    )
  }

  return (
    <div className="relative" ref={wadah}>
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8"
          value={kueri}
          onChange={e => setKueri(e.target.value)}
          onFocus={() => tampil.length > 0 && setBuka(true)}
          placeholder="Ketik nama siswa…"
          autoComplete="off"
        />
      </div>

      {buka && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {mencari && <p className="px-3 py-2 text-sm text-muted-foreground">Mencari…</p>}

          {!mencari && tampil.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Tidak ada siswa {unit} bernama itu. Periksa ejaannya, atau daftarkan
              siswanya lebih dulu lewat menu Siswa.
            </p>
          )}

          {!mencari && tampil.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPilih(s)
                setBuka(false)
              }}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <span className="text-sm font-medium">{s.full_name}</span>
              <span className="text-[11px] text-muted-foreground">
                Kelas {s.kelas ?? '—'} &middot; {ringkasHafalan(s.sudahSampai)}
              </span>
            </button>
          ))}
        </div>
      )}

      {kueriBersih.length === 1 && (
        <p className="mt-1 text-xs text-muted-foreground">Ketik minimal dua huruf.</p>
      )}
    </div>
  )
}
