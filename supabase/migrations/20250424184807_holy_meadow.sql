/*
  # Create Unique Index for Documento Veiculo

  1. New Index
    - Create a unique index on documento_veiculo(veiculo_id) to ensure one-to-one relationship
    
  2. Purpose
    - Ensure each vehicle has at most one document record
    - Prevent duplicate document entries for the same vehicle
    - Optimize document lookups by vehicle ID
*/

-- Create unique index for documento_veiculo to ensure one-to-one relationship
CREATE UNIQUE INDEX IF NOT EXISTS documento_veiculo_veiculo_id_unique
ON public.documento_veiculo(veiculo_id);

-- Add comment explaining the purpose of this index
COMMENT ON INDEX documento_veiculo_veiculo_id_unique IS 'Ensures one-to-one relationship between vehicles and their documents';