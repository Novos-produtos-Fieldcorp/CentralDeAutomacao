/*
  # Add RG field to documento_motorista table

  1. Changes
    - Add nr_rg column to documento_motorista table
    - Add orgao_expedidor column to documento_motorista table
    - Add data_expedicao column to documento_motorista table
    - Add foto_rg column to store RG image URL
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add RG fields to documento_motorista table
ALTER TABLE documento_motorista 
ADD COLUMN IF NOT EXISTS nr_rg text;

ALTER TABLE documento_motorista 
ADD COLUMN IF NOT EXISTS orgao_expedidor text;

ALTER TABLE documento_motorista 
ADD COLUMN IF NOT EXISTS data_expedicao date;

ALTER TABLE documento_motorista 
ADD COLUMN IF NOT EXISTS foto_rg text;

-- Create index for nr_rg
CREATE INDEX IF NOT EXISTS idx_documento_motorista_rg 
ON documento_motorista(nr_rg);