import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔐 Validando token WiseApp...');

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
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            valid: false,
            error: 'Token inválido' 
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
          error: 'Erro ao validar token' 
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
