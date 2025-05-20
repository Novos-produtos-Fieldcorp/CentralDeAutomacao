/*
  # Add Indexes for Hodometro Table Performance

  1. New Indexes
    - Add combined index on hodometro(company_id, data) for faster filtering
    - Add index on hodometro(data) for date range queries
    - Add index on hodometro(veiculo_id) for vehicle filtering
    - Add index on hodometro(motorista_id) for driver filtering
    
  2. Purpose
    - Improve query performance for hodometro listings
    - Optimize date range filtering
    - Speed up joins with motorista and veiculo tables
    - Reduce database load and prevent timeouts
*/

-- Create index for filtering hodometros by company and date
CREATE INDEX IF NOT EXISTS idx_hodometro_company_date 
ON public.hodometro(company_id, data DESC);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_hodometro_date 
ON public.hodometro(data DESC);

-- Create index for vehicle filtering
CREATE INDEX IF NOT EXISTS idx_hodometro_veiculo 
ON public.hodometro(veiculo_id);

-- Create index for driver filtering
CREATE INDEX IF NOT EXISTS idx_hodometro_motorista 
ON public.hodometro(motorista_id);

-- Add comments explaining the purpose of these indexes
COMMENT ON INDEX idx_hodometro_company_date IS 'Optimizes filtering hodometros by company_id and date';
COMMENT ON INDEX idx_hodometro_date IS 'Optimizes date range queries on hodometro table';
COMMENT ON INDEX idx_hodometro_veiculo IS 'Optimizes joins between hodometro and veiculo tables';
COMMENT ON INDEX idx_hodometro_motorista IS 'Optimizes joins between hodometro and motorista tables';