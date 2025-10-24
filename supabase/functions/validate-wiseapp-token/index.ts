const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let { token } = body;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Remove espaços extras do token (problema comum ao copiar/colar)
    token = token.trim();
    
    console.log('🔐 Validando token WiseApp...');
    console.log('Token length:', token.length);
    console.log('Token start:', token.substring(0, 10) + '...');

    // Validate token against Chatwoot API
    const wiseappApiUrl = 'https://chat.wiseapp360.com';
    const response = await fetch(`${wiseappApiUrl}/api/v1/profile`, {
      method: 'GET',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('❌ Chatwoot retornou erro:', response.status);
      const errorText = await response.text();
      console.error('Resposta:', errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            valid: false,
            error: 'Token inválido',
            details: `Chatwoot retornou 401: ${errorText}`
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Erro ao validar token',
          statusCode: response.status,
          details: errorText
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userData = await response.json();
    console.log('✅ Token válido para usuário:', userData.name);

    return new Response(
      JSON.stringify({ 
        valid: true,
        userData: {
          name: userData.name,
          email: userData.email,
          id: userData.id
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Erro ao validar token:', error);
    
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: 'Erro interno ao validar token',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
