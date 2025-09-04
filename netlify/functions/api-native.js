// Native Netlify function - no Express wrapper
exports.handler = async (event, context) => {
  console.log('Native API function called:', event.httpMethod, event.path);
  console.log('Headers:', event.headers);
  console.log('Query:', event.queryStringParameters);
  
  const { httpMethod, path, queryStringParameters: query, headers } = event;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, wiseapp-token, wiseapp-account-id',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }
  
  // Health check
  if (path === '/health') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        platform: 'netlify-native',
        version: '1.0'
      })
    };
  }
  
  // WiseApp contact search
  if (httpMethod === 'GET' && path.match(/^\/wiseapp\/\d+\/contacts\/search$/)) {
    try {
      const pathParts = path.split('/');
      const companyId = pathParts[2];
      
      const token = headers['wiseapp-token'];
      const accountId = headers['wiseapp-account-id'];
      const phone = query?.phone;
      
      console.log(`Contact search - Company: ${companyId}, Phone: ${phone}`);
      
      if (!token || !accountId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token e Account ID obrigatórios' })
        };
      }
      
      if (!phone) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Phone obrigatório' })
        };
      }
      
      const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
      console.log(`Fetching from: ${wiseappUrl}`);
      
      const response = await fetch(wiseappUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`WiseApp response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`WiseApp error: ${response.status} - ${errorText}`);
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `WiseApp API error: ${response.status}`,
            details: errorText
          })
        };
      }
      
      const data = await response.json();
      console.log(`Contact search successful`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data)
      };
    } catch (error) {
      console.error('Contact search error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro interno',
          details: error.message 
        })
      };
    }
  }
  
  // WiseApp labels
  if (httpMethod === 'GET' && path.match(/^\/wiseapp\/\d+\/labels$/)) {
    try {
      const pathParts = path.split('/');
      const companyId = pathParts[2];
      
      const token = headers['wiseapp-token'];
      const accountId = headers['wiseapp-account-id'];
      
      console.log(`Labels - Company: ${companyId}`);
      
      if (!token || !accountId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token e Account ID obrigatórios' })
        };
      }
      
      const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
      console.log(`Fetching from: ${wiseappUrl}`);
      
      const response = await fetch(wiseappUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`WiseApp labels response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`WiseApp labels error: ${response.status} - ${errorText}`);
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `WiseApp API error: ${response.status}`,
            details: errorText
          })
        };
      }
      
      const data = await response.json();
      console.log(`Labels fetched successfully`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data)
      };
    } catch (error) {
      console.error('Labels error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro interno',
          details: error.message 
        })
      };
    }
  }
  
  // Default 404
  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({
      error: 'Endpoint não encontrado',
      path,
      method: httpMethod,
      available_routes: [
        'GET /health',
        'GET /wiseapp/:companyId/labels',
        'GET /wiseapp/:companyId/contacts/search'
      ]
    })
  };
};