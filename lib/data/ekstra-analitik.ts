import { createServerClient } from '@/lib/supabase/server'
import {
  BAGIAN_HARI, getDataEkstra, getSetoranEkstra, HARI_EKSTRA, labelSlot,
  type BookingEkstra, type StatusHadirEkstra,
} from '@/lib/data/ekstra'

/**
 * Analitik Ekstra untuk Koordinator Ekstra. Seluruh agregasi di sini —
 * halaman hanya menerima angka jadi. Datanya kecil (ratusan baris), jadi
 * dibaca utuh lalu dihitung di memori.
 */

export interface AnalitikEkstra {
  bulan: string
  tabelAda: boolean
  kpi: {
    pesertaAktif: number
    pesertaLhi: number
    pesertaNon: number
    halaqoh: number
    guru: number
    permintaanBulanIni: number
    menunggu: number
    /** Dari permintaan yang sudah diputuskan (diterima vs ditolak), 90 hari terakhir. */
    diterima: number
    diputus: number
    /** Median hari dari permintaan masuk sampai pertama ditangani, untuk yang ditangani bulan ini. */
    tanggapHari: number | null
    hadir: number
    catatanHadir: number
    setoran: number
    /** Σ biaya jenis per peserta aktif yang satuannya per bulan. */
    pemasukanBulanan: number
    pesertaTanpaBiayaBulanan: number
  }
  tren: { bulan: string; label: string; masuk: number; mulai: number; berhenti: number }[]
  perJenis: { nama: string; peserta: number; halaqoh: number; kuota: number }[]
  perGuru: { nama: string; peserta: number; halaqoh: number }[]
  permintaanHari: { label: string; jumlah: number }[]
  permintaanBagian: { label: string; jumlah: number }[]
  keterisian: { id: string; nama: string; jadwal: string; jenis: string; peserta: number; kuota: number }[]
  menungguLama: { id: string; nama: string; jenis: string; hari: number; status: string }[]
  /** Siswa LHI peserta aktif yang sudah tertaut — bahan tabel capaian. */
  idSiswaLhi: string[]
  /** Peserta aktif non siswa LHI (atau siswa LHI yang belum tertaut): tanpa target. */
  nonLhi: { id: string; nama: string; keterangan: string; asal: string; jenis: string; halaqoh: string; posisi: string; hadir: number; pertemuan: number }[]
}

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function geserBulan(p: string, n: number): string {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Bulan kalender WIB dari timestamp ISO atau tanggal. */
const bulanDari = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 7) : null)

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const t = Math.floor(s.length / 2)
  return s.length % 2 ? s[t] : (s[t - 1] + s[t]) / 2
}

export async function getAnalitikEkstra(bulan: string): Promise<AnalitikEkstra> {
  const [y, m] = bulan.split('-').map(Number)
  const dari = `${bulan}-01`
  const sampai = `${bulan}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const supabase = createServerClient()

  const [data, bRes] = await Promise.all([
    getDataEkstra(),
    supabase.from('ekstra_booking').select('*').order('created_at'),
  ])
  const kosong: AnalitikEkstra = {
    bulan, tabelAda: false,
    kpi: { pesertaAktif: 0, pesertaLhi: 0, pesertaNon: 0, halaqoh: 0, guru: 0, permintaanBulanIni: 0, menunggu: 0, diterima: 0, diputus: 0, tanggapHari: null, hadir: 0, catatanHadir: 0, setoran: 0, pemasukanBulanan: 0, pesertaTanpaBiayaBulanan: 0 },
    tren: [], perJenis: [], perGuru: [], permintaanHari: [], permintaanBagian: [], keterisian: [], menungguLama: [], idSiswaLhi: [], nonLhi: [],
  }
  if (!data.tabelAda) return kosong

  const booking = (bRes.data ?? []) as (BookingEkstra & { ditangani_at: string | null })[]
  const aktif = booking.filter(b => b.status === 'aktif')
  // Peserta hasil impor database lama bukan permintaan dari formulir — tidak ikut
  // angka permintaan, penerimaan, lama respons, dan preferensi waktu.
  const permintaan = booking.filter(b => !b.catatan_koor.includes('Impor Database Ekstra'))
  const halaqoh = data.slot.filter(s => s.aktif)
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))

  const [hadirRes, setoran] = await Promise.all([
    supabase.from('ekstra_hadir').select('booking_id, status').gte('tanggal', dari).lte('tanggal', sampai),
    getSetoranEkstra(data.slot.map(s => s.id), dari, sampai),
  ])
  const hadir = (hadirRes.data ?? []) as { booking_id: string; status: StatusHadirEkstra }[]
  const slotById = new Map(data.slot.map(s => [s.id, s]))

  // Keputusan 90 hari terakhir: diterima = pernah jadi peserta (aktif/berhenti).
  const batas90 = new Date(Date.now() - 90 * 864e5).toISOString()
  const diputus = permintaan.filter(b => b.created_at >= batas90 && ['aktif', 'berhenti', 'ditolak'].includes(b.status))
  const tanggap = permintaan
    .filter(b => b.ditangani_at && bulanDari(b.ditangani_at) === bulan)
    .map(b => (new Date(b.ditangani_at!).getTime() - new Date(b.created_at).getTime()) / 864e5)
    .filter(d => d >= 0)

  // Estimasi: biaya per peserta, kecuali jenis "Keluarga" yang ditagih per keluarga
  // (= per halaqoh) — Privat Keluarga Rp 1,1 juta untuk 1–4 orang, bukan per orang.
  let pemasukan = 0, tanpaBulanan = 0
  const keluargaTerhitung = new Set<string>()
  for (const b of aktif) {
    const j = jenisById.get(b.jenis_id)
    if (!j || !/bulan/i.test(j.satuan_biaya)) { tanpaBulanan++; continue }
    if (/keluarga/i.test(j.nama)) {
      if (b.slot_id && !keluargaTerhitung.has(b.slot_id)) { keluargaTerhitung.add(b.slot_id); pemasukan += j.biaya }
    } else pemasukan += j.biaya
  }

  const tren = Array.from({ length: 6 }, (_, i) => geserBulan(bulan, i - 5)).map(p => ({
    bulan: p,
    label: `${NAMA_BULAN[Number(p.slice(5)) - 1]} ${p.slice(2, 4)}`,
    masuk: permintaan.filter(b => bulanDari(b.created_at) === p).length,
    mulai: booking.filter(b => b.mulai?.slice(0, 7) === p).length,
    berhenti: booking.filter(b => b.berhenti?.slice(0, 7) === p).length,
  }))

  const perJenis = data.jenis.map(j => {
    const h = halaqoh.filter(s => s.jenis_id === j.id)
    return { nama: j.nama, peserta: aktif.filter(b => b.jenis_id === j.id).length, halaqoh: h.length, kuota: h.reduce((n, s) => n + s.kuotaEfektif, 0) }
  }).filter(x => x.peserta > 0 || x.halaqoh > 0).sort((a, b) => b.peserta - a.peserta)

  const guruMap = new Map<string, { nama: string; peserta: number; halaqoh: number }>()
  for (const s of halaqoh) {
    const g = guruMap.get(s.teacher_id) ?? { nama: s.guru ?? '—', peserta: 0, halaqoh: 0 }
    g.halaqoh++; g.peserta += s.peserta
    guruMap.set(s.teacher_id, g)
  }

  // Permintaan dengan preferensi waktu (alur 0093) — kapan orang tua paling banyak meminta.
  const berPreferensi = permintaan.filter(b => (b.hari_pilihan ?? []).length > 0)
  const permintaanHari = [1, 2, 3, 4, 5, 6, 7].map(h => ({ label: HARI_EKSTRA[h], jumlah: berPreferensi.filter(b => b.hari_pilihan.includes(h)).length }))
  const permintaanBagian = BAGIAN_HARI.map(x => ({ label: `${x.label} (${x.jam})`, jumlah: berPreferensi.filter(b => (b.waktu_pilihan ?? []).includes(x.kode)).length }))

  const sekarang = Date.now()
  const menungguLama = booking
    .filter(b => (b.status === 'baru' || b.status === 'ditawarkan') && sekarang - new Date(b.created_at).getTime() > 3 * 864e5)
    .map(b => ({ id: b.id, nama: b.nama_anak, jenis: jenisById.get(b.jenis_id)?.nama ?? '—', hari: Math.floor((sekarang - new Date(b.created_at).getTime()) / 864e5), status: b.status }))
    .sort((a, b) => b.hari - a.hari)

  return {
    bulan, tabelAda: true,
    kpi: {
      pesertaAktif: aktif.length,
      pesertaLhi: aktif.filter(b => b.asal === 'lhi').length,
      pesertaNon: aktif.filter(b => b.asal !== 'lhi').length,
      halaqoh: halaqoh.length,
      guru: guruMap.size,
      permintaanBulanIni: permintaan.filter(b => bulanDari(b.created_at) === bulan).length,
      menunggu: booking.filter(b => b.status === 'baru' || b.status === 'ditawarkan').length,
      diterima: diputus.filter(b => b.status !== 'ditolak').length,
      diputus: diputus.length,
      tanggapHari: median(tanggap),
      hadir: hadir.filter(h => h.status === 'hadir').length,
      catatanHadir: hadir.length,
      setoran: setoran.length,
      pemasukanBulanan: pemasukan,
      pesertaTanpaBiayaBulanan: tanpaBulanan,
    },
    tren,
    perJenis,
    perGuru: [...guruMap.values()].sort((a, b) => b.peserta - a.peserta || a.nama.localeCompare(b.nama)),
    permintaanHari,
    permintaanBagian,
    keterisian: halaqoh.map(s => ({ id: s.id, nama: s.guru ?? '—', jadwal: labelSlot(s), jenis: s.jenis?.nama ?? '—', peserta: s.peserta, kuota: s.kuotaEfektif }))
      .sort((a, b) => b.peserta / b.kuota - a.peserta / a.kuota),
    menungguLama,
    idSiswaLhi: [...new Set(aktif.filter(b => b.asal === 'lhi' && b.student_id).map(b => b.student_id!))],
    nonLhi: aktif.filter(b => b.asal !== 'lhi' || !b.student_id).map(b => {
      const sl = b.slot_id ? slotById.get(b.slot_id) : undefined
      const h = hadir.filter(r => r.booking_id === b.id)
      return {
        id: b.id, nama: b.nama_anak, keterangan: b.kelas, asal: b.asal === 'lhi' ? 'Siswa LHI (belum tertaut)' : 'Non siswa LHI',
        jenis: jenisById.get(b.jenis_id)?.nama ?? '—', halaqoh: sl ? `${sl.guru} · ${labelSlot(sl)}` : '—',
        posisi: b.posisi_bacaan, hadir: h.filter(r => r.status === 'hadir').length, pertemuan: h.length,
      }
    }).sort((a, b) => a.jenis.localeCompare(b.jenis) || a.nama.localeCompare(b.nama)),
  }
}
