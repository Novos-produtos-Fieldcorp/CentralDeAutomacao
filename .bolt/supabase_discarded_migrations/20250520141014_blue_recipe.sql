/*
  # Optimize Agregados Query Performance

  1. New Indexes
    - Add combined index on motorista(funcao, company_id) for faster filtering of agregados
    - Add index on end_motorista(id_motorista) for faster address lookups
    - Add index on veiculo(motorista_id, status_veiculo) for faster vehicle lookups
    - Add index on motorista(telefone) for phone searches
    
  2. Purpose
    - Improve query performance for agregados list view
    - Optimize joins between motorista, end_motorista, and veiculo tables
    - Speed up filtering by function, company, and status
    - Reduce database load and prevent statement timeouts
*/

-- Create index for filtering agregados by function and company
CREATE INDEX IF NOT EXISTS idx_motorista_funcao_company 
ON public.motorista(funcao, company_id);

-- Create index for address lookups
CREATE INDEX IF NOT EXISTS idx_end_motorista_id_motorista 
ON public.end_motorista(id_motorista);

-- Create index for vehicle lookups with status
CREATE INDEX IF NOT EXISTS idx_veiculo_motorista_status 
ON public.veiculo(motorista_id, status_veiculo);

-- Create index for phone searches
CREATE INDEX IF NOT EXISTS idx_motorista_telefone_search
ON public.motorista(telefone);

-- Add comments explaining the purpose of these indexes
COMMENT ON INDEX idx_motorista_funcao_company IS 'Optimizes filtering motoristas by function and company_id';
COMMENT ON INDEX idx_end_motorista_id_motorista IS 'Optimizes joins between motorista and end_motorista tables';
COMMENT ON INDEX idx_veiculo_motorista_status IS 'Optimizes joins between motorista and veiculo tables with status filter';
COMMENT ON INDEX idx_motorista_telefone_search IS 'Optimizes phone number searches';