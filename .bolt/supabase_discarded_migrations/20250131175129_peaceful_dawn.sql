/*
  # Cities and States Schema Update

  1. New Tables
    - `estado`
      - `id_estado` (numeric, primary key)
      - `sigla_estado` (text)
      - `estado` (text)
    - `cidade`
      - `id_cidade` (bigserial, primary key)
      - `cidade` (text, not null)
      - `id_estado` (numeric, foreign key)

  2. Changes
    - Drop existing cidade table
    - Create new tables with proper relationships
    - Add sample data for states and cities

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Drop existing cidade table if it exists
DROP TABLE IF EXISTS cidade CASCADE;

-- Create estado table
CREATE TABLE IF NOT EXISTS estado (
  id_estado numeric PRIMARY KEY,
  sigla_estado text,
  estado text
);

-- Create cidade table with proper foreign key
CREATE TABLE IF NOT EXISTS cidade (
  id_cidade bigserial PRIMARY KEY,
  cidade text NOT NULL,
  id_estado numeric NOT NULL REFERENCES estado(id_estado) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cidade_estado ON cidade(id_estado);

-- Enable Row Level Security
ALTER TABLE estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE cidade ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on estado"
  ON estado FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access for authenticated users on cidade"
  ON cidade FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT ON estado TO authenticated;
GRANT SELECT ON cidade TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert sample data for states
INSERT INTO estado (id_estado, sigla_estado, estado) VALUES
(11, 'RO', 'Rondônia'),
(12, 'AC', 'Acre'),
(13, 'AM', 'Amazonas'),
(14, 'RR', 'Roraima'),
(15, 'PA', 'Pará'),
(16, 'AP', 'Amapá'),
(17, 'TO', 'Tocantins'),
(21, 'MA', 'Maranhão'),
(22, 'PI', 'Piauí'),
(23, 'CE', 'Ceará'),
(24, 'RN', 'Rio Grande do Norte'),
(25, 'PB', 'Paraíba'),
(26, 'PE', 'Pernambuco'),
(27, 'AL', 'Alagoas'),
(28, 'SE', 'Sergipe'),
(29, 'BA', 'Bahia'),
(31, 'MG', 'Minas Gerais'),
(32, 'ES', 'Espírito Santo'),
(33, 'RJ', 'Rio de Janeiro'),
(35, 'SP', 'São Paulo'),
(41, 'PR', 'Paraná'),
(42, 'SC', 'Santa Catarina'),
(43, 'RS', 'Rio Grande do Sul'),
(50, 'MS', 'Mato Grosso do Sul'),
(51, 'MT', 'Mato Grosso'),
(52, 'GO', 'Goiás'),
(53, 'DF', 'Distrito Federal');

-- Insert sample cities
INSERT INTO cidade (cidade, id_estado) VALUES
('São Paulo', 35),
('Guarulhos', 35),
('Campinas', 35),
('Santos', 35),
('Rio de Janeiro', 33),
('Niterói', 33),
('Belo Horizonte', 31),
('Uberlândia', 31),
('Curitiba', 41),
('Londrina', 41),
('Porto Alegre', 43),
('Caxias do Sul', 43),
('Salvador', 29),
('Feira de Santana', 29),
('Recife', 26),
('Olinda', 26),
('Fortaleza', 23),
('Caucaia', 23),
('Manaus', 13),
('Parintins', 13),
('Brasília', 53),
('Goiânia', 52);