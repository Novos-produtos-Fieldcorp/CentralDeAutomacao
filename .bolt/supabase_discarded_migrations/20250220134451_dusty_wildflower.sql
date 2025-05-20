/*
  # Update Checklist Templates

  1. Changes
    - Simplify weekly checklist items
    - Add photo requirements for monthly checklist items
    - Update status items and categories
    
  2. Security
    - Maintain existing RLS policies
    - Keep data integrity with foreign key constraints
*/

-- Reset checklist templates
TRUNCATE TABLE checklist_item CASCADE;
TRUNCATE TABLE checklist_item_category CASCADE;
TRUNCATE TABLE checklist_item_template CASCADE;

-- Insert weekly checklist template
INSERT INTO checklist_item_template (name, description, is_weekly, is_monthly)
VALUES ('Checklist Semanal', 'Verificação rápida dos itens críticos do veículo', true, false);

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
  -- Fluidos Essenciais
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Fluidos Essenciais', 'Verificação dos níveis críticos', v_weekly_template_id, 1)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Óleo do Motor', 'Verificar nível e aspecto', 1, false),
      ('Água do Radiador', 'Verificar nível do líquido', 2, false),
      ('Fluido de Freio', 'Verificar nível do reservatório', 3, false)
  ) AS items(name, description, order_index, requires_photo);

  -- Sistema de Freios
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Freios', 'Verificação do sistema de frenagem', v_weekly_template_id, 2)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Freio de Serviço', 'Testar funcionamento', 1, false),
      ('Freio de Estacionamento', 'Verificar eficiência', 2, false)
  ) AS items(name, description, order_index, requires_photo);

  -- Pneus
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Pneus', 'Inspeção visual dos pneus', v_weekly_template_id, 3)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Calibragem', 'Verificar pressão dos pneus', 1, false),
      ('Desgaste', 'Verificar condição da banda', 2, false)
  ) AS items(name, description, order_index, requires_photo);

  -- Iluminação Básica
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Iluminação', 'Verificação das luzes principais', v_weekly_template_id, 4)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Faróis', 'Verificar funcionamento', 1, false),
      ('Lanternas', 'Verificar funcionamento', 2, false),
      ('Setas', 'Verificar funcionamento', 3, false)
  ) AS items(name, description, order_index, requires_photo);
END $$;

-- Insert monthly checklist template
INSERT INTO checklist_item_template (name, description, is_weekly, is_monthly)
VALUES ('Checklist Mensal', 'Inspeção detalhada com registro fotográfico', false, true);

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
    VALUES ('Motor', 'Inspeção completa do motor', v_monthly_template_id, 1)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Correias', 'Verificar tensão e desgaste', 1, true),
      ('Mangueiras', 'Verificar estado e vazamentos', 2, true),
      ('Filtros', 'Verificar condição', 3, true),
      ('Bateria', 'Verificar terminais e carga', 4, true)
  ) AS items(name, description, order_index, requires_photo);

  -- Freios
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Sistema de Freios', 'Inspeção detalhada dos freios', v_monthly_template_id, 2)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Pastilhas', 'Verificar desgaste', 1, true),
      ('Discos', 'Verificar estado', 2, true),
      ('Tambores', 'Verificar condição', 3, true),
      ('Lonas', 'Verificar desgaste', 4, true)
  ) AS items(name, description, order_index, requires_photo);

  -- Suspensão
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Suspensão', 'Verificação do sistema de suspensão', v_monthly_template_id, 3)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Amortecedores', 'Verificar vazamentos e fixação', 1, true),
      ('Molas', 'Verificar estado e altura', 2, true),
      ('Buchas', 'Verificar folgas', 3, true),
      ('Terminais', 'Verificar folgas', 4, true)
  ) AS items(name, description, order_index, requires_photo);

  -- Pneus
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Pneus e Rodas', 'Inspeção detalhada dos pneus', v_monthly_template_id, 4)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Profundidade dos Sulcos', 'Medir e fotografar', 1, true),
      ('Alinhamento', 'Verificar desgaste irregular', 2, true),
      ('Balanceamento', 'Verificar vibrações', 3, true),
      ('Estepe', 'Verificar condições', 4, true)
  ) AS items(name, description, order_index, requires_photo);

  -- Carroceria
  WITH category AS (
    INSERT INTO checklist_item_category (name, description, template_id, order_index)
    VALUES ('Carroceria', 'Inspeção da estrutura', v_monthly_template_id, 5)
    RETURNING category_id
  )
  INSERT INTO checklist_item (name, description, category_id, order_index, requires_photo)
  SELECT name, description, category_id, order_index, requires_photo
  FROM category CROSS JOIN (
    VALUES 
      ('Estrutura do Baú', 'Verificar estado geral', 1, true),
      ('Portas', 'Verificar funcionamento', 2, true),
      ('Pintura', 'Verificar estado', 3, true),
      ('Vedações', 'Verificar borrachas', 4, true)
  ) AS items(name, description, order_index, requires_photo);
END $$;