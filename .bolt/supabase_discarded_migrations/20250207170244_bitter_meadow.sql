/*
  # Create Checklist Tables

  1. New Tables
    - `status_item` - Status options for checklist items
    - `acessorios_veiculos` - Vehicle accessories checklist
    - `componentes_gerais` - General components checklist
    - `farol_veiculo` - Vehicle lights checklist
    - `fluido_veiculo` - Vehicle fluids checklist

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Changes
    - Add foreign key constraints
    - Add indexes for better performance
*/

-- Create status_item table
CREATE TABLE IF NOT EXISTS status_item (
  status_id numeric PRIMARY KEY,
  status text NOT NULL
);

-- Create acessorios_veiculos table
CREATE TABLE IF NOT EXISTS acessorios_veiculos (
  id_acessorio bigserial PRIMARY KEY,
  pneu numeric REFERENCES status_item(status_id),
  pneu_ruim text,
  estepe numeric REFERENCES status_item(status_id),
  macaco_triangulo_chave_roda numeric REFERENCES status_item(status_id),
  extintor numeric REFERENCES status_item(status_id),
  cartao_combustivel numeric REFERENCES status_item(status_id),
  cadeado numeric REFERENCES status_item(status_id),
  chave_reserva numeric REFERENCES status_item(status_id),
  carrinho_carga numeric REFERENCES status_item(status_id),
  checklist_id bigint REFERENCES checklist(checklist_id),
  documento_veicular numeric REFERENCES status_item(status_id),
  manual_veiculo numeric REFERENCES status_item(status_id)
);

-- Create componentes_gerais table
CREATE TABLE IF NOT EXISTS componentes_gerais (
  id_componentes_gerais bigserial PRIMARY KEY,
  checklist_id bigint REFERENCES checklist(checklist_id),
  buzina numeric REFERENCES status_item(status_id),
  ar_condicionado numeric REFERENCES status_item(status_id),
  freio_estacionamento numeric REFERENCES status_item(status_id),
  pedal numeric REFERENCES status_item(status_id),
  retrovisor numeric REFERENCES status_item(status_id),
  parabrisa_dianteiro numeric REFERENCES status_item(status_id),
  limpador_parabrisa numeric REFERENCES status_item(status_id),
  vidros_laterais numeric REFERENCES status_item(status_id),
  bateria numeric REFERENCES status_item(status_id),
  banco numeric REFERENCES status_item(status_id),
  forro_interno numeric REFERENCES status_item(status_id),
  tampa_tanque numeric REFERENCES status_item(status_id),
  estrutura_bau numeric REFERENCES status_item(status_id),
  fechadura_porta numeric REFERENCES status_item(status_id),
  limpeza_interna numeric REFERENCES status_item(status_id),
  limpeza_externa numeric REFERENCES status_item(status_id),
  sistema_freio numeric REFERENCES status_item(status_id),
  tapete numeric REFERENCES status_item(status_id),
  cinto_seguranca numeric REFERENCES status_item(status_id)
);

-- Create farol_veiculo table
CREATE TABLE IF NOT EXISTS farol_veiculo (
  id_farol_veiculo bigserial PRIMARY KEY,
  checklist_id bigint REFERENCES checklist(checklist_id),
  dianteiro numeric REFERENCES status_item(status_id),
  auxiliar numeric REFERENCES status_item(status_id),
  pisca_dianteiro numeric REFERENCES status_item(status_id),
  pisca_traseiro numeric REFERENCES status_item(status_id),
  lanterna_traseira numeric REFERENCES status_item(status_id),
  luz_placa numeric REFERENCES status_item(status_id),
  luz_indicador_painel text
);

-- Create fluido_veiculo table
CREATE TABLE IF NOT EXISTS fluido_veiculo (
  id_fluido_veiculo bigserial PRIMARY KEY,
  checklist_id bigint REFERENCES checklist(checklist_id),
  agua_radiador numeric REFERENCES status_item(status_id),
  oleo_motor numeric REFERENCES status_item(status_id),
  oleo_hidraulico numeric REFERENCES status_item(status_id),
  fluido_freio numeric REFERENCES status_item(status_id),
  liq_arrefecimento numeric REFERENCES status_item(status_id),
  agua_parabrisa numeric REFERENCES status_item(status_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_acessorios_checklist ON acessorios_veiculos(checklist_id);
CREATE INDEX IF NOT EXISTS idx_componentes_checklist ON componentes_gerais(checklist_id);
CREATE INDEX IF NOT EXISTS idx_farol_checklist ON farol_veiculo(checklist_id);
CREATE INDEX IF NOT EXISTS idx_fluido_checklist ON fluido_veiculo(checklist_id);

-- Enable Row Level Security
ALTER TABLE status_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessorios_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE componentes_gerais ENABLE ROW LEVEL SECURITY;
ALTER TABLE farol_veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluido_veiculo ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on status_item"
  ON status_item FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow full access for authenticated users on acessorios_veiculos"
  ON acessorios_veiculos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on componentes_gerais"
  ON componentes_gerais FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on farol_veiculo"
  ON farol_veiculo FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on fluido_veiculo"
  ON fluido_veiculo FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON status_item TO authenticated;
GRANT ALL ON acessorios_veiculos TO authenticated;
GRANT ALL ON componentes_gerais TO authenticated;
GRANT ALL ON farol_veiculo TO authenticated;
GRANT ALL ON fluido_veiculo TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert status options
INSERT INTO status_item (status_id, status) VALUES
(1, 'OK'),
(2, 'Não OK'),
(3, 'N/A');