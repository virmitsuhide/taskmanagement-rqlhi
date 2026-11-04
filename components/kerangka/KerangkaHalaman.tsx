import { Skeleton } from '@/components/ui/skeleton'

/**
 * Kerangka muat yang meniru BENTUK halaman yang akan tampil — judul, baris
 * penyaring, lalu kartu/tabel — supaya isinya menggantikan tempatnya sendiri
 * tanpa lompatan tata letak. Dipakai oleh loading.tsx tiap wilayah.
 */

function Judul() {
  return (
    <div className="mb-5 space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  )
}

function Label({ teks }: { teks: string }) {
  // Teks untuk pembaca layar; kerangkanya sendiri tidak berarti apa-apa.
  return <span className="sr-only" role="status">{teks}</span>
}

/** Portal guru: lebar HalamanGuru, judul, penyaring, daftar kartu. */
export function KerangkaGuru() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <Label teks="Memuat halaman…" />
      <Judul />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 flex-1 sm:w-28 sm:flex-none" />
        <Skeleton className="h-9 flex-1 sm:w-28 sm:flex-none" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Sisi pengurus: bilah atas AppShell, judul, penyaring, lalu papan atau tabel. */
export function KerangkaPengurus({ isi = 'tabel' }: { isi?: 'tabel' | 'papan' }) {
  return (
    <div>
      <Label teks="Memuat halaman…" />
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <Judul />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        {isi === 'papan' ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, k) => (
              <div key={k} className="space-y-2 rounded-2xl border bg-muted/30 p-3">
                <Skeleton className="h-5 w-28" />
                {Array.from({ length: 3 - k % 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border">
            <Skeleton className="h-10 rounded-none" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 border-t px-4 py-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Antrian ujian publik: kotak cari, pilihan unit, daftar per tanggal. */
export function KerangkaAntrian() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <Label teks="Memuat antrian ujian…" />
      <div className="space-y-3 rounded-[20px] border bg-card p-4 md:p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 rounded-xl" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, k) => (
        <div key={k} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ))}
    </div>
  )
}
