/*
  # Add comentario column to motorista table

  1. New Column
    - Add comentario column to motorista table
    - Set default value to NULL
    
  2. Purpose
    - Store comments for motoristas and agregados
    - Support the new "Comentários" tab in the UI
    - Allow users to add notes about drivers
*/

-- Add comentario column to motorista table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'motorista'
    AND column_name = 'comentario'
  ) THEN
    ALTER TABLE public.motorista ADD COLUMN comentario TEXT;
    COMMENT ON COLUMN public.motorista.comentario IS 'Stores comments for motoristas and agregados';
  END IF;
END $$;