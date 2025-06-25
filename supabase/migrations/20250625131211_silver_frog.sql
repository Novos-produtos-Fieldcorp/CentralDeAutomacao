/*
  # Update envio_resumo table to use boolean for status

  1. Changes
    - Modify status column in envio_resumo table to use boolean type
    - Update existing records to convert 'success' to true and 'error' to false
    
  2. Purpose
    - Simplify status representation
    - Make status consistent with other boolean flags in the database
    - Improve query performance for status filtering
*/

-- First create a temporary column
ALTER TABLE public.envio_resumo 
ADD COLUMN status_boolean BOOLEAN;

-- Update the temporary column based on the text status
UPDATE public.envio_resumo 
SET status_boolean = (status = 'success');

-- Drop the check constraint on the status column
ALTER TABLE public.envio_resumo 
DROP CONSTRAINT IF EXISTS envio_resumo_status_check;

-- Drop the old status column
ALTER TABLE public.envio_resumo 
DROP COLUMN status;

-- Rename the temporary column to status
ALTER TABLE public.envio_resumo 
RENAME COLUMN status_boolean TO status;

-- Add comment explaining the status column
COMMENT ON COLUMN public.envio_resumo.status IS 'true = success, false = error';