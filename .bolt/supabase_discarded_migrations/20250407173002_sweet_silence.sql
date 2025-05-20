/*
  # Create Address Tables Migration

  1. New Tables
    - This migration creates tables for the address hierarchy:
      - estado (State)
      - cidade (City)
      - bairro (Neighborhood)
      - logradouro (Street)
      - end_motorista (Driver Address)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Grant appropriate permissions
*/

-- Create estado table if it doesn't exist
CREATE TABLE IF NOT EXISTS estado (
  id_estado numeric PRIMARY KEY,
  sigla_estado text,
  estado text
);

-- Create cidade table if it doesn't exist
CREATE TABLE IF NOT EXISTS cidade (
  id_cidade bigserial PRIMARY KEY,
  cidade text NOT NULL,
  id_estado numeric NOT NULL REFERENCES estado(id_estado) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create bairro table if it doesn't exist
CREATE TABLE IF NOT EXISTS bairro (
  id_bairro bigserial PRIMARY KEY,
  bairro text NOT NULL,
  id_cidade bigint NOT NULL REFERENCES cidade(id_cidade) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create logradouro table if it doesn't exist
CREATE TABLE IF NOT EXISTS logradouro (
  id_logradouro bigserial PRIMARY KEY,
  logradouro text,
  nr_cep text,
  id_bairro bigint REFERENCES bairro(id_bairro) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create end_motorista table if it doesn't exist
CREATE TABLE IF NOT EXISTS end_motorista (
  id_end_motorista bigserial PRIMARY KEY,
  nr_end numeric,
  ds_complemento_end text,
  st_end boolean DEFAULT true,
  id_motorista bigint NOT NULL REFERENCES motorista(motorista_id) ON UPDATE CASCADE ON DELETE CASCADE,
  id_logradouro bigint NOT NULL REFERENCES logradouro(id_logradouro) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT end_motorista_id_end_motorista_key UNIQUE (id_end_motorista)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cidade_estado ON cidade(id_estado);
CREATE INDEX IF NOT EXISTS idx_bairro_cidade ON bairro(id_cidade);
CREATE INDEX IF NOT EXISTS idx_logradouro_bairro ON logradouro(id_bairro);
CREATE INDEX IF NOT EXISTS idx_end_motorista_motorista ON end_motorista(id_motorista);
CREATE INDEX IF NOT EXISTS idx_end_motorista_logradouro ON end_motorista(id_logradouro);
CREATE INDEX IF NOT EXISTS idx_logradouro_cep ON logradouro(nr_cep);

-- Enable Row Level Security
ALTER TABLE estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE cidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE bairro ENABLE ROW LEVEL SECURITY;
ALTER TABLE logradouro ENABLE ROW LEVEL SECURITY;
ALTER TABLE end_motorista ENABLE ROW LEVEL SECURITY;

-- Create policies for estado
CREATE POLICY "Allow read access for authenticated users on estado"
  ON estado FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for cidade
CREATE POLICY "Allow read access for authenticated users on cidade"
  ON cidade FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for bairro
CREATE POLICY "Allow read access for authenticated users on bairro"
  ON bairro FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for logradouro
CREATE POLICY "Allow read access for authenticated users on logradouro"
  ON logradouro FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for end_motorista
CREATE POLICY "Allow read access for authenticated users on end_motorista"
  ON end_motorista FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated users on end_motorista"
  ON end_motorista FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users on end_motorista"
  ON end_motorista FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions to authenticated users
GRANT SELECT ON estado TO authenticated;
GRANT SELECT ON cidade TO authenticated;
GRANT SELECT ON bairro TO authenticated;
GRANT SELECT ON logradouro TO authenticated;
GRANT ALL ON end_motorista TO authenticated;

-- Insert Brazilian states if they don't exist
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
(53, 'DF', 'Distrito Federal')
ON CONFLICT (id_estado) DO NOTHING;