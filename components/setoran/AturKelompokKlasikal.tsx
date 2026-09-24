'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { simpanKelompokKlasikalAction } from '@/app/actions/kelompok-klasikal'
import { bisaKlasikal, usulanKelompok } from '@/lib/rq/klasikal'
import type { KelompokKlasikal } from '@/lib/data/kelompok-klasikal'
import type { SiswaSesiTahsin } from '@/lib/data/setoran-sesi'

interface KelompokLayar {
  /** Kunci lokal layar — id sungguhan dibuat server saat disimpan. */
  kunci: string
  nama: string
}

let urut = 0
const kunciBaru = () => `k${Date.now()}-${urut++}`

/**
 * Pengaturan kelompok klasikal satu sesi. Tiap anak dipilihkan kelompoknya
 * lewat satu dropdown — di HP itu lebih cepat daripada menyeret anak ke kotak
 * kelompok. Setoran BERIKUTNYA mengikuti pengaturan ini; setoran lama tidak.
 */
export function AturKelompokKlasikal({ halaqohId, siswa, kelompok }: {
  halaqohId: string
  siswa: SiswaSesiTahsin[]
  kelompok: KelompokKlasikal[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [daftar, setDaftar] = useState<KelompokLayar[]>(() =>
    kelompok.length > 0 ? kelompok.map(k => ({ kunci: k.id, nama: k.nama })) : [{ kunci: kunciBaru(), nama: 'Kelompok A' }])
  const [tempat, setTempat] = useState<Record<string, string>>(() => {
    const t: Record<string, string> = {}
    for (const k of kelompok) for (const id of k.anggota) t[id] = k.id
    return t
  })
  const [berubah, setBerubah] = useState(false)

  const anggotaDari = (kunci: string) => siswa.filter(s => tempat[s.id] === kunci)
  const namaBerikut = () => `Kelompok ${String.fromCharCode(65 + daftar.length)}`

  function ubahTempat(id: string, kunci: string) {
    setTempat(prev => ({ ...prev, [id]: kunci }))
    setBerubah(true)
  }
  function tambahKelompok() {
    setDaftar(prev => [...prev, { kunci: kunciBaru(), nama: namaBerikut() }])
    setBerubah(true)
  }
  function hapusKelompok(kunci: string) {
    setDaftar(prev => prev.filter(k => k.kunci !== kunci))
    setTempat(prev => Object.fromEntries(Object.entries(prev).filter(([, k]) => k !== kunci)))
    setBerubah(true)
  }
  function usulkan() {
    const usulan = usulanKelompok(siswa)
    if (usulan.length === 0) { toast.info('Tidak ada anak yang posisinya sama persis.'); return }
    const baru = usulan.map((_, i) => ({ kunci: kunciBaru(), nama: `Kelompok ${String.fromCharCode(65 + i)}` }))
    setDaftar(baru)
    const t: Record<string, string> = {}
    usulan.forEach((ids, i) => { for (const id of ids) t[id] = baru[i].kunci })
    setTempat(t)
    setBerubah(true)
  }
  function semuaIndividual() {
    setTempat({})
    setBerubah(true)
  }

  function simpan() {
    const isi = daftar.map(k => ({ nama: k.nama, anggota: anggotaDari(k.kunci).map(s => s.id) }))
    const kurang = isi.find(k => k.anggota.length === 1)
    if (kurang) { toast.error(`${kurang.nama} baru berisi 1 anak — klasikal minimal 2, atau jadikan individual.`); return }
    start(async () => {
      const r = await simpanKelompokKlasikalAction(halaqohId, isi.filter(k => k.anggota.length > 0))
      if (r.error) { toast.error(r.error); return }
      toast.success('Pengaturan kelompok tersimpan. Setoran berikutnya mengikuti pengaturan ini.')
      setBerubah(false)
      router.refresh()
    })
  }

  const posisi = (s: SiswaSesiTahsin) =>
    `${s.jilid_label ?? '—'}${s.total_halaman && s.halaman ? ` hal. ${s.halaman}` : ''}`

  return (
    <div className="space-y-4">
      {/* Kelompok */}
      <section className="space-y-2 rounded-2xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-sm font-semibold">Kelompok klasikal</p>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={usulkan}>
            <Sparkles className="mr-1 h-3.5 w-3.5" />Usulkan dari posisi yang sama
          </Button>
        </div>
        <ul className="space-y-2">
          {daftar.map(k => {
            const n = anggotaDari(k.kunci).length
            return (
              <li key={k.kunci} className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                <Input
                  value={k.nama}
                  onChange={e => { setDaftar(prev => prev.map(x => x.kunci === k.kunci ? { ...x, nama: e.target.value } : x)); setBerubah(true) }}
                  className="h-9 flex-1" aria-label="Nama kelompok"
                />
                <span className={cn('w-16 shrink-0 text-right text-xs tabular-nums', n === 1 ? 'text-warning' : 'text-muted-foreground')}>
                  {n} anak
                </span>
                <button type="button" onClick={() => hapusKelompok(k.kunci)} aria-label={`Hapus ${k.nama}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={tambahKelompok}>
            <Plus className="mr-1 h-3.5 w-3.5" />Tambah kelompok
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={semuaIndividual}>
            Semua individual
          </Button>
        </div>
      </section>

      {/* Anak */}
      <section className="rounded-2xl border bg-card">
        <p className="border-b px-3 py-2 text-sm font-semibold">Anak di sesi ini</p>
        <ul className="divide-y">
          {siswa.map(s => {
            const boleh = bisaKlasikal(s)
            const k = tempat[s.id] ?? ''
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {posisi(s)}{s.kelas ? ` · Kelas ${s.kelas}` : ''}
                    {!boleh && ' · setor individual (tahap berbasis materi / belum berjilid)'}
                  </p>
                </div>
                <select
                  value={k}
                  onChange={e => ubahTempat(s.id, e.target.value)}
                  disabled={!boleh || pending}
                  aria-label={`Kelompok ${s.full_name}`}
                  className={cn('h-10 max-w-[45%] rounded-md border bg-background px-2 text-sm', k && 'border-primary font-medium text-primary')}
                >
                  <option value="">Individual</option>
                  {daftar.map(g => <option key={g.kunci} value={g.kunci}>{g.nama}</option>)}
                </select>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Pengaturan ini dipakai halaman <Link href={`/guru/setoran/tahsin/sesi?halaqoh=${halaqohId}`} className="text-primary hover:underline">Setor Tahsin per sesi</Link>.
        Mengganti anggota mengubah setoran berikutnya; setoran yang sudah tersimpan tidak berubah.
      </p>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending || !berubah}>
          {pending ? 'Menyimpan…' : berubah ? 'Simpan pengaturan kelompok' : 'Tersimpan'}
        </Button>
      </div>
    </div>
  )
}
