/*
  # Optimize Motorista Queries with Specialized Indexes

  1. New Indexes
    - Add combined indexes for motorista filtering by company, status, and client
    - Add text search indexes for motorista names and CPF
    - Add indexes for sorting and filtering operations
    - Add specialized indexes for aggregated motorista queries
    
  2. Purpose
    - Improve query performance for motorista listings with large datasets
    - Optimize server-side pagination and filtering
    - Reduce database load and prevent timeouts
    - Support case-insensitive searches efficiently
*/

-- Create index for filtering motoristas by company and status
CREATE INDEX IF NOT EXISTS idx_motorista_company_status 
ON public.motorista(company_id, st_cadastro);

-- Create index for filtering by client
CREATE INDEX IF NOT EXISTS idx_motorista_cliente 
ON public.motorista(cliente_id);

-- Create index for name searches (case insensitive)
CREATE INDEX IF NOT EXISTS idx_motorista_nome_lower
ON public.motorista(lower(nome));

-- Create index for CPF searches
CREATE INDEX IF NOT EXISTS idx_motorista_cpf
ON public.motorista(cpf);

-- Create index for function filtering
CREATE INDEX IF NOT EXISTS idx_motorista_funcao
ON public.motorista(funcao);

-- Create index for date sorting
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro
ON public.motorista(data_cadastro DESC);

-- Create index for phone searches
CREATE INDEX IF NOT EXISTS idx_motorista_telefone
ON public.motorista(telefone);

-- Create index for motorista documents relationship
CREATE INDEX IF NOT EXISTS idx_documento_motorista_motorista
ON public.documento_motorista(motorista_id);

-- Add comments explaining the purpose of these indexes
COMMENT ON INDEX idx_motorista_company_status IS 'Optimizes filtering motoristas by company_id and st_cadastro';
COMMENT ON INDEX idx_motorista_cliente IS 'Optimizes filtering by cliente_id';
COMMENT ON INDEX idx_motorista_nome_lower IS 'Optimizes case-insensitive name searches';
COMMENT ON INDEX idx_motorista_cpf IS 'Optimizes CPF searches';
COMMENT ON INDEX idx_motorista_funcao IS 'Optimizes filtering by function (Motorista/Agregado)';
COMMENT ON INDEX idx_motorista_data_cadastro IS 'Optimizes sorting by registration date';
COMMENT ON INDEX idx_motorista_telefone IS 'Optimizes phone number searches';
COMMENT ON INDEX idx_documento_motorista_motorista IS 'Optimizes joins between documento_motorista and motorista tables';