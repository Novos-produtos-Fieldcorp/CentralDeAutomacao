/*
  # Add integration and training columns to motorista table

  1. New Columns
    - Add integration and training columns to motorista table
    - Add date columns to track when integration and training were completed
    
  2. Purpose
    - Track integration and training status for contracted drivers
    - Allow filtering and reporting on integration and training status
    - Support client requirements for driver onboarding
*/

-- Add integration columns to motorista table
ALTER TABLE public.motorista
ADD COLUMN IF NOT EXISTS integracao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS integracao_data DATE DEFAULT NULL;

-- Add training columns to motorista table
ALTER TABLE public.motorista
ADD COLUMN IF NOT EXISTS treinamento BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS treinamento_data DATE DEFAULT NULL;

-- Add comments explaining the purpose of these columns
COMMENT ON COLUMN public.motorista.integracao IS 'Indicates whether the driver has completed integration';
COMMENT ON COLUMN public.motorista.integracao_data IS 'Date when the driver completed integration';
COMMENT ON COLUMN public.motorista.treinamento IS 'Indicates whether the driver has completed training';
COMMENT ON COLUMN public.motorista.treinamento_data IS 'Date when the driver completed training';

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_motorista_integracao ON public.motorista(integracao);
CREATE INDEX IF NOT EXISTS idx_motorista_treinamento ON public.motorista(treinamento);

-- Create or replace the view for contratados with integration and training columns
CREATE OR REPLACE VIEW public.vw_contratados_completo AS
SELECT
  m.motorista_id,
  m.nome as nome_motorista,
  m.cpf,
  m.dt_nascimento,
  m.genero,
  m.telefone,
  m.email,
  m.funcao,
  m.origem_usuario,
  m.st_cadastro,
  m.autorizacao_lgpd,
  m.company_id,
  m.data_cadastro,
  m.cliente_id,
  m.conversation_id,
  m.integracao,
  m.integracao_data,
  m.treinamento,
  m.treinamento_data,
  em.nr_end,
  em.ds_complemento_end,
  em.st_end,
  em.id_end_motorista,
  l.logradouro,
  l.nr_cep,
  b.bairro as nome_bairro,
  c.cidade as nome_cidade,
  e.estado as nome_estado,
  e.sigla_estado,
  v.veiculo_id,
  v.placa,
  v.status_veiculo,
  v.marca,
  v.tipologia,
  v.ano,
  v.combustivel,
  v.peso,
  v.cubagem,
  v.possui_rastreador,
  v.marca_rastreador,
  v.cor,
  v.tipo,
  cl.cliente_id as cliente_id_rel,
  cl.nome as cliente_nome,
  gm.id as gr_motorista_id,
  gm.motivo as gr_motorista_motivo,
  ge.nome as empresa_motorista,
  gs.status as status_motorista
FROM
  motorista m
  LEFT JOIN end_motorista em ON em.id_motorista = m.motorista_id
  LEFT JOIN logradouro l ON l.id_logradouro = em.id_logradouro
  LEFT JOIN bairro b ON b.id_bairro = l.id_bairro
  LEFT JOIN cidade c ON c.id_cidade = b.id_cidade
  LEFT JOIN estado e ON e.id_estado = c.id_estado
  LEFT JOIN veiculo v ON v.motorista_id = m.motorista_id AND v.status_veiculo = true
  LEFT JOIN cliente cl ON cl.cliente_id = m.cliente_id
  LEFT JOIN gr_motorista gm ON gm.motorista_id = m.motorista_id
  LEFT JOIN gr_empresa ge ON ge.id = gm.empresa_id
  LEFT JOIN gr_status gs ON gs.id = gm.status_id
WHERE
  m.st_cadastro = 'contratado'::text;

-- Add comment explaining the purpose of this view
COMMENT ON VIEW public.vw_contratados_completo IS 'Provides a comprehensive view of contracted drivers with integration and training status';