/*
  # Create Grupo Resumo Table

  1. New Table
    - Create grupo_resumo table for storing group summary configurations
    - Add columns for group name, URL, schedule time, and status
    - Set up foreign key relationship with company table
    
  2. Purpose
    - Store configuration for automated group summaries
    - Track which groups should receive automated summaries
    - Allow scheduling of summary delivery times
*/

-- Create the grupo_resumo table
CREATE TABLE IF NOT EXISTS public.grupo_resumo (
  id SERIAL PRIMARY KEY,
  nome_grupo TEXT NOT NULL,
  url_grupo TEXT NOT NULL,
  horario TIME NOT NULL DEFAULT '08:00',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  company_id INTEGER NOT NULL REFERENCES public.company(company_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster company filtering
CREATE INDEX IF NOT EXISTS idx_grupo_resumo_company_id ON public.grupo_resumo(company_id);

-- Add index for active status filtering
CREATE INDEX IF NOT EXISTS idx_grupo_resumo_ativo ON public.grupo_resumo(ativo);

-- Add comment explaining the purpose of this table
COMMENT ON TABLE public.grupo_resumo IS 'Stores configuration for automated group summaries';