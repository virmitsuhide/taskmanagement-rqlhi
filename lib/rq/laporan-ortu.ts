/**
 * Laporan orang tua per sesi — bagian murni (tanpa akses data), dipakai
 * halaman /guru/laporan-ortu di server dan kotak teks WhatsApp di klien.
 *
 * Laporan ini PER SESI: satu lembar untuk seluruh anak satu halaqoh, dikirim
 * ke grup wali sesi itu. Rapor per anak tetap di /guru/siswa/[id]/rapor.
 */

export type PresetPeriode = 'hari' | 'pekan' | 'bulan' | 'rentang'

export interface PeriodeLaporan {
  preset: PresetPeriode
  /** 'YYYY-MM-DD', inklusif. */
  dari: string
  sampai: string
  /** "Senin–Kamis, 15–18 September 2026" */
  label: string
}

export interface AnakLaporan {
  id: string
  nama: string
  kelas: string | null
  /** Hari berbeda anak ini setor (tahsin atau tahfidz) dalam periode. */
  hariSetor: number
  tahsin: {
    /** "Jilid 3 hal. 14", "Al-Qur'an T2 · mushaf hal. 45", "Lulus Tahsin". */
    posisi: string | null
    setoran: number
    /** Setoran lulus di luar drill — tiap satu memajukan satu halaman. */
    lulus: number
    /** Sudah Lulus Tahsin — tahsinnya bukan kabar baru bagi wali. */
    selesai: boolean
  }
  tahfidz: {
    /** Setoran ziyadah terakhir sepanjang masa, mis. "Al-Baqarah 187–188". */
    terakhir: string | null
    juzTuntas: number
    /** Juz yang sedang dihafal bila melewati juz tuntas. */
    sedangJuz: number | null
    /** Hafalan baru dalam periode, halaman mushaf (boleh pecahan). */
    ziyadahHalaman: number
    ziyadahAyat: number
    /** Berapa kali setor ziyadah dalam periode. */
    ziyadahSetoran: number
    murojaah: number
    /** Total hafalan saat ini dalam halaman mushaf menurut urutan hafalan RQ. */
    totalHalaman: number
  }
  /** Ujian yang selesai dalam periode, mis. "Tasmi' Juz 30 · Mumtaz". */
  ujian: string[]
}

export interface LaporanOrtu {
  sesi: { id: string; nama: string }
  guru: { nama: string; ttdUrl: string | null }
  periode: PeriodeLaporan
  /** Hari yang ada setoran di sesi ini — bukan hari kalender, supaya libur tidak terbaca bolos. */
  hariPertemuan: number
  anak: AnakLaporan[]
  ringkas: {
    jumlahAnak: number
    anakSetor: number
    tahsinLulus: number
    ziyadahHalaman: number
    murojaah: number
    ujian: number
  }
  dicetak: string
}

// ─── Periode ─────────────────────────────────────────────────────────────────

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']
/** Rentang bebas dibatasi supaya satu laporan tetap terbaca dan kueri tetap ringan. */
export const RENTANG_MAKS_HARI = 93

function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const hariKe = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const tgl = (iso: string) => Number(iso.slice(8, 10))
const bln = (iso: string) => BULAN[Number(iso.slice(5, 7)) - 1]
const thn = (iso: string) => iso.slice(0, 4)
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function labelPeriode(dari: string, sampai: string): string {
  if (dari === sampai) return `${HARI[hariKe(dari)]}, ${tgl(dari)} ${bln(dari)} ${thn(dari)}`
  // Sepekan atau kurang: nama harinya ikut disebut, itu yang diingat wali.
  const namaHari = selisihHari(dari, sampai) < 7 ? `${HARI[hariKe(dari)]}–${HARI[hariKe(sampai)]}, ` : ''
  if (dari.slice(0, 7) === sampai.slice(0, 7)) return `${namaHari}${tgl(dari)}–${tgl(sampai)} ${bln(sampai)} ${thn(sampai)}`
  if (thn(dari) === thn(sampai)) return `${namaHari}${tgl(dari)} ${bln(dari)} – ${tgl(sampai)} ${bln(sampai)} ${thn(sampai)}`
  return `${namaHari}${tgl(dari)} ${bln(dari)} ${thn(dari)} – ${tgl(sampai)} ${bln(sampai)} ${thn(sampai)}`
}

const TANGGAL_SAH = /^\d{4}-\d{2}-\d{2}$/

/**
 * Rentang dari pilihan guru. Tidak pernah melewati hari ini; rentang bebas
 * yang tidak masuk akal (terbalik, kosong, terlalu panjang) dirapikan, bukan
 * ditolak — guru tetap mendapat laporan.
 */
export function rentangLaporan(
  preset: PresetPeriode,
  hariIni: string,
  diminta: { dari?: string; sampai?: string } = {},
): PeriodeLaporan {
  let dari = hariIni
  let sampai = hariIni
  if (preset === 'pekan') dari = tambahHari(hariIni, -((hariKe(hariIni) + 6) % 7))
  if (preset === 'bulan') dari = `${hariIni.slice(0, 7)}-01`
  if (preset === 'rentang') {
    sampai = TANGGAL_SAH.test(diminta.sampai ?? '') && diminta.sampai! <= hariIni ? diminta.sampai! : hariIni
    dari = TANGGAL_SAH.test(diminta.dari ?? '') ? diminta.dari! : sampai
    if (dari > sampai) [dari, sampai] = [sampai, dari]
    if (selisihHari(dari, sampai) >= RENTANG_MAKS_HARI) dari = tambahHari(sampai, -(RENTANG_MAKS_HARI - 1))
  }
  return { preset, dari, sampai, label: labelPeriode(dari, sampai) }
}

// ─── Angka ───────────────────────────────────────────────────────────────────

export function angka1(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

/**
 * Tambahan hafalan untuk dibaca wali. Di bawah satu halaman ditulis dalam
 * ayat: satu ayat ≈ 0,04 halaman, dan "+0 hal." terbaca seperti tidak ada
 * kemajuan sama sekali.
 */
export function tambahHafalan(halaman: number, ayat: number): string {
  return halaman >= 1 ? `+${angka1(halaman)} hal.` : `+${ayat} ayat`
}

/** "6 juz (124 hal.)" — juz tuntas + halaman mushaf; hanya halaman bila belum ada juz tuntas. */
export function labelTotalHafalan(t: Pick<AnakLaporan['tahfidz'], 'juzTuntas' | 'totalHalaman'>): string {
  const hal = `${angka1(t.totalHalaman)} hal.`
  return t.juzTuntas > 0 ? `${t.juzTuntas} juz (${hal})` : hal
}

// ─── Teks WhatsApp ───────────────────────────────────────────────────────────

export interface OpsiPesan {
  /** Rincian satu baris per anak. Dimatikan bila grup wali berisi orang tua sesi lain. */
  rincian: boolean
  /** Pesan tambahan dari guru, disisipkan sebelum penutup. */
  pesan: string
  /**
   * Tautan laporan yang bisa dibuka wali tanpa login. Kosong = tidak
   * disertakan, dan penutupnya kembali menyebut lampiran PDF — wali yang
   * tidak diberi tautan tidak boleh disuruh membuka sesuatu yang tak ada.
   */
  tautan?: string
}

/**
 * Pesan untuk grup wali satu sesi. Dikirim bersama PDF-nya, jadi isinya
 * ringkasan yang bisa dibaca tanpa membuka lampiran — bukan salinan tabel.
 */
export function teksWaLaporanOrtu(l: LaporanOrtu, opsi: OpsiPesan): string {
  const r = l.ringkas
  const baris: string[] = [
    "Assalamu'alaikum warahmatullahi wabarakatuh 🌿",
    '',
    `Ayah/Bunda yang dirahmati Allah, berikut laporan capaian pembelajaran Al-Qur'an Ananda di *${l.sesi.nama}* pada *${l.periode.label}*.`,
    '',
    '📊 *Ringkasan*',
  ]
  if (l.hariPertemuan > 1) baris.push(`• Pertemuan: ${l.hariPertemuan} hari`)
  baris.push(`• Ananda yang setor: ${r.anakSetor} dari ${r.jumlahAnak} anak`)
  if (r.tahsinLulus > 0) baris.push(`• Tahsin: ${r.tahsinLulus} halaman lulus`)
  if (r.ziyadahHalaman > 0 || r.murojaah > 0) {
    baris.push(`• Tahfidz: ${[
      r.ziyadahHalaman > 0 ? `${angka1(r.ziyadahHalaman)} halaman hafalan baru` : null,
      r.murojaah > 0 ? `${r.murojaah}× muroja'ah` : null,
    ].filter(Boolean).join(' · ')}`)
  }
  if (r.ujian > 0) baris.push(`• Ujian selesai: ${r.ujian}`)

  if (opsi.rincian && l.anak.length > 0) {
    baris.push('', '📖 *Capaian per Ananda*')
    l.anak.forEach((a, i) => {
      const hadir = a.hariSetor === 0
        ? 'belum setor'
        : l.hariPertemuan > 1 ? `setor ${a.hariSetor}/${l.hariPertemuan} hari` : 'setor'
      baris.push(`${i + 1}. *${a.nama}* — ${hadir}`)
      // Anak yang sudah Lulus Tahsin: baris tahsin hanya bila periode ini ada setorannya.
      if (a.tahsin.posisi && (!a.tahsin.selesai || a.tahsin.setoran > 0)) {
        baris.push(`   Tahsin: ${a.tahsin.posisi}${a.tahsin.lulus > 0 ? ` (+${a.tahsin.lulus} hal.)` : ''}`)
      }
      const t = a.tahfidz
      if (t.terakhir) baris.push(`   Tahfidz: ${t.terakhir}`)
      const rincianTf = [
        t.ziyadahAyat > 0 ? `ziyadah ${tambahHafalan(t.ziyadahHalaman, t.ziyadahAyat)}` : null,
        t.murojaah > 0 ? `muroja'ah ${t.murojaah}×` : null,
        t.totalHalaman > 0 ? `total hafalan ${labelTotalHafalan(t)}` : null,
      ].filter(Boolean)
      if (rincianTf.length > 0) baris.push(`   ${t.terakhir ? '' : 'Tahfidz: '}${rincianTf.join(' · ')}`)
      for (const u of a.ujian) baris.push(`   🎉 ${u}`)
    })
  }

  if (opsi.pesan.trim()) baris.push('', opsi.pesan.trim())
  baris.push(
    '',
    opsi.tautan
      ? `Laporan lengkap: ${opsi.tautan}`
      : 'Laporan lengkap terlampir dalam PDF.',
    "Mohon dukungan Ayah/Bunda untuk menyimak muroja'ah Ananda di rumah. 🤲",
    '',
    'Jazakumullahu khairan.',
    "Wassalamu'alaikum warahmatullahi wabarakatuh",
    '',
    l.guru.nama,
    `${l.sesi.nama} · Rumah Qur'an LHI`,
  )
  return baris.join('\n')
}
