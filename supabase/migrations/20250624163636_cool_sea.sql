/*
  # Create envio_resumo table for tracking summary delivery history

  1. New Table
    - Create a new table called 'envio_resumo'
    - Store history of summary deliveries to WhatsApp groups
    - Track success/failure status and messages
    
  2. Purpose
    - Provide delivery history for the Resumos em Grupo feature
    - Allow users to see when summaries were sent and their status
    - Support troubleshooting of failed deliveries
*/

-- Create the envio_resumo table
CREATE TABLE IF NOT EXISTS public.envio_resumo (
  id SERIAL PRIMARY KEY,
  grupo_id INTEGER NOT NULL REFERENCES public.grupo_resumo(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES public.company(company_id) ON DELETE CASCADE,
  data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  mensagem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_envio_resumo_grupo_id ON public.envio_resumo(grupo_id);
CREATE INDEX IF NOT EXISTS idx_envio_resumo_company_id ON public.envio_resumo(company_id);
CREATE INDEX IF NOT EXISTS idx_envio_resumo_data_envio ON public.envio_resumo(data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_envio_resumo_status ON public.envio_resumo(status);

-- Add comment explaining the purpose of this table
COMMENT ON TABLE public.envio_resumo IS 'Stores history of summary deliveries to WhatsApp groups';