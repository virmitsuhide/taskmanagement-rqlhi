import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { getBahanRaporSesi, type Semester } from '@/lib/data/rapor-quran'
import { getRaporTemplates } from '@/lib/data/rapor-template'
import { getTerms } from '@/lib/data/terms'
import { LembarRapor } from '@/components/rapor/LembarRapor'
import { IsiRapor } from '@/components/guru/IsiRapor'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'
import type { KodeMedan } from '@/lib/rapor/medan'
import type { AcademicTerm } from '@/types'

interface PageProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ term?: string }>
}

/** Medan yang boleh ditimpa guru: yang dihitung sistem, bukan tulisannya sendiri. */
const TAK_BISA_DITIMPA: KodeMedan[] = ['deskripsi', 'tetap', 'kosongkan']

/**
 * Isi rapor seorang anak.
 *
 * Seluruh anak sesi ini tetap dimuat, bukan satu: panah ◀ ▶ butuh nama
 * tetangganya, dan memuat sesi sekaligus sama mahalnya dengan memuat satu
 * anak — kueri bahan rapor memang dirancang per rombongan.
 */
export default async function IsiRaporPage({ params, searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { studentId } = await params
  const sp = await searchParams

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students').select('id, halaqoh_id').eq('id', studentId).maybeSingle()
  if (!siswa?.halaqoh_id) notFound()
  if (!(await getTeacherHalaqohIds(session.teacherId)).includes(siswa.halaqoh_id as string)) {
    redirect('/guru/rapor-quran')
  }

  const [{ data: halaqohRow }, terms, { daftar: templates }] = await Promise.all([
    supabase.from('halaqoh').select('id, name, sesi, jenjang').eq('id', siswa.halaqoh_id).maybeSingle(),
    getTerms(),
    getRaporTemplates(),
  ])
  if (!halaqohRow) notFound()

  const term = (terms.find(t => t.id === sp.term) ?? terms.find(t => t.is_current) ?? terms[0]) as AcademicTerm | undefined
  if (!term) redirect('/guru/rapor-quran')

  const bahan = await getBahanRaporSesi(halaqohRow as HalaqohSesi, term as Semester, templates)
  const ke = bahan.findIndex(b => b.student.id === studentId)
  if (ke < 0) notFound()
  const anak = bahan[ke]

  const kembali = `/guru/rapor-quran?sesi=${halaqohRow.id}&term=${term.id}`
  const tetangga = (i: number) =>
    bahan[i] ? { id: bahan[i].student.id, nama: bahan[i].student.nama } : null

  // Yang ditawarkan untuk ditimpa hanyalah medan yang benar-benar dipakai
  // template ini — daftar panjang berisi medan yang tak tercetak di mana pun
  // hanya mengundang guru mengisi sesuatu yang tak pernah muncul.
  const bisaDitimpa = anak.template
    ? ([...new Set(Object.values(anak.template.pemetaan))] as KodeMedan[]).filter(k => !TAK_BISA_DITIMPA.includes(k))
    : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-6 print:max-w-none print:p-0">
        <div className="print:hidden">
          <Link href={kembali} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {halaqohRow.name}
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {anak.student.nama}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {anak.student.kelas ?? 'tanpa kelas'} · semester {term.semester === 'ganjil' ? 'Ganjil' : 'Genap'} {term.year_label}
            {anak.sepi && ' · belum ada setoran semester ini'}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block">
          <div className="print:hidden">
            <IsiRapor
              studentId={anak.student.id}
              termId={term.id}
              templateId={anak.template?.id ?? null}
              nama={anak.student.nama}
              deskripsiAwal={anak.deskripsi}
              timpaanAwal={anak.timpaan}
              asli={anak.asli}
              bisaDitimpa={bisaDitimpa}
              sebelum={tetangga(ke - 1)}
              sesudah={tetangga(ke + 1)}
              urutan={{ ke: ke + 1, dari: bahan.length }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground print:hidden">Pratinjau lembar — inilah yang tercetak.</p>
            {anak.template ? (
              <div className="overflow-x-auto rounded-xl border print:overflow-visible print:rounded-none print:border-0">
                <LembarRapor blok={anak.template.blok} pemetaan={anak.template.pemetaan} nilai={anak.nilai} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground print:hidden">
                Belum ada template rapor untuk kelas {anak.student.kelas ?? '—'}. Deskripsi yang Anda tulis tetap
                tersimpan dan akan langsung terpakai begitu koordinator mengunggah formatnya.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
