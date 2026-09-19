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
