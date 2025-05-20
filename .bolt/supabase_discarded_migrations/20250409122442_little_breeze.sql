/*
  # Add Module Access Columns to Company Table

  1. Changes
    - Add checklist_access, motorista_access, and hodometro_acsess columns to company table
    - Set default values to false
    - Update existing companies to have these fields
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add module access columns to company table if they don't exist
ALTER TABLE company 
ADD COLUMN IF NOT EXISTS checklist_access boolean DEFAULT false;

ALTER TABLE company 
ADD COLUMN IF NOT EXISTS motorista_access boolean DEFAULT false;

ALTER TABLE company 
ADD COLUMN IF NOT EXISTS hodometro_acsess boolean DEFAULT false;

-- Update existing companies to have these fields set to false if they are null
UPDATE company 
SET 
  checklist_access = COALESCE(checklist_access, false),
  motorista_access = COALESCE(motorista_access, false),
  hodometro_acsess = COALESCE(hodometro_acsess, false);