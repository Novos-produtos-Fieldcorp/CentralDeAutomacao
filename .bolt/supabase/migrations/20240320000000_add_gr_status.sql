ALTER TABLE motorista DROP CONSTRAINT IF EXISTS motorista_st_cadastro_check;
ALTER TABLE motorista ADD CONSTRAINT motorista_st_cadastro_check 
  CHECK (st_cadastro IN ('cadastrado', 'qualificado', 'documentacao', 'gr', 'contrato_enviado', 'contratado', 'repescagem', 'rejeitado')); 