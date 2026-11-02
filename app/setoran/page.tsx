import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewHalaqoh, JENJANG_LABELS } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { getGuruSetoranKoor, type HalaqohGuru } from '@/lib/data/setoran-koor'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { UNIT_ORDER } from '@/lib/rq/programs'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { PilihGuruSetoran } from '@/components/setoran/PilihGuruSetoran'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ guru?: string; halaqoh?: string; periode?: string; jenis?: string; unit?: string }>
}

/**
 * Setoran siswa sebulan, dipilah per guru — Progres per Sesi milik guru,
 * dibuka dari sisi koordinator.
 *
 * Guru mencatat, koordinator membetulkan: klik sel untuk mengoreksi atau
 * menghapus setoran. Cakupan mengikuti canViewHalaqoh; tombol koreksi hanya
 * untuk halaqoh yang masuk canManageSetoran (koor SD melihat QULS tanpa
 * tombol), dan server memeriksanya lagi per siswa.
 *
 * ?guru=semua: tabel yang sama untuk SEMUA halaqoh pada satu sesi (per unit
 * bila role melihat lebih dari satu unit), dikelompokkan per halaqoh — supaya
 * koor & Kumik bisa menyisir setoran seluruh guru sekaligus.
 */
export default async function SetoranKoorPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewHalaqoh(session.role)) redirect('/dashboard')

  const q = await searchParams
  const periode = isValidPeriod(q.periode ?? '') ? q.periode! : currentPeriod()
  const jenis: JenisRekap = q.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'

  const semua = q.guru === 'semua'
  const daftarGuru = await getGuruSetoranKoor(session.role)
  const guru = semua ? null : daftarGuru.find(g => g.id === q.guru) ?? daftarGuru[0] ?? null
  const halaqoh = guru ? guru.halaqoh.find(h => h.id === q.halaqoh) ?? guru.halaqoh[0] ?? null : null

  // ── Semua guru: halaqoh unik beserta pengampunya, disaring unit & sesi ──
  const semuaHalaqoh = new Map<string, { h: HalaqohGuru; pengampu: string[] }>()
  if (semua) for (const g of daftarGuru) for (const h of g.halaqoh) {
    const x = semuaHalaqoh.get(h.id) ?? { h, pengampu: [] }
    x.pengampu.push(g.nama)
    semuaHalaqoh.set(h.id, x)
  }
  const unitAda = UNIT_ORDER.filter(u => [...semuaHalaqoh.values()].some(x => x.h.jenjang === u))
  // Satu unit per tampilan: seluruh unit sekaligus terlalu panjang (dan terlalu berat) untuk satu tabel.
  const unit = unitAda.find(u => u === q.unit) ?? unitAda[0] ?? null
  const diUnit = [...semuaHalaqoh.values()].filter(x => x.h.jenjang === unit)
  const sesiAda = [...new Set(diUnit.map(x => x.h.sesi ?? 0))].sort((a, b) => a - b)
  // Halaqoh tanpa nomor sesi: di SDIT semuanya kelas QULS (1D–3D) — dinamai "QULS"
  // bila memang semuanya QULS; unit lain (PAUD, SMA, SD Juara) tetap "Tanpa sesi".
  const tanpaSesiQuls = diUnit.some(x => !x.h.sesi) && diUnit.filter(x => !x.h.sesi).every(x => x.h.program === 'quls')
  const daftarSesi = sesiAda.map(n => ({ id: `sesi-${n}`, name: n ? `Sesi ${n}` : tanpaSesiQuls ? 'QULS' : 'Tanpa sesi', sesi: n || null, jenjang: unit! }) as HalaqohSesi)
  const sesiTerpilih = daftarSesi.find(x => x.id === q.halaqoh) ?? daftarSesi[0] ?? null
  const halaqohSesi = sesiTerpilih
    ? diUnit.filter(x => (x.h.sesi ?? 0) === (sesiTerpilih.sesi ?? 0))
        .sort((a, b) => a.h.name.localeCompare(b.h.name, 'id', { numeric: true }))
    : []

  const data = semua
    ? halaqohSesi.length ? await getProgresSesi({ halaqoh: halaqohSesi.map(x => x.h.id) }, periode, jenis) : null
    : halaqoh ? await getProgresSesi(halaqoh.id, periode, jenis) : null
  const bisaSuntingSemua = halaqohSesi.length > 0 && halaqohSesi.every(x => x.h.bisaSunting)
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Setoran Siswa' }]}
      />
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
          <h1 className="text-3xl leading-tight">Setoran Siswa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setoran tiap anak sepanjang bulan, per guru.
            {(semua ? bisaSuntingSemua : halaqoh?.bisaSunting) ? ' Klik angka di sel untuk mengoreksi atau menghapus setoran.' : ''}
          </p>
        </div>

        {semua ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <PilihGuruSetoran
                daftar={daftarGuru.map(g => ({ id: g.id, nama: g.nama, jumlahSesi: g.halaqoh.length }))}
                terpilih="semua"
                query={`periode=${periode}&jenis=${jenis}${unit ? `&unit=${unit}` : ''}`}
              />
              {(['tahsin', 'tahfidz'] as const).map(j => (
                <Link
                  key={j}
                  href={hrefRekap('/setoran', { guru: 'semua', unit: unit ?? undefined, halaqoh: sesiTerpilih?.id, periode, jenis: j })}
                  aria-current={j === jenis ? 'page' : undefined}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    j === jenis ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
                  )}
                >
                  {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
                </Link>
              ))}
            </div>

            {unitAda.length > 1 && (
              <nav aria-label="Pilih unit" className="flex flex-wrap gap-1.5">
                {unitAda.map(u => (
                  <Link
                    key={u}
                    href={hrefRekap('/setoran', { guru: 'semua', unit: u, periode, jenis })}
                    aria-current={u === unit ? 'page' : undefined}
                    className={cn('rounded-full border px-3 py-1 text-sm', u === unit ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent')}
                  >
                    {JENJANG_LABELS[u]}
                  </Link>
                ))}
              </nav>
            )}

            {sesiTerpilih && (
              <FilterSesiBulan
                basePath="/setoran"
                daftar={daftarSesi}
                halaqoh={sesiTerpilih.id}
                periode={periode}
                params={{ guru: 'semua', unit: unit ?? undefined, jenis }}
              />
            )}

            {halaqohSesi.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {unit ? JENJANG_LABELS[unit] : ''} · {sesiTerpilih?.name} · {halaqohSesi.length} halaqoh
              </p>
            )}

            {!data || data.baris.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa aktif di sesi ini.
              </div>
            ) : (
              <TabelProgres
                data={data}
                jenis={jenis}
                hariIni={hariIni}
                tautanSiswa="/siswa/"
                bisaSunting={bisaSuntingSemua}
                kelompok={halaqohSesi.map(x => ({
                  id: x.h.id,
                  judul: x.h.name,
                  keterangan: x.pengampu.join(', '),
                }))}
              />
            )}
          </>
        ) : !guru ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Belum ada guru yang mengampu halaqoh aktif di unit Anda.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <PilihGuruSetoran
                daftar={daftarGuru.map(g => ({ id: g.id, nama: g.nama, jumlahSesi: g.halaqoh.length }))}
                terpilih={guru.id}
                query={`periode=${periode}&jenis=${jenis}`}
              />
              {(['tahsin', 'tahfidz'] as const).map(j => (
                <Link
                  key={j}
                  href={hrefRekap('/setoran', { guru: guru.id, halaqoh: halaqoh?.id, periode, jenis: j })}
                  aria-current={j === jenis ? 'page' : undefined}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    j === jenis ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
                  )}
                >
                  {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
                </Link>
              ))}
            </div>

            {halaqoh && (
              <FilterSesiBulan
                basePath="/setoran"
                daftar={guru.halaqoh}
                halaqoh={halaqoh.id}
                periode={periode}
                params={{ guru: guru.id, jenis }}
              />
            )}

            {halaqoh && (
              <p className="text-sm text-muted-foreground">
                {JENJANG_LABELS[halaqoh.jenjang]} · {halaqoh.name}
                {halaqoh.sesi ? ` · Sesi ${halaqoh.sesi}` : ''}
              </p>
            )}

            {!halaqoh || !data || data.baris.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa aktif di sesi ini.
              </div>
            ) : (
              <TabelProgres data={data} jenis={jenis} hariIni={hariIni} tautanSiswa="/siswa/" bisaSunting={halaqoh.bisaSunting} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
