-- =====================================================
-- Dionizio Transportes — Bucket de Storage para documentos e fotos
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- O frontend faz upload dos arquivos (NFe de abastecimento, comprovantes
-- de descarga, fotos de ocorrências, comprovante do canhoto) direto neste
-- bucket usando a ANON KEY. Por isso o bucket é PÚBLICO e precisa de
-- policies que permitam INSERT pelo anon/authenticated e SELECT público
-- (para os links ficarem acessíveis a partir dos registros salvos).
-- Mesmo padrão do bucket "jpd-uploads" usado no painel JPD Transportes.
-- =====================================================

-- 1) Bucket público dionizio-uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('dionizio-uploads', 'dionizio-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Policies em storage.objects restritas a este bucket

-- Leitura pública (URLs salvas nos registros precisam ser acessíveis)
DROP POLICY IF EXISTS "dionizio_uploads_public_read" ON storage.objects;
CREATE POLICY "dionizio_uploads_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dionizio-uploads');

-- Upload pelo frontend (anon/authenticated)
DROP POLICY IF EXISTS "dionizio_uploads_insert" ON storage.objects;
CREATE POLICY "dionizio_uploads_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'dionizio-uploads');

-- =====================================================
-- FIM. Confira em Storage que o bucket "dionizio-uploads" foi criado e
-- está público.
-- =====================================================
