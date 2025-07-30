// Função de teste simples para verificar se o Netlify Functions está funcionando
export const handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Netlify Functions funcionando!',
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod,
      env_check: {
        has_supabase_url: !!process.env.VITE_SUPABASE_URL,
        has_supabase_key: !!process.env.VITE_SUPABASE_ANON_KEY
      }
    })
  };
};