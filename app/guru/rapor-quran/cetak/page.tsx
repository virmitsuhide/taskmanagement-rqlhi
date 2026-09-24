import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getBahanRaporSesi, type Semester } from '@/lib/data/rapor-quran'
import { getRaporTemplates, bacaJenisRapor, LABEL_JENIS_RAPOR } from '@/lib/data/rapor-template'
import { getTerms } from '@/lib/data/terms'
import { LembarRapor } from '@/components/rapor/LembarRapor'
import { TombolCetak } from '@/components/rapor/TombolCetak'
import type { AcademicTerm } from '@/types'

interface PageProps {
  searchParams: Promise<{ sesi?: string; term?: string; jenis?: string }>
}

/**
 * Cetak rapor satu sesi sekaligus.
 *
 * Anak berikutnya selalu mulai di halaman baru (aturan .rapor-sheet di
 * globals.css), jadi sekali cetak menghasilkan setumpuk rapor yang sudah
 * terpisah — bukan satu berkas panjang yang harus dipotong sendiri.
 *
 * Anak yang deskripsinya masih kosong TETAP ikut tercetak, dengan peringatan
 * di layar: guru yang memang belum menulis untuk seorang anak lebih baik
 * melihat lembarnya kosong daripada tidak menemukan lembarnya sama sekali.
 */
export default async function CetakRaporPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const [semuaSesi, terms, { daftar: templates }] = await Promise.all([
    getHalaqohSesiGuru(session.teacherId), getTerms(), getRaporTemplates(),
  ])
  const sesi = pilihHalaqoh(semuaSesi, sp.sesi)
  const term = (terms.find(t => t.id === sp.term) ?? terms.find(t => t.is_current) ?? terms[0]) as AcademicTerm | undefined
  if (!sesi || !term) redirect('/guru/rapor-quran')

  const jenis = bacaJenisRapor(sp.jenis)
  const bahan = (await getBahanRaporSesi(sesi, term as Semester, templates, jenis)).filter(b => b.template)
  const belum = bahan.filter(b => !b.selesai).length
  const isianKosong = bahan.reduce((n, b) => n + b.isianKosong, 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 md:px-6 print:max-w-none print:p-0">
        <div className="print:hidden">
          <Link
            href={`/guru/rapor-quran?sesi=${sesi.id}&term=${term.id}&jenis=${jenis}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {sesi.name}
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Cetak {bahan.length} rapor
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {LABEL_JENIS_RAPOR[jenis]} · semester {term.semester === 'ganjil' ? 'Ganjil' : 'Genap'} {term.year_label}.
            {belum > 0 && ` ${belum} di antaranya belum selesai diisi.`}
            {isianKosong > 0 && <span className="text-warning">{` ${isianKosong} isian merah masih kosong dan akan tercetak kosong.`}</span>}
          </p>
          <div className="mt-3">
            <TombolCetak label={`Cetak / simpan PDF (${bahan.length} lembar)`} namaBerkas={`Rapor Qur'an — ${sesi.name}`} />
          </div>
        </div>

        {bahan.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground print:hidden">
            Belum ada anak yang punya template rapor di sesi ini.
          </div>
        ) : (
          <div className="space-y-4 print:space-y-0">
            {bahan.map(b => (
              <div key={b.student.id} className="overflow-x-auto rounded-xl border bg-muted/40 p-2 sm:p-4 print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:p-0">
                <LembarRapor blok={b.template!.blok} pemetaan={b.template!.pemetaan} nilai={b.nilai} ttd={b.ttd} latar={b.latar} muat
                  isian={b.isian} riyadhoh={b.riyadhoh} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
