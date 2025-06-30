/*
  # Add Integration and Training Columns to Motorista Table

  1. New Columns
    - Add integracao boolean column to track integration status
    - Add integracao_data timestamp column to track integration date
    - Add treinamento boolean column to track training status
    - Add treinamento_data timestamp column to track training date
    
  2. Purpose
    - Track integration and training status for contracted drivers
    - Record when integration and training were completed
    - Support filtering and reporting on integration/training status
*/

-- Add integration columns to motorista table
ALTER TABLE public.motorista
ADD COLUMN IF NOT EXISTS integracao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS integracao_data TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add training columns to motorista table
ALTER TABLE public.motorista
ADD COLUMN IF NOT EXISTS treinamento BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS treinamento_data TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments explaining the purpose of these columns
COMMENT ON COLUMN public.motorista.integracao IS 'Indicates whether the driver has completed integration';
COMMENT ON COLUMN public.motorista.integracao_data IS 'Date when the driver completed integration';
COMMENT ON COLUMN public.motorista.treinamento IS 'Indicates whether the driver has completed training';
COMMENT ON COLUMN public.motorista.treinamento_data IS 'Date when the driver completed training';

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_motorista_integracao ON public.motorista(integracao);
CREATE INDEX IF NOT EXISTS idx_motorista_treinamento ON public.motorista(treinamento);