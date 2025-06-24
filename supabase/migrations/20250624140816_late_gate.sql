/*
  # Add resumo_access column to company table

  1. New Column
    - Add resumo_access column to company table
    - Set default value to FALSE
    
  2. Purpose
    - Control access to the Resumos em Grupo feature
    - Allow admins to enable/disable this feature per company
*/

-- Add resumo_access column to company table if it doesn't exist
ALTER TABLE public.company
ADD COLUMN IF NOT EXISTS resumo_access BOOLEAN DEFAULT FALSE;

-- Add comment explaining the purpose of this column
COMMENT ON COLUMN public.company.resumo_access IS 'Controls access to the Resumos em Grupo feature';