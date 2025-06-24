/*
  # Add resumos_access column to company table

  1. New Column
    - Add resumos_access boolean column to company table
    - Set default value to false
    
  2. Purpose
    - Enable control of access to the "Resumos em Grupo" module
    - Allow administrators to toggle access for each company
*/

-- Add resumos_access column to company table
ALTER TABLE public.company
ADD COLUMN IF NOT EXISTS resumos_access BOOLEAN DEFAULT FALSE;