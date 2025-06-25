/*
  # Add customization columns to grupo_resumo table

  1. New Columns
    - Add icon_name column to store the icon identifier
    - Add color_name column to store the color theme
    - Set default values for existing records
    
  2. Purpose
    - Enable customization of group appearance
    - Support icon and color selection in the UI
    - Ensure backward compatibility with existing records
*/

-- Add icon_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'grupo_resumo'
    AND column_name = 'icon_name'
  ) THEN
    ALTER TABLE public.grupo_resumo ADD COLUMN icon_name TEXT;
    COMMENT ON COLUMN public.grupo_resumo.icon_name IS 'Stores the name of the icon to display for this group';
  END IF;
END $$;

-- Add color_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'grupo_resumo'
    AND column_name = 'color_name'
  ) THEN
    ALTER TABLE public.grupo_resumo ADD COLUMN color_name TEXT;
    COMMENT ON COLUMN public.grupo_resumo.color_name IS 'Stores the name of the color theme for this group';
  END IF;
END $$;

-- Set default values for existing records
UPDATE public.grupo_resumo 
SET 
  icon_name = 'MessagesSquare',
  color_name = 'blue'
WHERE 
  icon_name IS NULL 
  OR color_name IS NULL;