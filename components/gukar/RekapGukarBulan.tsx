import Link from 'next/link'
import type { GukarMonthly, GukarParticipant } from '@/types'
import { ringkasPosisiTahfidz, ringkasPosisiTahsin, type TahapJilid } from '@/lib/rq/gukar-setoran'

/**
 * Rekap bulanan satu kelompok mentoring gukar — baca saja, untuk tab Gukar
 * Progres per Sesi. Gukar dicatat per BULAN (satu baris per peserta), bukan
 * per tanggal, jadi bentuknya daftar, bukan kisi tanggal seperti setoran
 * siswa. Pengisian & koreksi tetap di halaman kelompoknya.
 */
export function RekapGukarBulan({ judul, groupId, periode, peserta, bulanan, tahap, namaSurat, berjalan }: {
  judul: string
  groupId: string
  periode: string
  peserta: GukarParticipant[]
  bulanan: Map<string, GukarMonthly>
  tahap: TahapJilid[]
  namaSurat: Map<number, string>
  /** Bulan masih berjalan: posisi terakhir disebut "sedang", bukan "akhir". */
  berjalan: boolean
}) {
  const surat = (id: number) => namaSurat.get(id) ?? `Surat ${id}`
  const tahsin = (r: GukarMonthly, awal: boolean) => ringkasPosisiTahsin(
    tahap.find(t => t.id === (awal ? r.awal_jilid_id : r.jilid_id)),
    awal
      ? { jilidId: r.awal_jilid_id, halaman: r.awal_halaman, surat: r.awal_tahsin_surat, ayat: r.awal_tahsin_ayat }
      : { jilidId: r.jilid_id, halaman: r.halaman, surat: r.tahsin_surat, ayat: r.tahsin_ayat },
    surat,
  )
  const tahfidz = (r: GukarMonthly, awal: boolean) => ringkasPosisiTahfidz(
    awal ? { surat: r.awal_tahfidz_surat, ayat: r.awal_tahfidz_ayat } : { surat: r.tahfidz_surat, ayat: r.tahfidz_ayat },
    surat,
  )
  const rentang = (awal: string, akhir: string) => !akhir ? '—' : !awal || awal === akhir ? akhir : `${awal} → ${akhir}`
  const sudahSetor = peserta.filter(p => (bulanan.get(p.id)?.jumlah_setoran ?? 0) > 0).length

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">{judul}</h2>
        <p className="text-xs text-muted-foreground">
          {sudahSetor}/{peserta.length} sudah setor bulan ini ·{' '}
          <Link href={`/guru/gukar/${groupId}?periode=${periode}`} className="font-semibold text-primary hover:underline">Buka kelompok</Link>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Peserta</th>
              <th className="px-3 py-2 font-medium">Tahsin — awal → {berjalan ? 'sedang' : 'akhir'}</th>
              <th className="px-3 py-2 font-medium">Tahfidz — awal → {berjalan ? 'sedang' : 'akhir'}</th>
              <th className="px-3 py-2 text-right font-medium" title="Halaman tahsin / tahfidz yang ditempuh bulan ini">Halaman</th>
              <th className="px-3 py-2 text-right font-medium">Hari setor</th>
              <th className="px-4 py-2 text-right font-medium" title="Rekap kehadiran akhir bulan">Hadir</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {peserta.map(p => {
              const r = bulanan.get(p.id)
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.unit}</p>
                  </td>
                  <td className="px-3 py-2 text-[13px]">{r ? rentang(tahsin(r, true), tahsin(r, false)) : '—'}</td>
                  <td className="px-3 py-2 text-[13px]">{r ? rentang(tahfidz(r, true), tahfidz(r, false)) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r ? `${r.setoran_tahsin_halaman ?? 0} / ${r.setoran_tahfidz_halaman ?? 0}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r?.jumlah_setoran ? r.jumlah_setoran : <span className="text-warning">belum</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r?.jumlah_hadir != null ? `${r.jumlah_hadir}${r.jumlah_siklus ? `/${r.jumlah_siklus}` : ''}` : '—'}
                  </td>
                </tr>
              )
            })}
            {peserta.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Belum ada peserta di kelompok ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
