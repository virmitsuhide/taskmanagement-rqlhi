'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'
import {
  deleteTeacherAction, restoreTeacherAction, setKategoriGuruAction,
} from '@/app/actions/teachers'
import { KATEGORI_GURU_LABELS, KATEGORI_GURU_ORDER } from '@/lib/auth/permissions'
import type { KategoriGuru } from '@/types'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'

/**
 * Hapus akun guru. Hapusnya lunak — akun disembunyikan, bukan dibuang, dan
 * bisa dipulihkan dari tab Terhapus. Konfirmasinya menyebut nama guru supaya
 * tidak ada akun yang hilang karena salah baris, dan menyebut apa yang tetap
 * aman supaya admin tidak ragu menekan tombolnya.
 */
export function DeleteTeacherButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const confirm = useConfirm()

  async function handleDelete() {
    const ok = await confirm({
      title: `Hapus akun guru "${name}"?`,
      description:
        'Guru langsung kehilangan akses login dan hilang dari semua daftar. ' +
        'Riwayat setoran dan penugasan halaqoh-nya tetap tersimpan, dan akun ini ' +
        'bisa dipulihkan lagi dari tab Terhapus.',
      confirmText: 'Hapus akun guru',
    })
    if (!ok) return

    startTransition(async () => {
      const result = await deleteTeacherAction(id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Akun ${name} dihapus`)
      router.push('/ustadz')
    })
  }

  return (
    <Button
      type="button" size="sm" variant="outline" disabled={pending}
      onClick={handleDelete}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5 mr-1" />
      {pending ? 'Menghapus…' : 'Hapus'}
    </Button>
  )
}

/** Kembalikan akun guru yang terhapus, beserta status aktifnya semula. */
export function RestoreTeacherButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreTeacherAction(id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Akun ${name} dipulihkan`)
      router.refresh()
    })
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleRestore}>
      <RotateCcw className="h-3.5 w-3.5 mr-1" />
      {pending ? 'Memulihkan…' : 'Pulihkan'}
    </Button>
  )
}

/**
 * Penetap kategori guru (0053) langsung dari baris daftar.
 *
 * Ada supaya menyortir puluhan guru tidak berarti puluhan kali berpindah ke
 * Profil Guru dan kembali. Formulir Profil Guru tetap satu-satunya tempat
 * menyunting profil selengkapnya; yang di sini hanya satu pertanyaan, dijawab
 * di tempat pertanyaannya muncul.
 *
 * Disimpan saat pilihan berubah, tanpa tombol Simpan. Satu select dengan satu
 * tombol di sebelahnya menuntut dua klik untuk tiap guru, dan tombol yang tidak
 * ditekan meninggalkan pilihan yang tampak tersimpan padahal tidak.
 */
export function KategoriPicker({
  id, name, current,
}: { id: string; name: string; current: KategoriGuru | null }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  // Pilihan yang tampil dipegang di sini, bukan dibaca dari prop tiap render:
  // baris ini hidup di dalam daftar yang disegarkan dari server, dan select tak
  // terkendali akan kehilangan pilihan barunya begitu daftarnya datang kembali.
  const [nilai, setNilai] = useState<KategoriGuru | ''>(current ?? '')
  const [tersimpan, setTersimpan] = useState(false)

  function handleChange(pilihan: KategoriGuru | '') {
    const sebelumnya = nilai
    setNilai(pilihan)
    setTersimpan(false)

    startTransition(async () => {
      const result = await setKategoriGuruAction(id, pilihan || null)
      if (result?.error) {
        // Pilihan dikembalikan supaya layar tidak mengaku menyimpan sesuatu
        // yang ditolak database — SDM akan melanjutkan ke baris berikutnya dan
        // tidak pernah tahu satu guru ini tertinggal.
        setNilai(sebelumnya)
        toast.error(result.error)
        return
      }
      setTersimpan(true)
      toast.success(
        pilihan
          ? `${name} → ${KATEGORI_GURU_LABELS[pilihan]}`
          : `Kategori ${name} dikosongkan`,
      )
      selesaikanSimpan(router)
    })
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <select
        value={nilai}
        disabled={pending}
        onChange={e => handleChange(e.target.value as KategoriGuru | '')}
        aria-label={`Kategori ${name}`}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        <option value="">— belum ditentukan —</option>
        {KATEGORI_GURU_ORDER.map(k => (
          <option key={k} value={k}>{KATEGORI_GURU_LABELS[k]}</option>
        ))}
      </select>
      <span className="w-16 text-[11px] text-muted-foreground">
        {pending ? 'Menyimpan…' : tersimpan ? '✓ tersimpan' : ''}
      </span>
    </div>
  )
}

/**
 * Apa yang terjadi pada daftar setelah satu guru dapat kategori.
 *
 * Daftarnya disegarkan, jadi baris yang baru dikategorikan LENYAP dari tab
 * "Belum ditentukan" dan hitungan di judul menyusut. Tab itu memang daftar
 * kerja, bukan daftar guru: yang sudah dijawab tidak punya urusan lagi di
 * sana, dan menyusutnya sampai habis itulah tanda pekerjaannya selesai.
 *
 * Harganya dibayar sadar. Baris di bawahnya melompat naik ke posisi kursor,
 * jadi salah pilih tidak bisa dibetulkan di tempat — barisnya sudah pindah ke
 * tab kategorinya. Yang menahan kerugiannya: toast menyebut nama guru dan
 * kategori yang tersimpan, sehingga salah pilih terbaca sebelum barisnya
 * hilang, dan pembetulannya tinggal satu tab di sebelah.
 *
 * Penyegaran ini juga yang menjaga tab lain tetap jujur: tanpanya, "Guru RQ"
 * akan menampilkan jumlah yang sudah basi begitu SDM berpindah ke sana.
 */
function selesaikanSimpan(router: ReturnType<typeof useRouter>) {
  router.refresh()
}
