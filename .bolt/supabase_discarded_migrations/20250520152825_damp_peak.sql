/*
  # Optimize Motorista and Vehicle Queries with Specialized Indexes

  1. New Indexes
    - Add combined indexes for motorista filtering by company, status, and client
    - Add text search indexes for motorista names and documents
    - Add indexes for sorting and filtering operations
    - Add specialized indexes for aggregated queries
    
  2. Purpose
    - Improve query performance for motorista listings with large datasets
    - Optimize server-side pagination and filtering
    - Reduce database load and prevent timeouts
    - Support case-insensitive searches efficiently
*/

-- Create combined index for common filtering operations
CREATE INDEX IF NOT EXISTS idx_motorista_company_status_client 
ON public.motorista(company_id, st_cadastro, cliente_id);

-- Create index for function-based filtering
CREATE INDEX IF NOT EXISTS idx_motorista_funcao 
ON public.motorista(funcao);

-- Create index for sorting by registration date
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro 
ON public.motorista(data_cadastro DESC);

-- Create index for name searches (case insensitive)
CREATE INDEX IF NOT EXISTS idx_motorista_nome_lower
ON public.motorista(lower(nome));

-- Create index for CPF searches
CREATE INDEX IF NOT EXISTS idx_motorista_cpf
ON public.motorista(cpf);

-- Create index for phone searches
CREATE INDEX IF NOT EXISTS idx_motorista_telefone
ON public.motorista(telefone);

-- Create index for vehicle relationship
CREATE INDEX IF NOT EXISTS idx_veiculo_motorista 
ON public.veiculo(motorista_id);

-- Create index for vehicle company and status
CREATE INDEX IF NOT EXISTS idx_veiculo_company_status 
ON public.veiculo(company_id, status_veiculo);

-- Create index for address relationship
CREATE INDEX IF NOT EXISTS idx_end_motorista_id
ON public.end_motorista(id_motorista);

-- Add comments explaining the purpose of these indexes
COMMENT ON INDEX idx_motorista_company_status_client IS 'Optimizes filtering motoristas by company_id, st_cadastro, and cliente_id';
COMMENT ON INDEX idx_motorista_funcao IS 'Optimizes filtering by motorista function (Motorista/Agregado)';
COMMENT ON INDEX idx_motorista_data_cadastro IS 'Optimizes sorting by registration date';
COMMENT ON INDEX idx_motorista_nome_lower IS 'Optimizes case-insensitive name searches';
COMMENT ON INDEX idx_motorista_cpf IS 'Optimizes CPF searches';
COMMENT ON INDEX idx_motorista_telefone IS 'Optimizes phone number searches';
COMMENT ON INDEX idx_veiculo_motorista IS 'Optimizes joins between veiculo and motorista tables';
COMMENT ON INDEX idx_veiculo_company_status IS 'Optimizes filtering vehicles by company_id and status';
COMMENT ON INDEX idx_end_motorista_id IS 'Optimizes joins between end_motorista and motorista tables';