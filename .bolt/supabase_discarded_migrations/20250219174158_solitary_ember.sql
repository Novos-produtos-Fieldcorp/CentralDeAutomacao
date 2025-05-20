/*
  # Add verificacao column to checklist table

  1. Changes
    - Add verificacao column to checklist table with default value false
    - Create index for faster queries
    - Update existing rows to have default value
*/

-- Add verificacao column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist' AND column_name = 'verificacao'
  ) THEN
    ALTER TABLE checklist 
    ADD COLUMN verificacao boolean DEFAULT false;

    -- Set default value for existing rows
    UPDATE checklist SET verificacao = false WHERE verificacao IS NULL;
  END IF;
END $$;

-- Create index for verificacao column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'checklist' AND indexname = 'idx_checklist_verificacao'
  ) THEN
    CREATE INDEX idx_checklist_verificacao ON checklist(verificacao);
  END IF;
END $$;