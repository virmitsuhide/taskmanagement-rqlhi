/**
 * Siswa & halaqoh Al-Qur'an TPA IT LHI (PAUD: TKA & TKB) — TA 2026/2027.
 *
 *     npx tsx scripts/impor-tpait-2026.ts --dry   # lihat rencana, tidak menyimpan
 *     npx tsx scripts/impor-tpait-2026.ts         # simpan
 *
 * Sumber: Downloads\Capaian Al-Quran Anak TPA IT LHI.xlsx (sheet "Update 5_10_26"):
 * blok "Kelompok N Ust X" lalu baris No · Nama · Capaian Tahsin · Capaian Tahfidz.
 *
 *   - satu halaqoh per kelompok, wali = ustadzahnya (cukup wali_teacher_id —
 *     tanpa halaqoh_teachers.role, jadi ustadzah mencatat tahsin & tahfidz);
 *   - metode UMMI; "Pra Ummi hal N" / "Ummi jilid N hal M" menjadi posisi
 *     jilid & halaman awal, "jilid N drill" = halaman terakhir + tahsin_drill_sejak;
 *   - teks capaian asli disimpan di level_awal (capaian tahfidz belum punya
 *     kolom posisi untuk PAUD, jadi ikut tercatat di sana);
 *   - kelas (TKA/TKB) dan jenis kelamin dikosongkan — menyusul.
 *
 * Akun ustadzah yang belum ada dibuat (password awal dicetak di akhir). Aman
 * diulang: guru dicari menurut username, halaqoh menurut nama, siswa menurut
 * nama di jenjang PAUD.
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import XLSX from 'xlsx'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { syncHalaqohMemberships } from '@/lib/data/halaqoh-membership'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true } as dotenv.DotenvConfigOptions)

const BERKAS = 'C:/Users/Acer/Downloads/Capaian Al-Quran Anak TPA IT LHI.xlsx'
const TANGGAL_DATA = '2026-10-05'
const dry = process.argv.includes('--dry')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** Panggilan di judul kelompok → akun. */
const GURU: Record<string, { username: string; full_name: string; panggilan: string }> = {
  rahmi: { username: 'rahmi_husna', full_name: 'Rahmi Husna', panggilan: 'Rahmi' },
  erli: { username: 'erli_purwaningsih', full_name: 'Erli Purwaningsih', panggilan: 'Erli' },
  eti: { username: 'eti_sriwahyuni', full_name: 'Eti Sriwahyuni', panggilan: 'Eti' },
  andin: { username: 'andina_novi_hastami', full_name: 'Andina Novi Hastami', panggilan: 'Andin' },
}

function rapikanNama(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function kataSandi(): string {
  const huruf = 'abcdefghijkmnpqrstuvwxyz'
  const angka = '23456789'
  let p = 'Guru@'
  for (let i = 0; i < 3; i++) p += huruf[Math.floor(Math.random() * huruf.length)]
  for (let i = 0; i < 4; i++) p += angka[Math.floor(Math.random() * angka.length)]
  return p
}

/** "Pra Ummi hal 34" · "Ummi jilid 2 hal 37" · "Jilid Ummi 1 hal 36" · "Ummi jilid 1 drill". */
function bacaPosisi(teks: string): { tahap: number; halaman: number | null; drill: boolean } | null {
  const t = teks.toLowerCase()
  const hal = t.match(/hal\s*(\d+)/)
  const halaman = hal ? Number(hal[1]) : null
  if (/pra\s*ummi/.test(t)) return { tahap: 0, halaman, drill: false }
  const jilid = t.match(/jilid\s*(?:ummi\s*)?(\d)/)
  if (!jilid) return null
  return { tahap: Number(jilid[1]), halaman, drill: /drill/.test(t) }
}

async function pastikanGuru(kunci: string, sandiBaru: Map<string, string>): Promise<string> {
  const g = GURU[kunci]
  if (!g) throw new Error(`Guru "${kunci}" tidak dikenal — tambahkan ke GURU.`)
  const { data: ada } = await sb.from('teachers').select('id').eq('username', g.username).maybeSingle()
  console.log(`  ${ada ? '=' : '+'} ${g.username} (${g.full_name})`)
  if (ada) return ada.id as string
  if (dry) return `(baru:${g.username})`
  const sandi = kataSandi()
  const { data, error } = await sb.from('teachers').insert({
    username: g.username, full_name: g.full_name, password_hash: await bcrypt.hash(sandi, 10),
    is_active: true, can_change_password: true, gender: 'P',
    unit: 'paud', kategori_guru: 'guru_tpait', lingkup_penugasan: 'unit',
  }).select('id').single()
  if (error || !data) throw new Error(`Gagal membuat akun ${g.username}: ${error?.message}`)
  sandiBaru.set(g.username, sandi)
  return data.id as string
}

type Kelompok = { no: number; guru: string; siswa: { nama: string; tahsin: string; tahfidz: string }[] }

function bacaBerkas(): Kelompok[] {
  const wb = XLSX.readFile(BERKAS)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const hasil: Kelompok[] = []
  for (const r of rows) {
    const a = String(r[0]).trim()
    const judul = a.match(/^Kelompok\s+(\d+)\s+Ust\.?\s+(\S+)/i)
    if (judul) { hasil.push({ no: Number(judul[1]), guru: judul[2].toLowerCase(), siswa: [] }); continue }
    if (!/^\d+$/.test(a) || !String(r[1]).trim()) continue
    hasil.at(-1)!.siswa.push({ nama: rapikanNama(String(r[1])), tahsin: String(r[2]).trim(), tahfidz: String(r[3]).trim() })
  }
  return hasil
}

async function main() {
  const kelompok = bacaBerkas()
  console.log(`${kelompok.length} kelompok, ${kelompok.reduce((n, k) => n + k.siswa.length, 0)} siswa di berkas.\n`)

  const [{ data: term }, { data: metode }] = await Promise.all([
    sb.from('academic_terms').select('id').eq('is_current', true).maybeSingle(),
    sb.from('tahsin_methods').select('id').eq('name', 'UMMI').single(),
  ])
  if (!term) throw new Error('Tidak ada tahun ajaran berjalan (academic_terms.is_current).')
  if (!metode) throw new Error('Metode UMMI tidak ditemukan.')
  const { data: tahapData } = await sb.from('jilid_levels')
    .select('id, order_num, total_pages').eq('method_id', metode.id).lte('order_num', 6)
  const tahap = new Map((tahapData ?? []).map(t => [t.order_num as number, t as { id: string; total_pages: number | null }]))
  if (!tahap.has(0)) throw new Error('Tahap Pra-UMMI belum ada — jalankan scripts/ummi-pra-tpait.ts dulu.')

  const sandiBaru = new Map<string, string>()
  console.log('Ustadzah:')
  const idGuru = new Map<string, string>()
  for (const k of kelompok) idGuru.set(k.guru, await pastikanGuru(k.guru, sandiBaru))

  console.log('\nHalaqoh:')
  const idHalaqoh = new Map<number, string>()
  for (const k of kelompok) {
    const nama = `Kelompok ${k.no} — Ustadzah ${GURU[k.guru].panggilan}`
    const { data: ada } = await sb.from('halaqoh').select('id').eq('name', nama).eq('jenjang', 'paud').maybeSingle()
    let id = ada?.id as string | undefined
    console.log(`  ${ada ? '=' : '+'} ${nama} (${k.siswa.length} siswa)`)
    if (!id && !dry) {
      const { data, error } = await sb.from('halaqoh').insert({
        name: nama, jenjang: 'paud', wali_teacher_id: idGuru.get(k.guru), term_id: term.id, is_active: true,
      }).select('id').single()
      if (error || !data) throw new Error(`Gagal membuat halaqoh ${nama}: ${error?.message}`)
      id = data.id as string
    }
    idHalaqoh.set(k.no, id ?? `(baru:${nama})`)
  }

  console.log('\nSiswa:')
  const { data: paudAda } = await sb.from('students').select('id, full_name, halaqoh_id').eq('jenjang', 'paud')
  const kunciNama = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const pindah: { student_id: string; ke: string | null; dari: string | null }[] = []
  let baru = 0
  for (const k of kelompok) {
    const tujuan = idHalaqoh.get(k.no)!
    for (const s of k.siswa) {
      const ada = (paudAda ?? []).find(x => kunciNama(x.full_name) === kunciNama(s.nama))
      const pos = s.tahsin ? bacaPosisi(s.tahsin) : null
      if (s.tahsin && !pos) throw new Error(`Capaian tahsin "${s.tahsin}" (${s.nama}) tak terbaca.`)
      const level = pos ? tahap.get(pos.tahap) : undefined
      const halaman = pos?.drill ? level?.total_pages ?? null : pos?.halaman ?? null
      const posisiTeks = pos ? `${pos.tahap === 0 ? 'Pra-UMMI' : `Jilid ${pos.tahap}`} hal ${halaman ?? '?'}${pos.drill ? ' (drill)' : ''}` : '(belum ada capaian)'
      console.log(`  ${ada ? '=' : '+'} K${k.no}  ${s.nama.padEnd(38)} ${posisiTeks}`)
      if (dry) continue
      if (ada) {
        if (ada.halaqoh_id !== tujuan) {
          await sb.from('students').update({ halaqoh_id: tujuan, updated_at: new Date().toISOString() }).eq('id', ada.id)
          pindah.push({ student_id: ada.id, ke: tujuan, dari: ada.halaqoh_id })
        }
        continue
      }
      const capaian = [s.tahsin, s.tahfidz && `Tahfidz: ${s.tahfidz}`].filter(Boolean).join(' · ')
      const { data, error } = await sb.from('students').insert({
        full_name: s.nama, jenjang: 'paud', halaqoh_id: tujuan, is_active: true,
        current_method_id: metode.id,
        current_jilid_id: level?.id ?? null,
        current_jilid_page: halaman,
        tahsin_drill_sejak: pos?.drill ? TANGGAL_DATA : null,
        level_awal: capaian,
      }).select('id').single()
      if (error || !data) throw new Error(`Gagal menambah ${s.nama}: ${error?.message}`)
      pindah.push({ student_id: data.id as string, ke: tujuan, dari: null })
      baru++
    }
  }
  if (!dry && pindah.length) await syncHalaqohMemberships(sb as never, pindah)

  console.log(`\n${baru} siswa baru${dry ? ' — DRY-RUN, tidak disimpan' : ' — tersimpan'}.`)
  if (sandiBaru.size) {
    console.log('\nPassword awal akun ustadzah baru (sampaikan langsung ke masing-masing):')
    for (const [u, p] of sandiBaru) console.log(`  ${u.padEnd(20)} ${p}`)
  }
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
