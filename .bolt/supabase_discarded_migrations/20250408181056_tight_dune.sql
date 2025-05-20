/*
  # Add conversation_id to motorista table
  
  1. Changes
    - Add conversation_id column to motorista table
    - Create index for faster lookups
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add conversation_id column to motorista table
ALTER TABLE motorista 
ADD COLUMN IF NOT EXISTS conversation_id text;

-- Create index for conversation_id
CREATE INDEX IF NOT EXISTS idx_motorista_conversation_id 
ON motorista(conversation_id);