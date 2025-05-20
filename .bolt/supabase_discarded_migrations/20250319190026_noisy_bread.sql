/*
  # Add company filtering to status items through checklist relationship

  1. Changes
    - Add company_id to status_item table
    - Create foreign key constraint to company table
    - Update policies to filter by company_id
    - Add index for better performance
*/

-- Add company_id column to status_item
ALTER TABLE status_item
ADD COLUMN company_id bigint REFERENCES company(company_id);

-- Create index for company_id
CREATE INDEX idx_status_item_company ON status_item(company_id);

-- Update policies
DROP POLICY IF EXISTS "Allow read access for authenticated users on status_item" ON status_item;

CREATE POLICY "Allow read access for authenticated users on status_item"
ON status_item FOR SELECT
TO authenticated
USING (
  company_id IS NULL OR
  company_id IN (
    SELECT DISTINCT c.company_id 
    FROM checklist c 
    WHERE c.company_id = company_id
  )
);

-- Grant permissions
GRANT SELECT ON status_item TO authenticated;