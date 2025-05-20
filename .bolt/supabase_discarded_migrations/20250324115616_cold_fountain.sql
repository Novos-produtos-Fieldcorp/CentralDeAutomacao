/*
  # Add Hodometro Table Structure

  1. New Table
    - `hodometro` - Table for storing odometer readings
      - Basic fields for reading data
      - Foreign key relationships
      - Company filtering support
      
  2. Security
    - Enable RLS
    - Add policies for company-based access
    - Grant appropriate permissions
*/

-- Create hodometro table
CREATE TABLE IF NOT EXISTS hodometro (
  id_hodometro bigserial PRIMARY KEY,
  data date NOT NULL,
  hora time without time zone NOT NULL,
  hod_informado double precision,
  hod_lido double precision,
  trip_lida double precision,
  km_rodado double precision,
  verificacao boolean DEFAULT false,
  comparacao_leitura boolean DEFAULT false,
  foto_hodometro text,
  motorista_id bigint NOT NULL REFERENCES motorista(motorista_id) ON UPDATE CASCADE ON DELETE CASCADE,
  veiculo_id bigint NOT NULL REFERENCES veiculo(veiculo_id) ON UPDATE CASCADE ON DELETE CASCADE,
  cliente_id bigint REFERENCES cliente(cliente_id) ON UPDATE CASCADE ON DELETE SET NULL,
  company_id bigint NOT NULL REFERENCES company(company_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hodometro_data ON hodometro(data);
CREATE INDEX IF NOT EXISTS idx_hodometro_motorista ON hodometro(motorista_id);
CREATE INDEX IF NOT EXISTS idx_hodometro_veiculo ON hodometro(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_hodometro_cliente ON hodometro(cliente_id);
CREATE INDEX IF NOT EXISTS idx_hodometro_company ON hodometro(company_id);

-- Enable Row Level Security
ALTER TABLE hodometro ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view hodometros from their company"
  ON hodometro FOR SELECT
  TO authenticated
  USING (company_id = auth.jwt()->>'company_id'::bigint);

CREATE POLICY "Users can insert hodometros into their company"
  ON hodometro FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.jwt()->>'company_id'::bigint);

CREATE POLICY "Users can update hodometros from their company"
  ON hodometro FOR UPDATE
  TO authenticated
  USING (company_id = auth.jwt()->>'company_id'::bigint)
  WITH CHECK (company_id = auth.jwt()->>'company_id'::bigint);

CREATE POLICY "Users can delete hodometros from their company"
  ON hodometro FOR DELETE
  TO authenticated
  USING (company_id = auth.jwt()->>'company_id'::bigint);

-- Grant permissions
GRANT ALL ON hodometro TO authenticated;
GRANT USAGE ON SEQUENCE hodometro_id_hodometro_seq TO authenticated;