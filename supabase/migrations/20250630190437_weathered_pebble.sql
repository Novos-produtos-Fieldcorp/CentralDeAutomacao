/*
  # Add Integration and Training Columns to Contratados View

  1. Changes
    - Create or replace the vw_contratados_completo view
    - Include integration and training columns in the view
    
  2. Purpose
    - Support the display of integration and training status in the Contratados page
    - Allow filtering and reporting on integration and training status
*/

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
  da.id_ajudante,
  da.nome as nome_ajudante,
  da.cpf as cpf_ajudante,
  da.telefone as telefone_ajudante,
  da.genero as genero_ajudante,
  da.comprovante_residencia,
  rg.nr_rg,
  rg.data_emissao,
  rg.orgao_expedidor,
  rg.filiacao,
  rg.foto_rg,
  cnh.nr_registro,
  cnh.categoria,
  cnh.nome_pai,
  cnh.nome_mae,
  cnh.foto_cnh,
  ea.nr_end as nr_end_ajudante,
  ea.ds_complemento_end as ds_complemento_end_ajudante,
  ea.st_end as st_end_ajudante,
  l2.logradouro as logradouro_ajudante,
  l2.nr_cep as cep_ajudante,
  b2.bairro as bairro_ajudante,
  c2.cidade as cidade_ajudante,
  e2.estado as estado_ajudante,
  e2.sigla_estado as sigla_estado_ajudante,
  gm.id as gr_motorista_id,
  gm.motivo as gr_motorista_motivo,
  ge.nome as empresa_motorista,
  gs.status as status_motorista,
  ga.id as gr_ajudante_id,
  ga.motivo as gr_ajudante_motivo,
  ge2.nome as empresa_ajudante,
  gs2.status as status_ajudante
from
  motorista m
  left join end_motorista em on em.id_motorista = m.motorista_id
  left join logradouro l on l.id_logradouro = em.id_logradouro
  left join bairro b on b.id_bairro = l.id_bairro
  left join cidade c on c.id_cidade = b.id_cidade
  left join estado e on e.id_estado = c.id_estado
  left join veiculo v on v.motorista_id = m.motorista_id
  left join documento_ajudante da on da.motorista_id = m.motorista_id
  left join rg_ajudante rg on rg.id_ajudante = da.id_ajudante
  left join cnh_ajudante cnh on cnh.id_ajudante = da.id_ajudante
  left join end_ajudante ea on ea.id_ajudante = da.id_ajudante
  left join logradouro l2 on l2.id_logradouro = ea.id_logradouro
  left join bairro b2 on b2.id_bairro = l2.id_bairro
  left join cidade c2 on c2.id_cidade = b2.id_cidade
  left join estado e2 on e2.id_estado = c2.id_estado
  left join gr_motorista gm on gm.motorista_id = m.motorista_id
  left join gr_empresa ge on ge.id = gm.empresa_id
  left join gr_status gs on gs.id = gm.status_id
  left join gr_ajudante ga on ga.ajudante_id = da.id_ajudante
  left join gr_empresa ge2 on ge2.id = ga.empresa_id
  left join gr_status gs2 on gs2.id = ga.status_id
where
  m.st_cadastro = 'contratado'::text;

-- Add comment explaining the purpose of this view
COMMENT ON VIEW public.vw_contratados_completo IS 'Provides a comprehensive view of contracted drivers with integration and training status';