import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohPelaporIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { getBahanRaporSesi, type Semester } from '@/lib/data/rapor-quran'
import { getRaporTemplates, bacaJenisRapor, LABEL_JENIS_RAPOR } from '@/lib/data/rapor-template'
import { getTerms } from '@/lib/data/terms'
import { IsiRapor } from '@/components/guru/IsiRapor'
import { LembarRapor } from '@/components/rapor/LembarRapor'
import { PratinjauRaporLangsung, RaporLangsung } from '@/components/guru/PratinjauRaporLangsung'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'
import { slotIsianGuru, type KodeMedan } from '@/lib/rapor/medan'
import type { AcademicTerm } from '@/types'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ term?: string; jenis?: string }>
}

/** Medan yang boleh ditimpa guru: yang dihitung sistem, bukan tulisannya sendiri. */
const TAK_BISA_DITIMPA: KodeMedan[] = [
  'deskripsi', 'isian_guru', 'halaman_riyadhoh', 'sapaan_pengampu', 'sapaan_siswa', 'tetap', 'kosongkan',
]

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
  const jenis = bacaJenisRapor(sp.jenis)

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students').select('id, halaqoh_id').eq('id', studentId).maybeSingle()
  if (!siswa?.halaqoh_id) notFound()
  if (!(await getTeacherHalaqohPelaporIds(session.teacherId)).includes(siswa.halaqoh_id as string)) {
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

  const bahan = await getBahanRaporSesi(halaqohRow as HalaqohSesi, term as Semester, templates, jenis)
  const ke = bahan.findIndex(b => b.student.id === studentId)
  if (ke < 0) notFound()
  const anak = bahan[ke]

  const kembali = `/guru/rapor-quran?sesi=${halaqohRow.id}&term=${term.id}&jenis=${jenis}`
  const tetangga = (i: number) =>
    bahan[i] ? { id: bahan[i].student.id, nama: bahan[i].student.nama } : null

  // Yang ditawarkan untuk ditimpa hanyalah medan yang benar-benar dipakai
  // template ini — daftar panjang berisi medan yang tak tercetak di mana pun
  // hanya mengundang guru mengisi sesuatu yang tak pernah muncul.
  const bisaDitimpa = anak.template
    ? ([...new Set(Object.values(anak.template.pemetaan))] as KodeMedan[]).filter(k => !TAK_BISA_DITIMPA.includes(k))
    : []

  // Isian merah: potongan yang diisi guru, dengan kalimat yang mengapitnya.
  const isianSlot = anak.template
    ? slotIsianGuru(anak.template.blok, anak.template.pemetaan).map(s => ({
      id: s.id, sebelum: s.konteks?.sebelum ?? '', sesudah: s.konteks?.sesudah ?? '', contoh: s.contoh,
    }))
    : []
  // Kotak deskripsi bebas hanya ditawarkan bila template memang memakainya —
  // atau bila belum ada template sama sekali, supaya guru tetap bisa menulis.
  const pakaiDeskripsi = !anak.template || Object.values(anak.template.pemetaan).includes('deskripsi')
  const sisip = [
    { label: 'Capaian tahfidz', nilai: anak.nilai.capaian_tahfidz },
    { label: 'Juz tuntas', nilai: anak.nilai.juz_tuntas },
    { label: 'Level tahsin', nilai: anak.nilai.level_tahsin },
  ]

  const terisi = bahan.filter(b => b.selesai).length
  const labelSemester = `${term.semester === 'ganjil' ? 'Ganjil' : 'Genap'} ${term.year_label}`
  const adaAts = jenis === 'ats' || templates.some(t => t.aktif && t.jenis === 'ats')
  const keJenis = (j: string) => `/guru/rapor-quran/${anak.student.id}?term=${term.id}&jenis=${j}`

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
          <div className="min-w-0">
            <Link href={kembali} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> {halaqohRow.name}
            </Link>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-accent-warm">
              Rapor Qur&apos;an · {LABEL_JENIS_RAPOR[jenis]} {labelSemester}
            </p>
            <h1 className="mt-1.5 font-heading text-3xl leading-tight tracking-tight md:text-[34px]">{anak.student.nama}</h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">
              Kelas {anak.student.kelas ?? '—'} · {halaqohRow.name} · {terisi} dari {bahan.length} rapor sudah selesai diisi
              {anak.sepi && ' · belum ada setoran semester ini'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {adaAts && (
              <nav aria-label="Jenis rapor" className="flex gap-1 rounded-xl bg-muted p-1">
                {(['ats', 'semester'] as const).map(j => (
                  <Link key={j} href={keJenis(j)} aria-current={j === jenis ? 'page' : undefined}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
                      j === jenis ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}>
                    {LABEL_JENIS_RAPOR[j]}
                  </Link>
                ))}
              </nav>
            )}
            <Link href={`/guru/rapor-quran/cetak?sesi=${halaqohRow.id}&term=${term.id}&jenis=${jenis}`}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-accent">
              <Printer className="size-4" /> Cetak satu sesi
            </Link>
          </div>
        </div>

        <RaporLangsung key={`${anak.student.id}-${term.id}-${jenis}`}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] print:block">
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
              jenis={jenis}
              pakaiDeskripsi={pakaiDeskripsi}
              isianSlot={isianSlot}
              isianAwal={anak.isian}
              sisip={sisip}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 print:hidden">
              <p className="text-sm font-bold text-muted-foreground">Pratinjau lembar</p>
              <span className="rounded-md bg-primary-wash px-2 py-0.5 text-xs font-bold text-primary">
                {LABEL_JENIS_RAPOR[jenis]} {term.semester}
              </span>
            </div>
            <p className="text-xs text-muted-foreground print:hidden">Pratinjau ikut berubah selagi Anda mengetik — belum tersimpan sebelum menekan Simpan. Tombol Cetak selalu mencetak versi tersimpan.</p>
            {anak.template ? (
              <>
                {/* Layar saja: pratinjau langsung, ikut ketikan yang belum disimpan. */}
                <div className="overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm sm:p-4 print:hidden">
                  <PratinjauRaporLangsung blok={anak.template.blok} pemetaan={anak.template.pemetaan} nilai={anak.nilai} asli={anak.asli}
                    ttd={anak.ttd} latar={anak.latar} isian={anak.isian} riyadhoh={anak.riyadhoh} />
                </div>
                {/* Cetak saja: persis data tersimpan dari server. Tanpa `muat` —
                    pengecil layar mengukur lembar yang tampil, dan lembar yang
                    tersembunyi di layar tak terukur (lembarnya jadi tak terlihat).
                    Di kertas `muat` memang tak berpengaruh. */}
                <div className="hidden print:block">
                  <LembarRapor blok={anak.template.blok} pemetaan={anak.template.pemetaan} nilai={anak.nilai} ttd={anak.ttd} latar={anak.latar}
                    isian={anak.isian} riyadhoh={anak.riyadhoh} />
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground print:hidden">
                Belum ada template {LABEL_JENIS_RAPOR[jenis]} untuk kelas {anak.student.kelas ?? '—'}. Deskripsi yang Anda tulis tetap
                tersimpan dan akan langsung terpakai begitu koordinator mengunggah formatnya.
              </div>
            )}
          </div>
        </div>
        </RaporLangsung>
      </div>
    </div>
  )
}
