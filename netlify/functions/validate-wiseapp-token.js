exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    let { token } = body;

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token é obrigatório' }),
      };
    }

    token = token.trim();
    console.log('🔐 Validando token WiseApp - Length:', token.length);

    const wiseappResponse = await fetch('https://chat.wiseapp360.com/api/v1/profile', {
      method: 'GET',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!wiseappResponse.ok) {
      const errorText = await wiseappResponse.text();
      console.error('❌ Chatwoot erro:', wiseappResponse.status, errorText);

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Token inválido',
          details: `Chatwoot retornou ${wiseappResponse.status}`,
        }),
      };
    }

    const userData = await wiseappResponse.json();
    console.log('✅ Token válido para usuário:', userData.name);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        userData: {
          name: userData.name,
          email: userData.email,
          id: userData.id,
        },
      }),
    };
  } catch (error) {
    console.error('❌ Erro ao validar token:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        error: 'Erro interno ao validar token',
        details: error.message,
      }),
    };
  }
};
