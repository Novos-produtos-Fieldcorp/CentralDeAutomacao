/*
  # Create Risk Management Tables

  1. New Tables
    - Create gr_status table for risk management statuses
    - Create gr_empresa table for risk management companies
    - Create gr_motorista table for driver risk management
    - Create gr_ajudante table for helper risk management
    
  2. Purpose
    - Support risk management functionality
    - Track risk status for drivers and helpers
    - Associate drivers and helpers with risk management companies
*/

-- Create gr_status table
CREATE TABLE IF NOT EXISTS public.gr_status (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gr_empresa table
CREATE TABLE IF NOT EXISTS public.gr_empresa (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gr_motorista table
CREATE TABLE IF NOT EXISTS public.gr_motorista (
  id SERIAL PRIMARY KEY,
  motorista_id INTEGER NOT NULL REFERENCES public.motorista(motorista_id) ON DELETE CASCADE,
  empresa_id INTEGER NOT NULL REFERENCES public.gr_empresa(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES public.gr_status(id) ON DELETE CASCADE,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gr_ajudante table
CREATE TABLE IF NOT EXISTS public.gr_ajudante (
  id SERIAL PRIMARY KEY,
  ajudante_id INTEGER NOT NULL REFERENCES public.documento_ajudante(id_ajudante) ON DELETE CASCADE,
  empresa_id INTEGER NOT NULL REFERENCES public.gr_empresa(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES public.gr_status(id) ON DELETE CASCADE,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_gr_motorista_motorista_id ON public.gr_motorista(motorista_id);
CREATE INDEX IF NOT EXISTS idx_gr_motorista_empresa_id ON public.gr_motorista(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gr_motorista_status_id ON public.gr_motorista(status_id);

CREATE INDEX IF NOT EXISTS idx_gr_ajudante_ajudante_id ON public.gr_ajudante(ajudante_id);
CREATE INDEX IF NOT EXISTS idx_gr_ajudante_empresa_id ON public.gr_ajudante(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gr_ajudante_status_id ON public.gr_ajudante(status_id);

-- Insert default statuses
INSERT INTO public.gr_status (status)
VALUES 
  ('Aprovado'),
  ('Reprovado'),
  ('Pendente')
ON CONFLICT DO NOTHING;

-- Add comments explaining the purpose of these tables
COMMENT ON TABLE public.gr_status IS 'Stores risk management status options';
COMMENT ON TABLE public.gr_empresa IS 'Stores risk management companies';
COMMENT ON TABLE public.gr_motorista IS 'Stores risk management data for drivers';
COMMENT ON TABLE public.gr_ajudante IS 'Stores risk management data for helpers';