/*
  # Add Comments Table for Motoristas and Agregados

  1. New Table
    - Create motorista_comentarios table for storing comments
    - Add columns for comment text, date, and user
    - Set up foreign key relationship with motorista table
    
  2. Purpose
    - Allow adding comments to motoristas and agregados
    - Track comment history with timestamps
    - Support communication and notes about drivers
*/

-- Create the motorista_comentarios table
CREATE TABLE IF NOT EXISTS public.motorista_comentarios (
  id SERIAL PRIMARY KEY,
  motorista_id INTEGER NOT NULL REFERENCES public.motorista(motorista_id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  data_comentario TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usuario TEXT,
  company_id INTEGER REFERENCES public.company(company_id) ON DELETE CASCADE
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_motorista_comentarios_motorista_id 
ON public.motorista_comentarios(motorista_id);

CREATE INDEX IF NOT EXISTS idx_motorista_comentarios_company_id 
ON public.motorista_comentarios(company_id);

CREATE INDEX IF NOT EXISTS idx_motorista_comentarios_data 
ON public.motorista_comentarios(data_comentario DESC);

-- Add comment explaining the purpose of this table
COMMENT ON TABLE public.motorista_comentarios IS 'Stores comments for motoristas and agregados';