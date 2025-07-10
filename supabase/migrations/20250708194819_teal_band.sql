/*
  # Fix vw_agregados_completo view to properly include vehicle data

  1. Changes
    - Update the vw_agregados_completo view to properly join with veiculo table
    - Add status_veiculo = true condition to only show active vehicles
    - Ensure proper data structure for vehicle information
    
  2. Purpose
    - Fix issue where vehicle information is not displayed in the agregados list
    - Ensure only active vehicles are shown
    - Maintain consistent data structure across views
*/

-- Drop existing view
DROP VIEW IF EXISTS public.vw_agregados_completo;

-- Create the updated view for agregados with proper vehicle join
CREATE VIEW public.vw_agregados_completo AS
SELECT
  m.motorista_id,
  m.nome AS nome_motorista,
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
  m.ativo,
  em.nr_end,
  em.ds_complemento_end,
  em.st_end,
  em.id_end_motorista,
  l.logradouro,
  l.nr_cep,
  b.bairro AS nome_bairro,
  c.cidade AS nome_cidade,
  e.estado AS nome_estado,
  e.sigla_estado,
  v.veiculo_id,
  v.placa,
  v.status_veiculo,
  v.marca AS marca_veiculo,
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
  da.nome AS nome_ajudante,
  da.cpf AS cpf_ajudante,
  da.telefone AS telefone_ajudante,
  da.genero AS genero_ajudante,
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
  ea.nr_end AS nr_end_ajudante,
  ea.ds_complemento_end AS ds_complemento_end_ajudante,
  ea.st_end AS st_end_ajudante,
  l2.logradouro AS logradouro_ajudante,
  l2.nr_cep AS cep_ajudante,
  b2.bairro AS bairro_ajudante,
  c2.cidade AS cidade_ajudante,
  e2.estado AS estado_ajudante,
  e2.sigla_estado AS sigla_estado_ajudante,
  gm.id AS gr_motorista_id,
  gm.motivo AS gr_motorista_motivo,
  ge.nome AS empresa_motorista,
  gs.status AS status_motorista,
  ga.id AS gr_ajudante_id,
  ga.motivo AS gr_ajudante_motivo,
  ge2.nome AS empresa_ajudante,
  gs2.status AS status_ajudante,
  m.comentario,
  dm.id_documento_motorista,
  dm.foto_cnh AS dm_foto_cnh,
  dm.foto_comprovante_residencia,
  dm.nr_registro_cnh,
  dm.categoria_cnh,
  dm.validade_cnh,
  dm.uf_cnh,
  dm.nome_pai AS dm_nome_pai,
  dm.nome_mae AS dm_nome_mae
FROM
  motorista m
  LEFT JOIN end_motorista em ON em.id_motorista = m.motorista_id
  LEFT JOIN logradouro l ON l.id_logradouro = em.id_logradouro
  LEFT JOIN bairro b ON b.id_bairro = l.id_bairro
  LEFT JOIN cidade c ON c.id_cidade = b.id_cidade
  LEFT JOIN estado e ON e.id_estado = c.id_estado
  LEFT JOIN veiculo v ON v.motorista_id = m.motorista_id AND v.status_veiculo = true
  LEFT JOIN documento_ajudante da ON da.motorista_id = m.motorista_id
  LEFT JOIN rg_ajudante rg ON rg.id_ajudante = da.id_ajudante
  LEFT JOIN cnh_ajudante cnh ON cnh.id_ajudante = da.id_ajudante
  LEFT JOIN end_ajudante ea ON ea.id_ajudante = da.id_ajudante
  LEFT JOIN logradouro l2 ON l2.id_logradouro = ea.id_logradouro
  LEFT JOIN bairro b2 ON b2.id_bairro = l2.id_bairro
  LEFT JOIN cidade c2 ON c2.id_cidade = b2.id_cidade
  LEFT JOIN estado e2 ON e2.id_estado = c2.id_estado
  LEFT JOIN gr_motorista gm ON gm.motorista_id = m.motorista_id
  LEFT JOIN gr_empresa ge ON ge.id = gm.empresa_id
  LEFT JOIN gr_status gs ON gs.id = gm.status_id
  LEFT JOIN gr_ajudante ga ON ga.ajudante_id = da.id_ajudante
  LEFT JOIN gr_empresa ge2 ON ge2.id = ga.empresa_id
  LEFT JOIN gr_status gs2 ON gs2.id = ga.status_id
  LEFT JOIN documento_motorista dm ON dm.motorista_id = m.motorista_id
WHERE
  m.funcao = 'Agregado'::text;

-- Add comment explaining the purpose of this view
COMMENT ON VIEW public.vw_agregados_completo IS 'Provides a comprehensive view of agregados with all related information including vehicle data';