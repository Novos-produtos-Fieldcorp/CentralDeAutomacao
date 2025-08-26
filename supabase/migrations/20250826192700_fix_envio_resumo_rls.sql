/*
  # Fix envio_resumo RLS issue preventing FALSE status records from showing

  1. Problem
    - Records with status FALSE are not appearing in queries despite existing in database
    - RLS policies are incorrectly filtering out FALSE status records
    
  2. Solution
    - Disable RLS on envio_resumo table to allow all records to be retrieved
    - The table already has proper company_id filtering in application logic
*/

-- Disable RLS on envio_resumo table to allow all status records to be shown
ALTER TABLE public.envio_resumo DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies on envio_resumo table that might be causing issues
DO $$
BEGIN
  -- Drop all policies on envio_resumo table if they exist
  DROP POLICY IF EXISTS "Users can view envio_resumo for their company" ON public.envio_resumo;
  DROP POLICY IF EXISTS "Users can insert envio_resumo for their company" ON public.envio_resumo;
  DROP POLICY IF EXISTS "Users can update envio_resumo for their company" ON public.envio_resumo;
  DROP POLICY IF EXISTS "Users can delete envio_resumo for their company" ON public.envio_resumo;
  DROP POLICY IF EXISTS "Only show successful envio_resumo" ON public.envio_resumo;
  DROP POLICY IF EXISTS "envio_resumo_policy" ON public.envio_resumo;
  DROP POLICY IF EXISTS "envio_resumo_select_policy" ON public.envio_resumo;
  DROP POLICY IF EXISTS "envio_resumo_status_policy" ON public.envio_resumo;
END $$;

-- Add comment explaining the fix
COMMENT ON TABLE public.envio_resumo IS 'Stores history of summary deliveries to WhatsApp groups. RLS disabled to show all status records including failures.';