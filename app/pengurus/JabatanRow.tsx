'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CircleAlert } from 'lucide-react'
import { setPemegangAmanahAction } from '@/app/actions/pengurus'
import { Button } from '@/components/ui/button'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { TEACHER_EMPLOYMENT_LABELS } from '@/types'
import type { BarisJabatan, CalonPengurus } from '@/lib/data/pengurus'

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

interface Props {
  baris: BarisJabatan
  calon: CalonPengurus[]
}

/**
 * Satu jabatan beserta dropdown pemegangnya.
 *
 * Tombol Simpan hanya muncul setelah pilihannya berubah. Dropdown yang menyimpan
 * seketika saat dipilih terasa cepat, tapi di sini satu salah pilih langsung
 * menggeser profil sebuah akun dan mengganti namanya di seluruh aplikasi —
 * pantas ada satu ketukan lagi sebelum itu terjadi.
 */
export function JabatanRow({ baris, calon }: Props) {
  const semula = baris.pemegang?.id ?? ''
  const [pilihan, setPilihan] = useState(semula)
  const [pending, startTransition] = useTransition()

  const berubah = pilihan !== semula

  // Nama yang sudah memegang jabatan LAIN tidak ikut ditawarkan — kalau tetap
  // ditawarkan, memilihnya akan ditolak server dan pengguna baru tahu setelah
  // menekan Simpan. Pemegang kursi ini sendiri tentu tetap ada di daftar.
  const tersedia = calon.filter(g => !g.menjabat || g.id === baris.pemegang?.id)

  function simpan() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('role', baris.role)
      fd.set('orang_id', pilihan)
      // Nilai dropdown hanya berisi id, sedangkan id guru dan id karyawan hidup
      // di tabel berbeda — sumbernya ikut dikirim supaya server tidak perlu
      // menebak dengan mencari di dua tabel.
      fd.set('sumber', tersedia.find(g => g.id === pilihan)?.sumber ?? 'guru')
      const res = await setPemegangAmanahAction(null, fd)
      if (res.error) {
        toast.error(res.error)
        setPilihan(semula)
        return
      }
      toast.success(res.message ?? 'Tersimpan.')
    })
  }

  return (
    <div className="flex flex-col gap-2 border-b px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 sm:w-52 sm:shrink-0">
        <p className="text-sm font-medium leading-snug">{baris.label}</p>
        {baris.pemegang ? (
          <p className="text-xs text-muted-foreground">
            {[
              baris.pemegang.sumber === 'karyawan' ? 'Karyawan' : null,
              baris.pemegang.employment_type
                ? TEACHER_EMPLOYMENT_LABELS[baris.pemegang.employment_type]
                : null,
              baris.pemegang.unit ? JENJANG_LABELS[baris.pemegang.unit] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Belum ditetapkan</p>
        )}
      </div>

      <div className="flex flex-1 items-center gap-2">
        <select
          value={pilihan}
          onChange={e => setPilihan(e.target.value)}
          disabled={pending || !baris.userId}
          className={selectCls}
          aria-label={`Pemegang ${baris.label}`}
        >
          <option value="">— kosongkan —</option>
          {tersedia.map(g => (
            <option key={g.id} value={g.id}>
              {g.full_name}
              {g.sumber === 'karyawan' ? ' — karyawan' : ''}
              {!g.is_active ? ' (non-aktif)' : ''}
            </option>
          ))}
        </select>

        {berubah && (
          <Button size="sm" onClick={simpan} disabled={pending} className="shrink-0">
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        )}
      </div>

      {!baris.userId && (
        <p className="flex items-center gap-1.5 text-xs text-warning sm:w-40 sm:shrink-0">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          Akunnya belum dibuat
        </p>
      )}
    </div>
  )
}
