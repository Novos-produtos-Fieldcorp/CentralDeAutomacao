-- Corrige URLs antigas do Supabase Storage salvas no banco (ohmoxsvwjvohmqqgxjhb -> jnwocajxsgkgiixwyxkl)
-- Rode este script no SQL Editor do Supabase (projeto NOVO: jnwocajxsgkgiixwyxkl)
--
-- IMPORTANTE: faça um backup/snapshot do banco antes de rodar (Supabase Dashboard > Database > Backups),
-- ou rode primeiro o bloco de "PRÉVIA" abaixo para conferir o que vai ser afetado antes do UPDATE.

-- ============================================================
-- 1) PRÉVIA: lista todas as colunas de texto que ainda contêm o domínio antigo
--    e quantas linhas seriam afetadas em cada uma. Rode isso primeiro.
-- ============================================================
DO $$
DECLARE
  r RECORD;
  affected INT;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I LIKE %L',
      'public', r.table_name, r.column_name, '%ohmoxsvwjvohmqqgxjhb%'
    ) INTO affected;

    IF affected > 0 THEN
      RAISE NOTICE 'Tabela: % | Coluna: % | Linhas afetadas: %', r.table_name, r.column_name, affected;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2) CORREÇÃO: troca o domínio antigo pelo novo em todas as colunas de texto
--    que contiverem a URL antiga. Só roda este bloco depois de conferir a prévia acima.
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      'public', r.table_name, r.column_name, r.column_name,
      'ohmoxsvwjvohmqqgxjhb.supabase.co', 'jnwocajxsgkgiixwyxkl.supabase.co',
      r.column_name, '%ohmoxsvwjvohmqqgxjhb%'
    );
  END LOOP;
END $$;
