/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Bawaan Next.js 1 MB. Foto profil diperkecil di peramban sebelum dikirim
      // (lib/profil/kompres-foto.ts); batas ini jaring pengaman bila kompresi
      // tidak berjalan. Server tetap menolak foto di atas 2 MB (MAX_PHOTO_BYTES).
      bodySizeLimit: '4mb',
    },
  },
  images: {
    // Next 16 menolak gambar remote yang host-nya teresolusi ke IP privat
    // (perlindungan SSRF). DNS jaringan kantor menjawab *.supabase.co dengan
    // alamat IPv6 lokal (fd00:…), sehingga di server dev SEMUA thumbnail
    // Supabase ditolak 400 — yang tampil hanya sisa cache lama. Dilonggarkan
    // HANYA saat development; di produksi perlindungannya tetap berlaku.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
