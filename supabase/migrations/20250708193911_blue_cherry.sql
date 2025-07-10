/*
  # Fix Function Toggle in Motoristas List

  1. Changes
    - Add index on motorista.funcao column for faster filtering
    - Add comment explaining the purpose of this index
    
  2. Purpose
    - Improve performance when toggling between Motorista and Agregado functions
    - Optimize queries that filter by function
*/

-- Add index for function filtering
CREATE INDEX IF NOT EXISTS idx_motorista_funcao ON public.motorista(funcao);

-- Add comment explaining the purpose of this index
COMMENT ON INDEX idx_motorista_funcao IS 'Optimizes filtering and toggling between Motorista and Agregado functions';