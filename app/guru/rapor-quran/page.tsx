import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check, Printer } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getBahanRaporSesi, type Semester } from '@/lib/data/rapor-quran'
import { getRaporTemplates, bacaJenisRapor, LABEL_JENIS_RAPOR, type JenisRapor } from '@/lib/data/rapor-template'
import { getTerms } from '@/lib/data/terms'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { cn } from '@/lib/utils'
import type { AcademicTerm } from '@/types'

interface PageProps {
  searchParams: Promise<{ sesi?: string; term?: string; jenis?: string }>
}

const PATH = '/guru/rapor-quran'

const LABEL_SEMESTER = (t: AcademicTerm) => `${t.semester === 'ganjil' ? 'Ganjil' : 'Genap'} ${t.year_label}`

/**
 * Rapor Qur'an per sesi — daftar anak satu halaqoh dalam satu semester.
 *
 * Mengisi rapor adalah pekerjaan satu sesi sekaligus, bukan satu anak: guru
 * masuk dari sini lalu berjalan menyusuri halaqohnya dengan panah ◀ ▶ di
 * layar isian. Bentuk lembarnya ditentukan template unit (0082); halaman ini
 * hanya memberi tahu kalau templatenya belum ada.
 */
export default async function RaporQuranPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const [semuaSesi, terms] = await Promise.all([getHalaqohSesiGuru(session.teacherId), getTerms()])
  const sesi = pilihHalaqoh(semuaSesi, sp.sesi)
  const term = (terms.find(t => t.id === sp.term) ?? terms.find(t => t.is_current) ?? terms[0]) as AcademicTerm | undefined

  const jenis = bacaJenisRapor(sp.jenis)
  const params = { sesi: sesi?.id, term: term?.id, jenis: jenis === 'semester' ? undefined : jenis }
  const href = (g: Record<string, string | undefined>) => hrefDengan(PATH, params, g)

  const { tabelAda, daftar: templates } = await getRaporTemplates()
  const bahan = sesi && term ? await getBahanRaporSesi(sesi, term as Semester, templates, jenis) : []
  // Jenis yang punya template aktif di unit mana pun — ATS baru ditawarkan
  // begitu koordinator mengunggah formatnya.
  const adaJenis = (j: JenisRapor) => templates.some(t => t.aktif && t.jenis === j)

  // Satu halaqoh nyaris selalu satu rentang kelas, jadi template anak pertama
  // mewakili sesinya; anak yang kelasnya di luar rentang tetap memakai
  // templatenya sendiri, dan yang tak punya template ditandai di daftar.
  const template = bahan.find(b => b.template)?.template ?? null
  const tanpaTemplate = bahan.filter(b => !b.template).length
  const terisi = bahan.filter(b => b.selesai).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Laporan</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Rapor Qur&apos;an
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Satu lembar per anak, memakai format yang ditetapkan koordinator. Angkanya terisi sendiri dari setoran dan
            daftar hadir — yang Anda tulis adalah deskripsi perkembangannya.
          </p>
        </div>

        {!sesi || !term ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            {!sesi ? 'Anda belum mengampu halaqoh aktif.' : 'Belum ada tahun ajaran yang ditetapkan.'}
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl border bg-card p-4">
              {semuaSesi.length > 1 && (
                <Slicer label="Sesi" options={semuaSesi.map(h => ({
                  label: h.sesi && semuaSesi.filter(x => x.sesi === h.sesi).length === 1 ? `Sesi ${h.sesi}` : h.name,
                  href: href({ sesi: h.id }), active: h.id === sesi.id,
                }))} />
              )}
              {(adaJenis('ats') || jenis === 'ats') && (
                <Slicer label="Laporan" options={(['ats', 'semester'] as JenisRapor[]).map(j => ({
                  label: LABEL_JENIS_RAPOR[j], href: href({ jenis: j === 'semester' ? undefined : j }), active: j === jenis,
                }))} />
              )}
              {terms.length > 1 && (
                <Slicer label="Semester" options={terms.slice(0, 4).map(t => ({
                  label: LABEL_SEMESTER(t), href: href({ term: t.id }), active: t.id === term.id,
                }))} />
              )}
            </div>

            {!tabelAda ? (
              <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
                Tabel rapor belum ada di basis data. Migrasi 0081 &amp; 0082 perlu dijalankan lebih dulu.
              </div>
            ) : !template ? (
              <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
                Belum ada template {LABEL_JENIS_RAPOR[jenis]} untuk kelas ini. Koordinator unit mengunggahnya di menu{' '}
                <b>Template Rapor</b>; sampai itu ada, rapor belum bisa dicetak.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {terisi} dari {bahan.length} selesai diisi · format <b>{template.nama}</b>
                  </p>
                  <Link
                    href={`${PATH}/cetak?sesi=${sesi.id}&term=${term.id}&jenis=${jenis}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    <Printer className="h-4 w-4" /> Cetak satu sesi
                  </Link>
                </div>

                <ul className="space-y-2">
                  {bahan.map((b, i) => (
                    <li key={b.student.id}>
                      <Link
                        href={`${PATH}/${b.student.id}?term=${term.id}&jenis=${jenis}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            <span className="mr-2 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                            {b.student.nama}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {b.student.kelas ?? 'tanpa kelas'}
                            {b.nilai.nilai_tahsin && ` · tahsin ${b.nilai.nilai_tahsin}`}
                            {b.nilai.nilai_karakter && ` · adab ${b.nilai.nilai_karakter}`}
                            {' · hadir '}{b.absensi.hadir}/{b.absensi.total || 0}
                          </p>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                          b.selesai ? 'bg-primary-wash text-primary' : 'border text-muted-foreground',
                        )}>
                          {b.selesai ? <Check className="h-3.5 w-3.5" /> : 'belum'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                {tanpaTemplate > 0 && (
                  <p className="text-xs text-[color:var(--destructive)]">
                    {tanpaTemplate} anak kelasnya di luar rentang template mana pun — rapornya belum bisa dicetak
                    sampai koordinator menambah formatnya.
                  </p>
                )}

                {bahan.some(b => b.sepi) && (
                  <p className="text-xs text-muted-foreground">
                    Anak bertanda nilai kosong belum punya satu pun setoran di semester ini — periksa lagi sebelum
                    rapornya dicetak.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
