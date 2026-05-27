import { AppShell } from '@/components/layout/AppShell'

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
