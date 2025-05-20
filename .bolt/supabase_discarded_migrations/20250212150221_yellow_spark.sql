/*
  # Update checklist schema

  1. Changes
    - Add new status_item values for better granularity
    - Update existing status items to be more descriptive

  2. Security
    - Maintain existing RLS policies
*/

-- Update status items with more descriptive values
DELETE FROM status_item;
INSERT INTO status_item (status_id, status) VALUES
(1, 'OK'),
(2, 'Não OK'),
(3, 'N/A');