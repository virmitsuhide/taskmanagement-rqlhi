import type { ReactNode } from 'react'
import { TeacherShell } from '@/components/layout/TeacherShell'


// Auth guard untuk /guru/* dilakukan oleh proxy.ts.
// /guru/login dikecualikan dari guard.
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    // Dulu kelas ini juga memuat 'theme-light', yang memaku portal guru ke mode
    // terang. Dilepas: ThemeProvider di layout akar sudah melayani seluruh
    // aplikasi, jadi satu kelas itulah satu-satunya alasan portal ini tertinggal.
    <div
      className={`portal-guru bg-background font-sans text-foreground`}
    >
      <TeacherShell>{children}</TeacherShell>
    </div>
  )
}
