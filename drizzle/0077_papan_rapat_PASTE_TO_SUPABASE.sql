-- ============================================================
-- Papan Rapat — status hasil rapat per poin notulen
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah (semua di agenda_items, tanpa tabel baru):
--   • butuh_biaya            → dicentang notulis pada poin Approval
--   • approval_status        → 'menunggu' | 'disetujui' | 'ditolak'
--   • approval_by / _at      → siapa & kapan memutuskan
--   • biaya / biaya_catatan  → diisi bendahara untuk approval yang disetujui
--   • biaya_by / _at
--   • selesai_by / _at       → "Tandai selesai" pada Perlu Diskusi Lanjut
--   • diarsipkan_by / _at    → dikeluarkan dari papan aktif (data tetap ada)
--
-- ── KENAPA KOLOM DI agenda_items, BUKAN TABEL BARU ──────────
--
-- Satu poin notulen punya tepat satu status papan; tabel terpisah hanya akan
-- berisi relasi 1:1 yang harus dijaga sinkron. Kolom yang tidak relevan untuk
-- tag-nya dibiarkan NULL.
--
-- ── PRASYARAT DI KODE ───────────────────────────────────────
--
-- Sebelum migrasi ini, menyunting rapat MENGHAPUS seluruh agenda lalu
-- menyisipkannya ulang — id-nya berganti setiap kali disimpan. Status papan
-- yang menempel di baris itu akan ikut hilang. updateMeetingAction kini
-- memperbarui baris yang ada menurut id-nya dan hanya menghapus poin yang
-- memang dibuang dari notulen.
-- ============================================================

ALTER TABLE "agenda_items"
  ADD COLUMN IF NOT EXISTS "butuh_biaya"     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approval_status" text,
  ADD COLUMN IF NOT EXISTS "approval_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "approval_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "biaya"           integer,
  ADD COLUMN IF NOT EXISTS "biaya_catatan"   text,
  ADD COLUMN IF NOT EXISTS "biaya_by"        uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "biaya_at"        timestamptz,
  ADD COLUMN IF NOT EXISTS "selesai_by"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "selesai_at"      timestamptz,
  ADD COLUMN IF NOT EXISTS "diarsipkan_by"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "diarsipkan_at"   timestamptz;

DO $$ BEGIN
  ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_approval_status_cek"
    CHECK ("approval_status" IS NULL OR "approval_status" IN ('menunggu', 'disetujui', 'ditolak'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_biaya_cek"
    CHECK ("biaya" IS NULL OR "biaya" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Approval lama belum punya status: anggap semuanya masih menunggu keputusan.
UPDATE "agenda_items" SET "approval_status" = 'menunggu'
  WHERE "tag" = 'approval' AND "approval_status" IS NULL;

-- Papan aktif menyaring poin yang belum diarsipkan menurut tag.
CREATE INDEX IF NOT EXISTS "agenda_items_papan_idx"
  ON "agenda_items" ("tag") WHERE "diarsipkan_at" IS NULL;
