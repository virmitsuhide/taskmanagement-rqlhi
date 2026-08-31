import type { ReactNode } from 'react'
import { Lora, Playfair_Display } from 'next/font/google'
import { TeacherShell } from '@/components/layout/TeacherShell'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

// Auth guard untuk /guru/* dilakukan oleh proxy.ts.
// /guru/login dikecualikan dari guard.
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    // Dulu kelas ini juga memuat 'theme-light', yang memaku portal guru ke mode
    // terang. Dilepas: ThemeProvider di layout akar sudah melayani seluruh
    // aplikasi, jadi satu kelas itulah satu-satunya alasan portal ini tertinggal.
    <div
      className={`${lora.variable} ${playfair.variable} bg-background text-foreground`}
      style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
    >
      <TeacherShell>{children}</TeacherShell>
    </div>
  )
}
