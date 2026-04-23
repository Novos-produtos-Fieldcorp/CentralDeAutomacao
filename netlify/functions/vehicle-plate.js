exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const plate = event.path.split('/').pop();

  if (!plate) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Placa não informada' }),
    };
  }

  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fipeKey = process.env.FIPE_API_KEY;

  if (!fipeKey) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'FIPE API key não configurada' }),
    };
  }

  try {
    console.log(`🔄 Consultando placa: ${cleanPlate}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://placas.fipeapi.com.br/placas/${cleanPlate}?key=${fipeKey}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `FIPE retornou HTTP ${response.status}` }),
      };
    }

    const data = await response.json();
    console.log('FIPE raw response keys:', Object.keys(data));

    const vehicle = data.data?.data?.veiculo ?? data.data?.veiculo ?? data.veiculo;
    const fipes = data.data?.data?.fipes ?? data.data?.fipes ?? data.fipes ?? [];

    if (!vehicle) {
      console.log('FIPE: vehicle not found in response:', JSON.stringify(data).slice(0, 200));
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Veículo não encontrado' }),
      };
    }

    const fipeEntry = fipes[0] || {};
    const modelo = fipeEntry.modelo || vehicle.modelo || '';
    const marca = fipeEntry.marca || vehicle.marca || '';

    const result = {
      plate: vehicle.placa || cleanPlate,
      model: modelo,
      brand: marca.trim(),
      year: vehicle.ano || '',
      color: vehicle.cor || '',
      fuel: vehicle.combustivel || '',
      chassi: vehicle.chassi || '',
    };

    console.log(`✅ Placa ${cleanPlate}: ${result.brand} ${result.model}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('Erro FIPE:', err.message);

    if (err.message.includes('aborted') || err.message.includes('timeout')) {
      return {
        statusCode: 408,
        headers,
        body: JSON.stringify({ error: 'Timeout na consulta da placa' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
