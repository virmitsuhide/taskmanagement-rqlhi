/**
 * Isian awal target bulanan (drizzle/0103) untuk tahun ajaran berjalan.
 *
 *     npm run seed:target-bulanan
 *
 * Aman diulang: baris yang sudah ada (termasuk yang sudah disunting Kumik)
 * TIDAK ditimpa — hanya sel kosong yang diisi.
 *
 * TAHFIDZ — dari rencana per program (lib/rq/target-tahfidz.ts, disalin dari
 *   Excel target tahfidz), dibagi ke bulan menurut kalender pekan efektif —
 *   persis angka yang sudah dipakai Analitik target tahfidz.
 *     SD CLIL → sd_clil · SD QULS & SD Juara kelas 1 → sd_quls ·
 *     SD Juara kelas 2–6 → sd_juara · SMP → internal/eksternal
 *   TPAIT & SMA belum punya rencana tahfidz — dibiarkan kosong.
 *
 * TAHSIN — dari target per kelas (kurikulum_targets), dibagi rata per bulan
 *   menurut pekan efektif. Target kelas dibaca sebagai target AKHIR TAHUN;
 *   awal tahun kelas N = target kelas N−1. SMP kelas 8 punya target tengah
 *   tahun (ganjil Jilid 5, genap Al-Qur'an — ditetapkan koordinator).
 *   Hanya unit yang targetnya ada: SD CLIL (UMMI), SMP & SMA (Syajaroh),
 *   SD Juara kelas 2–6 (IQRO, CP TTQ 2026/2027). SD QULS, SD Juara kelas 1
 *   (QULS), dan TPAIT belum punya target tahsin — kosong.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { getKalenderTahfidz, getPetaHalaman } = await import('@/lib/data/target-tahfidz')
  const { getTanggaTahsin } = await import('@/lib/data/target-bulanan')
  const {
    RENCANA, buatKurva, posisiPada, progresKalender, semesterKurva, tahunAjaranDari, targetHalaman,
  } = await import('@/lib/rq/target-tahfidz')
  const {
    bagiRataBulanan, bulanTahunAjaran, kelompokTarget, kumulatifTargetKurikulum, posisiTahsin,
  } = await import('@/lib/rq/target-bulanan')
  type Jenjang = import('@/types').Jenjang

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const hariIni = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const tahunAjaran = tahunAjaranDari(hariIni)
  const kalender = (await getKalenderTahfidz(tahunAjaran)).bulan
  const bulanTA = bulanTahunAjaran(tahunAjaran)
  const baris: Record<string, unknown>[] = []

  // ── Tahfidz ──
  const peta = await getPetaHalaman()
  type Kurva = ReturnType<typeof buatKurva>
  /** Ayat berikutnya dalam urutan rencana; tanpa posisi sebelumnya → ayat pertama sesudah `halaman`. */
  const ayatSesudah = (kurva: Kurva, p: { surat: number; ayat: number } | null, halaman: number) => {
    if (!p) {
      const it = kurva.item.find(i => i.akhir > halaman + 1e-9)
      return it ? { surat: it.surat, ayat: it.dari } : null
    }
    const i = kurva.item.findIndex(x => x.surat === p.surat && x.dari <= p.ayat && p.ayat <= x.ke)
    if (i === -1) return null
    if (p.ayat < kurva.item[i].ke) return { surat: p.surat, ayat: p.ayat + 1 }
    const lanjut = kurva.item[i + 1]
    return lanjut ? { surat: lanjut.surat, ayat: lanjut.dari } : null
  }
  const JENJANG: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']
  for (const jenjang of JENJANG) {
    for (const kel of kelompokTarget(jenjang, 'tahfidz')) {
      if (!kel.rencana) continue
      for (const tingkat of kel.tingkat) {
        const kode = typeof kel.rencana === 'function' ? kel.rencana(tingkat) : kel.rencana
        const kurva = buatKurva(RENCANA[kode], peta)
        const s1 = semesterKurva(kurva, tingkat, 1)
        if (!s1) continue
        let sebelum = s1.mulai
        for (const bulan of bulanTA) {
          const t = targetHalaman(kurva, tingkat, progresKalender(kalender, `${bulan}-01`, true))
          if (!t) continue
          const dasar = { tahun_ajaran: tahunAjaran, bulan, jenjang, kelompok: kel.kode, tingkat, jenis: 'tahfidz' }
          if (t.semester.jenis === 'murojaah') {
            baris.push({ ...dasar, keterangan: "Murojaah & ujian/tasmi' juz yang sudah dihafal" })
            sebelum = t.halaman
            continue
          }
          const maju = t.halaman - sebelum > 1e-6
          // Awal bulan = ayat SESUDAH akhir bulan lalu, supaya rentang dua
          // bulan tidak berbagi satu ayat saat batasnya jatuh di tengah ayat.
          const akhirLalu = posisiPada(kurva, peta, sebelum)
          const awal = maju ? ayatSesudah(kurva, akhirLalu, sebelum) : akhirLalu
          const akhir = posisiPada(kurva, peta, t.halaman)
          sebelum = t.halaman
          if (!awal || !akhir) continue
          baris.push({
            ...dasar, keterangan: maju ? '' : 'Tidak ada materi baru — pertahankan',
            awal_surat: awal.surat, awal_ayat: awal.ayat, akhir_surat: akhir.surat, akhir_ayat: akhir.ayat,
          })
        }
      }
    }
  }
  const jumlahTahfidz = baris.length

  // ── Tahsin ──
  const { data: term } = await sb.from('academic_terms').select('id').eq('is_current', true).maybeSingle()
  const { data: kt } = await sb.from('kurikulum_targets').select('jenjang, tingkat, target_tahsin').eq('term_id', term?.id ?? '')
  const targetKelas = new Map(((kt ?? []) as { jenjang: string; tingkat: number; target_tahsin: string | null }[])
    .filter(r => r.target_tahsin).map(r => [`${r.jenjang}|${r.tingkat}`, r.target_tahsin!]))
  // SMP kelas 8 (ditetapkan koordinator): semester 1 menuntaskan Jilid 5,
  // semester 2 di Al-Qur'an — jadi akhir ganjil = awal tahap Al-Qur'an.
  //
  // SD Juara (CP TTQ 2026/2027): kelas 2 semester I Iqro' 3, II Iqro' 4 →
  // tengah tahun masuk Jilid 4, akhir tahun masuk Jilid 5; kelas 3 semester
  // I Jilid 5, II Jilid 6 → tengah Jilid 6, akhir Al-Qur'an. Kelas 2 berangkat
  // dari Jilid 3: kelas 1-nya QULS (KIBAR), jadi tidak ada target IQRO kelas 1.
  const TENGAH_TAHUN: Record<string, string> = { 'smp|8': "Al-Qur'an", 'sd_juara|2': 'Jilid 4', 'sd_juara|3': 'Jilid 6' }
  const AKHIR_TAHUN_KHUSUS: Record<string, string> = { 'smp|8': "Al-Qur'an" }
  const AWAL_TAHUN_KHUSUS: Record<string, string> = { 'sd_juara|2': 'Jilid 3' }
  const UNIT_TAHSIN: { jenjang: Jenjang; kelompok: string }[] = [
    { jenjang: 'sd', kelompok: 'clil' }, { jenjang: 'smp', kelompok: 'semua' }, { jenjang: 'sma', kelompok: 'semua' },
    { jenjang: 'sd_juara', kelompok: 'semua' },
  ]
  const tangga = await getTanggaTahsin()
  for (const { jenjang, kelompok } of UNIT_TAHSIN) {
    const kel = kelompokTarget(jenjang, 'tahsin').find(k => k.kode === kelompok)!
    kel.tingkat.forEach((tingkat, i) => {
      const metode = kel.metode!(tingkat)
      const tg = tangga[metode]
      if (!tg) return
      const kunci = `${jenjang}|${tingkat}`
      const akhirTeks = AKHIR_TAHUN_KHUSUS[kunci] ?? targetKelas.get(kunci)
      if (!akhirTeks) return
      const sebelumTeks = AWAL_TAHUN_KHUSUS[kunci]
        ?? (i === 0 ? null : (AKHIR_TAHUN_KHUSUS[`${jenjang}|${kel.tingkat[i - 1]}`] ?? targetKelas.get(`${jenjang}|${kel.tingkat[i - 1]}`)))
      const awalTahun = sebelumTeks ? kumulatifTargetKurikulum(tg, sebelumTeks) : 0
      const akhirTahun = kumulatifTargetKurikulum(tg, akhirTeks)
      const tengah = TENGAH_TAHUN[kunci] ? kumulatifTargetKurikulum(tg, TENGAH_TAHUN[kunci]) : null
      if (awalTahun === null || akhirTahun === null) return
      // Target "Jilid 5" berarti lulus Jilid 4 — bulan terakhir berhenti di
      // halaman terakhir Jilid 4. Target Lulus Tahsin justru harus TERCAPAI:
      // bulan terakhirnya berakhir di tahap Lulus itu sendiri.
      const keLulus = posisiTahsin(tg, akhirTahun).tahap === tg.find(x => x.is_terminal)?.label
      const rentang = bagiRataBulanan(kalender, awalTahun, tengah, Math.max(awalTahun, akhirTahun))
      for (const [n, r] of rentang.entries()) {
        const a = posisiTahsin(tg, r.awal)
        const z = posisiTahsin(tg, keLulus && n === rentang.length - 1 ? akhirTahun : r.akhir)
        baris.push({
          tahun_ajaran: tahunAjaran, bulan: r.bulan, jenjang, kelompok, tingkat, jenis: 'tahsin', metode,
          awal_tahap: a.tahap, awal_halaman: a.halaman, akhir_tahap: z.tahap, akhir_halaman: z.halaman,
          keterangan: '',
        })
      }
    })
  }

  // `npm run seed:target-bulanan -- --dry` → tampilkan saja, tidak menyimpan.
  if (process.argv.includes('--dry')) {
    const teks = (r: Record<string, unknown>) => r.jenis === 'tahsin'
      ? `${r.awal_tahap}${r.awal_halaman ? ` hal. ${r.awal_halaman}` : ''} – ${r.akhir_tahap}${r.akhir_halaman ? ` hal. ${r.akhir_halaman}` : ''}`
      : r.awal_surat ? `${r.awal_surat}:${r.awal_ayat} – ${r.akhir_surat}:${r.akhir_ayat}` : String(r.keterangan)
    const grup = new Map<string, Record<string, unknown>[]>()
    for (const r of baris) {
      const k = `${r.jenjang} · ${r.kelompok} · ${r.jenis} · kelas ${r.tingkat}`
      grup.set(k, [...(grup.get(k) ?? []), r])
    }
    for (const [k, rs] of grup) console.log(`\n${k}\n${rs.map(r => `   ${r.bulan}  ${teks(r)}`).join('\n')}`)
    console.log(`\n${jumlahTahfidz} tahfidz + ${baris.length - jumlahTahfidz} tahsin (dry-run, tidak disimpan)`)
    return
  }

  const { error, count } = await sb.from('target_bulanan')
    .upsert(baris, { onConflict: 'tahun_ajaran,bulan,jenjang,kelompok,tingkat,jenis', ignoreDuplicates: true, count: 'exact' })
  if (error) {
    console.error('✗ Gagal:', error.message)
    if (/target_bulanan/.test(error.message)) console.error('  → jalankan drizzle/0103_target_bulanan_PASTE_TO_SUPABASE.sql dulu.')
    process.exit(1)
  }
  console.log(`✓ Tahun ajaran ${tahunAjaran}: ${jumlahTahfidz} baris tahfidz + ${baris.length - jumlahTahfidz} baris tahsin disiapkan; ${count ?? '?'} baris baru tersimpan (yang sudah ada tidak ditimpa).`)
}

main().catch(e => { console.error(e); process.exit(1) })
