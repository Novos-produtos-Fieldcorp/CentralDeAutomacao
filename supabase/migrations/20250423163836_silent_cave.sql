/*
  # Add indexes for motorista table performance

  1. New Indexes
    - Combined index on company_id and funcao for filtering
    - Index on data_cadastro for sorting
    - Index on st_cadastro for status filtering
    
  2. Purpose
    - Improve query performance for the agregados list view
    - Reduce statement timeout issues
    - Optimize filtering and sorting operations
*/

-- Add combined index for company_id and funcao filtering
CREATE INDEX IF NOT EXISTS idx_motorista_company_funcao 
ON motorista (company_id, funcao);

-- Add index for data_cadastro sorting
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro 
ON motorista (data_cadastro DESC);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_motorista_st_cadastro 
ON motorista (st_cadastro);