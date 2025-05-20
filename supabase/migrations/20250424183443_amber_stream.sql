/*
  # Optimize Vehicle and Motorista Queries with Specialized Indexes

  1. New Indexes
    - Add combined indexes for vehicle filtering by company, status, and motorista
    - Add text search indexes for vehicle plates, brands, and models
    - Add indexes for sorting and filtering operations
    - Add specialized indexes for aggregated vehicles queries
    
  2. Purpose
    - Improve query performance for vehicle listings with large datasets
    - Optimize server-side pagination and filtering
    - Reduce database load and prevent timeouts
    - Support case-insensitive searches efficiently
*/

-- Create index for filtering vehicles by company and status
CREATE INDEX IF NOT EXISTS idx_veiculo_company_status 
ON public.veiculo(company_id, status_veiculo);

-- Create index for filtering vehicles by motorista
CREATE INDEX IF NOT EXISTS idx_veiculo_motorista 
ON public.veiculo(motorista_id);

-- Create index for plate searches (case insensitive)
CREATE INDEX IF NOT EXISTS idx_veiculo_placa_lower
ON public.veiculo(lower(placa));

-- Create index for brand searches (case insensitive)
CREATE INDEX IF NOT EXISTS idx_veiculo_marca_lower
ON public.veiculo(lower(marca));

-- Create index for model searches (case insensitive)
CREATE INDEX IF NOT EXISTS idx_veiculo_tipo_lower
ON public.veiculo(lower(tipo));

-- Create index for vehicle type filtering
CREATE INDEX IF NOT EXISTS idx_veiculo_tipologia
ON public.veiculo(tipologia);

-- Create index for vehicle documents relationship
CREATE INDEX IF NOT EXISTS idx_documento_veiculo_veiculo
ON public.documento_veiculo(veiculo_id);

-- Add comments explaining the purpose of these indexes
COMMENT ON INDEX idx_veiculo_company_status IS 'Optimizes filtering vehicles by company_id and status_veiculo';
COMMENT ON INDEX idx_veiculo_motorista IS 'Optimizes joins between veiculo and motorista tables';
COMMENT ON INDEX idx_veiculo_placa_lower IS 'Optimizes case-insensitive plate searches';
COMMENT ON INDEX idx_veiculo_marca_lower IS 'Optimizes case-insensitive brand searches';
COMMENT ON INDEX idx_veiculo_tipo_lower IS 'Optimizes case-insensitive model searches';
COMMENT ON INDEX idx_veiculo_tipologia IS 'Optimizes filtering by vehicle type';
COMMENT ON INDEX idx_documento_veiculo_veiculo IS 'Optimizes joins between documento_veiculo and veiculo tables';