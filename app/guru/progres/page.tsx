import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh, sasaranSesi, type HalaqohSesi } from '@/lib/data/setoran-sesi'
import { getKelompokAsrama } from '@/lib/data/asrama'
import { getProgresSesi, hariSekolah, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { FilterSesiBulan } from '@/components/setoran/FilterSesiBulan'
import { TabProgresSesi } from '@/components/setoran/TabProgresSesi'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { getHadirEkstra, getMateriEkstra, getSlotGuru, labelSlot } from '@/lib/data/ekstra'
import { rentangBulan } from '@/components/ekstra/LaporanEkstra'
import { TabelMateriEkstra } from '@/components/ekstra/TabelMateriEkstra'
import { cn } from '@/lib/utils'
import { getTabTambahanGuru, type TabTambahanGuru } from '@/lib/data/tab-progres-guru'
import { getPesertaTR } from '@/lib/data/tahsin-rekomendasi'
import { getSiswaRiyadhoh } from '@/lib/data/riyadhoh'
import { getCurrentTerm } from '@/lib/data/terms'
import { getDaftarSurat, getGukarGroupsFor, getGukarMonthly, getGukarParticipants, getGukarSetoranHarian, getTahapanGukar } from '@/lib/data/gukar'
import { statusSetoranBulan } from '@/lib/rq/gukar-siklus'
import { RekapGukarBulan } from '@/components/gukar/RekapGukarBulan'
import { KisiGukarBulan } from '@/components/gukar/KisiGukarBulan'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string; periode?: string; jenis?: string; tab?: string }>
}

/**
 * Progres setoran satu sesi dalam sebulan — siswa × tanggal.
 *
 * Kolomnya semua hari Senin–Jumat (Sabtu–Ahad libur) — dibaca seperti buku
 * absen: sel kosong berarti anak tidak setor hari itu. Garis tebal memisahkan
 * pekan, supaya "Senin ketiga" bisa ditemukan tanpa menghitung kolom.
 */
export default async function ProgresSesiPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const params = await searchParams
  const periode = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()
  const jenis: JenisRekap = params.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'

  /*
    Kelompok asrama yang diampu (0110) ikut tampil sebagai "sesi" di sini,
    berkunci "asrama-<id>" — progresnya dihitung dari daftar anggotanya,
    bukan dari halaqoh.
  */
  const [sekolah, asrama, ekstra, tambahan] = await Promise.all([
    getHalaqohSesiGuru(session.teacherId),
    getKelompokAsrama({ pengampuId: session.teacherId }),
    getSlotGuru(session.teacherId),
    getTabTambahanGuru(session.teacherId),
  ])
  const punyaEkstra = ekstra.slot.length > 0
  if (params.tab === 'ekstra' && punyaEkstra) {
    return <ProgresEkstra ekstra={ekstra} tambahan={tambahan} periode={periode} jenisDiminta={params.jenis} pilih={params.halaqoh} />
  }
  if ((params.tab === 'tr' && tambahan.tr) || (params.tab === 'riyadhoh' && tambahan.riyadhoh)) {
    return <ProgresJalur jalur={params.tab} teacherId={session.teacherId} ekstra={punyaEkstra} tambahan={tambahan} periode={periode} jenisDiminta={params.jenis} />
  }
  if (params.tab === 'gukar' && tambahan.gukar) {
    return <ProgresGukar teacherId={session.teacherId} ekstra={punyaEkstra} tambahan={tambahan} periode={periode} />
  }
  const daftar: HalaqohSesi[] = [
    ...sekolah,
    ...asrama.map(k => ({ id: `asrama-${k.id}`, name: `Asrama · ${k.nama}`, sesi: null, jenjang: 'smp' as const })),
  ]
  const halaqoh = pilihHalaqoh(daftar, params.halaqoh)
  const kelompokAsrama = halaqoh?.id.startsWith('asrama-') ? asrama.find(k => `asrama-${k.id}` === halaqoh.id) : undefined
  const data = !halaqoh
    ? null
    : kelompokAsrama
      ? await getProgresSesi({ siswa: kelompokAsrama.anggota.map(a => a.student_id) }, periode, jenis)
      : await getProgresSesi(sasaranSesi(halaqoh), periode, jenis)
  // Tanggal WIB hari ini — penanda kolom dan pemisah hari yang belum tiba.
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Progres per Sesi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setoran tiap anak sepanjang bulan. Arahkan kursor ke sel untuk rincian, atau ketuk nama anak untuk riwayat lengkapnya.
          </p>
        </div>

        <TabProgresSesi aktif={jenis} halaqoh={halaqoh?.id} periode={periode} ekstra={punyaEkstra} tambahan={tambahan} />

        {!halaqoh || !data ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh. Hubungi admin untuk assign halaqoh.
          </div>
        ) : (
          <>
            <FilterSesiBulan
              basePath="/guru/progres"
              daftar={daftar}
              halaqoh={halaqoh.id}
              periode={periode}
              params={{ jenis }}
            />

            {data.baris.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa di sesi ini.
              </div>
            ) : (
              <TabelProgres data={data} jenis={jenis} hariIni={hariIni} tautanSiswa="/guru/siswa/" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Tab Ekstra: setoran ekstra anak-anak yang diampu guru ini di halaqoh
 * ekstranya — tabel yang sama dengan sesi sekolah, hanya setoran bertanda
 * slot ekstra miliknya. Anaknya bisa berbeda dari halaqoh sekolah, jadi nama
 * tetap di kolom kiri; tanpa tautan, karena halaman siswa hanya terbuka
 * untuk pengampu sekolahnya.
 */
async function ProgresEkstra({ ekstra, tambahan, periode, jenisDiminta, pilih }: {
  ekstra: Awaited<ReturnType<typeof getSlotGuru>>
  tambahan: TabTambahanGuru
  periode: string
  jenisDiminta: string | undefined
  pilih: string | undefined
}) {
  const daftar: HalaqohSesi[] = [
    ...(ekstra.slot.length > 1 ? [{ id: 'ekstra-semua', name: 'Semua halaqoh ekstra', sesi: null, jenjang: 'sd' as const }] : []),
    ...ekstra.slot.map(s => ({ id: `ekstra-${s.id}`, name: `${s.jenis?.nama ?? 'Ekstra'} · ${labelSlot(s)}`, sesi: null, jenjang: 'sd' as const })),
  ]
  const terpilih = pilihHalaqoh(daftar, pilih)!
  const slotTerpilih = terpilih.id === 'ekstra-semua' ? ekstra.slot : ekstra.slot.filter(s => `ekstra-${s.id}` === terpilih.id)

  // Bahasa Arab / pelatihan guru (bidang materi) menyetor deskripsi materi,
  // halaqoh lain menyetor tahsin/tahfidz. Pilihan jenis mengikuti yang ada.
  const slotMateri = slotTerpilih.filter(s => s.jenis?.bidang === 'materi')
  const slotSetor = slotTerpilih.filter(s => s.jenis?.bidang !== 'materi')
  const pilihanJenis = [
    ...(slotSetor.length ? (['tahsin', 'tahfidz'] as const) : []),
    ...(slotMateri.length ? (['materi'] as const) : []),
  ]
  const jenis = pilihanJenis.find(j => j === jenisDiminta) ?? pilihanJenis[0]
  const label = { tahsin: 'Tahsin', tahfidz: 'Tahfidz', materi: 'Materi' } as const

  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  let isi: React.ReactNode
  if (jenis === 'materi') {
    const { dari, sampai } = rentangBulan(periode)
    const peserta = ekstra.peserta.filter(p => p.slot_id && slotMateri.some(s => s.id === p.slot_id))
    const [{ tabelAda, materi }, hadir] = await Promise.all([
      getMateriEkstra(slotMateri.map(s => s.id), dari, sampai),
      getHadirEkstra(peserta.map(p => p.id), dari, sampai),
    ])
    isi = !tabelAda ? (
      <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
        Fitur materi belum aktif — minta admin menjalankan migrasi 0117.
      </p>
    ) : (
      <TabelMateriEkstra
        peserta={peserta.map(p => ({ id: p.id, nama: p.nama_anak, slotId: p.slot_id!, keterangan: p.asal === 'lhi' ? p.kelas : 'Luar LHI' }))}
        materi={materi}
        hadir={hadir}
        namaSlot={Object.fromEntries(slotMateri.map(s => [s.id, `${s.jenis?.nama ?? 'Ekstra'} · ${labelSlot(s)}`]))}
      />
    )
  } else {
    const slotIds = slotSetor.map(s => s.id)
    const ids = [...new Set(ekstra.peserta.filter(p => p.student_id && p.slot_id && slotIds.includes(p.slot_id)).map(p => p.student_id!))]
    const data = ids.length ? await getProgresSesi({ siswa: ids }, periode, jenis, { ekstraSlot: slotIds }) : null
    const tanpaTaut = ekstra.peserta.filter(p => !p.student_id && p.slot_id && slotIds.includes(p.slot_id)).length
    isi = (
      <>
        {!data || data.baris.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Belum ada peserta LHI yang tertaut di halaqoh ekstra ini.
          </div>
        ) : (
          <TabelProgres data={data} jenis={jenis} hariIni={hariIni} />
        )}
        {tanpaTaut > 0 && (
          <p className="text-xs text-muted-foreground">{tanpaTaut} peserta luar LHI / belum ditautkan tidak punya setoran — hanya kehadiran yang dicatat.</p>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>Progres Ekstra</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setoran ekstra anak-anak yang Anda ampu sepanjang bulan — hanya yang dicatat di halaqoh ekstra Anda.
          </p>
        </div>

        <TabProgresSesi aktif="ekstra" periode={periode} ekstra tambahan={tambahan} />

        <FilterSesiBulan basePath="/guru/progres" daftar={daftar} halaqoh={terpilih.id} periode={periode} params={{ tab: 'ekstra', jenis }} />

        <div className="flex gap-2" role="group" aria-label="Jenis setoran">
          {pilihanJenis.map(j => (
            <a key={j} href={hrefRekap('/guru/progres', { tab: 'ekstra', halaqoh: terpilih.id, periode, jenis: j })}
              aria-current={jenis === j ? 'true' : undefined}
              className={cn('rounded-full border px-3 py-1 text-sm', jenis === j ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'bg-card hover:bg-accent')}>
              {label[j]}
            </a>
          ))}
        </div>

        {isi}
      </div>
    </div>
  )
}

/** Kepala halaman tab jalur tambahan — sama untuk TR, Riyadhoh, dan Gukar. */
function KepalaJalur({ judul, keterangan, aktif, ekstra, tambahan, periode }: {
  judul: string
  keterangan: string
  aktif: 'tr' | 'riyadhoh' | 'gukar'
  ekstra: boolean
  tambahan: TabTambahanGuru
  periode: string
}) {
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
        <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>{judul}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{keterangan}</p>
      </div>
      <TabProgresSesi aktif={aktif} periode={periode} ekstra={ekstra} tambahan={tambahan} />
    </>
  )
}

/**
 * Tab TR / Riyadhoh: setoran jalur itu saja untuk anak-anak yang diampu guru
 * ini di jalurnya. Kolomnya hanya Jum'at (TR) atau Sabtu (Riyadhoh) — hari
 * jalur itu berjalan. TR hanya tahsin; Riyadhoh tahsin & tahfidz.
 */
async function ProgresJalur({ jalur, teacherId, ekstra, tambahan, periode, jenisDiminta }: {
  jalur: 'tr' | 'riyadhoh'
  teacherId: string
  ekstra: boolean
  tambahan: TabTambahanGuru
  periode: string
  jenisDiminta: string | undefined
}) {
  const pilihanJenis = jalur === 'tr' ? (['tahsin'] as const) : (['tahsin', 'tahfidz'] as const)
  const jenis: JenisRekap = pilihanJenis.find(j => j === jenisDiminta) ?? 'tahsin'
  const ids = jalur === 'tr'
    ? (await getPesertaTR(teacherId)).map(p => p.id)
    : (await getSiswaRiyadhoh()).filter(s => s.ikut && s.pengampu_id === teacherId).map(s => s.id)
  const data = ids.length ? await getProgresSesi({ siswa: ids }, periode, jenis, { jalur }) : null
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const nama = jalur === 'tr' ? 'Tahsin Rekomendasi' : 'Riyadhoh'

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <KepalaJalur
          judul={`Progres ${nama}`}
          keterangan={`Setoran ${nama} anak-anak yang Anda ampu sepanjang bulan — hanya yang dicatat di ${jalur === 'tr' ? 'Jum’at sore' : 'Sabtu Riyadhoh'}.`}
          aktif={jalur} ekstra={ekstra} tambahan={tambahan} periode={periode}
        />

        <FilterSesiBulan
          basePath="/guru/progres"
          daftar={[{ id: jalur, name: nama, sesi: null, jenjang: jalur === 'tr' ? 'sd' : 'smp' }]}
          halaqoh={jalur}
          periode={periode}
          params={{ tab: jalur, jenis }}
        />

        {pilihanJenis.length > 1 && (
          <div className="flex gap-2" role="group" aria-label="Jenis setoran">
            {pilihanJenis.map(j => (
              <a key={j} href={hrefRekap('/guru/progres', { tab: jalur, periode, jenis: j })}
                aria-current={jenis === j ? 'true' : undefined}
                className={cn('rounded-full border px-3 py-1 text-sm', jenis === j ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'bg-card hover:bg-accent')}>
                {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
              </a>
            ))}
          </div>
        )}

        {!data || data.baris.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            {jalur === 'tr'
              ? 'Belum ada peserta di kelompok Tahsin Rekomendasi Anda.'
              : 'Belum ada siswa yang ditetapkan koordinator ke kelompok Riyadhoh Anda.'}
          </div>
        ) : (
          <TabelProgres data={data} jenis={jenis} hariIni={hariIni} />
        )}
      </div>
    </div>
  )
}

/**
 * Tab Gukar: setoran tiap kelompok mentoring guru & karyawan yang diampu,
 * peserta × tanggal seperti progres siswa (riwayat harian gukar_setoran,
 * 0127). Sebelum migrasi itu dijalankan, jatuh kembali ke rekap bulanan.
 */
async function ProgresGukar({ teacherId, ekstra, tambahan, periode }: {
  teacherId: string
  ekstra: boolean
  tambahan: TabTambahanGuru
  periode: string
}) {
  const term = await getCurrentTerm()
  const groups = term ? await getGukarGroupsFor(teacherId, term.id) : []
  const [pesertaPer, tahapan, surat] = await Promise.all([
    Promise.all(groups.map(g => getGukarParticipants(g.id))),
    getTahapanGukar(),
    getDaftarSurat(),
  ])
  const idPeserta = pesertaPer.flat().map(p => p.id)
  const [bulanan, harian] = await Promise.all([
    getGukarMonthly(idPeserta, periode),
    getGukarSetoranHarian(idPeserta, periode),
  ])
  // Senin–Jumat, plus akhir pekan yang ternyata berisi setoran susulan.
  const tanggal = [...new Set([
    ...hariSekolah(periode),
    ...[...harian.per.values()].flatMap(m => [...m.keys()]),
  ])].sort()
  const tahap = Object.values(tahapan).flat()
  const namaSurat = new Map(surat.map(s => [s.id, s.nama]))
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const berjalan = statusSetoranBulan(periode, hariIni, null) === 'berjalan'

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <KepalaJalur
          judul="Progres Mentoring Gukar"
          keterangan="Setoran peserta pembinaan guru & karyawan yang Anda ampu sepanjang bulan. Isian dan koreksinya tetap di halaman kelompok."
          aktif="gukar" ekstra={ekstra} tambahan={tambahan} periode={periode}
        />

        <FilterSesiBulan
          basePath="/guru/progres"
          daftar={[{ id: 'gukar', name: 'Mentoring Gukar', sesi: null, jenjang: 'sd' }]}
          halaqoh="gukar"
          periode={periode}
          params={{ tab: 'gukar' }}
        />

        {!harian.tabelAda && (
          <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Tampilan per tanggal belum aktif — minta admin menjalankan migrasi 0127. Sementara ditampilkan rekap bulanan.
          </p>
        )}

        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Belum ada kelompok mentoring gukar yang Anda ampu di semester ini.
          </div>
        )}

        {harian.tabelAda ? groups.map((g, i) => (
          <KisiGukarBulan
            key={g.id}
            judul={g.name}
            groupId={g.id}
            periode={periode}
            tanggal={tanggal}
            peserta={pesertaPer[i]}
            harian={harian.per}
            bulanan={bulanan}
            tahap={tahap}
            namaSurat={namaSurat}
            berjalan={berjalan}
            hariIni={hariIni}
          />
        )) : groups.map((g, i) => (
          <RekapGukarBulan
            key={g.id}
            judul={g.name}
            groupId={g.id}
            periode={periode}
            peserta={pesertaPer[i]}
            bulanan={bulanan}
            tahap={tahap}
            namaSurat={namaSurat}
            berjalan={berjalan}
          />
        ))}
      </div>
    </div>
  )
}
