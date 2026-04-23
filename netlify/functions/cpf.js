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

  const cpf = event.path.split('/').pop();

  if (!cpf || !/^\d{11}$/.test(cpf)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'CPF deve conter exatamente 11 dígitos' }),
    };
  }

  const hubToken = process.env.HUB_CPF_TOKEN;

  const APIS = [
    ...(hubToken ? [{
      name: 'HubDoDesenvolvedor',
      url: `https://ws.hubdodesenvolvedor.com.br/v2/cadastropf/?cpf=${cpf}&token=${hubToken}`,
    }] : []),
    {
      name: 'BrazilAPI',
      url: `https://brasilapi.com.br/api/cpf/v1/${cpf}`,
    },
  ];

  const processHubResponse = (apiResponse) => {
    if (apiResponse.return !== 'OK' || !apiResponse.result) return null;
    const r = apiResponse.result;

    let dt_nascimento;
    if (r.dataDeNascimento) {
      const parts = r.dataDeNascimento.split('/');
      if (parts.length === 3) dt_nascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const telefone = r.listaTelefones?.[0]?.telefoneComDDD?.replace(/\D/g, '') || undefined;

    return {
      nome: r.nomeCompleto || undefined,
      dt_nascimento,
      telefone,
    };
  };

  const processGenericResponse = (apiResponse) => ({
    nome: apiResponse.name || apiResponse.nome || undefined,
    dt_nascimento: apiResponse.birth_date || apiResponse.data_nascimento || undefined,
    telefone: apiResponse.phone || apiResponse.telefone || undefined,
  });

  let result = null;

  for (const api of APIS) {
    try {
      console.log(`🔄 CPF: tentando ${api.name}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(api.url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      result = api.name === 'HubDoDesenvolvedor'
        ? processHubResponse(data)
        : processGenericResponse(data);

      if (result && (result.nome || result.telefone)) {
        console.log(`✅ CPF consultado via ${api.name}`);
        break;
      } else {
        console.log(`⚠️ ${api.name} retornou resposta vazia`);
        result = null;
      }
    } catch (err) {
      console.log(`❌ ${api.name} falhou: ${err.message}`);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result || {}),
  };
};
