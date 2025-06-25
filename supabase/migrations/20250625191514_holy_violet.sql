/*
  # Add icon and color fields to grupo_resumo table

  1. New Columns
    - Add icon_name column to store the name of the selected icon
    - Add color_name column to store the name of the selected color
    
  2. Purpose
    - Allow customization of group appearance
    - Support visual differentiation between groups
    - Enhance user experience with personalized group styling
*/

-- Add icon_name column to grupo_resumo table
ALTER TABLE public.grupo_resumo
ADD COLUMN IF NOT EXISTS icon_name TEXT;

-- Add color_name column to grupo_resumo table
ALTER TABLE public.grupo_resumo
ADD COLUMN IF NOT EXISTS color_name TEXT;

-- Add comments explaining the purpose of these columns
COMMENT ON COLUMN public.grupo_resumo.icon_name IS 'Stores the name of the icon to display for this group';
COMMENT ON COLUMN public.grupo_resumo.color_name IS 'Stores the name of the color theme for this group';