'use client'

import { useState, useTransition, useActionState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, X } from 'lucide-react'
import { deleteSetoranAction, updateSetoranAction } from '@/app/actions/setoran-koreksi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type LogTable = 'tahsin_logs' | 'tahfidz_logs' | 'tasmi_logs'

export interface SetoranItem {
  id: string
  table: LogTable
  tanggal: string
  /** Ringkasan isi setoran, mis. "Jilid 2 · hal 14" atau "An-Naba 1–20". */
  judul: string
  nilai: number | null
  sikap: number | null
  status: string | null
  catatan: string | null
  /** Angka isi yang bisa disunting, sesuai jenis setorannya. */
  halaman?: number | null
  barisDari?: number | null
  barisKe?: number | null
  ayatDari?: number | null
  ayatKe?: number | null
}

const LABEL: Record<LogTable, string> = {
  tahsin_logs: 'Tahsin',
  tahfidz_logs: 'Tahfidz',
  tasmi_logs: "Tasmi'",
}

/**
 * Koreksi setoran — wewenang pengurus, bukan guru.
 *
 * Guru mencatat, pengurus membetulkan. Pemisahan itu disengaja: riwayat
 * capaian tidak boleh bisa diubah diam-diam oleh orang yang nilainya sedang
 * dinilai, sementara salah input tetap harus ada jalan keluarnya.
 */
export function SetoranKoreksi({ items }: { items: SetoranItem[] }) {
  const [editing, setEditing] = useState<SetoranItem | null>(null)

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        Belum ada setoran tercatat.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {editing && (
        <EditForm key={editing.id} item={editing} onDone={() => setEditing(null)} />
      )}

      <ul className="divide-y rounded-lg border bg-card">
        {items.map(item => (
          <Row key={`${item.table}:${item.id}`} item={item} onEdit={() => setEditing(item)} />
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Menghapus setoran tahsin ikut membatalkan kenaikan jilid yang ditimbulkannya,
        dan posisi siswa dihitung ulang dari seluruh riwayatnya.
      </p>
    </div>
  )
}

function Row({ item, onEdit }: { item: SetoranItem; onEdit: () => void }) {
  const [pending, startTransition] = useTransition()

  function remove() {
    const ok = confirm(
      `Hapus setoran ${LABEL[item.table]} tanggal ${item.tanggal}?\n\n${item.judul}\n\n` +
      'Kenaikan jilid atau juz yang ditimbulkannya ikut dibatalkan, dan posisi ' +
      'siswa dihitung ulang. Tindakan ini tidak bisa dibatalkan.',
    )
    if (!ok) return

    startTransition(async () => {
      const result = await deleteSetoranAction(item.table, item.id)
      if (result?.error) toast.error(result.error)
      else toast.success('Setoran dihapus, posisi siswa disesuaikan')
    })
  }

  return (
    <li className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {LABEL[item.table]}
          </span>
          <span className="text-sm font-medium">{item.judul}</span>
          {item.status === 'ulang' && (
            <span className="text-xs text-amber-600 dark:text-amber-400">ulang</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.tanggal}
          {item.nilai !== null && ` · nilai ${item.nilai}`}
          {item.sikap !== null && ` · sikap ${item.sikap}`}
          {item.catatan && ` · ${item.catatan}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label="Sunting setoran">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm" variant="ghost" disabled={pending} onClick={remove}
          className="h-7 w-7 p-0 text-destructive" aria-label="Hapus setoran"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  )
}

function EditForm({ item, onDone }: { item: SetoranItem; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await updateSetoranAction(prev, formData)
      if (result.success) {
        toast.success('Setoran diperbarui')
        onDone()
      }
      return result
    },
    null,
  )

  const isTahsin = item.table === 'tahsin_logs'
  const isTahfidz = item.table === 'tahfidz_logs'

  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="table" value={item.table} />
      <input type="hidden" name="id" value={item.id} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Sunting {LABEL[item.table]}</p>
          <p className="text-xs text-muted-foreground">{item.judul}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDone}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date">Tanggal</Label>
          <Input id="setoran_date" name="setoran_date" type="date" required defaultValue={item.tanggal} />
        </div>

        {isTahsin && (
          <div className="space-y-1.5">
            <Label htmlFor="halaman">Halaman</Label>
            <Input id="halaman" name="halaman" inputMode="numeric" defaultValue={item.halaman ?? ''} />
          </div>
        )}

        {isTahfidz && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ayat_dari">Ayat dari</Label>
              <Input id="ayat_dari" name="ayat_dari" inputMode="numeric" defaultValue={item.ayatDari ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ayat_ke">Ayat ke</Label>
              <Input id="ayat_ke" name="ayat_ke" inputMode="numeric" defaultValue={item.ayatKe ?? ''} />
            </div>
          </div>
        )}
      </div>

      {isTahsin && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="baris_dari">Baris dari</Label>
            <Input id="baris_dari" name="baris_dari" inputMode="numeric" defaultValue={item.barisDari ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baris_ke">Baris ke</Label>
            <Input id="baris_ke" name="baris_ke" inputMode="numeric" defaultValue={item.barisKe ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status" name="status" defaultValue={item.status ?? 'lulus'}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="lulus">Lulus</option>
              <option value="ulang">Ulang</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nilai">{isTahsin ? 'Nilai Tahsin' : 'Nilai Tahfidz'}</Label>
          <Input
            id="nilai"
            name={isTahsin ? 'nilai_tahsin' : 'nilai_tahfidz'}
            inputMode="numeric" defaultValue={item.nilai ?? ''} placeholder="0–100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nilai_sikap">Nilai Sikap</Label>
          <Input id="nilai_sikap" name="nilai_sikap" inputMode="numeric" defaultValue={item.sikap ?? ''} placeholder="0–100" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={item.catatan ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan'}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Batal</Button>
      </div>
    </form>
  )
}
