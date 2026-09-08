'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatTanggal } from '@/lib/rq/ujian'
import { createPengujiAction, deletePengujiAction } from '@/app/actions/ujian'
import { KATEGORI_GURU_LABELS, UNIT_PENUGASAN_LABELS } from '@/lib/auth/permissions'
import type { CalonPenguji, UjianPenguji } from '@/types'

/**
 * Daftar penguji ujian — dipilih dari guru yang benar-benar ada (0054).
 *
 * Dulu ini kolom teks bebas. Sebelas entri yang lahir darinya berbunyi
 * "Ust Akhid", "Usth Erna", "Ust Bahrun (Boarding)" — panggilan sehari-hari
 * yang tidak tercatat di mana pun, dan dua di antaranya cocok dengan lebih dari
 * satu guru sekaligus. Yang hilang bukan kerapian melainkan kemampuan menjawab
 * "ujian apa saja yang diuji ustadz ini", sebab tak ada yang menghubungkan
 * daftar penguji dengan daftar guru selain mata orang yang membacanya.
 */
export function PengujiManager(
  { pengujis, calon }: { pengujis: UjianPenguji[]; calon: CalonPenguji[] },
) {
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [error, setError] = useState('')
  const [hapus, setHapus] = useState<UjianPenguji | null>(null)
  const [pending, startTransition] = useTransition()

  /*
    Penyaringan dikerjakan di peramban atas daftar yang sudah diantar server,
    bukan lewat kueri tiap ketikan. Guru aktifnya berjumlah puluhan, bukan
    ribuan — memanggil server tiap huruf hanya menambah jeda pada pekerjaan
    yang datanya sudah ada di tangan.

    Cocoknya per KATA dan di mana pun letaknya, bukan awalan seluruh nama: yang
    diingat koor hampir selalu panggilan di tengah nama panjang. "karima" harus
    menemukan "Binti Karimah, M. Pd.", dan "akhid" menemukan "Akhid Ahmad
    Efendi, S.Si.".
  */
  const hasil = useMemo(() => {
    const kata = cari.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (kata.length === 0) return calon
    return calon.filter(g => {
      const nama = g.full_name.toLowerCase()
      return kata.every(k => nama.includes(k))
    })
  }, [cari, calon])

  function tambah(guru: CalonPenguji) {
    setError('')
    startTransition(async () => {
      const hasilAksi = await createPengujiAction(guru.id)
      if (hasilAksi.error) {
        setError(hasilAksi.error)
        return
      }
      setCari('')
      router.refresh()
    })
  }

  function konfirmasiHapus() {
    if (!hapus) return
    startTransition(async () => {
      const hasilAksi = await deletePengujiAction(hapus.id)
      setHapus(null)
      if (hasilAksi.error) setError(hasilAksi.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <label htmlFor="cari-guru" className="text-sm font-medium">
          Tambah penguji
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="cari-guru"
            className="h-9 pl-8"
            value={cari}
            onChange={e => setCari(e.target.value)}
            placeholder="Ketik nama guru…"
            autoComplete="off"
          />
        </div>

        {/*
          Daftarnya selalu tampak, tidak menunggu diketik atau difokuskan. Koor
          yang belum hafal nama lengkap seorang guru justru perlu melihat
          pilihannya lebih dulu — dan ketidaktahuan itulah yang dulu membuat
          daftar ini diisi dengan panggilan yang diketik sendiri.
        */}
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
          {hasil.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              {cari.trim() ? (
                <>
                  Tidak ada guru yang cocok dengan &ldquo;{cari.trim()}&rdquo;.
                  <br />
                  Guru harus terdaftar dulu di menu Ustadz / Guru.
                </>
              ) : (
                'Belum ada guru aktif terdaftar.'
              )}
            </li>
          ) : (
            hasil.map(g => (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={pending || g.sudahPenguji}
                  onClick={() => tambah(g)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{g.full_name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {[
                        g.kategori_guru ? KATEGORI_GURU_LABELS[g.kategori_guru] : null,
                        g.unit ? UNIT_PENUGASAN_LABELS[g.unit] : null,
                      ].filter(Boolean).join(' · ') || 'Kategori belum ditentukan'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {g.sudahPenguji ? 'sudah terdaftar' : <UserPlus className="h-4 w-4" />}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Dipilih dari guru yang sudah terdaftar, bukan diketik — supaya nama penguji di
          rapor ujian selalu sama dengan nama di data guru. Daftar ini yang muncul saat
          koordinator menjadwalkan ujian; dipakai bersama SD dan SMP.
        </p>
      </div>

      {pengujis.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm font-medium">Belum ada penguji terdaftar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pilih guru di atas agar bisa dipilih saat menjadwalkan ujian.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pengujis.map(p => (
            <li key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.nama}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {/*
                    Entri warisan ditandai terang-terangan. Ia masih dipakai 49
                    riwayat ujian, jadi tidak boleh dihapus diam-diam — tapi
                    tanpa tanda ini tak ada yang tahu mana yang masih perlu
                    ditautkan ke akun gurunya.
                  */}
                  {p.teacher_id ? (
                    [
                      p.kategori_guru ? KATEGORI_GURU_LABELS[p.kategori_guru] : null,
                      p.unit ? UNIT_PENUGASAN_LABELS[p.unit] : null,
                    ].filter(Boolean).join(' · ') || 'Tertaut ke data guru'
                  ) : (
                    <span className="text-warning">Belum tertaut ke data guru</span>
                  )}
                  {' · '}
                  Ditambahkan {formatTanggal(p.created_at)}
                </p>
              </div>
              <Button
                variant="ghost" size="icon-sm"
                aria-label={`Hapus ${p.nama}`}
                onClick={() => setHapus(p)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(hapus)} onOpenChange={open => !open && setHapus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus penguji?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{hapus?.nama}</span> tidak akan muncul
              lagi saat menjadwalkan ujian. Riwayat ujian yang sudah tercatat atas namanya tetap
              utuh — nama penguji disimpan sebagai teks pada tiap ujian. Akun gurunya tidak
              tersentuh.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1"
              onClick={() => setHapus(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant="destructive" size="lg" className="flex-1"
              onClick={konfirmasiHapus} disabled={pending}>
              {pending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
