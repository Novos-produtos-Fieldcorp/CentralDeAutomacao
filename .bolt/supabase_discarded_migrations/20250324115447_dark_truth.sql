/*
  # Add sample hodometro data

  1. Changes
    - Add sample hodometro readings for testing
    - Use existing motoristas and veiculos
    - Add realistic data for the last 30 days
*/

-- Insert sample hodometro data
DO $$
DECLARE
  v_motorista_id bigint;
  v_veiculo_id bigint;
  v_cliente_id bigint;
  v_current_date date;
  v_current_km numeric;
  v_km_increment numeric;
BEGIN
  -- Get first motorista
  SELECT motorista_id INTO v_motorista_id 
  FROM motorista 
  WHERE st_cadastro = 'contratado' 
  LIMIT 1;

  -- Get first veiculo
  SELECT veiculo_id INTO v_veiculo_id 
  FROM veiculo 
  WHERE status_veiculo = true 
  LIMIT 1;

  -- Get first cliente
  SELECT cliente_id INTO v_cliente_id 
  FROM cliente 
  WHERE st_cliente = true 
  LIMIT 1;

  IF v_motorista_id IS NOT NULL AND v_veiculo_id IS NOT NULL THEN
    -- Set initial values
    v_current_date := CURRENT_DATE - interval '30 days';
    v_current_km := 50000; -- Starting KM
    
    -- Insert data for the last 30 days
    WHILE v_current_date <= CURRENT_DATE LOOP
      -- Random KM increment between 100 and 300
      v_km_increment := random() * 200 + 100;
      
      -- Insert morning reading
      INSERT INTO hodometro (
        data,
        hora,
        hod_informado,
        hod_lido,
        trip_lida,
        km_rodado,
        verificacao,
        comparacao_leitura,
        motorista_id,
        veiculo_id,
        cliente_id
      ) VALUES (
        v_current_date,
        '08:00:00',
        v_current_km,
        v_current_km,
        random() * 100, -- Random trip reading
        v_km_increment,
        true,
        true,
        v_motorista_id,
        v_veiculo_id,
        v_cliente_id
      );

      -- Update current KM
      v_current_km := v_current_km + v_km_increment;

      -- Move to next day
      v_current_date := v_current_date + interval '1 day';
    END LOOP;
  END IF;
END $$;