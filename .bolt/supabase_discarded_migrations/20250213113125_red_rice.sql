/*
  # Add Checklist Items Structure

  1. New Tables
    - `checklist_item_template`
      - Template for checklist items (weekly/monthly)
    - `checklist_item_category`
      - Categories for grouping checklist items
    - `checklist_item`
      - Individual checklist items
    - `checklist_item_response`
      - Responses for each checklist item

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users

  3. Changes
    - Add relationships between checklist items and responses
    - Add status constraints and validations
*/

-- Create checklist_item_template table
CREATE TABLE IF NOT EXISTS checklist_item_template (
  template_id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_weekly boolean NOT NULL DEFAULT false,
  is_monthly boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create checklist_item_category table
CREATE TABLE IF NOT EXISTS checklist_item_category (
  category_id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  template_id bigint REFERENCES checklist_item_template(template_id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0
);

-- Create checklist_item table
CREATE TABLE IF NOT EXISTS checklist_item (
  item_id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  category_id bigint REFERENCES checklist_item_category(category_id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  requires_photo boolean NOT NULL DEFAULT false,
  requires_observation boolean NOT NULL DEFAULT false
);

-- Create checklist_item_response table
CREATE TABLE IF NOT EXISTS checklist_item_response (
  response_id bigserial PRIMARY KEY,
  checklist_id bigint REFERENCES checklist(checklist_id) ON DELETE CASCADE,
  item_id bigint REFERENCES checklist_item(item_id) ON DELETE CASCADE,
  status_id numeric REFERENCES status_item(status_id),
  observation text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_checklist_item_category ON checklist_item(category_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_category_template ON checklist_item_category(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_response_checklist ON checklist_item_response(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_response_item ON checklist_item_response(item_id);

-- Enable Row Level Security
ALTER TABLE checklist_item_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_item_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_item_response ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on checklist_item_template"
  ON checklist_item_template FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access for authenticated users on checklist_item_category"
  ON checklist_item_category FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access for authenticated users on checklist_item"
  ON checklist_item FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow full access for authenticated users on checklist_item_response"
  ON checklist_item_response FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON checklist_item_template TO authenticated;
GRANT SELECT ON checklist_item_category TO authenticated;
GRANT SELECT ON checklist_item TO authenticated;
GRANT ALL ON checklist_item_response TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert weekly checklist template
INSERT INTO checklist_item_template (name, description, is_weekly, is_monthly)
VALUES ('Checklist Semanal', 'Verificação semanal de itens do veículo', true, false);

-- Get the weekly template ID
DO $$
DECLARE
  v_weekly_template_id bigint;
BEGIN
  SELECT template_id INTO v_weekly_template_id
  FROM checklist_item_template
  WHERE name = 'Checklist Semanal'
  LIMIT 1;

  -- Insert weekly categories and items
  -- Pneus
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação dos Pneus', 'Inspeção dos pneus e componentes relacionados', v_weekly_template_id, 1)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Pressão dos pneus', 'Verificar a pressão de todos os pneus', 1, true),
      ('Desgaste da banda de rodagem', 'Verificar o desgaste dos pneus', 2, true),
      ('Alinhamento visual', 'Verificar alinhamento dos pneus', 3, true),
      ('Condição dos pneus reserva', 'Verificar estado do estepe', 4, true)
  ) AS items(name, description, order_index, requires_photo);

  -- Fluidos
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação dos Fluidos', 'Inspeção dos níveis de fluidos do veículo', v_weekly_template_id, 2)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Nível do óleo do motor', 'Verificar nível do óleo', 1, true),
      ('Nível do líquido de arrefecimento', 'Verificar nível do radiador', 2, true),
      ('Nível do fluido de freio', 'Verificar nível do fluido de freio', 3, true),
      ('Nível do fluido da direção hidráulica', 'Verificar nível da direção', 4, true),
      ('Nível do líquido do limpador', 'Verificar água do para-brisa', 5, false)
  ) AS items(name, description, order_index, requires_photo);

  -- Luzes
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação das Luzes', 'Inspeção do sistema de iluminação', v_weekly_template_id, 3)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Faróis baixo e alto', 'Verificar funcionamento dos faróis', 1, false),
      ('Lanternas', 'Verificar funcionamento das lanternas', 2, false),
      ('Luzes de freio', 'Verificar luzes de freio', 3, false),
      ('Setas direcionais', 'Verificar setas', 4, false),
      ('Luzes de emergência', 'Verificar pisca-alerta', 5, false),
      ('Luz da placa', 'Verificar iluminação da placa', 6, false)
  ) AS items(name, description, order_index, requires_photo);

  -- Componentes Básicos
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação dos Componentes Básicos', 'Inspeção de componentes essenciais', v_weekly_template_id, 4)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Limpadores de para-brisa', 'Verificar funcionamento das palhetas', 1, false),
      ('Freios', 'Verificar funcionamento dos freios', 2, true),
      ('Buzina', 'Verificar funcionamento da buzina', 3, false),
      ('Cinto de segurança', 'Verificar estado dos cintos', 4, true),
      ('Espelhos retrovisores', 'Verificar estado dos espelhos', 5, true)
  ) AS items(name, description, order_index, requires_photo);
END $$;

-- Insert monthly checklist template
INSERT INTO checklist_item_template (name, description, is_weekly, is_monthly)
VALUES ('Checklist Mensal', 'Verificação mensal completa do veículo', false, true);

-- Get the monthly template ID
DO $$
DECLARE
  v_monthly_template_id bigint;
BEGIN
  SELECT template_id INTO v_monthly_template_id
  FROM checklist_item_template
  WHERE name = 'Checklist Mensal'
  LIMIT 1;

  -- Insert monthly categories and items
  -- Motor
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação do Motor', 'Inspeção detalhada do motor e componentes', v_monthly_template_id, 1)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo, requires_observation)
  SELECT name, description, category_id, order_index, requires_photo, requires_observation
  FROM category CROSS JOIN (
    VALUES 
      ('Correias', 'Verificar estado das correias', 1, true, true),
      ('Mangueiras', 'Verificar estado das mangueiras', 2, true, true),
      ('Filtro de ar', 'Verificar condição do filtro', 3, true, false),
      ('Filtro de óleo', 'Verificar condição do filtro', 4, true, false),
      ('Sistema de escapamento', 'Verificar estado do escapamento', 5, true, true),
      ('Bateria', 'Verificar terminais e carga', 6, true, true)
  ) AS items(name, description, order_index, requires_photo, requires_observation);

  -- Transmissão
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação da Transmissão', 'Inspeção do sistema de transmissão', v_monthly_template_id, 2)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo, requires_observation)
  SELECT name, description, category_id, order_index, requires_photo, requires_observation
  FROM category CROSS JOIN (
    VALUES 
      ('Nível do óleo da transmissão', 'Verificar nível do óleo', 1, true, false),
      ('Embreagem', 'Verificar funcionamento', 2, false, true),
      ('Ruídos anormais', 'Verificar presença de ruídos', 3, false, true),
      ('Vazamentos', 'Verificar presença de vazamentos', 4, true, true)
  ) AS items(name, description, order_index, requires_photo, requires_observation);

  -- Sistema de Freios
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação do Sistema de Freios', 'Inspeção completa do sistema de frenagem', v_monthly_template_id, 3)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo, requires_observation)
  SELECT name, description, category_id, order_index, requires_photo, requires_observation
  FROM category CROSS JOIN (
    VALUES 
      ('Pastilhas de freio', 'Verificar desgaste', 1, true, true),
      ('Discos de freio', 'Verificar estado', 2, true, true),
      ('Tambores', 'Verificar condição', 3, true, true),
      ('Cabos', 'Verificar estado dos cabos', 4, true, false),
      ('Mangueiras do sistema', 'Verificar estado das mangueiras', 5, true, true)
  ) AS items(name, description, order_index, requires_photo, requires_observation);

  -- Suspensão
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação da Suspensão', 'Inspeção dos componentes da suspensão', v_monthly_template_id, 4)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo, requires_observation)
  SELECT name, description, category_id, order_index, requires_photo, requires_observation
  FROM category CROSS JOIN (
    VALUES 
      ('Amortecedores', 'Verificar estado', 1, true, true),
      ('Molas', 'Verificar condição', 2, true, true),
      ('Buchas', 'Verificar desgaste', 3, true, true),
      ('Terminais de direção', 'Verificar folgas', 4, true, true),
      ('Pivôs', 'Verificar estado', 5, true, true)
  ) AS items(name, description, order_index, requires_photo, requires_observation);

  -- Carroceria
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação da Carroceria', 'Inspeção da estrutura e acabamento', v_monthly_template_id, 5)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo, requires_observation)
  SELECT name, description, category_id, order_index, requires_photo, requires_observation
  FROM category CROSS JOIN (
    VALUES 
      ('Portas', 'Verificar fechaduras e dobradiças', 1, true, true),
      ('Vedações', 'Verificar borrachas e vedantes', 2, true, true),
      ('Estrutura do baú/carroceria', 'Verificar estado geral', 3, true, true),
      ('Condição da pintura', 'Verificar estado da pintura', 4, true, true),
      ('Pontos de oxidação', 'Verificar presença de ferrugem', 5, true, true)
  ) AS items(name, description, order_index, requires_photo, requires_observation);

  -- Documentação
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Verificação dos Documentos', 'Conferência da documentação obrigatória', v_monthly_template_id, 6)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo, requires_observation)
  SELECT name, description, category_id, order_index, requires_photo, requires_observation
  FROM category CROSS JOIN (
    VALUES 
      ('Licenciamento', 'Verificar validade', 1, true, false),
      ('Seguro', 'Verificar vigência', 2, true, false),
      ('Documentação do veículo', 'Verificar documentos', 3, true, false),
      ('Cartão de abastecimento', 'Verificar validade', 4, true, false),
      ('Cartão de pedágio', 'Verificar créditos/validade', 5, true, false)
  ) AS items(name, description, order_index, requires_photo, requires_observation);
END $$;