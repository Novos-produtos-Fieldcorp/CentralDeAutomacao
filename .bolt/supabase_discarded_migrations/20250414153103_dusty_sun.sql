/*
  # Create end_cliente table for client addresses

  1. New Table
    - `end_cliente` - Table for storing client addresses
      - id_end_cliente: Primary key
      - nr_end: Address number
      - ds_complemento_end: Address complement
      - id_cliente: Foreign key to cliente table
      - id_logradouro: Foreign key to logradouro table
      
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Grant appropriate permissions
*/

-- Create end_cliente table
CREATE TABLE IF NOT EXISTS end_cliente (
  id_end_cliente bigserial PRIMARY KEY,
  nr_end numeric,
  ds_complemento_end text,
  id_cliente bigint NOT NULL REFERENCES cliente(cliente_id) ON UPDATE CASCADE ON DELETE CASCADE,
  id_logradouro bigint NOT NULL REFERENCES logradouro(id_logradouro) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_end_cliente_cliente ON end_cliente(id_cliente);
CREATE INDEX IF NOT EXISTS idx_end_cliente_logradouro ON end_cliente(id_logradouro);

-- Enable Row Level Security
ALTER TABLE end_cliente ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on end_cliente"
  ON end_cliente FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated users on end_cliente"
  ON end_cliente FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users on end_cliente"
  ON end_cliente FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users on end_cliente"
  ON end_cliente FOR DELETE
  TO authenticated
  USING (true);

-- Grant permissions
GRANT ALL ON end_cliente TO authenticated;
GRANT USAGE ON SEQUENCE end_cliente_id_end_cliente_seq TO authenticated;