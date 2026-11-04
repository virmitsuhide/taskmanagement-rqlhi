/**
 * Pesan yang dikembalikan server action saat sesi sudah tidak berlaku.
 *
 * Satu teks untuk semua action supaya formulir bisa mengenalinya
 * (lihat components/formulir/PesanGalat.tsx) dan menawarkan jalan masuk lagi
 * TANPA meninggalkan halaman — isian yang sudah diketik tetap di layar.
 *
 * Sejak sesi diperpanjang selama dipakai (proxy.ts), pesan ini hanya muncul
 * bila akun tidak dibuka lebih dari 7 hari, atau dinonaktifkan admin.
 */
export const SESI_BERAKHIR = 'Sesi Anda sudah berakhir. Silakan masuk lagi.'

export function apakahSesiBerakhir(pesan: string | null | undefined): boolean {
  return Boolean(pesan && pesan.startsWith('Sesi Anda sudah berakhir'))
}
