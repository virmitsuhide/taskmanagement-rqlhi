import { redirect } from 'next/navigation'

/** Pencatatan per transaksi diganti Isian Bulanan (2026-11); tautan lama tetap jalan. */
export default async function TransaksiPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const { periode } = await searchParams
  redirect(`/keuangan/isian${periode ? `?periode=${periode}` : ''}`)
}
