/*
  # Add Database Indexes for Improved Performance with Large Datasets

  1. New Indexes
    - Combined index for company_id and funcao filtering
    - Index for data_cadastro sorting
    - Index for st_cadastro filtering
    - Index for motorista_id in veiculo table
    - Index for telefone to improve phone search
    - Index for nome to improve name search
    - Index for cpf to improve CPF search
    
  2. Purpose
    - Improve query performance for large datasets (6000+ records)
    - Optimize filtering and sorting operations
    - Reduce database load and prevent statement timeouts
    - Speed up server-side pagination
*/

-- Add combined index for company_id and funcao filtering
CREATE INDEX IF NOT EXISTS idx_motorista_company_funcao ON public.motorista(company_id, funcao);

-- Add index for data_cadastro sorting
CREATE INDEX IF NOT EXISTS idx_motorista_data_cadastro ON public.motorista(data_cadastro DESC);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_motorista_st_cadastro ON public.motorista(st_cadastro);

-- Add index for vehicle-motorista relationship
CREATE INDEX IF NOT EXISTS idx_veiculo_motorista_id ON public.veiculo(motorista_id);

-- Add index for phone search
CREATE INDEX IF NOT EXISTS idx_motorista_telefone ON public.motorista(telefone);

-- Add standard btree index for name search
CREATE INDEX IF NOT EXISTS idx_motorista_nome ON public.motorista(nome);

-- Add index for CPF search
CREATE INDEX IF NOT EXISTS idx_motorista_cpf ON public.motorista(cpf);

-- Add index for client_id filtering
CREATE INDEX IF NOT EXISTS idx_motorista_cliente_id ON public.motorista(cliente_id);

-- Add index for company_id on veiculo table
CREATE INDEX IF NOT EXISTS idx_veiculo_company_id ON public.veiculo(company_id);

-- Add index for status_veiculo on veiculo table
CREATE INDEX IF NOT EXISTS idx_veiculo_status ON public.veiculo(status_veiculo);