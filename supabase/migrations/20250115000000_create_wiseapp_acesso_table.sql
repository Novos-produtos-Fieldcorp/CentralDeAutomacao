/*
  # Create wiseapp_acesso table

  1. Table Creation
    - Create wiseapp_acesso table for WiseApp authentication
    - Store access tokens and company associations
    
  2. Purpose
    - Store WiseApp access tokens per company
    - Enable synchronization with WiseApp API
    - Track authentication status
*/

-- Create wiseapp_acesso table
CREATE TABLE IF NOT EXISTS public.wiseapp_acesso (
  wiseapp_acesso_id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  nome TEXT,
  company_id INTEGER REFERENCES public.company(company_id),
  id_conta_wiseapp NUMERIC NOT NULL,
  access_token_wiseapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wiseapp_acesso_company_id ON public.wiseapp_acesso(company_id);
CREATE INDEX IF NOT EXISTS idx_wiseapp_acesso_email ON public.wiseapp_acesso(email);

-- Add comments
COMMENT ON TABLE public.wiseapp_acesso IS 'Stores WiseApp access tokens and authentication data per company';
COMMENT ON COLUMN public.wiseapp_acesso.wiseapp_acesso_id IS 'Primary key for wiseapp_acesso table';
COMMENT ON COLUMN public.wiseapp_acesso.email IS 'Email associated with the WiseApp account';
COMMENT ON COLUMN public.wiseapp_acesso.nome IS 'Name of the WiseApp account holder';
COMMENT ON COLUMN public.wiseapp_acesso.company_id IS 'Foreign key to company table';
COMMENT ON COLUMN public.wiseapp_acesso.id_conta_wiseapp IS 'WiseApp account ID';
COMMENT ON COLUMN public.wiseapp_acesso.access_token_wiseapp IS 'WiseApp API access token';
COMMENT ON COLUMN public.wiseapp_acesso.created_at IS 'Timestamp when the record was created';
