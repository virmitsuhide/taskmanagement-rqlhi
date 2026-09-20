'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LembarRapor } from '@/components/rapor/LembarRapor'
import { simpanPemetaanAction } from '@/app/actions/rapor-template'
import { cariSlot, MEDAN, MEDAN_PER_KODE, type KodeMedan } from '@/lib/rapor/medan'
import type { Blok } from '@/lib/rapor/docx'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  blok: Blok[]
  pemetaan: Record<string, KodeMedan>
  pengesahan: { tempat_terbit: string; nama_koordinator: string; nip_koordinator: string }
}

const GRUP = [...new Set(MEDAN.map(m => m.grup))]

/**
 * Layar pemetaan — menghubungkan tiap tempat isian di template dengan sumber
 * datanya.
 *
 * Baris yang sudah ditebak sistem tampil lebih dulu; sisanya (teks biasa yang
 * boleh saja berisi data, mis. nama koordinator di blok tanda tangan)
 * disembunyikan di balik satu tombol supaya daftar ini tetap terbaca.
 * Pratinjau di sebelahnya menandai kuning setiap bagian yang akan diganti
 * data, jadi salah petakan kelihatan sebelum satu rapor pun dicetak.
 */
export function PemetaanTemplate({ id, blok, pemetaan, pengesahan }: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [peta, setPeta] = useState<Record<string, KodeMedan>>(pemetaan)
  const [sah, setSah] = useState(pengesahan)
  const [lihatSemua, setLihatSemua] = useState(false)

  const slot = useMemo(() => cariSlot(blok), [blok])
  const terdeteksi = slot.filter(s => s.tebakan !== null)
  const lainnya = slot.filter(s => s.tebakan === null)
  const tampil = lihatSemua ? slot : terdeteksi

  const dipakai = new Set<KodeMedan>(Object.values(peta).filter(k => k !== 'tetap' && k !== 'kosongkan'))
  const belumDipetakan = MEDAN.filter(m => m.grup === 'Diisi guru' && !dipakai.has(m.kode))

  function simpan() {
    mulai(async () => {
      const hasil = await simpanPemetaanAction(id, peta, sah)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success('Pemetaan tersimpan.')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">Pengesahan</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sama untuk seluruh rapor unit ini — tidak perlu diketik ulang tiap anak.
            </p>
          </div>
          <div className="space-y-2">
            <Input value={sah.tempat_terbit} disabled={pending} placeholder="Tempat terbit — Banguntapan"
              onChange={e => setSah({ ...sah, tempat_terbit: e.target.value })} />
            <Input value={sah.nama_koordinator} disabled={pending} placeholder="Nama koordinator — Erna, S.Pd"
              onChange={e => setSah({ ...sah, nama_koordinator: e.target.value })} />
            <Input value={sah.nip_koordinator} disabled={pending} placeholder="NIY koordinator — NIY.20001011.308"
              onChange={e => setSah({ ...sah, nip_koordinator: e.target.value })} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Isi dari data</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {terdeteksi.length} baris terdeteksi{lainnya.length > 0 && `, ${lainnya.length} baris lain`}.
              </p>
            </div>
            {lainnya.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setLihatSemua(v => !v)}>
                {lihatSemua ? 'Yang terdeteksi saja' : 'Tampilkan semua baris'}
              </Button>
            )}
          </div>

          {belumDipetakan.length > 0 && (
            <p className="rounded-lg border border-dashed p-2 text-[11px] text-muted-foreground">
              Belum ada tempat untuk <b>{belumDipetakan.map(m => m.label).join(', ')}</b>. Tanpa itu, tulisan guru
              tidak punya tempat di lembar ini.
            </p>
          )}

          <ul className="space-y-2">
            {tampil.map(s => {
              const kode = peta[s.id] ?? 'tetap'
              const aktif = kode !== 'tetap' && kode !== 'kosongkan'
              return (
                <li key={s.id} className={cn('rounded-lg border p-2', aktif && 'border-primary/40 bg-primary-wash/40')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{s.petunjuk}</p>
                    {s.eksplisit && <span className="shrink-0 text-[10px] uppercase text-muted-foreground">placeholder</span>}
                  </div>
                  {s.contoh && (
                    <p className="truncate text-[11px] text-muted-foreground">di template: &ldquo;{s.contoh.slice(0, 70)}&rdquo;</p>
                  )}
                  <select
                    value={kode}
                    disabled={pending}
                    onChange={e => setPeta({ ...peta, [s.id]: e.target.value as KodeMedan })}
                    className="mt-1.5 h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {GRUP.map(g => (
                      <optgroup key={g} label={g}>
                        {MEDAN.filter(m => m.grup === g).map(m => (
                          <option key={m.kode} value={m.kode}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan pemetaan'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Pratinjau — bagian berlatar kuning akan diganti data tiap anak.
          {' '}{[...dipakai].map(k => MEDAN_PER_KODE.get(k)?.label).filter(Boolean).length} medan terpakai.
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <LembarRapor blok={blok} pemetaan={peta} tandai />
        </div>
      </div>
    </div>
  )
}
