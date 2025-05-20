/*
  # Create Module Access Control Table

  1. New Table
    - `module_access` - Table for storing module access permissions by account ID
      - account_id: The WiseApp account ID
      - checklist_access: Whether the account has access to the checklist module
      - motoristas_access: Whether the account has access to the hiring module
      - hodometros_access: Whether the account has access to the odometer module
      
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Grant appropriate permissions
*/

-- Create module_access table
CREATE TABLE IF NOT EXISTS module_access (
  id bigserial PRIMARY KEY,
  account_id text NOT NULL UNIQUE,
  checklist_access boolean DEFAULT false,
  motoristas_access boolean DEFAULT false,
  hodometros_access boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_module_access_account_id ON module_access(account_id);

-- Enable Row Level Security
ALTER TABLE module_access ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users on module_access"
  ON module_access FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated users on module_access"
  ON module_access FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users on module_access"
  ON module_access FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users on module_access"
  ON module_access FOR DELETE
  TO authenticated
  USING (true);

-- Grant permissions
GRANT ALL ON module_access TO authenticated;
GRANT USAGE ON SEQUENCE module_access_id_seq TO authenticated;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_module_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_module_access_updated_at
  BEFORE UPDATE ON module_access
  FOR EACH ROW
  EXECUTE FUNCTION update_module_access_updated_at();