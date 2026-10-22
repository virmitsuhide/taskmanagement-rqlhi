import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, Sparkles } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHadirEkstra, getMateriEkstra, getSetoranEkstraSunting, getSlotGuru, hariIniWIB, labelSlot } from '@/lib/data/ekstra'
import { FormMateriEkstra } from '@/components/ekstra/FormMateriEkstra'
import { SetoranKoreksi } from '@/components/siswa/SetoranKoreksi'
import { HadirEkstra } from '@/components/ekstra/HadirEkstra'
import { TanggalPertemuan } from '@/components/ekstra/TanggalPertemuan'
import { SetorLuarEkstra, type BarisLuar } from '@/components/ekstra/SetorLuarEkstra'
import { getMetodeLuar, getPesertaLuar, ringkasSetoranLuar } from '@/lib/data/ekstra-luar'
import { LaporanEkstra, rentangBulan } from '@/components/ekstra/LaporanEkstra'
import { cn } from '@/lib/utils'

/**
 * Ekstra di portal guru — slot yang diampu, kehadiran tiap pertemuan,
 * setoran peserta LHI, dan laporan ekstra bulan ini.
 */
export default async function GuruEkstraPage({ searchParams }: { searchParams: Promise<{ slot?: string; tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const { tabelAda, slot, peserta } = await getSlotGuru(session.teacherId)
  const hariIni = hariIniWIB()
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? '') && sp.tanggal! <= hariIni ? sp.tanggal! : hariIni
  const aktif = slot.find(s => s.id === sp.slot) ?? slot[0]
  const anggota = aktif ? peserta.filter(p => p.slot_id === aktif.id) : []
  const hadir = aktif ? await getHadirEkstra(anggota.map(p => p.id), tanggal, tanggal) : []
  const awal = Object.fromEntries(hadir.map(h => [h.booking_id, h.status]))
  const bisaSetor = anggota.filter(p => p.student_id && (awal[p.id] ?? 'hadir') === 'hadir').length
  const bidang = aktif?.jenis?.bidang
  // Bulan dari tanggal pertemuan terpilih — guru membuka bulan lalu cukup
  // dengan memilih tanggal di bulan itu.
  const bulan = tanggal.slice(0, 7)
  const { dari, sampai, label: namaBulan } = rentangBulan(bulan)
  const materiBidang = bidang === 'materi'
  const [setoranSunting, materi] = await Promise.all([
    aktif && !materiBidang ? getSetoranEkstraSunting(aktif.id, dari, sampai) : Promise.resolve([]),
    aktif && materiBidang ? getMateriEkstra([aktif.id], dari, sampai) : Promise.resolve(null),
  ])
  // Dua privat di jam yang sama (mis. kakak-adik) berlabel kembar — nama
  // pesertanya membedakan, supaya anak di halaqoh kedua tidak tampak hilang.
  const labelPil = (x: typeof slot[number]) => `${x.jenis?.nama} · ${labelSlot(x)}`
  const kembar = new Set(slot.map(labelPil).filter((l, i, a) => a.indexOf(l) !== i))
  const namaPeserta = (id: string) => peserta.filter(p => p.slot_id === id).map(p => p.nama_anak.split(' ').slice(0, 2).join(' ')).join(', ')
  const materiHariIni = materi?.materi.find(m => m.tanggal === tanggal)?.deskripsi ?? ''
  // Peserta non-LHI (0122): setoran tahsinnya disimpan di data peserta ekstra sendiri.
  const anggotaLuar = materiBidang || bidang === 'tahfidz' ? [] : anggota.filter(p => p.asal === 'luar')
  const [luar, metode] = anggotaLuar.length
    ? await Promise.all([getPesertaLuar(anggotaLuar.map(p => p.id), tanggal), getMetodeLuar()])
    : [null, []]
  const barisLuar: BarisLuar[] = anggotaLuar.map(p => {
    const d = luar?.peserta.get(p.id)
    return {
      bookingId: p.id,
      nama: p.nama_anak,
      absen: (awal[p.id] ?? 'hadir') !== 'hadir',
      posisi: d?.posisi ?? { method_id: null, jilid_id: null, halaman: null },
      teksPosisi: d?.teksPosisi ?? 'Belum ditempatkan',
      hariIni: (d?.setoran ?? []).filter(s => s.tanggal === tanggal).map(s => ({ id: s.id, ringkas: ringkasSetoranLuar(s), status: s.status })),
    }
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Ekstra tahsin &amp; tahfidz</p>
          <h1 className="mt-1 text-3xl tracking-tight">Ekstra yang saya ampu</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Setoran ekstra anak LHI ikut memajukan capaian sekolahnya, tetapi dilaporkan di laporan ekstra — bukan di laporan orang tua halaqoh.
          </p>
        </header>

        {!tabelAda || slot.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh ekstra. Halaqoh ekstra dibentuk oleh Koordinator Ekstra.
          </p>
        ) : (
          <>
            {slot.length > 1 && (
              <nav aria-label="Pilih halaqoh ekstra" className="flex flex-wrap gap-2">
                {slot.map(s => (
                  <Link key={s.id} href={`/guru/ekstra?slot=${s.id}`}
                    className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium',
                      s.id === aktif?.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                    {labelPil(s)}{kembar.has(labelPil(s)) && namaPeserta(s.id) ? ` · ${namaPeserta(s.id)}` : ''}
                  </Link>
                ))}
              </nav>
            )}

            {aktif && (
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="rounded-2xl border bg-card p-4 md:p-5">
                  <h2 className="font-heading text-xl">{aktif.jenis?.nama}</h2>
                  <p className="text-xs text-muted-foreground">{labelSlot(aktif)}{aktif.tempat ? ` · ${aktif.tempat}` : ''} · {anggota.length} peserta</p>
                  <TanggalPertemuan key={`${aktif.id}|${tanggal}`} href={`/guru/ekstra?slot=${aktif.id}`} tanggal={tanggal} maks={hariIni}
                    keterangan="Pertemuan yang terlewat: pilih tanggalnya dulu, lalu Setor." />
                  <div className="mt-4">
                    {anggota.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada peserta aktif.</p>
                    ) : (
                      <HadirEkstra key={`${aktif.id}|${tanggal}`} slotId={aktif.id} tanggal={tanggal}
                        peserta={anggota.map(p => ({ id: p.id, nama: p.nama_anak, ket: p.asal === 'lhi' ? (p.student_id ? 'Siswa LHI' : 'Siswa LHI · belum ditautkan koordinator') : 'Non LHI · setoran tahsin di bawah' }))}
                        awal={awal} />
                    )}
                  </div>
                </section>

                {materiBidang ? (
                  <section className="rounded-2xl border bg-card p-4 md:p-5">
                    <h2 className="font-heading text-xl">Materi pertemuan ini</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tuliskan materi yang diberikan. Semua peserta yang hadir tercatat menerima materi ini — di Progres tampil sebagai kode M.
                    </p>
                    <div className="mt-4">
                      {materi && !materi.tabelAda ? (
                        <p className="text-sm text-muted-foreground">Fitur materi belum aktif — minta admin menjalankan migrasi 0117.</p>
                      ) : (
                        <FormMateriEkstra key={`${aktif.id}|${tanggal}`} slotId={aktif.id} tanggal={tanggal} awal={materiHariIni} />
                      )}
                    </div>
                    {(materi?.materi.length ?? 0) > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <p className="text-xs font-semibold">Materi {namaBulan}</p>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {materi!.materi.map(m => (
                            <li key={m.tanggal}><b className="text-foreground">{m.tanggal.slice(8)}/{m.tanggal.slice(5, 7)}</b> — {m.deskripsi}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                ) : (
                <section className="rounded-2xl border bg-card p-4 md:p-5">
                  <h2 className="font-heading text-xl">Setoran pertemuan ini</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bisaSetor} peserta LHI hadir bisa disetor. Siswa LHI yang belum ditautkan hanya dicatat kehadirannya; peserta non-LHI disetor di bawah.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {bidang !== 'tahfidz' && (
                      <Link href={`/guru/ekstra/setor?slot=${aktif.id}&jenis=tahsin&tanggal=${tanggal}`}
                        className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:opacity-90">
                        <BookOpen className="h-5 w-5" /><span className="text-sm font-semibold">Setor tahsin</span>
                      </Link>
                    )}
                    {bidang !== 'tahsin' && (
                      <Link href={`/guru/ekstra/setor?slot=${aktif.id}&jenis=tahfidz&tanggal=${tanggal}`}
                        className="flex items-center gap-3 rounded-xl border px-4 py-3 hover:border-primary/40">
                        <Sparkles className="h-5 w-5 text-primary" /><span className="text-sm font-semibold">Setor tahfidz</span>
                      </Link>
                    )}
                  </div>
                  {anggotaLuar.length > 0 && (
                    <div className="mt-5 border-t pt-4">
                      <h3 className="text-sm font-bold">Peserta non-LHI · setoran tahsin</h3>
                      <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
                        Tersimpan di data peserta ekstra, terpisah dari data siswa LHI. Posisi mengikuti setoran terbaru.
                      </p>
                      {luar && !luar.tabelAda ? (
                        <p className="text-sm text-muted-foreground">Fitur ini belum aktif — minta admin menjalankan migrasi 0122.</p>
                      ) : (
                        <SetorLuarEkstra key={`${aktif.id}|${tanggal}`} slotId={aktif.id} tanggal={tanggal} peserta={barisLuar} metode={metode} />
                      )}
                    </div>
                  )}
                </section>
                )}
              </div>
            )}

            {aktif && !materiBidang && (
              <section>
                <h2 className="font-heading text-2xl">Ubah setoran ekstra · {namaBulan}</h2>
                <p className="mb-3 mt-1 max-w-2xl text-sm text-muted-foreground">
                  Setoran ekstra bulan {namaBulan} di halaqoh ini. Ganti tanggal pertemuan di atas untuk membuka bulan lain —
                  pertemuan yang terlewat bisa diisi lewat Setor tahsin/tahfidz pada tanggal itu. Posisi anak dihitung ulang setiap ada perubahan.
                </p>
                <SetoranKoreksi items={setoranSunting} />
              </section>
            )}

            {aktif && (
              <div>
                <h2 className="mb-3 font-heading text-2xl">Laporan ekstra · {namaBulan}</h2>
                <LaporanEkstra slot={[aktif]} peserta={anggota} bulan={bulan} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
