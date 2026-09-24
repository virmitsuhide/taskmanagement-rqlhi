import { SetorRiyadhoh } from '@/components/riyadhoh/SetorRiyadhoh'

export default async function Page({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const { tanggal } = await searchParams
  return <SetorRiyadhoh jenis="tahfidz" diminta={tanggal} />
}
