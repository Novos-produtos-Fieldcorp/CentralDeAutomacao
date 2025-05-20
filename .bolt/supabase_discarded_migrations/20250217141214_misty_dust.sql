/*
  # Add verificacao column to checklist table
  
  1. Changes
    - Add verificacao column to checklist table with default value false
    - Add index for verificacao column for better query performance
*/

-- Add verificacao column if it doesn't exist
ALTER TABLE checklist 
ADD COLUMN IF NOT EXISTS verificacao boolean DEFAULT false;

-- Create index for verificacao column
CREATE INDEX IF NOT EXISTS idx_checklist_verificacao 
ON checklist(verificacao);