'use client'

import { useEffect, useState } from 'react'

/**
 * Bawa ?next= ke action login, dan jelaskan kenapa orang sampai di sini.
 *
 * Dibaca dari window.location di dalam effect, bukan useSearchParams: halaman
 * login dirender statis, dan useSearchParams di sana memaksa batas Suspense
 * untuk dua nilai yang baru dibutuhkan sesudah halaman tampil.
 */
export function LoginTujuan() {
  const [next, setNext] = useState('')
  const [habis, setHabis] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nilai URL baru ada di browser
    setNext(q.get('next') ?? '')
    setHabis(q.get('sesi') === 'habis')
  }, [])

  return (
    <>
      {next && <input type="hidden" name="next" value={next} />}
      {habis && (
        <p role="status" className="rounded-xl border bg-muted px-4 py-3 text-sm">
          <span className="font-semibold">Sesi Anda berakhir</span> karena akun ini tidak dibuka lebih
          dari 7 hari. Masuk lagi untuk kembali ke halaman yang tadi Anda buka.
        </p>
      )}
    </>
  )
}
