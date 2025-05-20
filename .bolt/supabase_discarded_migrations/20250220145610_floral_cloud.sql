-- Add status column to checklist_item_response if it doesn't exist
ALTER TABLE checklist_item_response 
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('pendente', 'analisado')) DEFAULT 'pendente';

-- Create index for status column
CREATE INDEX IF NOT EXISTS idx_checklist_item_response_status 
ON checklist_item_response(status);

-- Update existing responses to have a default status if null
UPDATE checklist_item_response 
SET status = 'pendente' 
WHERE status IS NULL;

-- Make status column NOT NULL
ALTER TABLE checklist_item_response 
ALTER COLUMN status SET NOT NULL;