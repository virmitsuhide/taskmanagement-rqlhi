import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru } from '@/lib/data/setoran-sesi'
import { getCatatanAdab } from '@/lib/data/rekap-sesi'
import { currentPeriod, formatPeriod, isValidPeriod } from '@/lib/finance/period'
import { BINTANG_ADAB_RENDAH } from '@/lib/rq/bintang'
import { FilterSesiBulan } from '@/components/setoran/FilterSesiBulan'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string; periode?: string }>
}

function tanggalPendek(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Catatan Adab — anak yang nilai sikapnya ≤ 2,5★, dan berapa kali sebulan.
 *
 * Adab tidak ikut menentukan lulus/ulang maupun kenaikan halaman; ia dicatat
 * terpisah supaya guru dan wali kelas bisa menindaklanjuti polanya — sekali
 * rendah bisa kebetulan, lima kali sebulan perlu dibicarakan.
 */
export default async function CatatanAdabPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const params = await searchParams
  const periode = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const daftar = await getHalaqohSesiGuru(session.teacherId)
  // Bawaan "Semua sesi": pertanyaan pertama guru biasanya "anak mana saja",
  // bukan "anak mana di sesi 2".
  const terpilih = daftar.find(h => h.id === params.halaqoh)
  const halaqoh = terpilih?.id ?? 'semua'
  const namaSesi = new Map(daftar.map(h => [h.id, h.sesi ? `Sesi ${h.sesi}` : h.name]))

  const data = daftar.length
    ? await getCatatanAdab(terpilih ? [terpilih.id] : daftar.map(h => h.id), periode)
    : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Catatan Adab
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anak dengan nilai adab ≤ {BINTANG_ADAB_RENDAH.toLocaleString('id-ID')}★ saat setor tahsin atau tahfidz.
            Nilai adab tidak memengaruhi kenaikan halaman.
          </p>
        </div>

        {!data ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh. Hubungi admin untuk assign halaqoh.
          </div>
        ) : (
          <>
            <FilterSesiBulan basePath="/guru/adab" daftar={daftar} halaqoh={halaqoh} periode={periode} semua={daftar.length > 1} />

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">Anak tercatat</p>
                <p className="text-2xl font-bold mt-1.5 leading-none">
                  {data.siswa.length.toLocaleString('id-ID')}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ {data.jumlahSiswa.toLocaleString('id-ID')}</span>
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">Kejadian adab rendah</p>
                <p className="text-2xl font-bold mt-1.5 leading-none">{data.totalRendah.toLocaleString('id-ID')}</p>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">Setoran dinilai adabnya</p>
                <p className="text-2xl font-bold mt-1.5 leading-none">{data.totalDinilai.toLocaleString('id-ID')}</p>
              </div>
            </div>

            {data.totalDinilai === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada setoran yang dinilai adabnya pada {formatPeriod(periode)}.
              </div>
            ) : data.siswa.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Alhamdulillah — tidak ada nilai adab ≤ {BINTANG_ADAB_RENDAH.toLocaleString('id-ID')}★ pada {formatPeriod(periode)}.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.siswa.map(s => (
                  <li key={s.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <Link href={`/guru/siswa/${s.id}`} className="font-semibold hover:underline">{s.nama}</Link>
                        <p className="text-xs text-muted-foreground">
                          {[namaSesi.get(s.halaqoh_id), s.kelas ? `Kelas ${s.kelas}` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <p className="text-sm">
                        <span className="text-lg font-bold text-destructive">{s.kejadian.length}×</span>
                        <span className="text-muted-foreground"> dari {s.dinilai.toLocaleString('id-ID')} setoran dinilai</span>
                      </p>
                    </div>
                    <ul className="mt-3 space-y-1 border-t pt-2 text-xs">
                      {s.kejadian.map((k, i) => (
                        <li key={i} className="flex flex-wrap gap-x-3">
                          <span className="w-24 shrink-0 text-muted-foreground">{tanggalPendek(k.tanggal)}</span>
                          <span className="w-10 shrink-0 font-semibold tabular-nums">{k.bintang.toLocaleString('id-ID')}★</span>
                          <span className="shrink-0 text-muted-foreground">{k.jenis}</span>
                          {k.catatan && <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">“{k.catatan}”</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
