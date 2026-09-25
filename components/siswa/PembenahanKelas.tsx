'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowRight, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { pindahkanKelasAction } from '@/app/actions/students'
import type { Jenjang } from '@/types'

export interface SiswaBenah {
  id: string
  full_name: string
  nis: string | null
  halaqoh: string | null
  pengampu: string | null
}

export interface KelompokBenah {
  jenjang: Jenjang
  /** Nilai kelas apa adanya, mis. '4.0'. Kosong bila kolomnya memang kosong. */
  kelas: string
  /** Rombel yang sudah nyata di tingkat yang sama, mis. ['4A','4B','4C','4D']. */
  saran: string[]
  siswa: SiswaBenah[]
}

/**
 * Membereskan kelas yang belum jelas, sekelompok sekaligus.
 *
 * Bentuknya daftar centang, bukan satu formulir per anak, karena begitulah
 * sumbernya dibaca: operator memegang daftar rombel sekolah — "4A: Adzka,
 * Bilal, …" — lalu menandai nama-nama itu di layar. Membuka 31 formulir
 * sunting untuk pekerjaan yang sama adalah 31 kesempatan berhenti di tengah.
 *
 * Yang TIDAK ada di sini, sengaja: tombol yang menyebar anak secara merata ke
 * 4A–4D, atau menebak rombel dari halaqohnya. Halaqoh dan rombel memang sering
 * seiring, tapi tidak selalu — dan salah tempat di sini menaruh anak pada wali
 * kelas yang bukan gurunya, lalu ikut terbawa naik ke tingkat berikutnya tiap
 * tahun ajaran. Rombel itu keputusan sekolah, bukan kesimpulan yang boleh
 * ditarik dari data yang kebetulan ada.
 */
export function PembenahanKelas({ kelompok }: { kelompok: KelompokBenah[] }) {
  if (kelompok.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground bg-muted/30">
        Semua siswa sudah punya kelas yang jelas.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {kelompok.map(k => (
        <Kelompok key={`${k.jenjang}-${k.kelas}`} kelompok={k} />
      ))}
    </div>
  )
}

function Kelompok({ kelompok }: { kelompok: KelompokBenah }) {
  const router = useRouter()
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  const [tujuan, setTujuan] = useState('')
  const [pending, setPending] = useState(false)

  const semua = pilih.size === kelompok.siswa.length && kelompok.siswa.length > 0

  function toggle(id: string) {
    setPilih(kini => {
      const next = new Set(kini)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSemua() {
    setPilih(semua ? new Set() : new Set(kelompok.siswa.map(s => s.id)))
  }

  async function pindahkan() {
    const ids = [...pilih]
    setPending(true)
    const hasil = await pindahkanKelasAction(ids, tujuan)
    setPending(false)
    if ('error' in hasil) {
      toast.error(hasil.error)
      return
    }
    toast.success(`${hasil.jumlah} siswa dipindahkan ke kelas ${hasil.kelas}`)
    setPilih(new Set())
    setTujuan('')
    router.refresh()
  }

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">
            {JENJANG_LABELS[kelompok.jenjang]} &middot; tertulis{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {kelompok.kelas || '(kosong)'}
            </code>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kelompok.siswa.length} siswa &middot; dilewati kenaikan kelas selama belum dibereskan
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSemua}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {semua ? 'Batalkan semua' : 'Pilih semua'}
        </button>
      </div>

      <ul className="divide-y">
        {kelompok.siswa.map(s => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30">
              <input
                type="checkbox"
                checked={pilih.has(s.id)}
                onChange={() => toggle(s.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <Link
                  href={`/siswa/${s.id}`}
                  onClick={e => e.stopPropagation()}
                  className="text-sm font-medium hover:underline"
                >
                  {s.full_name}
                </Link>
                <span className="block text-[11px] text-muted-foreground">
                  {s.nis ? `NIS ${s.nis}` : 'tanpa NIS'}
                  {/* Pengampu ikut ditampilkan sebagai petunjuk, bukan jawaban:
                      ia sering seiring rombel dan membantu mengenali anaknya,
                      tetapi yang memutuskan tetap daftar rombel sekolah. */}
                  {s.pengampu && ` · ${s.pengampu}`}
                  {s.halaqoh && ` · ${s.halaqoh}`}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {pilih.size > 0 && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium">
            {pilih.size} siswa dipilih &middot; pindahkan ke:
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {kelompok.saran.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setTujuan(k)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  tujuan === k
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {k}
              </button>
            ))}
            <Input
              value={tujuan}
              onChange={e => setTujuan(e.target.value)}
              placeholder="atau ketik"
              className="h-7 w-28 text-xs"
              aria-label="Kelas tujuan"
            />
          </div>
          <Button size="sm" disabled={!tujuan.trim() || pending} onClick={pindahkan}>
            {pending ? 'Memindahkan…' : (
              <>
                <Check className="h-3.5 w-3.5" />
                Pindahkan {pilih.size} siswa
                <ArrowRight className="h-3.5 w-3.5" />
                {tujuan.trim() || '…'}
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  )
}
