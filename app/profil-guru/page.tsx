import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Pencil, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageHomepage } from '@/lib/auth/permissions'
import { getPublicTeachers, getSiteSettings, findSection } from '@/lib/data/site'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import type { PublicTeacher } from '@/types'

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
  const [session, teachers, settings] = await Promise.all([
    getSession(),
    getPublicTeachers(),
    getSiteSettings(),
  ])

  const canManage = !!session && canManageHomepage(session.role)
  const heading = findSection(settings, 'profil_guru').title

  return (
    <div>
      <PublicHeader />

      <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-[50vh]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
        </Link>

        <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{heading}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Para pengajar yang mendampingi santri Rumah Qur&apos;an LHI
            </p>
          </div>
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link href="/humas/beranda?tab=guru">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Kelola Profil
              </Link>
            </Button>
          )}
        </div>

        {teachers.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
            <Users className="h-7 w-7 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Belum ada profil guru yang ditampilkan</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canManage
                ? 'Pilih guru yang ingin ditampilkan lewat menu Kelola Profil.'
                : 'Profil guru sedang disiapkan oleh tim Humas.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-10">
            {teachers.map(teacher => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  )
}

function TeacherCard({ teacher }: { teacher: PublicTeacher }) {
  return (
    <article className="rounded-xl border bg-card p-5 flex flex-col items-center text-center">
      <Avatar className="size-20 mb-3.5 overflow-hidden">
        {teacher.photo_url && (
          <AvatarImage src={teacher.photo_url} alt="" style={photoStyle(parseFocus(teacher.photo_focus))} />
        )}
        <AvatarFallback className="text-lg font-semibold">{initials(teacher.full_name)}</AvatarFallback>
      </Avatar>

      <h2 className="font-semibold text-[15px] leading-snug">{teacher.full_name}</h2>

      {teacher.public_title && (
        <p className="text-xs text-primary font-medium mt-1">{teacher.public_title}</p>
      )}

      {teacher.public_bio && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-2.5 whitespace-pre-line">
          {teacher.public_bio}
        </p>
      )}
    </article>
  )
}
