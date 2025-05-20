/*
  # Add company_id to checklist table

  1. Changes
    - Add company_id column to checklist table
    - Create foreign key constraint to company table
    - Update policies to filter by company_id
    - Add index for better performance
    
  2. Security
    - Update RLS policies to filter by company_id
    - Ensure proper data isolation between companies
*/

-- Add company_id column to checklist table
ALTER TABLE checklist
ADD COLUMN IF NOT EXISTS company_id bigint REFERENCES company(company_id) ON DELETE CASCADE;

-- Create index for company_id
CREATE INDEX IF NOT EXISTS idx_checklist_company ON checklist(company_id);

-- Update policies
DROP POLICY IF EXISTS "Allow full access for authenticated users on checklist" ON checklist;

CREATE POLICY "Allow full access for authenticated users on checklist"
ON checklist FOR ALL
TO authenticated
USING (
  company_id = auth.jwt()->>'company_id'::bigint
)
WITH CHECK (
  company_id = auth.jwt()->>'company_id'::bigint
);

-- Update existing checklist records to associate with companies
DO $$
DECLARE
  v_company_id bigint;
  v_checklist_id bigint;
BEGIN
  -- Get all companies
  FOR v_company_id IN SELECT company_id FROM company LOOP
    -- Get all checklists associated with motoristas from this company
    FOR v_checklist_id IN 
      SELECT c.checklist_id 
      FROM checklist c
      JOIN motorista m ON c.motorista_id = m.motorista_id
      WHERE m.company_id = v_company_id
      AND c.company_id IS NULL
    LOOP
      -- Update checklist with company_id
      UPDATE checklist
      SET company_id = v_company_id
      WHERE checklist_id = v_checklist_id;
    END LOOP;
  END LOOP;
END $$;