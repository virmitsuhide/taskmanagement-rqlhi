import { createServerClient } from '@/lib/supabase/server'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { halamanLulusPerSetoran, type LogHalaman } from '@/lib/rq/halaman-lulus'
import { rentangPeriode, wadahAktivitas, type KodePeriode, type RentangPeriode } from '@/lib/data/statistik-guru'

/**
 * Grafik progres satu anak, memakai periode & wadah batang yang sama dengan
 * Statistik Mengajar — "sebulan" di halaman anak dan di statistik guru
 * harus berarti rentang dan batang yang sama.
 *
 * Yang dihitung adalah KEMAJUAN, bukan jumlah setoran:
 *  • Tahsin → setoran lulus di luar drill; tiap satu memajukan satu halaman
 *    buku (aturan posisi di actions/setoran.ts). Setoran "ulang" dicatat
 *    terpisah supaya guru tetap melihat anak yang rajin setor tapi belum lulus.
 *  • Tahfidz → halaman mushaf dari ayat ziyadah. Muroja'ah menjaga, tidak
 *    menambah hafalan, jadi tidak ikut.
 *
 * Halaman tahsin (buku jilid) dan halaman tahfidz (mushaf) sengaja tidak
 * dijumlahkan atau ditumpuk: satuannya sama namanya, tapi bukunya lain.
 */

export interface TitikProgres {
  label: string
  judul: string
  tahsinLulus: number
  tahsinUlang: number
  /** Halaman mushaf, boleh pecahan. */
  tahfidzHalaman: number
  tahfidzAyat: number
}

export interface ProgresSiswa {
  periode: RentangPeriode
  titik: TitikProgres[]
  total: { tahsinLulus: number; tahsinUlang: number; tahfidzHalaman: number; tahfidzAyat: number }
}

export async function getProgresSiswa(studentId: string, kode: KodePeriode): Promise<ProgresSiswa> {
  const periode = await rentangPeriode(kode)
  const supabase = createServerClient()

  // Satu anak, paling banyak setahun: satu setoran tahsin per hari, jadi jauh
  // di bawah batas 1.000 baris PostgREST tanpa perlu dipaginasi.
  // Setoran Lulus dihitung dalam HALAMAN (selisih dengan Lulus sebelumnya),
  // jadi dibaca mundur dua bulan sebelum periode sebagai pembanding.
  const mundur = new Date(`${periode.awal}T00:00:00Z`)
  mundur.setUTCDate(mundur.getUTCDate() - 62)
  const [tahsinRes, lulusRes, tahfidzRes, peta] = await Promise.all([
    supabase.from('tahsin_logs').select('setoran_date, status, drill')
      .eq('student_id', studentId).gte('setoran_date', periode.awal).lte('setoran_date', periode.akhir),
    supabase.from('tahsin_logs').select('id, setoran_date, halaman, status, drill, jilid_id')
      .eq('student_id', studentId).eq('status', 'lulus')
      .gte('setoran_date', mundur.toISOString().slice(0, 10)).lte('setoran_date', periode.akhir)
      .order('setoran_date').order('created_at'),
    supabase.from('tahfidz_logs').select('setoran_date, kind, surat_id, ayat_dari, ayat_ke')
      .eq('student_id', studentId).in('kind', ['ziyadah', 'hafalan_baru'])
      .gte('setoran_date', periode.awal).lte('setoran_date', periode.akhir),
    getPetaHalaman(),
  ])
  const tahsin = (tahsinRes.data ?? []) as { setoran_date: string; status: string; drill: boolean | null }[]
  const tahfidz = (tahfidzRes.data ?? []) as { setoran_date: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null }[]
  const lulus = (lulusRes.data ?? []) as (LogHalaman & { setoran_date: string })[]
  const halamanLulus = halamanLulusPerSetoran(lulus)

  const titik = wadahAktivitas(periode).map(w => {
    const di = (tgl: string) => tgl >= w.mulai && tgl <= w.selesai
    const ts = tahsin.filter(l => di(l.setoran_date))
    const tf = tahfidz.filter(l => di(l.setoran_date) && l.ayat_dari !== null && l.ayat_ke !== null)
    return {
      label: w.label,
      judul: w.judul,
      // Halaman, bukan banyaknya setoran: satu setoran bisa melewati beberapa halaman.
      tahsinLulus: lulus.filter(l => !l.drill && di(l.setoran_date)).reduce((n, l) => n + (halamanLulus.get(l.id) ?? 1), 0),
      // Lanjut (halaman belum tuntas) bukan ulang — anak sedang maju pelan.
      tahsinUlang: ts.filter(l => l.status === 'ulang').length,
      tahfidzHalaman: tf.reduce((n, l) => n + peta.bobot(l.surat_id, l.ayat_dari!, l.ayat_ke!), 0),
      tahfidzAyat: tf.reduce((n, l) => n + l.ayat_ke! - l.ayat_dari! + 1, 0),
    }
  })

  const jumlah = (k: keyof Omit<TitikProgres, 'label' | 'judul'>) => titik.reduce((n, t) => n + t[k], 0)
  return {
    periode,
    titik,
    total: {
      tahsinLulus: jumlah('tahsinLulus'),
      tahsinUlang: jumlah('tahsinUlang'),
      tahfidzHalaman: jumlah('tahfidzHalaman'),
      tahfidzAyat: jumlah('tahfidzAyat'),
    },
  }
}
