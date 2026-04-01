-- Migration: Create oil_change_alert_log table
-- Run this in Supabase SQL Editor or via psql
-- This table stores in-app alerts for oil change notifications (replaces WhatsApp sends)

CREATE TABLE IF NOT EXISTS oil_change_alert_log (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  veiculo_id INTEGER NOT NULL,
  placa TEXT,
  km_atual NUMERIC,
  km_proxima_troca NUMERIC,
  km_restante NUMERIC,
  status TEXT NOT NULL DEFAULT 'Atenção',
  lido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oil_change_alert_log_company_id ON oil_change_alert_log(company_id, lido);
CREATE INDEX IF NOT EXISTS idx_oil_change_alert_log_veiculo_id ON oil_change_alert_log(veiculo_id);

-- Enable RLS: all access is through service_role (backend), anon key is blocked
ALTER TABLE oil_change_alert_log ENABLE ROW LEVEL SECURITY;
