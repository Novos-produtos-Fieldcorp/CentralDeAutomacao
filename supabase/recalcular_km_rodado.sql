-- =========================================================================
-- SCRIPT PARA RECALCULAR KM_RODADO BASEADO NA FLAG CALCULO_UM_POR_DIA
-- =========================================================================
-- 
-- IMPORTANTE: Execute este script no Supabase SQL Editor
-- 
-- Este script cria uma função que recalcula o km_rodado de todos os 
-- registros de hodômetro, respeitando a configuração calculo_um_por_dia
-- de cada empresa:
--
-- - calculo_um_por_dia = TRUE (intra-day):
--   km_rodado = última leitura (por hora) do dia - primeira leitura (por hora) do dia
--
-- - calculo_um_por_dia = FALSE (inter-day):  
--   km_rodado = última leitura de hoje - última leitura do dia anterior
--
-- =========================================================================

-- Passo 1: Criar a função de recálculo
CREATE OR REPLACE FUNCTION recompute_km_rodado(target_company_id uuid DEFAULT NULL)
RETURNS TABLE(
  updated_count integer,
  company_id uuid,
  method text,
  message text
) AS $$
DECLARE
  company_rec RECORD;
  vehicle_rec RECORD;
  daily_rec RECORD;
  calculated_km numeric;
  company_updated integer;
  rows_affected integer;
  prev_day_last_reading numeric;
  is_ciclomotor boolean;
BEGIN
  -- Loop through each company (or specific company if provided)
  FOR company_rec IN 
    SELECT c.company_id, c.calculo_um_por_dia
    FROM company c
    WHERE target_company_id IS NULL OR c.company_id = target_company_id
  LOOP
    company_updated := 0;
    
    -- Loop through each vehicle in this company
    FOR vehicle_rec IN
      SELECT DISTINCT v.veiculo_id
      FROM veiculo v
      WHERE v.company_id = company_rec.company_id
    LOOP
      
      -- Determine if this vehicle is a ciclomotor (has battery readings)
      SELECT EXISTS(
        SELECT 1 FROM hodometro 
        WHERE veiculo_id = vehicle_rec.veiculo_id 
          AND bateria IS NOT NULL 
        LIMIT 1
      ) INTO is_ciclomotor;
      
      IF company_rec.calculo_um_por_dia = TRUE THEN
        -- =====================================================================
        -- INTRA-DAY METHOD: km_rodado = LAST reading by time - FIRST reading by time
        -- Uses chronological order (data, hora), not min/max values
        -- =====================================================================
        
        FOR daily_rec IN
          WITH first_last AS (
            SELECT 
              data,
              FIRST_VALUE(CASE WHEN is_ciclomotor THEN trip_lida ELSE hod_lido END) 
                OVER (PARTITION BY data ORDER BY hora ASC) as first_reading,
              FIRST_VALUE(CASE WHEN is_ciclomotor THEN trip_lida ELSE hod_lido END) 
                OVER (PARTITION BY data ORDER BY hora DESC) as last_reading,
              ROW_NUMBER() OVER (PARTITION BY data ORDER BY hora ASC) as rn
            FROM hodometro
            WHERE veiculo_id = vehicle_rec.veiculo_id
              AND company_id = company_rec.company_id
              AND (
                (is_ciclomotor AND trip_lida IS NOT NULL) OR
                (NOT is_ciclomotor AND hod_lido IS NOT NULL)
              )
          )
          SELECT 
            data,
            first_reading,
            last_reading
          FROM first_last
          WHERE rn = 1
          ORDER BY data
        LOOP
          calculated_km := 0;
          
          IF daily_rec.first_reading IS NOT NULL AND daily_rec.last_reading IS NOT NULL THEN
            calculated_km := daily_rec.last_reading - daily_rec.first_reading;
            
            -- Handle negative values (odometer reset during the day)
            IF calculated_km < 0 THEN
              calculated_km := 0;
            END IF;
          END IF;
          
          -- Update all readings for this vehicle on this day
          UPDATE hodometro
          SET km_rodado = calculated_km
          WHERE veiculo_id = vehicle_rec.veiculo_id
            AND company_id = company_rec.company_id
            AND data = daily_rec.data;
          
          GET DIAGNOSTICS rows_affected = ROW_COUNT;
          company_updated := company_updated + rows_affected;
        END LOOP;
        
      ELSE
        -- =====================================================================
        -- INTER-DAY METHOD: km_rodado = last reading of today - last reading of previous day
        -- Uses chronological order to get the actual last reading of each day
        -- =====================================================================
        
        prev_day_last_reading := NULL;
        
        -- Get the last reading of each day in chronological order
        FOR daily_rec IN
          WITH last_readings AS (
            SELECT 
              data,
              CASE WHEN is_ciclomotor THEN trip_lida ELSE hod_lido END as reading_value,
              ROW_NUMBER() OVER (PARTITION BY data ORDER BY hora DESC) as rn
            FROM hodometro
            WHERE veiculo_id = vehicle_rec.veiculo_id
              AND company_id = company_rec.company_id
              AND (
                (is_ciclomotor AND trip_lida IS NOT NULL) OR
                (NOT is_ciclomotor AND hod_lido IS NOT NULL)
              )
          )
          SELECT 
            data,
            reading_value as last_reading_of_day
          FROM last_readings
          WHERE rn = 1
          ORDER BY data
        LOOP
          calculated_km := 0;
          
          -- Calculate km as difference from previous day's last reading
          IF prev_day_last_reading IS NOT NULL AND daily_rec.last_reading_of_day IS NOT NULL THEN
            calculated_km := daily_rec.last_reading_of_day - prev_day_last_reading;
            
            -- Handle negative values (odometer reset between days)
            IF calculated_km < 0 THEN
              calculated_km := 0;
            END IF;
          END IF;
          
          -- Update all readings for this vehicle on this day
          UPDATE hodometro
          SET km_rodado = calculated_km
          WHERE veiculo_id = vehicle_rec.veiculo_id
            AND company_id = company_rec.company_id
            AND data = daily_rec.data;
          
          GET DIAGNOSTICS rows_affected = ROW_COUNT;
          company_updated := company_updated + rows_affected;
          
          -- Store this day's last reading for next iteration
          prev_day_last_reading := daily_rec.last_reading_of_day;
        END LOOP;
        
      END IF;
    END LOOP;
    
    -- Return result for this company
    RETURN QUERY SELECT 
      company_updated,
      company_rec.company_id,
      CASE 
        WHEN company_rec.calculo_um_por_dia THEN 'intra-day (hora-based)'
        ELSE 'inter-day (dia-based)'
      END::text,
      format('Atualizados %s registros com sucesso', company_updated)::text;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Passo 2: Executar a função para recalcular TODOS os registros
-- =========================================================================

SELECT * FROM recompute_km_rodado();

-- =========================================================================
-- OPCIONAL: Executar apenas para uma empresa específica
-- =========================================================================
-- Descomente a linha abaixo e substitua 'SEU_COMPANY_ID' pelo ID da empresa
-- SELECT * FROM recompute_km_rodado('SEU_COMPANY_ID'::uuid);

-- =========================================================================
-- Verificação: Conferir alguns registros atualizados
-- =========================================================================

SELECT 
  h.id_hodometro,
  h.data,
  h.hora,
  v.placa,
  h.hod_lido,
  h.trip_lida,
  h.bateria,
  h.km_rodado,
  c.calculo_um_por_dia,
  CASE 
    WHEN c.calculo_um_por_dia THEN 'intra-day'
    ELSE 'inter-day'
  END as metodo
FROM hodometro h
JOIN veiculo v ON h.veiculo_id = v.veiculo_id
JOIN company c ON h.company_id = c.company_id
WHERE h.data >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY h.company_id, h.veiculo_id, h.data, h.hora
LIMIT 50;
