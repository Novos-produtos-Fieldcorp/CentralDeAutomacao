-- =====================================================
-- JPD Transportes — Bucket de Storage para leitura automática (OCR)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- O frontend faz upload das imagens/PDFs (foto de BV, hodômetro, comprovante)
-- direto neste bucket usando a ANON KEY e depois manda o link público aos
-- webhooks n8n de leitura. Por isso o bucket é PÚBLICO e precisa de policies
-- que permitam INSERT pelo anon/authenticated e SELECT público.
-- (Mesmo padrão do bucket "comprovante" usado em AddComprovanteModal.tsx.)
-- =====================================================

-- 1) Bucket público jpd-uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('jpd-uploads', 'jpd-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Policies em storage.objects restritas a este bucket

-- Leitura pública (o n8n baixa o arquivo pela URL pública)
DROP POLICY IF EXISTS "jpd_uploads_public_read" ON storage.objects;
CREATE POLICY "jpd_uploads_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'jpd-uploads');

-- Upload pelo frontend (anon/authenticated)
DROP POLICY IF EXISTS "jpd_uploads_insert" ON storage.objects;
CREATE POLICY "jpd_uploads_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'jpd-uploads');

-- =====================================================
-- FIM. Confira em Storage que o bucket "jpd-uploads" foi criado e está público.
-- =====================================================
