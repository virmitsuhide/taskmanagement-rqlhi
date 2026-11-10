-- ============================================================
-- Pembaruan Sistem — draf otomatis dari commit yang di-push
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • changelog.status       : 'draf' | 'terbit' (baris lama = 'terbit')
--   • changelog.commit_sha   : commit asal draf (unik — push ulang tidak dobel)
--   • changelog.commit_pesan : pesan commit asli, hanya tampil ke Kepala RQ
--
-- ── ALURNYA ─────────────────────────────────────────────────
--
--   git push ke master → webhook GitHub → /api/webhooks/github
--   → tiap commit feat/fix/perf (atau yang punya blok "Pembaruan:")
--     menjadi DRAF, pembaca bawaan: pengurus.
--   → Kepala RQ meninjau di /pembaruan, merapikan, lalu Terbitkan.
--
-- Draf tidak pernah terlihat oleh pembaca (getChangelog menyaring status).
-- ============================================================

ALTER TABLE changelog ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'terbit';
ALTER TABLE changelog ADD COLUMN IF NOT EXISTS commit_sha text;
ALTER TABLE changelog ADD COLUMN IF NOT EXISTS commit_pesan text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_status_sah') THEN
    ALTER TABLE changelog ADD CONSTRAINT changelog_status_sah CHECK (status IN ('draf', 'terbit'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_commit_sha_key') THEN
    ALTER TABLE changelog ADD CONSTRAINT changelog_commit_sha_key UNIQUE (commit_sha);
  END IF;
END $$;

-- Verifikasi (opsional):
-- SELECT status, count(*) FROM changelog GROUP BY status;
