'use client'

import { useEffect, useRef, useState } from 'react'
import { History, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Isian formulir yang disimpan di perangkat sambil diketik.
 *
 * Jaring pengaman bila halaman tertutup sebelum isian terkirim — tab dimuat
 * ulang, HP mematikan browser di latar, koneksi putus lalu guru berpindah
 * halaman. Bukan tempat menyimpan data: isinya hanya di browser ini, dan
 * dihapus begitu formulirnya berhasil terkirim.
 *
 * Alur:
 *   · nilai berubah  → ditulis ke localStorage (jeda 400 ms)
 *   · formulir dibuka lagi dan ada draf → `draf` terisi; formulir menampilkan
 *     <TawaranDraf>, guru memilih Pulihkan atau Buang
 *   · `tandaiTerkirim()` dipanggil saat menyimpan; bila komponen hilang dari
 *     layar tanpa `galat` (artinya action berhasil lalu mengalihkan halaman),
 *     drafnya dihapus. Bila server menjawab galat, draf tetap ada.
 *
 * Semua akses localStorage dibungkus try/catch: mode privat & penyimpanan
 * penuh membuatnya melempar, dan formulir harus tetap jalan tanpanya.
 */
export function useDraf<T>(kunci: string | null, nilai: T, opsi: { kosong: (v: T) => boolean; galat?: string | null }) {
  const [draf, setDraf] = useState<{ nilai: T; waktu: number } | null>(null)
  // Selama tawaran belum dijawab, isian baru tidak menimpa draf lama.
  const menunggu = useRef(true)
  const terkirim = useRef(false)
  const galat = useRef(opsi.galat)
  useEffect(() => { galat.current = opsi.galat }, [opsi.galat])
  const { kosong } = opsi
  const kunciPenuh = kunci ? `draf:${kunci}` : null

  useEffect(() => {
    menunggu.current = true
    if (!kunciPenuh) return
    let ada: { nilai: T; waktu: number } | null = null
    try {
      const mentah = localStorage.getItem(kunciPenuh)
      if (mentah) ada = JSON.parse(mentah)
    } catch { /* penyimpanan tak tersedia */ }
    // Draf lebih dari 3 hari tidak ditawarkan — isinya hampir pasti sudah basi.
    if (ada && Date.now() - ada.waktu < 3 * 24 * 3600 * 1000 && !kosong(ada.nilai)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage baru terbaca di browser
      setDraf(ada)
    } else {
      menunggu.current = false
      setDraf(null)
    }
  }, [kunciPenuh, kosong])

  const teks = JSON.stringify(nilai)
  useEffect(() => {
    if (!kunciPenuh || menunggu.current) return
    const t = setTimeout(() => {
      try {
        if (kosong(JSON.parse(teks))) localStorage.removeItem(kunciPenuh)
        else localStorage.setItem(kunciPenuh, JSON.stringify({ nilai: JSON.parse(teks), waktu: Date.now() }))
      } catch { /* penyimpanan tak tersedia */ }
    }, 400)
    return () => clearTimeout(t)
  }, [teks, kunciPenuh, kosong])

  useEffect(() => () => {
    if (kunciPenuh && terkirim.current && !galat.current) {
      try { localStorage.removeItem(kunciPenuh) } catch { /* abaikan */ }
    }
  }, [kunciPenuh])

  return {
    draf,
    /** Ambil isi draf untuk diterapkan formulir ke state-nya sendiri. */
    pulihkan(): T | null {
      const d = draf
      menunggu.current = false
      setDraf(null)
      return d?.nilai ?? null
    },
    buang() {
      menunggu.current = false
      setDraf(null)
      if (kunciPenuh) try { localStorage.removeItem(kunciPenuh) } catch { /* abaikan */ }
    },
    tandaiTerkirim() { terkirim.current = true },
  }
}

const JAM = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', hour: '2-digit', minute: '2-digit' })

export function TawaranDraf({ waktu, onPulihkan, onBuang }: { waktu: number; onPulihkan: () => void; onBuang: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-wash px-4 py-3 text-sm">
      <History className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        Ada isian yang belum terkirim dari <span className="font-medium">{JAM.format(new Date(waktu))}</span>.
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onPulihkan}>Pulihkan</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onBuang}>
          <X className="mr-1 h-3.5 w-3.5" />Buang
        </Button>
      </div>
    </div>
  )
}
