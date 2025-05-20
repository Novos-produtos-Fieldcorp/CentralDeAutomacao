/*
  # Fix updated_at column in checklist table
  
  1. Changes
    - Drop and recreate updated_at column with proper constraints
    - Create trigger for automatic updates
    - Migrate existing data
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_checklist_updated_at ON checklist;
DROP FUNCTION IF EXISTS update_checklist_updated_at();

-- Recreate the column with proper setup
ALTER TABLE checklist 
DROP COLUMN IF EXISTS updated_at;

ALTER TABLE checklist 
ADD COLUMN updated_at timestamptz DEFAULT now();

-- Update existing rows
UPDATE checklist 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Make column NOT NULL after data migration
ALTER TABLE checklist 
ALTER COLUMN updated_at SET NOT NULL;

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger
CREATE TRIGGER set_checklist_updated_at
  BEFORE UPDATE ON checklist
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_checklist_updated_at 
ON checklist(updated_at);