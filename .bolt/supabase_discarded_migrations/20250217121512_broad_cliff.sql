/*
  # Add vehicle document information
  
  1. New Fields
    - Add document fields to documento_veiculo table:
      - renavam
      - chassi
      - ipva_vencimento
      - licenciamento_status
      - ultima_vistoria
      - categoria
      - ano_modelo
      - restricoes
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Add new columns to documento_veiculo table
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS renavam text;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS chassi text;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS ipva_vencimento date;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS licenciamento_status text;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS ultima_vistoria date;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS ano_modelo text;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS restricoes text;

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_documento_veiculo_renavam ON documento_veiculo(renavam);
CREATE INDEX IF NOT EXISTS idx_documento_veiculo_chassi ON documento_veiculo(chassi);
CREATE INDEX IF NOT EXISTS idx_documento_veiculo_ipva ON documento_veiculo(ipva_vencimento);

-- Update existing policies
DROP POLICY IF EXISTS "Allow full access for authenticated users on documento_veiculo" ON documento_veiculo;
CREATE POLICY "Allow full access for authenticated users on documento_veiculo"
  ON documento_veiculo FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);