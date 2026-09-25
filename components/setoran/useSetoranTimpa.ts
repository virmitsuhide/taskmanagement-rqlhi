'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import type { SetoranGanda } from '@/lib/data/setoran-ganda'

/**
 * Kirim formulir setoran satu-satu, dengan jalan untuk menimpa setoran hari itu.
 *
 * Formulir tidak lagi dikirim lewat prop `action`, melainkan lewat onSubmit
 * yang memanggil action-nya sendiri. Alasannya: React mengosongkan isian tak
 * terkendali (tanggal, catatan, halaman) setiap kali sebuah form action
 * selesai. Bila itu terjadi saat server menjawab "sudah ada setoran", tombol
 * "Timpa" akan mengirim ulang formulir yang sudah kosong — atau lebih buruk,
 * tanggal yang diam-diam kembali ke hari ini. FormData disimpan pada saat
 * pertama dikirim dan itulah yang dikirim ulang, persis sama, plus `timpa=1`.
 */
export function useSetoranTimpa(formAction: (fd: FormData) => void, ganda: SetoranGanda | undefined) {
  const tertunda = useRef<FormData | null>(null)
  const [, startTransition] = useTransition()
  // Perbandingan yang sudah dibatalkan guru tidak dimunculkan lagi sampai
  // server mengirim perbandingan baru.
  const [dibatalkan, setDibatalkan] = useState<SetoranGanda | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Tombol pengirim (mis. "Simpan & berikutnya") ikut terkirim bila bernama.
    const pengirim = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (pengirim?.name) fd.set(pengirim.name, pengirim.value)
    tertunda.current = fd
    startTransition(() => formAction(fd))
  }

  function timpa() {
    const fd = tertunda.current
    if (!fd) return
    fd.set('timpa', '1')
    startTransition(() => formAction(fd))
  }

  return {
    onSubmit,
    daftarGanda: ganda && ganda !== dibatalkan ? [ganda] : [],
    timpa,
    batal: () => setDibatalkan(ganda ?? null),
  }
}
