import { redirect } from 'next/navigation'
import Link from 'next/link'

import { getSession } from '@/lib/auth/session'
import { canManageStudents, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { kelasJelas } from '@/lib/rq/kelas'
import { tingkatOf } from '@/lib/rq/sesi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import {
  PembenahanKelas, type KelompokBenah, type SiswaBenah,
} from '@/components/siswa/PembenahanKelas'
import type { Jenjang } from '@/types'

/**
 * Membereskan siswa yang kelasnya belum jelas.
 *
 * Sisa impor Excel seperti '4.0' menyimpan tingkatnya tapi kehilangan
 * rombelnya. Selama itu dibiarkan, tiga hal terjadi diam-diam: anaknya
 * menempati tab kelas yang tidak pernah ada di sekolah, ia dilewati kenaikan
 * kelas tiap pergantian tahun ajaran, dan rekap per rombel tidak pernah
 * menjumlah utuh.
 *
 * Tidak seperti /ujian/pemetaan yang memang dirancang habis masa pakainya,
 * halaman ini permanen. Impor siswa menerima kolom Kelas apa adanya, jadi
 * bentuk seperti '4.0' bisa masuk lagi kapan saja — dan yang dibutuhkan bukan
 * sekadar pembersihan sekali jalan, melainkan tempat yang selalu bisa ditanya
 * "masih ada yang menggantung?".
 */
export default async function PembenahanKelasPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Halaman perbaikan, bukan halaman baca: yang hanya boleh melihat siswa
  // (sdm, bendahara, koor_sd atas siswa QULS) tidak punya keperluan di sini.
  if (!canManageStudents(session.role)) redirect('/siswa')

  const supabase = createServerClient()

  // Seluruh siswa aktif dibaca dengan empat kolom — kueri yang sebanding
  // dengan yang sudah dilakukan halaman daftar untuk menghitung tab-nya.
  // Penyaringan dilakukan di sini, bukan di SQL, karena aturan "jelas" itu
  // pola teks yang sama persis dengan yang dipakai kenaikan kelas; menyalinnya
  // jadi klausa SQL berarti punya dua versi aturan yang bisa berbeda diam-diam.
  const { data } = await supabase
    .from('students')
    .select('id, jenjang, kelas, program')
    .eq('is_active', true)

  const semua = (data ?? []) as {
    id: string; jenjang: Jenjang; kelas: string | null; program: string | null
  }[]

  // Izin diperiksa per baris, sama seperti di server action: koor SD dan koor
  // QULS SD berbagi jenjang 'sd' dan hanya programnya yang memisahkan.
  const milikSaya = semua.filter(s => canManageStudents(session.role, s.jenjang, s.program))
  const bermasalah = milikSaya.filter(s => !kelasJelas(s.jenjang, s.kelas))

  // Rombel yang sudah nyata, untuk ditawarkan sebagai tombol cepat. Diambil
  // dari data yang ada supaya tawarannya selalu rombel yang benar-benar
  // dipakai unit itu, bukan daftar A–D yang dikarang.
  const rombelSah = new Map<Jenjang, string[]>()
  for (const s of milikSaya) {
    if (!s.kelas || !kelasJelas(s.jenjang, s.kelas)) continue
    const daftar = rombelSah.get(s.jenjang) ?? []
    if (!daftar.includes(s.kelas)) daftar.push(s.kelas)
    rombelSah.set(s.jenjang, daftar)
  }

  let kelompok: KelompokBenah[] = []

  if (bermasalah.length > 0) {
    const ids = bermasalah.map(s => s.id)
    const { data: rinci } = await supabase
      .from('students')
      .select(
        'id, full_name, nis, jenjang, kelas,' +
        ' halaqoh:halaqoh!students_halaqoh_id_fkey(name, wali:teachers!halaqoh_wali_teacher_id_fkey(full_name))',
      )
      .in('id', ids)

    const rows = (rinci ?? []) as unknown as {
      id: string; full_name: string; nis: string | null
      jenjang: Jenjang; kelas: string | null
      halaqoh: { name: string; wali: { full_name: string } | null } | null
    }[]

    // Dikelompokkan menurut nilai mentahnya, bukan sekadar per unit: satu
    // kelompok '4.0' berisi 31 anak yang sumber kekeliruannya sama, dan itu
    // pula kelompok yang dibaca operator dari daftar rombel sekolah.
    const peta = new Map<string, { jenjang: Jenjang; kelas: string; siswa: SiswaBenah[] }>()
    for (const r of rows) {
      const kelas = (r.kelas ?? '').trim()
      const kunci = `${r.jenjang}|${kelas}`
      const grup = peta.get(kunci) ?? { jenjang: r.jenjang, kelas, siswa: [] }
      grup.siswa.push({
        id: r.id,
        full_name: r.full_name,
        nis: r.nis,
        halaqoh: r.halaqoh?.name ?? null,
        pengampu: r.halaqoh?.wali?.full_name ?? null,
      })
      peta.set(kunci, grup)
    }

    kelompok = [...peta.values()]
      .map(g => {
        const tingkat = tingkatOf(g.kelas)
        const kandidat = rombelSah.get(g.jenjang) ?? []
        return {
          ...g,
          siswa: g.siswa.sort((a, b) => a.full_name.localeCompare(b.full_name, 'id')),
          // Kelas kosong tidak menyisakan petunjuk tingkat, jadi seluruh rombel
          // unit itu ditawarkan. Kalau tingkatnya masih terbaca ('4.0'),
          // tawaran dipersempit ke tingkat itu saja — 4A–4D, bukan 23 rombel SD.
          saran: kandidat
            .filter(k => tingkat === null || tingkatOf(k) === tingkat)
            .sort((a, b) => (tingkatOf(a) ?? 0) - (tingkatOf(b) ?? 0) || a.localeCompare(b, 'id')),
        }
      })
      .sort((a, b) =>
        b.siswa.length - a.siswa.length || a.kelas.localeCompare(b.kelas, 'id'))
  }

  const total = bermasalah.length
  const perUnit = new Map<Jenjang, number>()
  for (const s of bermasalah) perUnit.set(s.jenjang, (perUnit.get(s.jenjang) ?? 0) + 1)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelas Belum Jelas"
        breadcrumbs={[{ label: 'Siswa', href: '/siswa' }, { label: 'Kelas Belum Jelas' }]}
      />
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl leading-tight">Kelas Belum Jelas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {total === 0
                ? 'Semua siswa sudah punya kelas yang jelas.'
                : `${total} siswa menunggu rombel` +
                  (perUnit.size > 0
                    ? ` · ${[...perUnit].map(([j, n]) => `${JENJANG_LABELS[j]} ${n}`).join(', ')}`
                    : '')}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/siswa">Kembali ke daftar</Link>
          </Button>
        </div>

        {total > 0 && (
          <div className="rounded-xl border bg-info-wash p-4 text-sm text-info">
            Kelas seperti <code className="font-mono">4.0</code> masuk dari impor Excel: angka
            tingkatnya selamat, huruf rombelnya hilang. Anak-anak ini{' '}
            <strong>dilewati saat kenaikan kelas</strong> dan muncul sebagai tab kelas yang tidak
            ada di sekolah. Tandai namanya menurut daftar rombel sekolah, lalu pindahkan.
          </div>
        )}

        <PembenahanKelas kelompok={kelompok} />
      </div>
    </div>
  )
}
