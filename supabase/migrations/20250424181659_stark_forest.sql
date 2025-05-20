/*
  # Optimize Contractor Queries with Specialized Indexes

  1. New Indexes
    - Add combined index on motorista(company_id, st_cadastro) for faster filtering
    - Add index on motorista(nome) for name searches
    - Add index on motorista(cpf) for CPF searches
    - Add index on motorista(data_cadastro) for date sorting
    - Add index on motorista(cliente_id) for client filtering
    - Add combined index on veiculo(company_id, status_veiculo) for vehicle filtering

  2. Purpose
    - Significantly improve query performance for contractor lists
    - Optimize pagination with large datasets
    - Speed up filtering by status, name, CPF, and date
    - Reduce database load and prevent timeouts
*/

-- Create optimized indexes for contractor queries
CREATE INDEX IF NOT EXISTS idx_motorista_company_status 
ON public.motorista(company_id, st_cadastro);

-- Add index for name searches (case insensitive)
CREATE INDEX IF NOT EXISTS idx_motorista_nome_lower
ON public.motorista(lower(nome));

-- Add index for CPF searches
CREATE INDEX IF NOT EXISTS idx_motorista_cpf
ON public.motorista(cpf);

-- Add index for date sorting (descending for newest first)
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro_desc
ON public.motorista(data_cadastro DESC);

-- Add index for client filtering
CREATE INDEX IF NOT EXISTS idx_motorista_cliente
ON public.motorista(cliente_id);

-- Add combined index for vehicle status filtering
CREATE INDEX IF NOT EXISTS idx_veiculo_company_status
ON public.veiculo(company_id, status_veiculo);

-- Add comment explaining the purpose of these indexes
COMMENT ON INDEX idx_motorista_company_status IS 'Optimizes filtering contractors by company_id and status';
COMMENT ON INDEX idx_motorista_nome_lower IS 'Optimizes case-insensitive name searches';
COMMENT ON INDEX idx_motorista_cpf IS 'Optimizes CPF searches';
COMMENT ON INDEX idx_motorista_data_cadastro_desc IS 'Optimizes sorting by registration date (newest first)';
COMMENT ON INDEX idx_motorista_cliente IS 'Optimizes filtering by client';
COMMENT ON INDEX idx_veiculo_company_status IS 'Optimizes filtering vehicles by company and status';