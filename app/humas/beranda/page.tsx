import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutTemplate, Type, Users, ExternalLink } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageHomepage, canCreateNews, canEditProgram, canEditAbout } from '@/lib/auth/permissions'
import { getSiteSettings, getTeachersForCuration } from '@/lib/data/site'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { HeaderFooterForm } from './HeaderFooterForm'
import { SectionsForm } from './SectionsForm'
import { TeacherProfilesForm } from './TeacherProfilesForm'
import type { UserRole } from '@/types'

type Tab = 'seksi' | 'teks' | 'guru'
const VALID_TABS: Tab[] = ['seksi', 'teks', 'guru']

const TABS: { value: Tab; label: string; icon: typeof Type }[] = [
  { value: 'seksi', label: 'Seksi Beranda',   icon: LayoutTemplate },
  { value: 'teks',  label: 'Header & Footer', icon: Type           },
  { value: 'guru',  label: 'Profil Guru',     icon: Users          },
]

/**
 * Konten yang editornya sudah punya halaman sendiri — panel cukup menautkan.
 *
 * Tiap tautan membawa izinnya sendiri karena panel ini dibuka oleh Kepala RQ
 * maupun Humas (canManageHomepage), sementara halaman tujuannya tidak semuanya
 * seluas itu: berita & Tentang RQ kini murni wewenang Humas. Tanpa penyaringan
 * ini Kepala RQ melihat tautan yang justru melemparnya kembali ke /dashboard.
 */
const CONTENT_LINKS: {
  label: string
  href: string
  hint: string
  can: (role: UserRole) => boolean
}[] = [
  { label: 'Tulis & kelola berita', href: '/humas/berita',  hint: 'Isi artikel yang tampil di seksi Kabar & Berita', can: canCreateNews  },
  { label: 'Kelola program',        href: '/humas/program', hint: 'Tambah, ubah, dan atur urutan program RQ',        can: canEditProgram },
  { label: 'Tentang RQ',            href: '/humas/tentang', hint: 'Visi-misi, sejarah, dan struktur organisasi',     can: canEditAbout   },
]

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function KelolaBerandaPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageHomepage(session.role)) redirect('/dashboard')

  const params = await searchParams
  const activeTab: Tab = VALID_TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'seksi'

  const [settings, teachers] = await Promise.all([getSiteSettings(), getTeachersForCuration()])

  const contentLinks = CONTENT_LINKS.filter(l => l.can(session.role))

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelola Beranda"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Kelola Tampilan Beranda</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Atur seksi yang tampil di halaman depan, teks header &amp; footer, dan profil guru.
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline pt-1"
          >
            Lihat beranda <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="border-b mb-7 -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1 min-w-fit">
            {TABS.map(({ value, label, icon: Icon }) => {
              const active = activeTab === value
              return (
                <Link
                  key={value}
                  href={`/humas/beranda?tab=${value}`}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary" />}
                </Link>
              )
            })}
          </div>
        </div>

        {activeTab === 'seksi' && (
          <div className="space-y-8 pb-10">
            <SectionsForm sections={settings.sections} />

            {contentLinks.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-5">
              <h2 className="text-sm font-semibold mb-1">Mengisi kontennya</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Panel ini mengatur <em>bagaimana</em> konten tampil. Untuk menulis isinya, pakai
                halaman berikut.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {contentLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border bg-card px-3.5 py-3 hover:border-primary/40 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {link.label}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-1 leading-snug">
                      {link.hint}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'teks' && <HeaderFooterForm settings={settings} />}

        {activeTab === 'guru' && <TeacherProfilesForm teachers={teachers} />}
      </div>
    </div>
  )
}
