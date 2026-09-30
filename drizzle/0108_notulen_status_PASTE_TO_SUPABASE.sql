-- ============================================================
-- Rapat: status notulen Draf / Terbit
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • meetings.notulen_status    — 'draf' | 'terbit' (bawaan 'draf')
--   • meetings.notulen_terbit_at — kapan notulen diterbitkan (opsional)
--   • meetings.notulen_terbit_by — siapa yang menerbitkan (users.id, opsional)
--
-- Isi awal: rapat yang SUDAH punya minimal satu poin notulen langsung dianggap
-- 'terbit' (notulen_terbit_at = updated_at, atau created_at bila kosong),
-- supaya notulen lama tidak tiba-tiba terlihat belum selesai. Isi awal ini
-- hanya dijalankan sekali, saat kolom notulen_status pertama kali dibuat —
-- menjalankan ulang file ini tidak menimpa draf yang dibuat sesudahnya.
--
-- Status ini tidak mengubah siapa yang boleh melihat notulen.
-- Aplikasi tetap berjalan sebelum file ini dijalankan (kolom dibaca opsional).
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'notulen_status'
  ) THEN
    ALTER TABLE public.meetings ADD COLUMN notulen_status text NOT NULL DEFAULT 'draf';
    ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS notulen_terbit_at timestamptz;

    -- Isi awal (sekali saja): notulen yang sudah berisi poin → terbit.
    UPDATE public.meetings m
       SET notulen_status = 'terbit',
           notulen_terbit_at = COALESCE(m.updated_at, m.created_at)
     WHERE EXISTS (SELECT 1 FROM public.agenda_items a WHERE a.meeting_id = m.id);
  END IF;
END $$;

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS notulen_terbit_at timestamptz;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS notulen_terbit_by uuid
  REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_notulen_status_check') THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_notulen_status_check CHECK (notulen_status IN ('draf', 'terbit'));
  END IF;
END $$;

COMMIT;

-- Cek cepat (opsional):
-- SELECT notulen_status, count(*) FROM meetings WHERE deleted_at IS NULL GROUP BY 1;

-- Muat ulang cache skema PostgREST supaya kolom baru langsung terbaca.
NOTIFY pgrst, 'reload schema';
