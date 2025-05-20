/*
  # Address System Tables

  1. New Tables
    - `estado` (State)
      - `id_estado` (numeric, primary key)
      - `sigla_estado` (text, state abbreviation)
      - `estado` (text, state name)
    
    - `cidade` (City)
      - `id_cidade` (bigserial, primary key)
      - `cidade` (text, city name)
      - `id_estado` (numeric, foreign key to estado)
    
    - `bairro` (Neighborhood)
      - `id_bairro` (bigserial, primary key)
      - `bairro` (text, neighborhood name)
      - `id_cidade` (bigint, foreign key to cidade)
    
    - `logradouro` (Street)
      - `id_logradouro` (bigserial, primary key)
      - `logradouro` (text, street name)
      - `nr_cep` (text, postal code)
      - `id_bairro` (bigint, foreign key to bairro)
    
    - `end_motorista` (Driver Address)
      - `id_end_motorista` (bigserial, primary key)
      - `nr_end` (numeric, address number)
      - `ds_complemento_end` (text, address complement)
      - `st_end` (boolean, address status)
      - `id_motorista` (bigint, foreign key to motorista)
      - `id_logradouro` (bigint, foreign key to logradouro)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read data
    - Add policies for service role to manage data

  3. Relationships
    - Cascading updates and deletes for all foreign key relationships
    - Proper indexing on foreign keys and commonly queried fields
*/

-- Create estado table
CREATE TABLE IF NOT EXISTS estado (
  id_estado numeric PRIMARY KEY,
  sigla_estado text,
  estado text
);

-- Create cidade table
CREATE TABLE IF NOT EXISTS cidade (
  id_cidade bigserial PRIMARY KEY,
  cidade text NOT NULL,
  id_estado numeric NOT NULL REFERENCES estado(id_estado) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create bairro table
CREATE TABLE IF NOT EXISTS bairro (
  id_bairro bigserial PRIMARY KEY,
  bairro text NOT NULL,
  id_cidade bigint NOT NULL REFERENCES cidade(id_cidade) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create logradouro table
CREATE TABLE IF NOT EXISTS logradouro (
  id_logradouro bigserial PRIMARY KEY,
  logradouro text,
  nr_cep text,
  id_bairro bigint REFERENCES bairro(id_bairro) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create end_motorista table
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