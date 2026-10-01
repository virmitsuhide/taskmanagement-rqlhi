'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  aturAnggotaAction, hapusKelompokAction, keluarkanAnggotaAction, simpanKelompokAction, ubahLevelAction,
} from '@/app/actions/asrama'
import { LencanaLevel } from '@/components/asrama/LencanaLevel'
import { LABEL_LEVEL, URUTAN_LEVEL } from '@/lib/rq/asrama'
import type { KelompokAsrama } from '@/lib/data/asrama'

type Guru = { id: string; nama: string }
type Calon = { id: string; nama: string; kelas: string | null }

const PILIH = 'h-8 rounded-md border bg-background px-2 text-xs'

function PilihLevel({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} aria-label="Level" className={PILIH}>
      <option value="">— level —</option>
      {URUTAN_LEVEL.map(l => <option key={l} value={l}>{LABEL_LEVEL[l]}</option>)}
    </select>
  )
}

/**
 * Satu kelompok asrama: nama & pengampu, anggota beserta levelnya. Mode
 * baca saja (`bisaUbah` false) untuk pengelola asrama yang lain — BPA melihat
 * asrama putri persis seperti BPI, hanya tanpa tombol.
 */
export function KartuKelompok({ kelompok, guru, calon, bisaUbah }: {
  kelompok: KelompokAsrama
  guru: Guru[]
  /** Anak boarding segender yang belum berkelompok. */
  calon: Calon[]
  bisaUbah: boolean
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [sunting, setSunting] = useState(false)
  const [nama, setNama] = useState(kelompok.nama)
  const [pengampu, setPengampu] = useState(kelompok.pengampu_id ?? '')
  const [baru, setBaru] = useState('')
  const [levelBaru, setLevelBaru] = useState('')

  function jalankan(aksi: () => Promise<{ error?: string }>, sukses: string, sesudah?: () => void) {
    startTransition(async () => {
      const r = await aksi()
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(sukses)
      sesudah?.()
      router.refresh()
    })
  }

  async function hapus() {
    const ok = await confirm({
      title: `Hapus kelompok "${kelompok.nama}"?`,
      description: `${kelompok.anggota.length} anggotanya kembali belum berkelompok. Riwayat setoran tidak terhapus.`,
      confirmText: 'Hapus kelompok',
    })
    if (ok) jalankan(() => hapusKelompokAction(kelompok.id), 'Kelompok dihapus.')
  }

  const perLevel = URUTAN_LEVEL.map(l => ({ l, n: kelompok.anggota.filter(a => a.level === l).length })).filter(x => x.n > 0)

  return (
    <section className="rounded-xl border bg-card p-4">
      {sunting ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 space-y-1">
            <span className="text-xs font-medium">Nama kelompok</span>
            <Input value={nama} onChange={e => setNama(e.target.value)} className="h-9" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium">Pengampu asrama</span>
            <select value={pengampu} onChange={e => setPengampu(e.target.value)} className="h-9 max-w-64 rounded-md border bg-background px-2 text-sm">
              <option value="">— belum ditetapkan —</option>
              {guru.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select>
          </label>
          <Button size="sm" disabled={pending} onClick={() => jalankan(
            () => simpanKelompokAction({ id: kelompok.id, nama, gender: kelompok.gender, pengampu_id: pengampu || null }),
            'Kelompok disimpan.', () => setSunting(false),
          )}>Simpan</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSunting(false)}>Batal</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{kelompok.nama}</h2>
            <p className="text-xs text-muted-foreground">
              Pengampu asrama: {kelompok.pengampu_nama ?? <span className="text-warning">belum ditetapkan</span>}
              {' · '}{kelompok.anggota.length} anak
              {perLevel.length > 0 && <> · {perLevel.map(x => `${LABEL_LEVEL[x.l]} ${x.n}`).join(', ')}</>}
            </p>
          </div>
          {bisaUbah && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSunting(true)} aria-label="Ubah kelompok">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={hapus} disabled={pending} aria-label="Hapus kelompok">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {kelompok.anggota.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada anggota.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Siswa</th>
                <th className="py-1.5 pr-2 font-medium">Level</th>
                <th className="py-1.5 pr-2 font-medium">Pengampu sekolah</th>
                {bisaUbah && <th className="py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {kelompok.anggota.map(a => (
                <tr key={a.student_id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{a.nama}</span>
                    {a.kelas && <span className="ml-1.5 text-xs text-muted-foreground">{a.kelas}</span>}
                  </td>
                  <td className="py-1.5 pr-2">
                    {bisaUbah ? (
                      <PilihLevel
                        value={a.level ?? ''}
                        disabled={pending}
                        onChange={v => jalankan(() => ubahLevelAction(a.student_id, v || null), `Level ${a.nama.split(' ')[0]} disimpan.`)}
                      />
                    ) : (
                      <LencanaLevel level={a.level} />
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                    {a.pengampu_sekolah.length > 0 ? a.pengampu_sekolah.join(', ') : '—'}
                    {a.halaqoh_sekolah && <span className="block text-[11px]">{a.halaqoh_sekolah}</span>}
                  </td>
                  {bisaUbah && (
                    <td className="py-1.5 text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" disabled={pending}
                        aria-label={`Keluarkan ${a.nama}`}
                        onClick={() => jalankan(() => keluarkanAnggotaAction(a.student_id), `${a.nama.split(' ')[0]} dikeluarkan.`)}>
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bisaUbah && calon.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <select value={baru} onChange={e => setBaru(e.target.value)} aria-label="Tambah anggota" className="h-8 min-w-0 max-w-72 flex-1 rounded-md border bg-background px-2 text-xs">
            <option value="">+ Tambah anak boarding…</option>
            {calon.map(c => <option key={c.id} value={c.id}>{c.nama}{c.kelas ? ` (${c.kelas})` : ''}</option>)}
          </select>
          <PilihLevel value={levelBaru} onChange={setLevelBaru} disabled={pending} />
          <Button size="sm" variant="outline" className="h-8" disabled={pending || !baru} onClick={() => jalankan(
            () => aturAnggotaAction(kelompok.id, baru, levelBaru || null),
            'Anggota ditambahkan.', () => { setBaru(''); setLevelBaru('') },
          )}>
            <UserPlus className="mr-1 h-3.5 w-3.5" />Tambah
          </Button>
        </div>
      )}
    </section>
  )
}

/** Tombol + form kecil untuk membuat kelompok baru. */
export function TambahKelompok({ gender, guru }: { gender: 'L' | 'P'; guru: Guru[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [buka, setBuka] = useState(false)
  const [nama, setNama] = useState('')
  const [pengampu, setPengampu] = useState('')

  if (!buka) {
    return <Button size="sm" variant="outline" onClick={() => setBuka(true)}>+ Kelompok baru</Button>
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
      <label className="min-w-48 flex-1 space-y-1">
        <span className="text-xs font-medium">Nama kelompok</span>
        <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Halaqoh Ust. Bahrun" className="h-9" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium">Pengampu asrama</span>
        <select value={pengampu} onChange={e => setPengampu(e.target.value)} className="h-9 max-w-64 rounded-md border bg-background px-2 text-sm">
          <option value="">— belum ditetapkan —</option>
          {guru.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </select>
      </label>
      <Button size="sm" disabled={pending || !nama.trim()} onClick={() => startTransition(async () => {
        const r = await simpanKelompokAction({ nama, gender, pengampu_id: pengampu || null })
        if (r.error) { toast.error(r.error); return }
        toast.success('Kelompok dibuat.')
        setBuka(false); setNama(''); setPengampu('')
        router.refresh()
      })}>Buat</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setBuka(false)}>Batal</Button>
    </div>
  )
}
