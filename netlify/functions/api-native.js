// Native Netlify function - no Express wrapper
exports.handler = async (event, context) => {
  console.log('=== NETLIFY FUNCTION DEBUG ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Method:', event.httpMethod);
  console.log('Path:', event.path);
  console.log('rawUrl:', event.rawUrl);
  console.log('rawQuery:', event.rawQuery);
  console.log('Headers:', event.headers);
  console.log('Query:', event.queryStringParameters);
  console.log('================================');
  
  const { httpMethod, queryStringParameters: query, headers } = event;
  // Use rawUrl path or path from event
  const path = event.path || event.rawUrl?.split('?')[0] || '';
  
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
  
  // WiseApp contact search - more flexible matching
  console.log(`Checking contact search pattern for path: "${path}"`);
  if (httpMethod === 'GET' && (path.includes('/wiseapp/') && path.includes('/contacts/search'))) {
    try {
      // Extract company ID more reliably
      const wiseappMatch = path.match(/\/wiseapp\/(\d+)\//);
      const companyId = wiseappMatch ? wiseappMatch[1] : '2'; // Default to 2
      
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
      
      // Formatar telefone com código do país (55)
      const formattedPhone = `55${phone}`;
      const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`;
      
      console.log(`Fetching from: ${wiseappUrl}`);
      
      // Implementar retry logic como no servidor
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Para account_id 20 ou outros accounts grandes, adicionar delay
          if (accountId === '20' && attempts > 1) {
            console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 2s...`);
            await delay(2000); // 2 segundos entre tentativas
          }

          response = await fetch(wiseappUrl, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            break; // Success!
          }
          
          // Se 401 em account grande, tentar novamente
          if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
            console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
            
            if (attempts < maxAttempts) {
              continue; // Try again
            }
          }
          
          // Para outros erros, falhar imediatamente
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`Contact search attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp contact search failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
      }
      
      console.log(`Contact search successful`);
      
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
          error: 'Erro na busca de contatos',
          details: error.message || 'Erro desconhecido'
        })
      };
    }
  }
  
  // WiseApp labels - implementação completa como no servidor
  console.log(`Checking labels pattern for path: "${path}"`);
  if (httpMethod === 'GET' && (path.includes('/wiseapp/') && path.endsWith('/labels'))) {
    try {
      const wiseappMatch = path.match(/\/wiseapp\/(\d+)/);
      const companyId = wiseappMatch ? wiseappMatch[1] : '2';
      
      console.log(`Fetching WiseApp labels for company ${companyId}`);
      console.log('Request headers:', headers);
      
      const token = headers['wiseapp-token'];
      const accountId = headers['wiseapp-account-id'];
      
      console.log('Token from header:', token ? 'Found' : 'Not found');
      console.log('Account ID from header:', accountId ? 'Found' : 'Not found');
      
      if (!token) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token WiseApp não configurado para esta empresa' })
        };
      }
      
      if (!accountId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Account ID não configurado para esta empresa' })
        };
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
      console.log(`Fetching labels from: ${wiseAppUrl}`);

      // Log específico para account ID 20
      if (accountId === '20') {
        console.log(`Special handling for Account ID 20 - Token length: ${token?.length || 0}`);
      }

      // Implementar retry logic para accounts grandes (como account_id 20)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Para account_id 20 ou outros accounts grandes, adicionar delay
          if (accountId === '20' && attempts > 1) {
            console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 3s...`);
            await delay(3000); // 3 segundos entre tentativas
          }

          // Try different header configurations for problematic accounts
          const requestHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };
          
          // For account ID 20, try different token header formats
          if (accountId === '20' && attempts > 1) {
            console.log(`Attempting alternative headers for account ${accountId}, attempt ${attempts}`);
            // Try both token formats
            requestHeaders['Authorization'] = `Bearer ${token}`;
            requestHeaders['api_access_token'] = token;
          } else {
            requestHeaders['api_access_token'] = token;
          }
          
          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers: requestHeaders,
          });

          if (response.ok) {
            break; // Success!
          }
          
          // Se 401 em account grande, tentar novamente
          if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
            console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
            
            if (attempts < maxAttempts) {
              continue; // Try again
            }
          }
          
          // Para outros erros, falhar imediatamente
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`API fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp API failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
      }

      const data = await response.json();
      
      // Transformar formato dos labels do WiseApp para nosso formato
      const labels = data.payload?.map((label) => ({
        id: label.id,
        name: label.title,
        color: label.color,
        description: label.description
      })) || [];

      console.log(`Labels fetched successfully: ${labels.length} labels`);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(labels)
      };
    } catch (error) {
      console.error('Erro ao buscar labels do WiseApp:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro ao buscar labels do WiseApp',
          details: error.message || 'Erro desconhecido'
        })
      };
    }
  }
  
  // WiseApp apply labels to contact
  console.log(`Checking apply labels pattern for path: "${path}"`);
  if (httpMethod === 'POST' && (path.includes('/wiseapp/') && path.includes('/contacts/') && path.includes('/labels'))) {
    try {
      // Extract company ID and contact ID
      const wiseappMatch = path.match(/\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels/);
      const companyId = wiseappMatch ? wiseappMatch[1] : '2';
      const contactId = wiseappMatch ? wiseappMatch[2] : null;
      
      console.log(`Apply labels - Company: ${companyId}, Contact: ${contactId}`);
      
      const token = headers['wiseapp-token'];
      const accountId = headers['wiseapp-account-id'];
      
      if (!token || !accountId) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token e Account ID obrigatórios' })
        };
      }
      
      if (!contactId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Contact ID não encontrado no path' })
        };
      }
      
      // Parse request body
      let requestBody = {};
      try {
        requestBody = JSON.parse(event.body || '{}');
      } catch (e) {
        console.error('Error parsing request body:', e);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Formato JSON inválido' })
        };
      }
      
      console.log(`Request body:`, requestBody);
      
      // Support both formats: {labels: [...]} and {tagName}
      let labelsToApply = [];
      
      if (requestBody.labels && Array.isArray(requestBody.labels)) {
        labelsToApply = requestBody.labels;
        console.log(`Using provided labels array: ${labelsToApply}`);
      } else if (requestBody.tagName) {
        console.log(`Adding single tag: ${requestBody.tagName}`);
        
        // Get existing labels first
        const getUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
        const getResponse = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        });

        if (getResponse.ok) {
          const currentData = await getResponse.json();
          const existingLabels = currentData.payload || [];
          console.log(`Existing labels: ${existingLabels}`);
          labelsToApply = [...existingLabels, requestBody.tagName];
          console.log(`Final labels to apply: ${labelsToApply}`);
        } else {
          console.log(`Could not get existing labels, applying only new tag`);
          labelsToApply = [requestBody.tagName];
        }
      } else {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Formato inválido. Use {labels: [...]} ou {tagName: "..."}' })
        };
      }
      
      const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      console.log(`Posting to: ${url}`);
      console.log(`Payload: ${JSON.stringify({ labels: labelsToApply })}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ labels: labelsToApply })
      });
      
      console.log(`WiseApp apply labels response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`WiseApp apply labels error: ${response.status} - ${errorText}`);
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
      console.log(`Labels applied successfully`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data })
      };
    } catch (error) {
      console.error('Apply contact labels error:', error);
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
  console.log(`No route matched for ${httpMethod} ${path}`);
  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({
      error: 'Endpoint não encontrado',
      path,
      method: httpMethod,
      debugInfo: {
        originalPath: event.path,
        rawUrl: event.rawUrl,
        actualPath: path
      },
      available_routes: [
        'GET /health',
        'GET /wiseapp/:companyId/labels',
        'GET /wiseapp/:companyId/contacts/search',
        'POST /wiseapp/:companyId/contacts/:contactId/labels'
      ]
    })
  };
};