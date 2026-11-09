import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth/session'
import { canViewStudents, getListProgramScope, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  bacaUrutan, getBarisSiswa, jenjangTerlihat, ketArah, LABEL_SORT, urutKelas, urutkanBaris,
} from '@/lib/data/daftar-siswa'
import { tingkatOf } from '@/lib/rq/sesi'
import { tanggalWIB } from '@/lib/rq/ujian'
import type { Jenjang } from '@/types'

/**
 * Unduh capaian siswa /siswa sebagai Excel.
 *
 *   lingkup=kelas     — satu rombel (`kelas`)
 *   lingkup=angkatan  — seluruh rombel di `tingkat` unit itu, satu daftar
 *   lingkup=pilihan   — hanya `ids` yang dicentang, dari rombel `kelas`
 *
 * Urutan (`sort`, `dir`) dan pencarian (`q`) ikut dari layar. Daftar `ids`
 * tidak dipercaya mentah: hanya id yang memang ada di rombel yang boleh
 * dilihat peran ini yang masuk berkas.
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session || !canViewStudents(session.role)) {
    return new Response('Tidak memiliki izin.', { status: 403 })
  }

  const p = new URL(req.url).searchParams
  const jenjang = p.get('jenjang') as Jenjang
  const terlihat = jenjangTerlihat(session.role)
  if (!terlihat.includes(jenjang)) return new Response('Unit tidak boleh diakses.', { status: 403 })

  const lingkup = p.get('lingkup') ?? 'kelas'
  const query = (p.get('q') ?? '').trim()
  const { sort, dir } = bacaUrutan(p.get('sort') ?? undefined, p.get('dir') ?? undefined)

  let kelas: string[] = []
  let judulLingkup = ''
  if (lingkup === 'angkatan') {
    const tingkat = Number(p.get('tingkat'))
    const supabase = createServerClient()
    const scope = getListProgramScope(session.role, terlihat)
    let q = supabase.from('students').select('kelas').eq('is_active', true).eq('jenjang', jenjang)
    if (scope) q = q.in('program', scope as string[])
    const { data } = await q
    kelas = [...new Set(((data ?? []) as { kelas: string | null }[])
      .map(r => r.kelas)
      .filter((k): k is string => Boolean(k) && (tingkatOf(k) ?? 0) === tingkat))].sort(urutKelas)
    judulLingkup = tingkat === 0 ? 'Lainnya' : `Kelas ${tingkat} (seangkatan: ${kelas.join(', ') || '—'})`
  } else {
    const k = p.get('kelas')
    if (k) kelas = [k]
    judulLingkup = `Kelas ${k ?? '—'}`
  }

  let baris = await getBarisSiswa({ role: session.role, jenjang, kelas, query })
  if (lingkup === 'pilihan') {
    const ids = new Set((p.get('ids') ?? '').split(',').filter(Boolean))
    baris = baris.filter(b => ids.has(b.id))
    judulLingkup += ` — ${baris.length} siswa terpilih`
  }
  urutkanBaris(baris, sort, dir)

  const hariIni = tanggalWIB(new Date().toISOString())
  const aoa: (string | number)[][] = [
    [`CAPAIAN SISWA ${JENJANG_LABELS[jenjang].toUpperCase()}`],
    [judulLingkup],
    [`Diurutkan: ${LABEL_SORT[sort]}, ${ketArah(sort, dir)}${query ? ` · pencarian "${query}"` : ''} · per ${hariIni}`],
    [],
    ['No', 'Nama Siswa', 'NIS', 'Kelas', 'Program', 'Pengampu', 'Halaqoh', 'Capaian Tahsin', 'Capaian Tahfidz'],
    ...baris.map((b, i) => [
      i + 1,
      b.full_name,
      b.nis ?? '',
      b.kelas ?? '',
      b.program ?? '',
      b.pengampu ?? 'tanpa pengampu',
      b.halaqoh ?? '',
      b.tahsinLabel === '—' ? 'belum tercatat' : b.tahsinLabel,
      b.tahfidzLabel === '—' ? 'belum tercatat' : b.tahfidzLabel,
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 7 }, { wch: 14 },
    { wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 24 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Capaian')
  const isi = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const bagian = lingkup === 'angkatan' ? `kelas-${p.get('tingkat')}-seangkatan` : `kelas-${kelas[0] ?? ''}`
  const nama = `capaian-${jenjang}-${bagian}${lingkup === 'pilihan' ? '-terpilih' : ''}-${hariIni}.xlsx`
    .replace(/[^\w.-]+/g, '_')

  return new Response(new Uint8Array(isi), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nama}"`,
      'Cache-Control': 'no-store',
    },
  })
}
