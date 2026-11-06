import Link from 'next/link'
import type { GukarMonthly, GukarParticipant } from '@/types'
import type { GukarSetoranHarian } from '@/lib/data/gukar'
import { ringkasPosisiTahfidz, ringkasPosisiTahsin, type TahapJilid } from '@/lib/rq/gukar-setoran'
import { cn } from '@/lib/utils'

const HARI = ['Ahad', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/**
 * Progres setoran satu kelompok mentoring gukar sepanjang bulan — peserta ×
 * tanggal, dibaca seperti tabel progres siswa: sel kosong berarti tidak setor
 * hari itu, garis tebal memisahkan pekan (siklus Senin–Jumat).
 *
 * Isi sel adalah POSISI hari itu (gukar mencatat posisi, bukan rentang),
 * dari gukar_setoran (0127). Posisi yang sama dengan setoran sebelumnya
 * ditandai kuning — hari setor tanpa kemajuan. Baca saja; pengisian &
 * koreksi tetap di halaman kelompoknya.
 */
export function KisiGukarBulan({ judul, groupId, periode, tanggal, peserta, harian, bulanan, tahap, namaSurat, berjalan, hariIni }: {
  judul: string
  groupId: string
  periode: string
  /** Kolom tanggal, urut naik. */
  tanggal: string[]
  peserta: GukarParticipant[]
  harian: Map<string, Map<string, GukarSetoranHarian>>
  bulanan: Map<string, GukarMonthly>
  tahap: TahapJilid[]
  namaSurat: Map<number, string>
  berjalan: boolean
  hariIni: string
}) {
  const surat = (id: number) => namaSurat.get(id) ?? `Surat ${id}`
  const tahapDari = (id: string | null) => tahap.find(t => t.id === id)

  /** Label pendek untuk sel: "J3 12", "Q 67:15"; rincian lengkap di title. */
  const selTahsin = (r: GukarSetoranHarian) => {
    const t = tahapDari(r.jilid_id)
    if (!t) return null
    const pendek = t.is_quran
      ? (r.tahsin_surat ? `Q ${r.tahsin_surat}${r.tahsin_ayat ? `:${r.tahsin_ayat}` : ''}` : 'Q')
      : `${t.label.replace(/^Jilid\s*/i, 'J')}${r.halaman ? ` ${r.halaman}` : ''}`
    const rinci = ringkasPosisiTahsin(t, { jilidId: r.jilid_id, halaman: r.halaman, surat: r.tahsin_surat, ayat: r.tahsin_ayat }, surat)
    return { pendek, rinci, kunci: `${r.jilid_id}|${r.halaman}|${r.tahsin_surat}|${r.tahsin_ayat}` }
  }
  const selTahfidz = (r: GukarSetoranHarian) => {
    if (!r.tahfidz_surat) return null
    return {
      pendek: `${r.tahfidz_surat}${r.tahfidz_ayat ? `:${r.tahfidz_ayat}` : ''}`,
      rinci: ringkasPosisiTahfidz({ surat: r.tahfidz_surat, ayat: r.tahfidz_ayat }, surat),
      kunci: `${r.tahfidz_surat}|${r.tahfidz_ayat}`,
    }
  }
  const sudahSetor = peserta.filter(p => (harian.get(p.id)?.size ?? 0) > 0).length

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
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="sticky left-0 z-10 min-w-44 bg-card px-3 py-2 text-left font-medium">Peserta</th>
              {tanggal.map(t => {
                const d = new Date(`${t}T00:00:00`)
                return (
                  <th key={t} className={cn(
                    'px-1.5 py-2 text-center font-medium',
                    d.getDay() === 1 && 'border-l-2',
                    t === hariIni && 'bg-primary-wash text-primary',
                    t > hariIni && 'opacity-50',
                  )}>
                    <span className="block text-[10px]">{HARI[d.getDay()]}</span>
                    <span className={cn('block text-sm tabular-nums', t === hariIni ? 'font-bold' : 'text-foreground')}>{d.getDate()}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {peserta.map(p => {
              const hari = harian.get(p.id)
              const r = bulanan.get(p.id)
              // Posisi sebelumnya, untuk menandai hari setor tanpa kemajuan.
              let kunciTahsin: string | null = null
              let kunciTahfidz: string | null = null
              const sel = new Map(tanggal.map(t => {
                const h = hari?.get(t)
                if (!h) return [t, null] as const
                const a = selTahsin(h)
                const b = selTahfidz(h)
                const isi = {
                  tahsin: a && { ...a, tetap: a.kunci === kunciTahsin },
                  tahfidz: b && { ...b, tetap: b.kunci === kunciTahfidz },
                }
                if (a) kunciTahsin = a.kunci
                if (b) kunciTahfidz = b.kunci
                return [t, isi] as const
              }))
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                    <span className="font-medium text-foreground">{p.full_name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {p.unit} · {(hari?.size ?? 0).toLocaleString('id-ID')} hari setor
                      {r?.jumlah_hadir != null && <> · hadir {r.jumlah_hadir}{r.jumlah_siklus ? `/${r.jumlah_siklus}` : ''}</>}
                    </span>
                    {r && (r.setoran_tahsin_halaman || r.setoran_tahfidz_halaman) ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {r.setoran_tahsin_halaman ?? 0} hlm tahsin · {r.setoran_tahfidz_halaman ?? 0} hlm tahfidz {berjalan ? 'sejauh ini' : 'bulan ini'}
                      </span>
                    ) : null}
                  </td>
                  {tanggal.map(t => {
                    const isi = sel.get(t)
                    return (
                      <td key={t} className={cn(
                        'px-1.5 py-2 text-center align-middle',
                        new Date(`${t}T00:00:00`).getDay() === 1 && 'border-l-2',
                        t === hariIni && 'bg-primary-wash/40',
                      )}>
                        {!isi ? <span className="text-muted-foreground/40">·</span> : (
                          <span className="flex flex-col items-center gap-0.5">
                            {isi.tahsin && (
                              <span title={`Tahsin: ${isi.tahsin.rinci}${isi.tahsin.tetap ? ' — sama dengan setoran sebelumnya' : ''}`}
                                className={cn('inline-flex min-w-8 justify-center whitespace-nowrap rounded px-1 py-0.5 tabular-nums',
                                  isi.tahsin.tetap ? 'bg-warning-wash text-warning font-semibold' : 'bg-primary-wash text-primary')}>
                                {isi.tahsin.pendek}
                              </span>
                            )}
                            {isi.tahfidz && (
                              <span title={`Tahfidz: ${isi.tahfidz.rinci}${isi.tahfidz.tetap ? ' — sama dengan setoran sebelumnya' : ''}`}
                                className={cn('inline-flex min-w-8 justify-center whitespace-nowrap rounded px-1 py-0.5 tabular-nums',
                                  isi.tahfidz.tetap ? 'bg-warning-wash text-warning font-semibold' : 'bg-info-wash text-info')}>
                                {isi.tahfidz.pendek}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {peserta.length === 0 && (
              <tr><td colSpan={tanggal.length + 1} className="py-6 text-center text-muted-foreground">Belum ada peserta di kelompok ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span><b className="text-primary">J3 12</b> = tahsin Jilid 3 halaman 12</span>
        <span><b className="text-primary">Q 67:15</b> = tahsin Al-Qur&apos;an surat 67 ayat 15</span>
        <span><b className="text-info">78:20</b> = hafalan sampai surat 78 ayat 20</span>
        <span><b className="text-warning">kuning</b> = posisi sama dengan setoran sebelumnya</span>
        <span>Arahkan kursor ke sel untuk nama surat</span>
      </div>
    </section>
  )
}
