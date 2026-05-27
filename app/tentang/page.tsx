import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditAbout } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Pencil,
  Network,
  Sparkles,
  History,
  Crown,
  Briefcase,
  Users,
  GraduationCap,
  Megaphone,
  Wrench,
  UserPlus,
  Calculator,
} from 'lucide-react'
import type { AboutRq } from '@/types'

type Tab = 'struktur' | 'visi-misi' | 'sejarah'
const VALID_TABS: Tab[] = ['struktur', 'visi-misi', 'sejarah']

const TABS: { value: Tab; label: string; icon: typeof Network }[] = [
  { value: 'struktur',  label: 'Struktur Organisasi', icon: Network  },
  { value: 'visi-misi', label: 'Visi & Misi',         icon: Sparkles },
  { value: 'sejarah',   label: 'Sejarah RQ',          icon: History  },
]

async function getAbout(): Promise<AboutRq | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('about_rq')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    return (data as AboutRq | null) ?? null
  } catch {
    return null
  }
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function TentangPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeTab: Tab = VALID_TABS.includes(params.tab as Tab)
    ? (params.tab as Tab)
    : 'struktur'

  const [session, about] = await Promise.all([getSession(), getAbout()])
  const isLoggedIn = !!session?.isLoggedIn
  const canEdit = !!session && canEditAbout(session.role)

  return (
    <div>
      {isLoggedIn && session ? (
        <DashboardHeader
          displayName={session.displayName}
          role={session.role}
          title="Tentang RQ"
        />
      ) : (
        <PublicHeader />
      )}

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {!isLoggedIn && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
          </Link>
        )}

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Tentang Rumah Qur&apos;an LHI</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Profil, visi-misi, dan struktur organisasi RQ LHI
            </p>
          </div>
          {canEdit && activeTab !== 'struktur' && (
            <Button asChild size="sm" variant="outline">
              <Link href="/tentang/edit">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit Konten
              </Link>
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b mb-7 -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1 min-w-fit">
            {TABS.map(({ value, label, icon: Icon }) => {
              const active = activeTab === value
              return (
                <Link
                  key={value}
                  href={value === 'struktur' ? '/tentang' : `/tentang?tab=${value}`}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {activeTab === 'struktur' && <StrukturTab />}
        {activeTab === 'visi-misi' && <VisiMisiTab about={about} />}
        {activeTab === 'sejarah'   && <SejarahTab about={about} />}
      </div>
    </div>
  )
}

/* ─── Tab: Struktur Organisasi ─────────────────────────────────────── */

function StrukturTab() {
  return (
    <div className="space-y-10 pb-6">
      {/* Kepala RQ */}
      <div className="flex flex-col items-center">
        <div className="rounded-2xl border-2 border-primary/30 bg-card shadow-sm px-8 py-5 text-center min-w-[220px]">
          <div className="inline-flex items-center justify-center rounded-xl p-2.5 mb-2 bg-amber-50 dark:bg-amber-950/50">
            <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">Pimpinan</p>
          <p className="font-bold text-base">Kepala RQ</p>
        </div>
        <div className="h-6 w-px bg-border" aria-hidden />
      </div>

      {/* Manajemen */}
      <Section title="Manajemen" subtitle="Tim manajemen langsung di bawah Kepala RQ">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RoleCard icon={Briefcase}   iconBg="bg-slate-50 dark:bg-slate-900" iconColor="text-slate-600 dark:text-slate-300" label="Kumik"    />
          <RoleCard icon={Users}       iconBg="bg-blue-50  dark:bg-blue-950/50" iconColor="text-blue-600  dark:text-blue-400"  label="SDM"      />
          <RoleCard icon={Calculator}  iconBg="bg-green-50 dark:bg-green-950/50" iconColor="text-green-600 dark:text-green-400" label="Bendahara"/>
        </div>
      </Section>

      {/* Koordinator dengan Guru */}
      <Section title="Koordinator Program" subtitle="Setiap koordinator membawahi para guru di program-nya">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KoordinatorWithSubordinate
            koor={{ label: 'Koor SD',     icon: GraduationCap, iconBg: 'bg-emerald-50 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400' }}
            sub={{  label: "Guru Qur'an SD" }}
          />
          <KoordinatorWithSubordinate
            koor={{ label: 'Koor SMP',    icon: GraduationCap, iconBg: 'bg-teal-50 dark:bg-teal-950/50',       iconColor: 'text-teal-600 dark:text-teal-400' }}
            sub={{  label: "Guru Qur'an SMP" }}
          />
          <KoordinatorWithSubordinate
            koor={{ label: 'Koor Ekstra', icon: GraduationCap, iconBg: 'bg-violet-50 dark:bg-violet-950/50',   iconColor: 'text-violet-600 dark:text-violet-400' }}
            sub={{  label: 'Guru Ekstra' }}
          />
        </div>
      </Section>

      {/* Divisi Pendukung */}
      <Section title="Divisi Pendukung" subtitle="Divisi-divisi penunjang operasional RQ">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RoleCard icon={Megaphone} iconBg="bg-pink-50    dark:bg-pink-950/50"   iconColor="text-pink-600    dark:text-pink-400"   label="Humas"        />
          <RoleCard icon={Wrench}    iconBg="bg-orange-50  dark:bg-orange-950/50" iconColor="text-orange-600  dark:text-orange-400" label="Div Training" />
          <RoleCard icon={UserPlus}  iconBg="bg-sky-50     dark:bg-sky-950/50"    iconColor="text-sky-600     dark:text-sky-400"    label="New Squad"    />
        </div>
      </Section>

      <p className="text-center text-xs text-muted-foreground pt-2">
        Seluruh divisi dan koordinator berada langsung di bawah koordinasi Kepala RQ.
      </p>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function RoleCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
}: {
  icon: typeof Network
  iconBg: string
  iconColor: string
  label: string
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
      <div className={`inline-flex items-center justify-center rounded-lg p-2 ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className="font-medium text-sm">{label}</p>
    </div>
  )
}

function KoordinatorWithSubordinate({
  koor,
  sub,
}: {
  koor: { label: string; icon: typeof Network; iconBg: string; iconColor: string }
  sub: { label: string }
}) {
  const Icon = koor.icon
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b">
        <div className={`inline-flex items-center justify-center rounded-lg p-2 ${koor.iconBg}`}>
          <Icon className={`h-4 w-4 ${koor.iconColor}`} />
        </div>
        <p className="font-medium text-sm">{koor.label}</p>
      </div>
      <div className="px-4 py-2.5 bg-muted/30 flex items-center gap-2">
        <span className="text-muted-foreground text-xs">└─</span>
        <p className="text-xs text-foreground/80">{sub.label}</p>
      </div>
    </div>
  )
}

/* ─── Tab: Visi & Misi ─────────────────────────────────────────────── */

function VisiMisiTab({ about }: { about: AboutRq | null }) {
  const hasContent = !!about && (about.vision || about.mission)
  return (
    <div className="space-y-5 pb-6">
      <ContentBlock
        title="Visi"
        icon={Sparkles}
        accent="bg-primary/10 text-primary"
        content={about?.vision}
        placeholder="Visi Rumah Qur'an LHI belum diisi."
      />
      <ContentBlock
        title="Misi"
        icon={Network}
        accent="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
        content={about?.mission}
        placeholder="Misi Rumah Qur'an LHI belum diisi."
      />
      {!hasContent && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Konten ini dapat dilengkapi oleh Kepala RQ atau Humas melalui menu Edit.
        </p>
      )}
    </div>
  )
}

/* ─── Tab: Sejarah ─────────────────────────────────────────────────── */

function SejarahTab({ about }: { about: AboutRq | null }) {
  return (
    <div className="pb-6">
      <ContentBlock
        title="Sejarah Rumah Qur'an LHI"
        icon={History}
        accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
        content={about?.history}
        placeholder="Sejarah Rumah Qur'an LHI belum diisi."
      />
      {!about?.history && (
        <p className="text-xs text-muted-foreground text-center pt-4">
          Konten ini dapat dilengkapi oleh Kepala RQ atau Humas melalui menu Edit.
        </p>
      )}
    </div>
  )
}

function ContentBlock({
  title,
  icon: Icon,
  accent,
  content,
  placeholder,
}: {
  title: string
  icon: typeof Network
  accent: string
  content: string | undefined
  placeholder: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`inline-flex items-center justify-center rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-base">{title}</h2>
      </div>
      {content ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">{content}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">{placeholder}</p>
      )}
    </div>
  )
}
