/*
  # Add sample data for fleet management system

  1. Sample Data
    - Add sample companies
    - Add sample clients
    - Add sample drivers and aggregates
    - Add sample documents
    - Add sample addresses

  2. Changes
    - Insert initial data for testing
    - Ensure proper relationships between tables
*/

-- Insert sample company if not exists
INSERT INTO company (nome_company, cnpj, email, telefone, st_company)
VALUES ('FastShop', '12345678901234', 'contato@fastshop.com', '11999999999', true)
ON CONFLICT (cnpj) DO NOTHING;

-- Insert sample clients
INSERT INTO cliente (nome, cnpj, email, telefone, st_cliente, company_id)
VALUES 
  ('FastShop SP', '12345678901234', 'sp@fastshop.com', '11999999999', true, 
    (SELECT company_id FROM company WHERE cnpj = '12345678901234')),
  ('FastShop RJ', '12345678901235', 'rj@fastshop.com', '21999999999', true,
    (SELECT company_id FROM company WHERE cnpj = '12345678901234'))
ON CONFLICT (cnpj) DO NOTHING;

-- Insert sample drivers and aggregates
DO $$
DECLARE
  v_company_id bigint;
  v_motorista_id bigint;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE cnpj = '12345678901234';

  -- Insert motoristas
  INSERT INTO motorista (nome, cpf, dt_nascimento, genero, telefone, email, funcao, st_cadastro, company_id)
  VALUES 
    ('João Silva', '12345678901', '1990-01-01', 'M', '11999999999', 'joao@email.com', 'Motorista', 'contratado', v_company_id),
    ('Maria Santos', '12345678902', '1992-02-02', 'F', '11999999998', 'maria@email.com', 'Motorista', 'cadastrado', v_company_id),
    ('José Oliveira', '12345678903', '1988-03-03', 'M', '11999999997', 'jose@email.com', 'Agregado', 'contratado', v_company_id),
    ('Ana Souza', '12345678904', '1995-04-04', 'F', '11999999996', 'ana@email.com', 'Motorista', 'documentacao', v_company_id),
    ('Carlos Lima', '12345678905', '1987-05-05', 'M', '11999999995', 'carlos@email.com', 'Agregado', 'qualificado', v_company_id)
  ON CONFLICT (cpf) DO NOTHING
  RETURNING motorista_id INTO v_motorista_id;

  -- Insert sample documents for the first motorista
  IF v_motorista_id IS NOT NULL THEN
    INSERT INTO documento_motorista (
      foto_cnh,
      nome_pai,
      nome_mae,
      nr_registro_cnh,
      categoria_cnh,
      validade_cnh,
      foto_comprovante_residencia,
      motorista_id
    )
    VALUES (
      'https://example.com/cnh.jpg',
      'José Silva',
      'Maria Silva',
      '123456789',
      'D',
      '2025-01-01',
      'https://example.com/comprovante.jpg',
      v_motorista_id
    );
  END IF;
END $$;

-- Insert sample addresses
DO $$
DECLARE
  v_motorista_id bigint;
  v_id_logradouro bigint;
  v_id_bairro bigint;
  v_id_cidade bigint;
BEGIN
  -- Get São Paulo city ID
  SELECT id_cidade INTO v_id_cidade 
  FROM cidade 
  WHERE cidade = 'São Paulo' 
  LIMIT 1;

  -- Create bairro if not exists
  INSERT INTO bairro (bairro, id_cidade)
  VALUES ('Centro', v_id_cidade)
  RETURNING id_bairro INTO v_id_bairro;

  -- Create logradouro
  INSERT INTO logradouro (logradouro, nr_cep, id_bairro)
  VALUES ('Avenida Paulista', '01310-100', v_id_bairro)
  RETURNING id_logradouro INTO v_id_logradouro;

  -- Get first motorista
  SELECT motorista_id INTO v_motorista_id
  FROM motorista
  WHERE cpf = '12345678901'
  LIMIT 1;

  -- Create end_motorista
  IF v_motorista_id IS NOT NULL AND v_id_logradouro IS NOT NULL THEN
    INSERT INTO end_motorista (nr_end, ds_complemento_end, id_motorista, id_logradouro)
    VALUES (100, 'Apto 50', v_motorista_id, v_id_logradouro);
  END IF;
END $$;