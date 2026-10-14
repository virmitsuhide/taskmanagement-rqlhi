import { AppShell } from '@/components/layout/AppShell'

// Membungkus /backup dan /backup/pulihkan dengan sidebar & bilah atas.
// Unduhan /backup/[domain] adalah route handler — tidak terkena layout ini.
export default function BackupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
