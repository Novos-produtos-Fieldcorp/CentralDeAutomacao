-- Migration: add minuta_access to company
-- Created by automation on 2025-10-07

ALTER TABLE IF EXISTS public.company
ADD COLUMN IF NOT EXISTS minuta_access boolean DEFAULT false;

-- For safety, ensure existing rows have a value (should be defaulted already)
UPDATE public.company SET minuta_access = false WHERE minuta_access IS NULL;

-- Optional: add comment
COMMENT ON COLUMN public.company.minuta_access IS 'Access control flag to enable Minuta tab (boolean)';
