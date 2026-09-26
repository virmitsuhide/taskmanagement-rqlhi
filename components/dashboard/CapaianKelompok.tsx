import { BookMarked, BookOpen, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { targetPerTingkat, type CapaianKelompok } from '@/lib/data/capaian-kelas'
import { Panel } from '@/components/dashboard/kit'
import { MatriksCapaianTable } from '@/components/dashboard/MatriksCapaianTable'

/**
 * Tahsin & tahfidz satu kelompok (unit × jalur). Tahfidz bisa lebih dari satu
 * tabel: blok Juz 30–26 selalu ada, blok Juz 1–5 dan seterusnya muncul begitu
 * ada anak yang sampai di sana.
 */
export function CapaianKelompokPanel({ k, tampil = 'semua' }: {
  k: CapaianKelompok
  tampil?: 'semua' | 'tahsin' | 'tahfidz'
}) {
  const kosong = k.jalur === 'quls'
    ? `Belum ada siswa ${k.judul.split(' — ')[0]} yang ditandai program QULS. Tandai programnya di data siswa agar muncul di sini.`
    : `Belum ada siswa aktif di ${k.judul}.`

  return (
    <div className="space-y-5">
      {tampil !== 'tahfidz' && (
        <Panel title="Capaian Tahsin" icon={<BookOpen className="h-4 w-4" />}
          sub="Jilid/tahap menurut setoran terakhir · % = siswa yang mencapai target jilid kelasnya">
          <MatriksCapaianTable matriks={k.tahsin} kosong={kosong} topik={`${k.judul} · Tahsin`} />
        </Panel>
      )}
      {tampil !== 'tahsin' && (
        <Panel title="Capaian Tahfidz" icon={<BookMarked className="h-4 w-4" />}
          sub="Juz menurut setoran terakhir & ujian · % = siswa yang sesuai atau di atas target tahfidznya">
          {k.siswa === 0 ? (
            <p className="text-sm text-muted-foreground">{kosong}</p>
          ) : (
            <div className="space-y-6">
              {k.tahfidz.map(m => (
                <div key={m.judul}>
                  {k.tahfidz.length > 1 && (
                    <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{m.judul}</h3>
                  )}
                  <MatriksCapaianTable matriks={m} kosong="Belum ada siswa di blok ini." topik={`${k.judul} · ${m.judul}`} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

/**
 * Ketercapaian target per kelas, reguler dan QULS berdampingan. Tabel lebar
 * di atas terlalu padat untuk dijajarkan; yang dijajarkan di sini hanya
 * angka yang memang ingin dibandingkan.
 */
export function PerbandinganJalur({ reguler, quls, tampil = 'semua' }: {
  reguler: CapaianKelompok
  quls: CapaianKelompok
  tampil?: 'semua' | 'tahsin' | 'tahfidz'
}) {
  const data = {
    tahsin: [targetPerTingkat([reguler.tahsin]), targetPerTingkat([quls.tahsin])],
    tahfidz: [targetPerTingkat(reguler.tahfidz), targetPerTingkat(quls.tahfidz)],
  }
  const tingkat = [...new Set([...data.tahsin, ...data.tahfidz].flatMap(p => [...p.keys()]))]
    .sort((a, b) => (a ?? 99) - (b ?? 99))
  const bidang = (['tahsin', 'tahfidz'] as const).filter(b => tampil === 'semua' || tampil === b)
  const namaReguler = reguler.judul.split(' — ')[1] ?? 'Reguler'
  const total = (p: Map<number | null, { tercapai: number; bertarget: number }>) =>
    [...p.values()].reduce((a, v) => ({ tercapai: a.tercapai + v.tercapai, bertarget: a.bertarget + v.bertarget }), { tercapai: 0, bertarget: 0 })

  return (
    <Panel title={`${namaReguler} vs QULS`} icon={<Scale className="h-4 w-4" />}
      sub={`Ketercapaian target per kelas · ${reguler.siswa.toLocaleString('id-ID')} vs ${quls.siswa.toLocaleString('id-ID')} siswa`}>
      <table className="w-full table-fixed text-xs sm:text-sm">
        <thead>
          <tr className="text-[10px] text-muted-foreground sm:text-[11px]">
            <th rowSpan={2} className="w-14 pb-1 text-left align-bottom font-medium sm:w-24">Kelas</th>
            {bidang.map(b => (
              <th key={b} colSpan={2} className="border-b pb-1 text-center font-semibold capitalize text-foreground">{b}</th>
            ))}
          </tr>
          <tr className="text-[10px] text-muted-foreground sm:text-[11px]">
            {bidang.map(b => (
              <HeaderJalur key={b} reguler={namaReguler} />
            ))}
          </tr>
        </thead>
        <tbody>
          {tingkat.map(t => (
            <tr key={t ?? 'x'}>
              <td className="border-t py-1.5 font-medium">{t ? `Kelas ${t}` : 'Tanpa kelas'}</td>
              {bidang.map(b => data[b].map((p, i) => <SelPersen key={`${b}-${i}`} v={p.get(t)} />))}
            </tr>
          ))}
          <tr>
            <td className="border-t-2 py-1.5 font-semibold">Total</td>
            {bidang.map(b => data[b].map((p, i) => <SelPersen key={`${b}-${i}`} v={total(p)} tebal />))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">— = kelas itu tidak punya siswa atau targetnya belum diatur.</p>
    </Panel>
  )
}

function HeaderJalur({ reguler }: { reguler: string }) {
  return (
    <>
      <th className="pt-1 text-center font-medium">{reguler.replace(/\s*\(.*\)$/, '')}</th>
      <th className="pt-1 text-center font-medium">QULS</th>
    </>
  )
}

function SelPersen({ v, tebal }: { v?: { tercapai: number; bertarget: number }; tebal?: boolean }) {
  const kelas = cn(tebal ? 'border-t-2 font-semibold' : 'border-t', 'py-1.5 text-center tabular-nums')
  if (!v || v.bertarget === 0) return <td className={cn(kelas, 'text-muted-foreground/50')}>—</td>
  const p = Math.round((v.tercapai / v.bertarget) * 100)
  return (
    <td className={kelas} title={`${v.tercapai} dari ${v.bertarget}`}>
      <span className={p >= 75 ? 'text-success' : p >= 50 ? 'text-warning' : 'text-destructive'}>{p}%</span>
      <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">{v.tercapai}/{v.bertarget}</span>
    </td>
  )
}
