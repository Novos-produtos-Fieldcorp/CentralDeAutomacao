/*
  # Fix status item filtering through checklist relationship

  1. Changes
    - Update policy to filter status items through checklist relationship
    - Remove company_id dependency
    - Ensure all basic status items are available
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Allow read access for authenticated users on status_item" ON status_item;

-- Create new policy that filters through checklist relationship
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
    WHERE c.motorista_id IN (
      SELECT motorista_id FROM motorista WHERE company_id = auth.jwt()->>'company_id'::bigint
    )
  )
  OR status_id IN (1, 2, 3) -- Always allow access to basic status items
);

-- Ensure all basic status items are available
INSERT INTO status_item (status_id, status) VALUES
(1, 'OK'),
(2, 'Não OK'),
(3, 'N/A')
ON CONFLICT (status_id) DO NOTHING;