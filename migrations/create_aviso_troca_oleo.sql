-- Migration: Create aviso_troca_oleo table
-- Run this in Supabase SQL Editor or via psql

CREATE TABLE IF NOT EXISTS aviso_troca_oleo (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES veiculo(veiculo_id),
  company_id INTEGER NOT NULL REFERENCES company(company_id),
  intervalo_km INTEGER NOT NULL DEFAULT 5000,
  km_ultima_troca NUMERIC NOT NULL DEFAULT 0,
  km_aviso_antecipado INTEGER NOT NULL DEFAULT 500,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_aviso_km NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Optional: Add index for faster queries by company
CREATE INDEX IF NOT EXISTS idx_aviso_troca_oleo_company_id ON aviso_troca_oleo(company_id);
CREATE INDEX IF NOT EXISTS idx_aviso_troca_oleo_veiculo_id ON aviso_troca_oleo(veiculo_id);

-- Enable RLS (if needed)
-- ALTER TABLE aviso_troca_oleo ENABLE ROW LEVEL SECURITY;
