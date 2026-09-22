import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Salinan project pengajuan-ujian yang sudah diporting ke modul /ujian.
    // Ditinggal sementara sebagai rujukan; bukan bagian aplikasi ini.
    "pengajuan-ujian/**",
    // Perkakas asisten AI (skill & skrip validasinya) — bukan kode aplikasi,
    // tidak ikut di-commit, dan memakai require() CommonJS yang ditolak
    // aturan Next. Diabaikan supaya `npm run lint` lokal sama dengan CI.
    ".claude/**",
    "agent-skills/**",
  ]),
]);

export default eslintConfig;
