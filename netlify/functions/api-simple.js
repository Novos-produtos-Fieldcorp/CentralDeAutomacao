// Função Netlify simplificada para debug
export const handler = async (event, context) => {
  console.log('=== NETLIFY FUNCTION DEBUG ===');
  console.log('Raw path:', event.path);
  console.log('Method:', event.httpMethod);
  console.log('Headers:', Object.keys(event.headers || {}));
  console.log('Query params:', event.queryStringParameters);
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, api_access_token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Extrair path limpo
    let cleanPath = event.path.replace('/.netlify/functions/api-simple', '');
    console.log('Clean path:', cleanPath);
    
    // Se for uma requisição para a API do WiseApp
    if (cleanPath.includes('/api/v1/')) {
      const apiPath = cleanPath.substring(cleanPath.indexOf('/api/v1/'));
      const targetUrl = `https://chat.wiseapp360.com${apiPath}`;
      
      // Adicionar query parameters
      if (event.queryStringParameters) {
        const queryString = new URLSearchParams(event.queryStringParameters).toString();
        const fullUrl = `${targetUrl}?${queryString}`;
        console.log('Proxy target URL:', fullUrl);
        
        // Fazer a requisição
        const response = await fetch(fullUrl, {
          method: event.httpMethod,
          headers: {
            'api_access_token': event.headers['api_access_token'] || event.headers['authorization'] || '',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: event.httpMethod !== 'GET' && event.body ? event.body : undefined
        });
        
        const responseText = await response.text();
        console.log('WiseApp response status:', response.status);
        console.log('WiseApp response headers:', Object.fromEntries(response.headers.entries()));
        
        return {
          statusCode: response.status,
          headers: {
            ...headers,
            'Content-Type': response.headers.get('content-type') || 'application/json'
          },
          body: responseText
        };
      }
    }
    
    // Resposta padrão para outras rotas
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Netlify function working',
        path: cleanPath,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Function error', 
        details: error.message,
        path: event.path
      })
    };
  }
};