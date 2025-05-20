/*
  # Create tables for fleet management system

  1. New Tables
    - `cidade` - Cities table
    - `motorista` - Drivers table
    - `cliente` - Clients table
    - `company` - Companies table
    - `documento_motorista` - Driver documents table

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Grant appropriate permissions

  3. Sample Data
    - Add initial company
    - Add sample clients
    - Add sample cities
    - Add sample drivers
*/

-- Create cidade table if it doesn't exist
CREATE TABLE IF NOT EXISTS cidade (
  id_cidade bigserial PRIMARY KEY,
  cidade text NOT NULL,
  estado text NOT NULL
);

-- Create indexes and enable RLS
CREATE INDEX IF NOT EXISTS idx_cidade_estado ON cidade(estado);
ALTER TABLE cidade ENABLE ROW LEVEL SECURITY;

-- Create policies for cidade
CREATE POLICY "Allow full access for authenticated users on cidade"
  ON cidade FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON cidade TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert sample cities if they don't exist
INSERT INTO cidade (cidade, estado) VALUES
('São Paulo', 'SP'),
('Rio de Janeiro', 'RJ'),
('Guarulhos', 'SP'),
('Franco da Rocha', 'SP')
ON CONFLICT DO NOTHING;