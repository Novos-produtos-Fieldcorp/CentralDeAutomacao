/*
  # Add updated_at column to checklist table
  
  1. Changes
    - Add updated_at column to checklist table
    - Create trigger to automatically update the timestamp
    - Set default value for existing rows
*/

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE checklist 
    ADD COLUMN updated_at timestamptz DEFAULT now();

    -- Set default value for existing rows
    UPDATE checklist SET updated_at = created_at WHERE updated_at IS NULL;

    -- Make the column NOT NULL
    ALTER TABLE checklist 
    ALTER COLUMN updated_at SET NOT NULL;
  END IF;
END $$;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and create it again
DROP TRIGGER IF EXISTS set_checklist_updated_at ON checklist;
CREATE TRIGGER set_checklist_updated_at
  BEFORE UPDATE ON checklist
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();