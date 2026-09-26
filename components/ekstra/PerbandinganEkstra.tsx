import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { targetPerTingkat, type CapaianKelompok } from '@/lib/data/capaian-kelas'
import { Panel } from '@/components/dashboard/kit'

type Ringkas = Map<number | null, { tercapai: number; bertarget: number }>

/**
 * Peserta ekstra (siswa LHI) dibanding seluruh angkatannya: % yang sudah
 * sesuai atau di atas target kelas. Targetnya sama — target angkatan — jadi
 * selisih kolom inilah jawaban "apakah anak ekstra melampaui teman seangkatannya".
 */
export function PerbandinganEkstra({ pasangan }: {
  /** Satu pasang per kelompok (unit × jalur) yang punya peserta ekstra. */
  pasangan: { ekstra: CapaianKelompok; angkatan: CapaianKelompok | undefined }[]
}) {
  return (
    <Panel title="Peserta ekstra vs angkatannya" icon={<Scale className="h-4 w-4" />}
      sub="% siswa yang sesuai atau di atas target kelas · target sama untuk keduanya (target angkatan)">
      <div className="space-y-6">
        {pasangan.map(({ ekstra, angkatan }) => {
          const data = {
            tahsin: [targetPerTingkat([ekstra.tahsin]), angkatan ? targetPerTingkat([angkatan.tahsin]) : new Map()] as Ringkas[],
            tahfidz: [targetPerTingkat(ekstra.tahfidz), angkatan ? targetPerTingkat(angkatan.tahfidz) : new Map()] as Ringkas[],
          }
          // Hanya kelas yang punya peserta ekstra — kelas lain tidak ada yang dibandingkan.
          const tingkat = [...new Set([...data.tahsin[0].keys(), ...data.tahfidz[0].keys()])]
            .filter(t => (data.tahsin[0].get(t)?.bertarget ?? 0) + (data.tahfidz[0].get(t)?.bertarget ?? 0) > 0
              || ekstra.tahsin.baris.some(b => b.tingkat === t && b.total > 0))
            .sort((a, b) => (a ?? 99) - (b ?? 99))
          const total = (p: Ringkas) => [...p.entries()].filter(([t]) => tingkat.includes(t))
            .reduce((a, [, v]) => ({ tercapai: a.tercapai + v.tercapai, bertarget: a.bertarget + v.bertarget }), { tercapai: 0, bertarget: 0 })
          return (
            <div key={ekstra.kode}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {ekstra.judul} · {ekstra.siswa.toLocaleString('id-ID')} peserta ekstra
              </h3>
              <table className="w-full table-fixed text-xs sm:text-sm">
                <thead>
                  <tr className="text-[10px] text-muted-foreground sm:text-[11px]">
                    <th rowSpan={2} className="w-16 pb-1 text-left align-bottom font-medium sm:w-24">Kelas</th>
                    <th colSpan={2} className="border-b pb-1 text-center font-semibold text-foreground">Tahsin</th>
                    <th colSpan={2} className="border-b pb-1 text-center font-semibold text-foreground">Tahfidz</th>
                  </tr>
                  <tr className="text-[10px] text-muted-foreground sm:text-[11px]">
                    {[0, 1].map(i => (
                      <th key={i} colSpan={2} className="p-0">
                        <span className="grid grid-cols-2">
                          <span className="pt-1 text-center font-medium">Ekstra</span>
                          <span className="pt-1 text-center font-medium">Angkatan</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tingkat.map(t => (
                    <tr key={t ?? 'x'}>
                      <td className="border-t py-1.5 font-medium">{t ? `Kelas ${t}` : 'Tanpa kelas'}</td>
                      {(['tahsin', 'tahfidz'] as const).map(b => (
                        <Pasang key={b} ekstra={data[b][0].get(t)} angkatan={data[b][1].get(t)} />
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="border-t-2 py-1.5 font-semibold">Total</td>
                    {(['tahsin', 'tahfidz'] as const).map(b => (
                      <Pasang key={b} ekstra={total(data[b][0])} angkatan={total(data[b][1])} tebal />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
        <p className="text-[11px] text-muted-foreground">
          ▲ = persentase peserta ekstra lebih tinggi dari angkatannya. — = kelas itu belum punya target atau belum ada siswa bertarget.
          Angkatan = semua siswa aktif di kelas & jalur yang sama, termasuk peserta ekstranya.
        </p>
      </div>
    </Panel>
  )
}

function persen(v?: { tercapai: number; bertarget: number }) {
  return v && v.bertarget > 0 ? Math.round((v.tercapai / v.bertarget) * 100) : null
}

function Pasang({ ekstra, angkatan, tebal }: {
  ekstra?: { tercapai: number; bertarget: number }
  angkatan?: { tercapai: number; bertarget: number }
  tebal?: boolean
}) {
  const kelas = cn(tebal ? 'border-t-2 font-semibold' : 'border-t', 'py-1.5 text-center tabular-nums')
  const pe = persen(ekstra)
  const pa = persen(angkatan)
  const unggul = pe !== null && pa !== null && pe > pa
  return (
    <>
      <td className={kelas} title={ekstra && ekstra.bertarget ? `${ekstra.tercapai} dari ${ekstra.bertarget} peserta ekstra` : undefined}>
        {pe === null ? <span className="text-muted-foreground/50">—</span> : (
          <>
            <span className={pe >= 75 ? 'text-success' : pe >= 50 ? 'text-warning' : 'text-destructive'}>{pe}%</span>
            {unggul && <span className="ml-0.5 text-success" aria-label="di atas angkatan">▲</span>}
            <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">{ekstra!.tercapai}/{ekstra!.bertarget}</span>
          </>
        )}
      </td>
      <td className={cn(kelas, 'text-muted-foreground')} title={angkatan && angkatan.bertarget ? `${angkatan.tercapai} dari ${angkatan.bertarget} siswa` : undefined}>
        {pa === null ? <span className="text-muted-foreground/50">—</span> : `${pa}%`}
      </td>
    </>
  )
}
