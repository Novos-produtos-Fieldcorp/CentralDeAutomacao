/*
  # Add indexes for vehicle queries

  1. New Indexes
    - Combined index on veiculo(company_id, status_veiculo) for filtering
    - Index on veiculo(motorista_id) for joins
    - Index on motorista(company_id, st_cadastro) for filtering
    - Index on documento_veiculo(veiculo_id) for joins

  2. Purpose
    - Optimize queries in VeiculosAgregados component
    - Improve performance of joins between veiculo, motorista, and documento_veiculo
    - Speed up filtering by company_id and status_veiculo
*/

-- Create index for filtering vehicles by company and status
CREATE INDEX IF NOT EXISTS idx_veiculo_company_status 
ON veiculo(company_id, status_veiculo);

-- Create index for joining vehicles with motoristas
CREATE INDEX IF NOT EXISTS idx_veiculo_motorista 
ON veiculo(motorista_id);

-- Create index for filtering motoristas by company and status
CREATE INDEX IF NOT EXISTS idx_motorista_company_status 
ON motorista(company_id, st_cadastro);

-- Create index for joining documento_veiculo with veiculo
CREATE INDEX IF NOT EXISTS idx_documento_veiculo_veiculo 
ON documento_veiculo(veiculo_id);

-- Add comment explaining the purpose of these indexes
COMMENT ON INDEX idx_veiculo_company_status IS 'Optimizes filtering vehicles by company_id and status_veiculo';
COMMENT ON INDEX idx_veiculo_motorista IS 'Optimizes joins between veiculo and motorista tables';
COMMENT ON INDEX idx_motorista_company_status IS 'Optimizes filtering motoristas by company_id and st_cadastro';
COMMENT ON INDEX idx_documento_veiculo_veiculo IS 'Optimizes joins between documento_veiculo and veiculo tables';