/*
  # Fix Checklist Foreign Key Constraints

  1. Changes
    - Add ON DELETE CASCADE to all checklist foreign key constraints
    - Ensure proper cleanup of related records when deleting a checklist
    
  2. Security
    - Maintain existing RLS policies
    - Keep data integrity with cascading deletes
*/

-- Drop existing foreign key constraints
ALTER TABLE acessorios_veiculos 
DROP CONSTRAINT IF EXISTS acessorios_veiculos_checklist_id_fkey;

ALTER TABLE componentes_gerais 
DROP CONSTRAINT IF EXISTS componentes_gerais_checklist_id_fkey;

ALTER TABLE farol_veiculo 
DROP CONSTRAINT IF EXISTS farol_veiculo_checklist_id_fkey;

ALTER TABLE fluido_veiculo 
DROP CONSTRAINT IF EXISTS fluido_veiculo_checklist_id_fkey;

ALTER TABLE foto_checklist 
DROP CONSTRAINT IF EXISTS foto_checklist_checklist_id_fkey;

-- Recreate constraints with ON DELETE CASCADE
ALTER TABLE acessorios_veiculos
ADD CONSTRAINT acessorios_veiculos_checklist_id_fkey
FOREIGN KEY (checklist_id)
REFERENCES checklist(checklist_id)
ON DELETE CASCADE;

ALTER TABLE componentes_gerais
ADD CONSTRAINT componentes_gerais_checklist_id_fkey
FOREIGN KEY (checklist_id)
REFERENCES checklist(checklist_id)
ON DELETE CASCADE;

ALTER TABLE farol_veiculo
ADD CONSTRAINT farol_veiculo_checklist_id_fkey
FOREIGN KEY (checklist_id)
REFERENCES checklist(checklist_id)
ON DELETE CASCADE;

ALTER TABLE fluido_veiculo
ADD CONSTRAINT fluido_veiculo_checklist_id_fkey
FOREIGN KEY (checklist_id)
REFERENCES checklist(checklist_id)
ON DELETE CASCADE;

ALTER TABLE foto_checklist
ADD CONSTRAINT foto_checklist_checklist_id_fkey
FOREIGN KEY (checklist_id)
REFERENCES checklist(checklist_id)
ON DELETE CASCADE;