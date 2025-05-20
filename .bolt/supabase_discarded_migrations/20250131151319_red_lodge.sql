-- Create company table
CREATE TABLE IF NOT EXISTS company (
  company_id bigserial PRIMARY KEY,
  nome_company text NOT NULL,
  cnpj text UNIQUE NOT NULL,
  email text,
  telefone text,
  st_company boolean DEFAULT true,
  api_key text
);

-- Create cliente table
CREATE TABLE IF NOT EXISTS cliente (
  cliente_id bigserial PRIMARY KEY,
  nome text NOT NULL,
  cnpj text UNIQUE NOT NULL,
  email text,
  telefone text,
  st_cliente boolean DEFAULT true,
  company_id bigint REFERENCES company(company_id) ON DELETE CASCADE
);

-- Create motorista table
CREATE TABLE IF NOT EXISTS motorista (
  motorista_id bigserial PRIMARY KEY,
  nome text NOT NULL,
  cpf text UNIQUE NOT NULL,
  dt_nascimento date,
  genero text,
  telefone text,
  email text,
  funcao text NOT NULL CHECK (funcao IN ('Motorista', 'Agregado')),
  st_cadastro text NOT NULL CHECK (st_cadastro IN ('cadastrado', 'qualificado', 'documentacao', 'contrato_enviado', 'contratado', 'repescagem', 'rejeitado')),
  data_cadastro timestamptz DEFAULT now(),
  cliente_id bigint REFERENCES cliente(cliente_id) ON DELETE SET NULL,
  company_id bigint REFERENCES company(company_id) ON DELETE CASCADE
);

-- Create documento_motorista table
CREATE TABLE IF NOT EXISTS documento_motorista (
  id_documento_motorista bigserial PRIMARY KEY,
  foto_cnh text,
  nome_pai text,
  nome_mae text,
  nr_registro_cnh text,
  categoria_cnh text,
  validade_cnh date,
  foto_comprovante_residencia text,
  motorista_id bigint NOT NULL REFERENCES motorista(motorista_id) ON DELETE CASCADE
);

-- Create cidade table
CREATE TABLE IF NOT EXISTS cidade (
  id_cidade bigserial PRIMARY KEY,
  cidade text NOT NULL,
  estado text NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_motorista_funcao ON motorista(funcao);
CREATE INDEX IF NOT EXISTS idx_motorista_st_cadastro ON motorista(st_cadastro);
CREATE INDEX IF NOT EXISTS idx_motorista_cliente ON motorista(cliente_id);
CREATE INDEX IF NOT EXISTS idx_motorista_company ON motorista(company_id);
CREATE INDEX IF NOT EXISTS idx_cliente_company ON cliente(company_id);

-- Enable Row Level Security
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_motorista ENABLE ROW LEVEL SECURITY;
ALTER TABLE cidade ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow full access for authenticated users on company"
  ON company FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on cliente"
  ON cliente FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on motorista"
  ON motorista FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on documento_motorista"
  ON documento_motorista FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on cidade"
  ON cidade FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON company TO authenticated;
GRANT ALL ON cliente TO authenticated;
GRANT ALL ON motorista TO authenticated;
GRANT ALL ON documento_motorista TO authenticated;
GRANT ALL ON cidade TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert sample data
INSERT INTO company (nome_company, cnpj, email, telefone, st_company) VALUES
('FastShop', '12345678901234', 'contato@fastshop.com', '11999999999', true);

INSERT INTO cliente (nome, cnpj, email, telefone, st_cliente, company_id) VALUES
('FastShop SP', '12345678901234', 'sp@fastshop.com', '11999999999', true, 1),
('FastShop RJ', '12345678901235', 'rj@fastshop.com', '21999999999', true, 1);

INSERT INTO cidade (cidade, estado) VALUES
('São Paulo', 'SP'),
('Rio de Janeiro', 'RJ'),
('Guarulhos', 'SP'),
('Franco da Rocha', 'SP');

INSERT INTO motorista (nome, cpf, dt_nascimento, genero, telefone, email, funcao, st_cadastro, cliente_id, company_id) VALUES
('João Silva', '12345678901', '1990-01-01', 'M', '11999999999', 'joao@email.com', 'Motorista', 'contratado', 1, 1),
('Maria Santos', '12345678902', '1992-02-02', 'F', '11999999998', 'maria@email.com', 'Motorista', 'cadastrado', NULL, 1),
('José Oliveira', '12345678903', '1988-03-03', 'M', '11999999997', 'jose@email.com', 'Agregado', 'contratado', 2, 1);