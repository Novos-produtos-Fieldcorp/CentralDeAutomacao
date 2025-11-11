-- Migration: Add calculo_um_por_dia flag to company table
-- Date: 2025-11-11
-- Purpose: Enable alternative km calculation method (inter-day vs intra-day)

-- Add the column with default value false
ALTER TABLE company 
ADD COLUMN IF NOT EXISTS calculo_um_por_dia boolean DEFAULT false;

-- Backfill any NULL values to false (safety measure)
UPDATE company 
SET calculo_um_por_dia = false 
WHERE calculo_um_por_dia IS NULL;

-- Optional: Add comment to document the column purpose
COMMENT ON COLUMN company.calculo_um_por_dia IS 
'Flag que alterna o método de cálculo de km rodados:
- FALSE (padrão): Calcula diferença entre primeira e última leitura do mesmo dia (intra-day)
- TRUE: Calcula diferença entre leitura de hoje e leitura de ontem (inter-day)';
