import { AppShell } from '@/components/layout/AppShell'

/**
 * Sisi pengurus modul ujian.
 *
 * Dikelompokkan dalam route group supaya /ujian dan /ujian/rekap tetap
 * berupa halaman publik tanpa sidebar, sementara kelola/ajukan/riwayat/penguji
 * di bawahnya memakai kerangka aplikasi yang sama dengan menu lain.
 */
export default function UjianPengurusLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
