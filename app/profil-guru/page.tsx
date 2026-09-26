import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Pencil, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageHomepage } from '@/lib/auth/permissions'
import { getPublicTeachers, getSiteSettings, findSection } from '@/lib/data/site'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Button } from '@/components/ui/button'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import type { PublicTeacher } from '@/types'
import { getDataEkstra } from '@/lib/data/ekstra'

export const metadata: Metadata = {
  title: "Profil Guru — RQ LHI",
  description: "Para pengajar Rumah Qur'an LHI",
}

/** Inisial dari dua kata pertama nama, untuk fallback saat foto kosong. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function ProfilGuruPage() {
  const [session, teachers, settings, ekstra] = await Promise.all([
    getSession(),
    getPublicTeachers(),
    getSiteSettings(),
    getDataEkstra({ hanyaAktif: true }),
  ])
  // Guru yang punya slot ekstra dibuka → sisa kursinya (0 = penuh).
  const sisaEkstra = new Map<string, number>()
  for (const s of ekstra.slot) {
    sisaEkstra.set(s.teacher_id, (sisaEkstra.get(s.teacher_id) ?? 0) + Math.max(0, s.kuotaEfektif - s.peserta))
  }

  const canManage = !!session && canManageHomepage(session.role)
  const heading = findSection(settings, 'profil_guru').title

  return (
    // Kerangka mengikuti beranda (app/page.tsx): kontainer max-w-6xl px-4 sm:px-6,
    // hero pt-10/md:pt-14, jarak antar-seksi pb-16.
    <div className="min-h-screen bg-background" style={{ fontSize: 14, lineHeight: 1.5 }}>
      <PublicHeader />

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-7 pt-10 sm:px-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:pb-9 md:pt-14">
        <div className="min-w-0">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">{heading}</p>
          <h1 className="m-0 font-heading text-[clamp(34px,6vw,60px)] font-normal leading-[1.05] tracking-[-0.02em]">
            Guru yang mendampingi <span className="italic text-primary">setiap halaman anak.</span>
          </h1>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-3 md:items-end">
          <p className="text-[15px] leading-relaxed text-muted-foreground md:text-right md:text-[17px]">
            {teachers.length > 0 ? `${teachers.length} pengajar` : 'Para pengajar'} yang mendampingi siswa Rumah Qur&apos;an LHI.
          </p>
          {ekstra.slot.length > 0 && (
            <Link
              href="/daftar-ekstra"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent-warm px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Daftar ekstra <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link href="/humas/beranda?tab=guru">
                <Pencil className="mr-1.5 h-3.5 w-3.5" />Kelola profil
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {teachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
            <Users className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm font-medium">Belum ada profil guru yang ditampilkan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManage
                ? 'Pilih guru yang ingin ditampilkan lewat menu Kelola Profil.'
                : 'Profil guru sedang disiapkan oleh tim Humas.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {teachers.map(teacher => (
              <TeacherCard key={teacher.id} teacher={teacher} sisaEkstra={sisaEkstra.get(teacher.id)} />
            ))}
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  )
}

function TeacherCard({ teacher, sisaEkstra }: { teacher: PublicTeacher; sisaEkstra?: number }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-3.5 transition-all hover:border-primary/40 hover:shadow-sm">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-primary-wash">
        {teacher.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={teacher.photo_url}
            alt={teacher.full_name}
            className="h-full w-full"
            style={photoStyle(parseFocus(teacher.photo_focus))}
          />
        ) : (
          <span className="flex h-full items-center justify-center font-heading text-5xl text-primary">
            {initials(teacher.full_name)}
          </span>
        )}
      </div>
      <div className="px-1 pb-1">
        <h2 className="font-heading text-[22px] leading-tight">
          <Link href={`/profil-guru/${teacher.id}`} className="hover:text-primary hover:underline">{teacher.full_name}</Link>
        </h2>
        {teacher.public_title && (
          <p className="mt-1 text-[13px] font-semibold text-accent-warm">{teacher.public_title}</p>
        )}
        {teacher.public_bio && (
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground line-clamp-5">
            {teacher.public_bio}
          </p>
        )}
      </div>
      {sisaEkstra !== undefined && (
        <div className="mt-auto space-y-2 px-1 pb-1">
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${sisaEkstra > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className={`h-2 w-2 rounded-full ${sisaEkstra > 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
            {sisaEkstra > 0 ? `${sisaEkstra} kursi ekstra tersedia` : 'Kuota ekstra penuh'}
          </p>
          <Link
            href={`/profil-guru/${teacher.id}#booking`}
            className="flex h-11 items-center justify-center rounded-xl bg-accent-warm text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Booking ekstra
          </Link>
        </div>
      )}
      {sisaEkstra === undefined && (
        <Link href={`/profil-guru/${teacher.id}`} className="mt-auto flex h-11 items-center justify-center rounded-xl border bg-card text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">
          Lihat profil
        </Link>
      )}
    </article>
  )
}
