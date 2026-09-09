'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, Link2Off } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PilihSiswa } from './PilihSiswa'
import {
  petakanUjianKeSiswaAction,
  lepasPemetaanUjianAction,
  type SaranSiswa,
} from '@/app/actions/ujian'
import { getTahfidzLabel } from '@/lib/rq/ujian'
import type { TahfidzTipe, UjianUnit } from '@/types'

export interface BarisPemetaan {
  id: string
  unit: UjianUnit
  tipe: TahfidzTipe
  juz: string
  /** Nama sebagaimana tercatat dulu — biasanya sudah tersingkat. */
  nama_siswa: string
  kelas: string
  jadwal: string | null
  /** Terisi bila baris ini sudah dipasangkan. */
  student_id: string | null
  nama_terpetakan: string | null
}

/**
 * Memasangkan catatan ujian lama ke siswa, satu per satu.
 *
 * Sengaja tanpa tombol "cocokkan semua otomatis". Nama yang tersimpan sudah
 * tersingkat ("Lutfan N. M." muncul dua kali dengan kelas berbeda), jadi
 * pencocokan mesin hanya memindahkan tebakan dari manusia ke kode sambil
 * menghilangkan kesempatan memeriksanya. Salah pasang di sini menaruh capaian
 * juz pada anak yang keliru, dan baru ketahuan lewat analitik yang aneh
 * berbulan-bulan kemudian.
 */
export function PemetaanUjian({ baris }: { baris: BarisPemetaan[] }) {
  const belum = baris.filter(b => !b.student_id)
  const sudah = baris.filter(b => b.student_id)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-sm font-semibold">
          Belum dipasangkan ({belum.length})
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Selama belum dipasangkan, catatan ini tidak muncul di profil siswa dan
          tidak terhitung di analitik hafalan.
        </p>
        {belum.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Semua catatan sudah dipasangkan.
          </p>
        ) : (
          <div className="space-y-3">
            {belum.map(b => <Baris key={b.id} baris={b} />)}
          </div>
        )}
      </section>

      {sudah.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Sudah dipasangkan ({sudah.length})</h2>
          <div className="space-y-2">
            {sudah.map(b => <BarisSudah key={b.id} baris={b} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function keterangan(b: BarisPemetaan): string {
  const tanggal = b.jadwal
    ? new Date(b.jadwal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'tanpa tanggal'
  return `${b.unit} · Kelas ${b.kelas || '—'} · ${tanggal}`
}

function Baris({ baris }: { baris: BarisPemetaan }) {
  const router = useRouter()
  const [siswa, setSiswa] = useState<SaranSiswa | null>(null)
  const [pending, setPending] = useState(false)

  async function simpan() {
    if (!siswa) return
    setPending(true)
    const res = await petakanUjianKeSiswaAction(baris.id, siswa.id)
    setPending(false)
    if (res.error) toast.error(res.error)
    else {
      toast.success(`Dipasangkan ke ${siswa.full_name}`)
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <p className="font-medium">{baris.nama_siswa}</p>
        <p className="text-xs text-muted-foreground">
          {getTahfidzLabel(baris.tipe, baris.juz)} &middot; {keterangan(baris)}
        </p>
      </div>

      <PilihSiswa unit={baris.unit} terpilih={siswa} onPilih={setSiswa} />

      {siswa && (
        <Button size="sm" className="mt-3" disabled={pending} onClick={simpan}>
          <Check className="h-3.5 w-3.5" />
          {pending ? 'Menyimpan…' : `Pasangkan ke ${siswa.full_name}`}
        </Button>
      )}
    </div>
  )
}

function BarisSudah({ baris }: { baris: BarisPemetaan }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function lepas() {
    setPending(true)
    const res = await lepasPemetaanUjianAction(baris.id)
    setPending(false)
    if (res.error) toast.error(res.error)
    else {
      toast.success('Tautan dilepas')
      router.refresh()
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          <Link href={`/siswa/${baris.student_id}`} className="hover:underline">
            {baris.nama_terpetakan ?? baris.nama_siswa}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          {getTahfidzLabel(baris.tipe, baris.juz)} &middot; {keterangan(baris)}
        </p>
      </div>
      <Button size="sm" variant="ghost" disabled={pending} onClick={lepas}>
        <Link2Off className="h-3.5 w-3.5" />
        Lepas
      </Button>
    </div>
  )
}
