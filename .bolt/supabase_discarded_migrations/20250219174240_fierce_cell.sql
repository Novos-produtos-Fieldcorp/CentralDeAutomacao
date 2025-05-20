/*
  # Create checklist tables with all required columns

  1. New Tables
    - tipo_checklist: Defines checklist types (monthly/weekly)
    - checklist: Main checklist table with all required columns
    - foto_checklist: Stores photo URLs for checklists
  
  2. Changes
    - Drops existing tables if they exist to ensure clean slate
    - Creates all tables with proper relationships
    - Adds necessary indexes for performance
    - Enables RLS and creates policies
    - Inserts initial data for checklist types
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS foto_checklist CASCADE;
DROP TABLE IF EXISTS checklist CASCADE;
DROP TABLE IF EXISTS tipo_checklist CASCADE;

-- Create tipo_checklist table
CREATE TABLE tipo_checklist (
  id_tipo_checklist numeric PRIMARY KEY,
  tipo text NOT NULL
);

-- Create checklist table
CREATE TABLE checklist (
  checklist_id bigserial PRIMARY KEY,
  data date NOT NULL,
  hora time without time zone NOT NULL,
  quilometragem numeric,
  verificacao boolean DEFAULT false,
  observacoes text,
  id_tipo_checklist numeric NOT NULL REFERENCES tipo_checklist(id_tipo_checklist),
  motorista_id bigint NOT NULL REFERENCES motorista(motorista_id) ON UPDATE CASCADE ON DELETE CASCADE,
  veiculo_id bigint NOT NULL REFERENCES veiculo(veiculo_id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create foto_checklist table
CREATE TABLE foto_checklist (
  id_foto_checklist bigserial PRIMARY KEY,
  checklist_id bigint NOT NULL REFERENCES checklist(checklist_id) ON UPDATE CASCADE ON DELETE CASCADE,
  hodometro text,
  oleo text,
  bateria text,
  carrinho_carga text,
  dianteira text,
  traseira text,
  lateral_direita text,
  lateral_esquerda text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_checklist_tipo ON checklist(id_tipo_checklist);
CREATE INDEX idx_checklist_motorista ON checklist(motorista_id);
CREATE INDEX idx_checklist_veiculo ON checklist(veiculo_id);
CREATE INDEX idx_checklist_data ON checklist(data);
CREATE INDEX idx_checklist_verificacao ON checklist(verificacao);
CREATE INDEX idx_foto_checklist_checklist ON foto_checklist(checklist_id);

-- Enable Row Level Security
ALTER TABLE tipo_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE foto_checklist ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on tipo_checklist"
  ON tipo_checklist FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow full access for authenticated users on checklist"
  ON checklist FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on foto_checklist"
  ON foto_checklist FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON tipo_checklist TO authenticated;
GRANT ALL ON checklist TO authenticated;
GRANT ALL ON foto_checklist TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert checklist types
INSERT INTO tipo_checklist (id_tipo_checklist, tipo) VALUES
(1, 'Mensal'),
(2, 'Semanal');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_checklist_updated_at
  BEFORE UPDATE ON checklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();