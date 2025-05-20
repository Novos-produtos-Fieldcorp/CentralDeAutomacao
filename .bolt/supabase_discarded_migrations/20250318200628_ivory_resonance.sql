/*
  # Add Wiseapp Account ID to Company Table

  1. Changes
    - Add id_conta_wiseapp column to company table
    - Create index for faster lookups
    - Add NOT NULL constraint after data migration
*/

-- Add id_conta_wiseapp column
ALTER TABLE company 
ADD COLUMN IF NOT EXISTS id_conta_wiseapp text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_wiseapp_id 
ON company(id_conta_wiseapp);

-- Add NOT NULL constraint after ensuring data is migrated
ALTER TABLE company 
ALTER COLUMN id_conta_wiseapp SET NOT NULL;