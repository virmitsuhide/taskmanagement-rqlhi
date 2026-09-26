import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { FormJenisEkstra } from '@/components/ekstra/FormEkstra'
import { getDataEkstra, rupiah } from '@/lib/data/ekstra'

/**
 * Jenis ekstra = program (nama, biaya, jumlah peserta, durasi, waktu);
 * program kafalah dibuat sebagai jenis tersendiri dengan biayanya sendiri.
 * Halaqoh ekstra (pengampu + jadwal) diatur di /ekstra/halaqoh.
 */
export default async function AturEkstraPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const data = await getDataEkstra()

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · pengaturan</p>
          <h1 className="mt-1 text-3xl leading-tight">Jenis ekstra</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Jenis ekstra (biaya, durasi, jumlah peserta) yang dicentang &ldquo;dibuka&rdquo; tampil di beranda dan halaman pendaftaran.
            Pengampu dan jadwalnya diatur di tab <b>Halaqoh ekstra</b>.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <div className="max-w-3xl">
            <section className="space-y-4 rounded-2xl border bg-card p-5">
              <h2 className="font-heading text-xl">Jenis ekstra</h2>
              {data.jenis.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jenis ekstra.</p>}
              <ul className="space-y-2">
                {data.jenis.map(j => (
                  <li key={j.id}>
                    <details className="group rounded-xl border">
                      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{j.nama}{!j.aktif && <span className="ml-2 text-xs font-normal text-muted-foreground">(ditutup)</span>}</span>
                          <span className="block text-xs text-muted-foreground">
                            {j.bidang} · {rupiah(j.biaya)}{j.biaya ? ` ${j.satuan_biaya}` : ''} · {j.kuota} peserta/halaqoh · {j.durasi_menit} menit{j.keterangan_waktu ? ` · ${j.keterangan_waktu}` : ''}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-primary group-open:hidden">Ubah</span>
                      </summary>
                      <div className="border-t p-4"><FormJenisEkstra jenis={j} /></div>
                    </details>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="mb-3 text-sm font-semibold">Tambah jenis ekstra</p>
                <FormJenisEkstra />
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  )
}
