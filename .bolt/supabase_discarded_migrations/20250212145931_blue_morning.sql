-- Create tipo_checklist table
CREATE TABLE IF NOT EXISTS tipo_checklist (
  id_tipo_checklist numeric PRIMARY KEY,
  tipo text NOT NULL
);

-- Create checklist table
CREATE TABLE IF NOT EXISTS checklist (
  checklist_id bigserial PRIMARY KEY,
  data date NOT NULL,
  hora time without time zone NOT NULL,
  quilometragem numeric,
  verificacao boolean DEFAULT false,
  observacoes text,
  id_tipo_checklist numeric NOT NULL REFERENCES tipo_checklist(id_tipo_checklist),
  motorista_id bigint NOT NULL REFERENCES motorista(motorista_id) ON UPDATE CASCADE ON DELETE CASCADE,
  veiculo_id bigint NOT NULL REFERENCES veiculo(veiculo_id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create foto_checklist table
CREATE TABLE IF NOT EXISTS foto_checklist (
  id_foto_checklist bigserial PRIMARY KEY,
  checklist_id bigint NOT NULL REFERENCES checklist(checklist_id) ON UPDATE CASCADE ON DELETE CASCADE,
  hodometro text,
  oleo text,
  bateria text,
  carrinho_carga text,
  dianteira text,
  traseira text,
  lateral_direita text,
  lateral_esquerda text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_checklist_tipo ON checklist(id_tipo_checklist);
CREATE INDEX IF NOT EXISTS idx_checklist_motorista ON checklist(motorista_id);
CREATE INDEX IF NOT EXISTS idx_checklist_veiculo ON checklist(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_data ON checklist(data);
CREATE INDEX IF NOT EXISTS idx_foto_checklist_checklist ON foto_checklist(checklist_id);

-- Enable Row Level Security
ALTER TABLE tipo_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE foto_checklist ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on tipo_checklist"
  ON tipo_checklist FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow full access for authenticated users on checklist"
  ON checklist FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access for authenticated users on foto_checklist"
  ON foto_checklist FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON tipo_checklist TO authenticated;
GRANT ALL ON checklist TO authenticated;
GRANT ALL ON foto_checklist TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert checklist types
INSERT INTO tipo_checklist (id_tipo_checklist, tipo) VALUES
(1, 'Mensal'),
(2, 'Semanal');

-- Insert sample data
DO $$
DECLARE
  v_motorista_id bigint;
  v_veiculo_id bigint;
  v_checklist_id bigint;
BEGIN
  -- Get first motorista and veiculo
  SELECT motorista_id INTO v_motorista_id FROM motorista LIMIT 1;
  SELECT veiculo_id INTO v_veiculo_id FROM veiculo LIMIT 1;

  IF v_motorista_id IS NOT NULL AND v_veiculo_id IS NOT NULL THEN
    -- Insert sample checklist
    INSERT INTO checklist (
      data,
      hora,
      quilometragem,
      verificacao,
      observacoes,
      id_tipo_checklist,
      motorista_id,
      veiculo_id
    )
    VALUES (
      CURRENT_DATE,
      CURRENT_TIME,
      50000,
      true,
      'Checklist de teste',
      1,
      v_motorista_id,
      v_veiculo_id
    )
    RETURNING checklist_id INTO v_checklist_id;

    -- Insert sample photos
    IF v_checklist_id IS NOT NULL THEN
      INSERT INTO foto_checklist (
        checklist_id,
        hodometro,
        oleo,
        bateria,
        carrinho_carga,
        dianteira,
        traseira,
        lateral_direita,
        lateral_esquerda
      )
      VALUES (
        v_checklist_id,
        'https://example.com/hodometro.jpg',
        'https://example.com/oleo.jpg',
        'https://example.com/bateria.jpg',
        'https://example.com/carrinho.jpg',
        'https://example.com/dianteira.jpg',
        'https://example.com/traseira.jpg',
        'https://example.com/lateral_direita.jpg',
        'https://example.com/lateral_esquerda.jpg'
      );
    END IF;
  END IF;
END $$;