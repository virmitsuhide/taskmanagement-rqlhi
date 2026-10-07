import { idSetoranEkstra } from '@/lib/data/ekstra'
import { getHasilMateriPerSiswa, getMateriPerJilid } from '@/lib/data/materi-tahsin'
import { createServerClient } from '@/lib/supabase/server'
import { getSesiPelaporGuru, halamanDrill, idHalaqohSesi, type HalaqohSesi } from '@/lib/data/setoran-sesi'
import { teksDrill } from '@/lib/rq/drill-tahsin'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { halamanHafalan } from '@/lib/rq/target-tahfidz'
import { rekapMurojaah, suratMurojaah } from '@/lib/rq/murojaah'
import { getInfoSurat } from '@/lib/data/nama-surat'
import { getJuzTerujiPerSiswa, getSiswaUrutanBebas, gabungJuz, juzSetoranPerSiswa, type BarisJuzProgress } from '@/lib/data/hafalan'
import { ttdSrc } from '@/lib/kpi/ttd-berkas'
import { sapaanName } from '@/lib/auth/permissions'
import { juzTerjauh, posisiJuz } from '@/lib/rq/hafalan'
import { getPredikatLabel, getTahfidzLabel, tanggalWIB } from '@/lib/rq/ujian'
import type { AnakLaporan, LaporanOrtu, PeriodeLaporan } from '@/lib/rq/laporan-ortu'
import type { Jenjang, TahfidzTipe, UjianPredikat, UjianSiswa } from '@/types'

/**
 * Data laporan orang tua satu sesi (halaqoh) dalam satu periode.
 *
 * Posisi TERAKHIR (jilid, setoran ziyadah terakhir, juz tuntas) dibaca apa
 * adanya hari ini; jumlah setoran, halaman, dan ujian dihitung HANYA di dalam
 * periode. Layar dan PDF menyebut keduanya terpisah supaya wali tidak
 * menyangka posisi hari ini adalah hasil periode itu saja.
 */

async function ambilSemua<T>(buat: (dari: number, ke: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999)
    if (error) return hasil
    const potong = (data ?? []) as T[]
    hasil.push(...potong)
    if (potong.length < 1000) return hasil
  }
}

const ZIYADAH = ['ziyadah', 'hafalan_baru']

function besok(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Setoran tahsin TERAKHIR periode itu, bila berstatus Lanjut (0109): halaman
 * yang belum tuntas beserta barisnya. Baris awal kosong = mulai dari baris 1;
 * baris akhir kosong = guru tidak mengisinya.
 */
function barisLanjut(ts: { setoran_date: string; created_at: string; status: string; halaman: number | null; baris_dari: number | null; baris_ke: number | null }[]): string | null {
  const akhir = [...ts].sort((a, b) => (a.setoran_date + a.created_at).localeCompare(b.setoran_date + b.created_at)).at(-1)
  if (!akhir || akhir.status !== 'lanjut' || akhir.halaman === null) return null
  if (akhir.baris_ke === null) return `hal. ${akhir.halaman} (belum tuntas)`
  const dari = akhir.baris_dari ?? 1
  return `hal. ${akhir.halaman} baris ${dari === akhir.baris_ke ? dari : `${dari}–${akhir.baris_ke}`}`
}

export async function getSesiGuruLaporan(teacherId: string): Promise<HalaqohSesi[]> {
  // Tanpa sesi yang dipegang khusus tahsin — laporan dikirim guru tahfidz (SMA).
  return getSesiPelaporGuru(teacherId)
}

export async function getLaporanOrtu(
  teacherId: string,
  halaqoh: HalaqohSesi,
  periode: PeriodeLaporan,
): Promise<LaporanOrtu> {
  const supabase = createServerClient()
  const { data: siswaRows } = await supabase
    .from('students')
    .select('id, full_name, kelas, jenjang, current_jilid_id, current_jilid_page, current_quran_halaman, tahsin_drill_sejak,' +
      ' jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages, is_terminal)')
    .in('halaqoh_id', idHalaqohSesi(halaqoh))
    .eq('is_active', true)
    .order('full_name')
  const siswa = (siswaRows ?? []) as unknown as {
    id: string; full_name: string; kelas: string | null; jenjang: Jenjang
    current_jilid_id: string | null; current_jilid_page: number | null; current_quran_halaman: number | null
    tahsin_drill_sejak: string | null
    jilid: { label: string; total_pages: number | null; is_terminal: boolean } | null
  }[]
  const ids = siswa.map(s => s.id)

  const waktuDari = `${periode.dari}T00:00:00+07:00`
  const waktuSampai = `${besok(periode.sampai)}T00:00:00+07:00`
  const kosong = <T,>() => Promise.resolve([] as T[])
  type LogTahsin = {
    id: string; student_id: string; setoran_date: string; created_at: string; status: string; drill: boolean | null
    halaman: number | null; baris_dari: number | null; baris_ke: number | null
  }
  type LogTahfidz = { id: string; student_id: string; setoran_date: string; kind: string; surat_id: number; ayat_dari: number | null; surat_ke_id: number | null; ayat_ke: number | null }
  type Ziyadah = { student_id: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null; setoran_date: string; created_at: string }

  const [guruRes, tahsinSemua, tahfidzSemua, ziyadahSemua, progres, juzTeruji, ujianTf, ujianTs, peta, surat, logEkstra, materiPerJilid, hasilMateri, drill] = await Promise.all([
    supabase.from('teachers').select('full_name, sapaan, nickname, signature_path').eq('id', teacherId).maybeSingle(),
    ids.length ? ambilSemua<LogTahsin>((a, b) =>
      supabase.from('tahsin_logs').select('id, student_id, setoran_date, created_at, status, drill, halaman, baris_dari, baris_ke')
        .in('student_id', ids).gte('setoran_date', periode.dari).lte('setoran_date', periode.sampai).range(a, b)) : kosong<LogTahsin>(),
    ids.length ? ambilSemua<LogTahfidz>((a, b) =>
      supabase.from('tahfidz_logs').select('id, student_id, setoran_date, kind, surat_id, ayat_dari, surat_ke_id, ayat_ke')
        .in('student_id', ids).gte('setoran_date', periode.dari).lte('setoran_date', periode.sampai).range(a, b)) : kosong<LogTahfidz>(),
    // Setoran ziyadah terakhir sepanjang masa — posisi hafalan hari ini.
    ids.length ? ambilSemua<Ziyadah>((a, b) =>
      supabase.from('tahfidz_logs').select('student_id, surat_id, ayat_dari, ayat_ke, setoran_date, created_at')
        .in('student_id', ids).in('kind', ZIYADAH)
        .order('setoran_date', { ascending: false }).order('created_at', { ascending: false }).range(a, b)) : kosong<Ziyadah>(),
    ids.length ? ambilSemua<BarisJuzProgress>((a, b) =>
      supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin').in('student_id', ids).range(a, b)) : kosong<BarisJuzProgress>(),
    getJuzTerujiPerSiswa(ids),
    ids.length
      ? supabase.from('ujian_tahfidz').select('student_id, tipe, juz, predikat')
          .in('student_id', ids).eq('status', 'selesai').gte('jadwal', waktuDari).lt('jadwal', waktuSampai)
      : Promise.resolve({ data: [] }),
    // Ujian tahsin menyimpan pesertanya di larik JSON — disaring per anak di bawah.
    supabase.from('ujian_tahsin').select('level, siswa').eq('status', 'selesai')
      .gte('jadwal', waktuDari).lt('jadwal', waktuSampai),
    getPetaHalaman(),
    getInfoSurat(),
    // Setoran pertemuan ekstra (0091) masuk laporan ekstra, bukan laporan halaqoh.
    idSetoranEkstra(ids, periode.dari, periode.sampai),
    // Gharib/Tajwid disetor per materi — halaman lulusnya dibaca dari materi.
    getMateriPerJilid(siswa.map(s => s.current_jilid_id ?? '')),
    getHasilMateriPerSiswa(ids),
    // Putaran drill dihitung dari SELURUH setoran drill sejak masuk drill, bukan periode saja.
    halamanDrill(supabase, siswa.map(s => ({ ...s, total_pages: s.jilid?.total_pages ?? null }))),
  ])
  const tahsin = tahsinSemua.filter(l => !logEkstra.tahsin.has(l.id))
  const tahfidz = tahfidzSemua.filter(l => !logEkstra.tahfidz.has(l.id))

  const guru = guruRes.data as { full_name: string; sapaan: string | null; nickname: string | null; signature_path: string | null } | null
  const ttdUrl = await ttdSrc(guru?.signature_path).catch(() => null)

  // Hari pertemuan: tanggal yang ada setoran siapa pun di sesi ini.
  const hariPertemuan = new Set([...tahsin.map(l => l.setoran_date), ...tahfidz.map(l => l.setoran_date)])
  // SMA (urutan bebas): juz tuntas hanya dari ujian, dihitung per juz.
  const bebas = await getSiswaUrutanBebas()
  const setoranTuntas = juzSetoranPerSiswa(progres, bebas)
  const namaSurat = (id: number) => surat.get(id)?.name_latin ?? `Surat ${id}`

  const ujianPer = new Map<string, string[]>()
  for (const u of (ujianTf.data ?? []) as { student_id: string; tipe: TahfidzTipe; juz: string; predikat: UjianPredikat | null }[]) {
    const teks = `${getTahfidzLabel(u.tipe, u.juz)}${u.predikat && u.predikat !== 'mengulang' ? ` · ${getPredikatLabel(u.predikat)}` : u.predikat === 'mengulang' ? ' · mengulang' : ''}`
    ujianPer.set(u.student_id, [...(ujianPer.get(u.student_id) ?? []), teks])
  }
  const idSet = new Set(ids)
  for (const u of (ujianTs.data ?? []) as { level: string; siswa: UjianSiswa[] }[]) {
    for (const s of u.siswa ?? []) {
      if (!s.student_id || !idSet.has(s.student_id)) continue
      const hasil = s.predikat === 'lulus' ? ' · Lulus' : s.predikat === 'mengulang' ? ' · mengulang' : ''
      ujianPer.set(s.student_id, [...(ujianPer.get(s.student_id) ?? []), `Ujian Tahsin ${s.level ?? u.level}${hasil}`])
    }
  }

  const anak: AnakLaporan[] = siswa.map(s => {
    const ts = tahsin.filter(l => l.student_id === s.id)
    const tf = tahfidz.filter(l => l.student_id === s.id)
    const hari = new Set([...ts.map(l => l.setoran_date), ...tf.map(l => l.setoran_date)])

    // Tahsin: HALAMAN TERAKHIR YANG LULUS, bukan halaman yang sedang dikerjakan
    // — wali membaca "Jilid 3 hal. 14" sebagai capaian, jadi yang ditulis harus
    // yang sudah tuntas. Halaman hanya untuk tahap berbuku — tahap tanpa
    // halaman (Al-Qur'an, Talaqqi, Lulus Tahsin) kerap menyimpan sisa tahap lama.
    const berbuku = Boolean(s.jilid?.total_pages && s.current_jilid_page)
    const materi = materiPerJilid.get(s.current_jilid_id ?? '') ?? []
    let teksBuku = ''
    if (berbuku && s.tahsin_drill_sejak) {
      // Drill: membaca ulang jilidnya dari hal. 1, berputar sampai lulus ujian.
      // Yang ditulis putaran & rentang halaman drill periode ini, supaya wali
      // tahu anak tidak diam di tempat: "Drill putaran 2 hal. 1–5".
      const d = drill.get(s.id)
      const diPeriode = (d?.logs ?? [])
        .filter(l => l.halaman !== null && l.setoran_date >= periode.dari && l.setoran_date <= periode.sampai)
        .map(l => ({ putaran: l.putaran, halaman: l.halaman! }))
      teksBuku = ` · ${teksDrill(diPeriode, d?.putaran ?? 1)}`
    } else if (berbuku && materi.length > 0) {
      // Gharib/Tajwid: satu halaman memuat beberapa materi — halaman lulus =
      // halaman materi terjauh yang sudah lulus.
      const hasil = hasilMateri.get(s.id)
      const lulus = materi.filter(m => hasil?.get(m.id) === 'lulus').map(m => m.halaman)
      teksBuku = lulus.length > 0 ? ` hal. ${Math.max(...lulus)}` : ''
    } else if (berbuku) {
      // Lulus memajukan posisi ke halaman + 1; Ulang & Lanjut menahannya.
      // Jadi halaman lulus terakhir selalu satu di belakang posisi.
      const halLulus = s.current_jilid_page! - 1
      teksBuku = halLulus >= 1 ? ` hal. ${halLulus}` : ''
    }
    const posisiTahsin = s.jilid
      ? `${s.jilid.label}${teksBuku}${!s.jilid.is_terminal && s.current_quran_halaman ? ` · mushaf hal. ${s.current_quran_halaman}` : ''}`
      : null

    // Tahfidz: hafalan baru dalam periode, tiap ayat dihitung sekali.
    const sudah = new Set<string>()
    let halaman = 0
    for (const l of tf) {
      if (!ZIYADAH.includes(l.kind) || l.ayat_dari === null || l.ayat_ke === null) continue
      for (let a = l.ayat_dari; a <= l.ayat_ke; a++) {
        const k = `${l.surat_id}:${a}`
        if (sudah.has(k)) continue
        sudah.add(k)
        halaman += peta.bobot(l.surat_id, a, a)
      }
    }
    const terakhir = ziyadahSemua.find(z => z.student_id === s.id)
    const juz = gabungJuz(setoranTuntas.get(s.id) ?? 0, (juzTeruji.get(s.id) ?? []).length)
    const sedang = juzTerjauh(progres.filter(p => p.student_id === s.id && p.ayat_hafal > 0).map(p => p.juz_number))

    return {
      id: s.id,
      nama: s.full_name,
      kelas: s.kelas,
      hariSetor: hari.size,
      tahsin: {
        posisi: posisiTahsin,
        setoran: ts.length,
        lulus: ts.filter(l => l.status === 'lulus' && !l.drill).length,
        drillLulus: ts.filter(l => l.status === 'lulus' && l.drill).length,
        baris: barisLanjut(ts),
        selesai: Boolean(s.jilid?.is_terminal),
      },
      tahfidz: {
        terakhir: terakhir && terakhir.ayat_dari !== null
          ? `${namaSurat(terakhir.surat_id)} ${terakhir.ayat_dari}${terakhir.ayat_ke && terakhir.ayat_ke !== terakhir.ayat_dari ? `–${terakhir.ayat_ke}` : ''}`
          : null,
        juzTuntas: juz.total,
        sedangJuz: sedang !== null && (bebas.has(s.id) ? !(juzTeruji.get(s.id) ?? []).includes(sedang) : (posisiJuz(sedang) ?? 0) > juz.total) ? sedang : null,
        ziyadahHalaman: halaman,
        ziyadahAyat: sudah.size,
        ziyadahSetoran: tf.filter(l => ZIYADAH.includes(l.kind)).length,
        totalHalaman: halamanHafalan(peta, bebas.has(s.id) ? juzTeruji.get(s.id) ?? [] : juz.total, ziyadahSemua.filter(z => z.student_id === s.id), s.jenjang),
        // Muroja'ah dalam halaman — volume baca: tiap setoran dijumlah.
        // Tasmi' bukan muroja'ah dan tidak ikut dihitung.
        ...(() => {
          const m = rekapMurojaah(peta, tf)
          const surat = suratMurojaah(tf)
          return {
            murojaah: m.kaliBaru + m.kaliLama, murojaahBaruHalaman: m.baru, murojaahLamaHalaman: m.lama,
            murojaahBaruSurat: surat.baru.map(namaSurat), murojaahLamaSurat: surat.lama.map(namaSurat),
          }
        })(),
      },
      ujian: ujianPer.get(s.id) ?? [],
    }
  })

  return {
    sesi: { id: halaqoh.id, nama: halaqoh.name },
    guru: {
      nama: sapaanName(guru?.sapaan, guru?.nickname, guru?.full_name ?? ''),
      ttdUrl,
    },
    periode,
    hariPertemuan: hariPertemuan.size,
    anak,
    ringkas: {
      jumlahAnak: anak.length,
      anakSetor: anak.filter(a => a.hariSetor > 0).length,
      tahsinLulus: anak.reduce((n, a) => n + a.tahsin.lulus, 0),
      ziyadahHalaman: anak.reduce((n, a) => n + a.tahfidz.ziyadahHalaman, 0),
      murojaah: anak.reduce((n, a) => n + a.tahfidz.murojaah, 0),
      murojaahHalaman: anak.reduce((n, a) => n + a.tahfidz.murojaahBaruHalaman + a.tahfidz.murojaahLamaHalaman, 0),
      ujian: anak.reduce((n, a) => n + a.ujian.length, 0),
    },
    dicetak: tanggalWIB(new Date()),
  }
}
