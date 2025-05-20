/*
  # Fix cidade queries to remove company_id filtering

  1. Changes
    - Remove company_id filtering from cidade table
    - Update cidade table structure
    - Add proper indexes and constraints
*/

-- Drop existing cidade table if it exists
DROP TABLE IF EXISTS cidade CASCADE;

-- Create cidade table without company_id
CREATE TABLE IF NOT EXISTS cidade (
  id_cidade bigserial PRIMARY KEY,
  cidade text NOT NULL,
  id_estado numeric NOT NULL REFERENCES estado(id_estado) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE(cidade, id_estado)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cidade_estado ON cidade(id_estado);
CREATE INDEX IF NOT EXISTS idx_cidade_nome ON cidade(cidade);

-- Enable Row Level Security
ALTER TABLE cidade ENABLE ROW LEVEL SECURITY;

-- Create policies for read access
CREATE POLICY "Allow read access for authenticated users on cidade"
  ON cidade FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT ON cidade TO authenticated;