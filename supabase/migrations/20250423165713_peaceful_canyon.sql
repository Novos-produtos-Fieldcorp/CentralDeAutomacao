/*
  # Add Database Indexes for Improved Performance

  1. New Indexes
    - Combined index for company_id and funcao filtering
    - Index for data_cadastro sorting
    - Index for st_cadastro filtering
    
  2. Purpose
    - Improve query performance for large datasets
    - Optimize filtering and sorting operations
    - Reduce database load when retrieving motoristas
*/

-- Add combined index for company_id and funcao filtering
CREATE INDEX IF NOT EXISTS idx_motorista_company_funcao 
ON public.motorista (company_id, funcao);

-- Add index for data_cadastro sorting
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro 
ON public.motorista (data_cadastro DESC);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_motorista_st_cadastro 
ON public.motorista (st_cadastro);