/*
  # Fix status item company filtering

  1. Changes
    - Remove company_id column from status_item table
    - Update policy to filter through checklist relationship
    - Keep global status items accessible to all companies
*/

-- Drop the company_id column and its index if they exist
ALTER TABLE status_item 
DROP COLUMN IF EXISTS company_id;

DROP INDEX IF EXISTS idx_status_item_company;

-- Update policy to filter through checklist relationship
DROP POLICY IF EXISTS "Allow read access for authenticated users on status_item" ON status_item;

CREATE POLICY "Allow read access for authenticated users on status_item"
ON status_item FOR SELECT
TO authenticated
USING (
  status_id IN (
    SELECT DISTINCT s.status_id
    FROM status_item s
    LEFT JOIN acessorios_veiculos av ON av.pneu = s.status_id 
      OR av.estepe = s.status_id 
      OR av.macaco_triangulo_chave_roda = s.status_id
      OR av.extintor = s.status_id
      OR av.cartao_combustivel = s.status_id
      OR av.cadeado = s.status_id
      OR av.chave_reserva = s.status_id
      OR av.carrinho_carga = s.status_id
      OR av.documento_veicular = s.status_id
      OR av.manual_veiculo = s.status_id
    LEFT JOIN checklist c ON av.checklist_id = c.checklist_id
    LEFT JOIN componentes_gerais cg ON cg.checklist_id = c.checklist_id
    LEFT JOIN farol_veiculo fv ON fv.checklist_id = c.checklist_id
    LEFT JOIN fluido_veiculo fvl ON fvl.checklist_id = c.checklist_id
  )
);

-- Ensure all status items are available
INSERT INTO status_item (status_id, status) VALUES
(1, 'OK'),
(2, 'Não OK'),
(3, 'N/A')
ON CONFLICT (status_id) DO NOTHING;