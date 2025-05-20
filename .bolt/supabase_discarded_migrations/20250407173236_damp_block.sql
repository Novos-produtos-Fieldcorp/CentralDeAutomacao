/*
  # Correct Estado IDs

  1. Changes
    - Update estado table with correct IDs (1 to 27)
    - Maintain the same order of states
    - Use ON CONFLICT to avoid duplicates
*/

-- Delete existing estados to avoid conflicts
DELETE FROM estado;

-- Insert Brazilian states with correct IDs (1 to 27)
INSERT INTO estado (id_estado, sigla_estado, estado) VALUES
(1, 'RO', 'Rondônia'),
(2, 'AC', 'Acre'),
(3, 'AM', 'Amazonas'),
(4, 'RR', 'Roraima'),
(5, 'PA', 'Pará'),
(6, 'AP', 'Amapá'),
(7, 'TO', 'Tocantins'),
(8, 'MA', 'Maranhão'),
(9, 'PI', 'Piauí'),
(10, 'CE', 'Ceará'),
(11, 'RN', 'Rio Grande do Norte'),
(12, 'PB', 'Paraíba'),
(13, 'PE', 'Pernambuco'),
(14, 'AL', 'Alagoas'),
(15, 'SE', 'Sergipe'),
(16, 'BA', 'Bahia'),
(17, 'MG', 'Minas Gerais'),
(18, 'ES', 'Espírito Santo'),
(19, 'RJ', 'Rio de Janeiro'),
(20, 'SP', 'São Paulo'),
(21, 'PR', 'Paraná'),
(22, 'SC', 'Santa Catarina'),
(23, 'RS', 'Rio Grande do Sul'),
(24, 'MS', 'Mato Grosso do Sul'),
(25, 'MT', 'Mato Grosso'),
(26, 'GO', 'Goiás'),
(27, 'DF', 'Distrito Federal')
ON CONFLICT (id_estado) DO NOTHING;