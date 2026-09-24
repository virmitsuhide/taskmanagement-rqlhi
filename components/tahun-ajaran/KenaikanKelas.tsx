'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GraduationCap, TriangleAlert } from 'lucide-react'
import { naikkanKelasAction, pratinjauKenaikanAction, type RencanaKenaikan } from '@/app/actions/students'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { AcademicTerm } from '@/types'

/**
 * Menaikkan seluruh angkatan satu tingkat, menuju tahun ajaran berjalan.
 *
 * Berdiri terpisah dari TermManager dan TIDAK menempel pada "Jadikan berjalan".
 * Berpindah semester adalah tindakan yang wajar diulang — koor menengok
 * semester lalu untuk memeriksa rekap, lalu kembali. Kalau kenaikan menempel di
 * sana, sekali menengok arsip akan menaikkan seluruh angkatan untuk kedua
 * kalinya.
 *
 * Pratinjaunya wajib dibuka lebih dulu, dan tombolnya baru muncul sesudah itu.
 * Angka "612 naik · 157 lulus" adalah satu-satunya kesempatan seseorang
 * menyadari bahwa yang akan berubah bukan satu kelas, melainkan semuanya.
 */
export function KenaikanKelas({ term, boleh }: { term: AcademicTerm; boleh: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()
  const [rencana, setRencana] = useState<RencanaKenaikan | null>(null)

  if (!boleh) return null

  const sudah = term.kenaikan_at

  function lihatRencana() {
    startTransition(async () => {
      const hasil = await pratinjauKenaikanAction()
      if ('error' in hasil) {
        toast.error(hasil.error)
        return
      }
      setRencana(hasil.rencana)
    })
  }

  async function jalankan() {
    if (!rencana) return
    const ok = await confirm({
      title: `Naikkan seluruh siswa menuju ${term.year_label}?`,
      description:
        `• ${rencana.naik} siswa naik satu tingkat (1A → 2A, rombel tetap)\n` +
        `• ${rencana.lulus} siswa kelas akhir ditandai lulus & nonaktif\n` +
        (rencana.dilewati.length > 0
          ? `• ${rencana.dilewati.reduce((n, d) => n + d.jumlah, 0)} siswa DILEWATI karena kelasnya tidak berpola\n`
          : '') +
        '\nHanya bisa dijalankan sekali untuk tahun ajaran ini.',
      confirmText: 'Naikkan kelas',
    })
    if (!ok) return

    startTransition(async () => {
      const hasil = await naikkanKelasAction(term.id)
      if ('error' in hasil && hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(`${hasil.naik} siswa naik, ${hasil.lulus} lulus.`)
      setRencana(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-medium">Kenaikan Kelas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Menaikkan seluruh siswa aktif satu tingkat menuju{' '}
            <b className="text-foreground">{term.year_label}</b> — angkanya naik, rombelnya
            tetap. Siswa kelas akhir (6 SD, 9 SMP) ditandai lulus dan nonaktif; riwayat
            setoran serta rapornya tetap tersimpan.
          </p>
        </div>
      </div>

      {sudah ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Sudah dijalankan pada {new Date(sudah).toLocaleString('id-ID')}. Tidak bisa
          diulang — mengulangnya akan menaikkan seluruh angkatan dua tingkat.
        </p>
      ) : rencana ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-1">
              <b className="tabular-nums">{rencana.naik}</b> naik satu tingkat
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              <b className="tabular-nums">{rencana.lulus}</b> lulus &amp; nonaktif
            </span>
          </div>

          {rencana.dilewati.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-wash px-3 py-2 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {rencana.dilewati.reduce((n, d) => n + d.jumlah, 0)} siswa akan dilewati
                </p>
                {/* Ditolak, bukan ditebak: '4.0' tidak punya rombel yang bisa
                    dipertahankan, dan menebaknya memindahkan anak ke kelas yang
                    tak pernah diputuskan siapa pun. */}
                <p className="mt-0.5 opacity-90">
                  Kelasnya tidak berpola angka+rombel:{' '}
                  {rencana.dilewati.map(d => `${d.kelas} (${d.jumlah})`).join(', ')}.
                  Betulkan dulu lewat menu Siswa kalau mereka harus ikut naik.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setRencana(null)}>
              Batal
            </Button>
            <Button size="sm" disabled={pending} onClick={jalankan}>
              {pending ? 'Menjalankan…' : `Naikkan ${rencana.naik} siswa`}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={lihatRencana}>
          {pending ? 'Menghitung…' : 'Lihat rencana kenaikan'}
        </Button>
      )}
    </div>
  )
}
