import { createServerClient } from '@/lib/supabase/server'
import { getHalaqohSesiGuru, type HalaqohSesi } from '@/lib/data/setoran-sesi'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { halamanHafalan } from '@/lib/rq/target-tahfidz'
import { getInfoSurat } from '@/lib/data/nama-surat'
import { getJuzTerujiPerSiswa, gabungJuz, juzSetoranPerSiswa, type BarisJuzProgress } from '@/lib/data/hafalan'
import { ttdSrc } from '@/lib/kpi/ttd-berkas'
import { sapaanName } from '@/lib/auth/permissions'
import { juzTerjauh, posisiJuz } from '@/lib/rq/hafalan'
import { getPredikatLabel, getTahfidzLabel, tanggalWIB } from '@/lib/rq/ujian'
import type { AnakLaporan, LaporanOrtu, PeriodeLaporan } from '@/lib/rq/laporan-ortu'
import type { TahfidzTipe, UjianPredikat, UjianSiswa } from '@/types'

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

export async function getSesiGuruLaporan(teacherId: string): Promise<HalaqohSesi[]> {
  return getHalaqohSesiGuru(teacherId)
}

export async function getLaporanOrtu(
  teacherId: string,
  halaqoh: HalaqohSesi,
  periode: PeriodeLaporan,
): Promise<LaporanOrtu> {
  const supabase = createServerClient()
  const { data: siswaRows } = await supabase
    .from('students')
    .select('id, full_name, kelas, current_jilid_page, current_quran_halaman,' +
      ' jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages, is_terminal)')
    .eq('halaqoh_id', halaqoh.id)
    .eq('is_active', true)
    .order('full_name')
  const siswa = (siswaRows ?? []) as unknown as {
    id: string; full_name: string; kelas: string | null
    current_jilid_page: number | null; current_quran_halaman: number | null
    jilid: { label: string; total_pages: number | null; is_terminal: boolean } | null
  }[]
  const ids = siswa.map(s => s.id)

  const waktuDari = `${periode.dari}T00:00:00+07:00`
  const waktuSampai = `${besok(periode.sampai)}T00:00:00+07:00`
  const kosong = <T,>() => Promise.resolve([] as T[])
  type LogTahsin = { student_id: string; setoran_date: string; status: string; drill: boolean | null }
  type LogTahfidz = { student_id: string; setoran_date: string; kind: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null }
  type Ziyadah = { student_id: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null; setoran_date: string; created_at: string }

  const [guruRes, tahsin, tahfidz, ziyadahSemua, progres, juzTeruji, ujianTf, ujianTs, peta, surat] = await Promise.all([
    supabase.from('teachers').select('full_name, sapaan, nickname, signature_path').eq('id', teacherId).maybeSingle(),
    ids.length ? ambilSemua<LogTahsin>((a, b) =>
      supabase.from('tahsin_logs').select('student_id, setoran_date, status, drill')
        .in('student_id', ids).gte('setoran_date', periode.dari).lte('setoran_date', periode.sampai).range(a, b)) : kosong<LogTahsin>(),
    ids.length ? ambilSemua<LogTahfidz>((a, b) =>
      supabase.from('tahfidz_logs').select('student_id, setoran_date, kind, surat_id, ayat_dari, ayat_ke')
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
  ])

  const guru = guruRes.data as { full_name: string; sapaan: string | null; nickname: string | null; signature_path: string | null } | null
  const ttdUrl = await ttdSrc(guru?.signature_path).catch(() => null)

  // Hari pertemuan: tanggal yang ada setoran siapa pun di sesi ini.
  const hariPertemuan = new Set([...tahsin.map(l => l.setoran_date), ...tahfidz.map(l => l.setoran_date)])
  const setoranTuntas = juzSetoranPerSiswa(progres)
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

    // Tahsin: posisi terakhir. Halaman hanya untuk tahap berbuku — tahap tanpa
    // halaman (Al-Qur'an, Talaqqi, Lulus Tahsin) kerap menyimpan sisa tahap lama.
    const halBuku = s.jilid?.total_pages && s.current_jilid_page ? s.current_jilid_page : null
    const posisiTahsin = s.jilid
      ? `${s.jilid.label}${halBuku ? ` hal. ${halBuku}` : ''}${!s.jilid.is_terminal && s.current_quran_halaman ? ` · mushaf hal. ${s.current_quran_halaman}` : ''}`
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
        selesai: Boolean(s.jilid?.is_terminal),
      },
      tahfidz: {
        terakhir: terakhir && terakhir.ayat_dari !== null
          ? `${namaSurat(terakhir.surat_id)} ${terakhir.ayat_dari}${terakhir.ayat_ke && terakhir.ayat_ke !== terakhir.ayat_dari ? `–${terakhir.ayat_ke}` : ''}`
          : null,
        juzTuntas: juz.total,
        sedangJuz: sedang !== null && (posisiJuz(sedang) ?? 0) > juz.total ? sedang : null,
        ziyadahHalaman: halaman,
        ziyadahAyat: sudah.size,
        ziyadahSetoran: tf.filter(l => ZIYADAH.includes(l.kind)).length,
        totalHalaman: halamanHafalan(peta, juz.total, ziyadahSemua.filter(z => z.student_id === s.id)),
        murojaah: tf.filter(l => !ZIYADAH.includes(l.kind)).length,
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
      ujian: anak.reduce((n, a) => n + a.ujian.length, 0),
    },
    dicetak: tanggalWIB(new Date()),
  }
}
