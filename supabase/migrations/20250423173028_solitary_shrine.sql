/*
  # Add indexes for motorista queries

  1. New Indexes
    - Add index on motorista.company_id and funcao for faster filtering
    - Add index on motorista.data_cadastro for sorting
    - Add index on motorista.st_cadastro for status filtering
    - Add index on veiculo.motorista_id for faster joins

  2. Purpose
    - Improve query performance for the agregados list
    - Reduce statement timeout issues
    - Optimize sorting and filtering operations
*/

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_motorista_company_funcao ON motorista(company_id, funcao);
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro ON motorista(data_cadastro DESC);
CREATE INDEX IF NOT EXISTS idx_motorista_st_cadastro ON motorista(st_cadastro);
CREATE INDEX IF NOT EXISTS idx_veiculo_motorista_id ON veiculo(motorista_id);