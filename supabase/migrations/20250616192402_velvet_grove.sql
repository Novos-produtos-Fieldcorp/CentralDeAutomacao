/*
  # Add Helper Tables for Vehicle Assistants

  1. New Tables
    - documento_ajudante: Stores basic information about helpers
    - cnh_ajudante: Stores CNH information for helpers
    - rg_ajudante: Stores RG information for helpers
    - end_ajudante: Stores address information for helpers
    
  2. Purpose
    - Enable tracking of vehicle assistants/helpers
    - Store personal information and documents for helpers
    - Associate helpers with specific vehicles
    - Support document management for helpers
*/

-- Create documento_ajudante table
CREATE TABLE IF NOT EXISTS public.documento_ajudante (
  id_ajudante bigserial NOT NULL,
  nome text NULL,
  cpf numeric NULL,
  veiculo_id bigint NULL,
  comprovante_residencia text NULL,
  telefone text NULL,
  genero text NULL,
  CONSTRAINT documento_ajudante_pkey PRIMARY KEY (id_ajudante),
  CONSTRAINT documento_ajudante_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES veiculo (veiculo_id) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create cnh_ajudante table
CREATE TABLE IF NOT EXISTS public.cnh_ajudante (
  id_cnh_ajudante bigserial NOT NULL,
  nr_registro numeric NULL,
  categoria text NULL,
  nome_pai text NULL,
  nome_mae text NULL,
  id_ajudante bigint NULL,
  foto_cnh text NULL,
  CONSTRAINT cnh_ajudante_pkey PRIMARY KEY (id_cnh_ajudante),
  CONSTRAINT cnh_ajudante_id_ajudante_fkey FOREIGN KEY (id_ajudante) REFERENCES documento_ajudante (id_ajudante) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create sequence for end_ajudante if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS seq_id_end_ajudante
  INCREMENT 1
  START 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

-- Create end_ajudante table
CREATE TABLE IF NOT EXISTS public.end_ajudante (
  nr_end numeric NULL,
  ds_complemento_end text NULL,
  st_end boolean NULL DEFAULT true,
  id_ajudante bigint NOT NULL,
  id_logradouro bigint NOT NULL,
  id_end_ajudante bigint NOT NULL DEFAULT nextval('seq_id_end_ajudante'::regclass),
  CONSTRAINT end_ajudante_pkey PRIMARY KEY (id_end_ajudante),
  CONSTRAINT end_ajudante_id_end_motorista_key UNIQUE (id_end_ajudante),
  CONSTRAINT end_ajudante_id_ajudante_fkey FOREIGN KEY (id_ajudante) REFERENCES documento_ajudante (id_ajudante),
  CONSTRAINT end_ajudante_id_logradouro_fkey FOREIGN KEY (id_logradouro) REFERENCES logradouro (id_logradouro)
) TABLESPACE pg_default;

-- Create rg_ajudante table
CREATE TABLE IF NOT EXISTS public.rg_ajudante (
  id_rg_ajudante bigserial NOT NULL,
  nr_rg numeric NULL,
  data_emissao date NULL,
  orgao_expedidor text NULL,
  filiacao text NULL,
  id_ajudante bigint NULL,
  foto_rg text NULL,
  CONSTRAINT rg_ajudante_pkey PRIMARY KEY (id_rg_ajudante),
  CONSTRAINT rg_ajudante_id_ajudante_fkey FOREIGN KEY (id_ajudante) REFERENCES documento_ajudante (id_ajudante) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documento_ajudante_veiculo_id ON documento_ajudante(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_cnh_ajudante_id_ajudante ON cnh_ajudante(id_ajudante);
CREATE INDEX IF NOT EXISTS idx_rg_ajudante_id_ajudante ON rg_ajudante(id_ajudante);
CREATE INDEX IF NOT EXISTS idx_end_ajudante_id_ajudante ON end_ajudante(id_ajudante);