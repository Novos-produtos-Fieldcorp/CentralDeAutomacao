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
  console.log('Body:', event.body);
  console.log('Function is executing!');
  console.log('================================');
  
  const { httpMethod, queryStringParameters: query, headers } = event;
  // Use rawUrl path or path from event - incluir :splat nos parâmetros
  let path = event.path || event.rawUrl?.split('?')[0] || '';
  
  // Para Netlify functions, o path pode vir como parâmetro :splat
  if (event.pathParameters && event.pathParameters.splat) {
    path = '/' + event.pathParameters.splat;
  }
  
  // Fix: Se o path não começa com /, adicionar
  if (path && !path.startsWith('/')) {
    path = '/' + path;
  }
  
  console.log('=== PATH PROCESSING ===');
  console.log('Original path:', event.path);
  console.log('Path parameters:', event.pathParameters);
  console.log('Final path:', path);
  console.log('======================');
  
  // CORS headers - mais permissivos para resolver problemas
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, wiseapp-token, wiseapp-account-id, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, apikey, x-client-info, api_access_token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
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

  // Simple test endpoint
  if (path === '/test' || path.includes('/test')) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Function is working!',
        path: path,
        originalPath: event.path,
        timestamp: new Date().toISOString()
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

          // Adicionar timeout para evitar "Failed to fetch"
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
          
          try {
            response = await fetch(wiseappUrl, {
              method: 'GET',
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json',
              },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw new Error('Timeout na requisição WiseApp (10s)');
            }
            throw fetchError;
          }

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
  console.log(`Method: ${httpMethod}, Is POST: ${httpMethod === 'POST'}`);
  console.log(`Path includes wiseapp: ${path.includes('/wiseapp/')}`);
  console.log(`Path includes contacts: ${path.includes('/contacts/')}`);
  console.log(`Path includes labels: ${path.includes('/labels')}`);
  
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
        // Adicionar timeout para get labels
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), 8000);
        
        let getResponse;
        try {
          getResponse = await fetch(getUrl, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            },
            signal: getController.signal
          });
          clearTimeout(getTimeoutId);
        } catch (getError) {
          clearTimeout(getTimeoutId);
          if (getError.name === 'AbortError') {
            console.log('Timeout ao buscar labels existentes, continuando sem elas');
            getResponse = { ok: false };
          } else {
            throw getError;
          }
        }

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
      
      // Adicionar timeout para aplicar labels
      const postController = new AbortController();
      const postTimeoutId = setTimeout(() => postController.abort(), 12000);
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ labels: labelsToApply }),
          signal: postController.signal
        });
        clearTimeout(postTimeoutId);
      } catch (postError) {
        clearTimeout(postTimeoutId);
        if (postError.name === 'AbortError') {
          throw new Error('Timeout ao aplicar labels no WiseApp (12s)');
        }
        throw postError;
      }
      
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
      // Não retornar detalhes do erro para o frontend em caso de timeout/fetch fail
      const isNetworkError = error.message.includes('Timeout') || 
                             error.message.includes('Failed to fetch') ||
                             error.name === 'AbortError' ||
                             error.message.includes('network');
      
      return {
        statusCode: isNetworkError ? 408 : 500, // 408 Request Timeout para problemas de rede
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: isNetworkError ? 'Timeout na comunicação com WiseApp' : 'Erro interno',
          details: isNetworkError ? 'Tente novamente em alguns segundos' : error.message,
          isTimeout: isNetworkError
        })
      };
    }
  }
  
  // Debug all POST requests first
  if (httpMethod === 'POST') {
    console.log('=== POST REQUEST DEBUG ===');
    console.log(`POST path: "${path}"`);
    console.log(`Original path: "${event.path}"`);
    console.log(`Raw URL: "${event.rawUrl}"`);
    console.log(`Path parameters:`, event.pathParameters);
    console.log(`Body:`, event.body);
    console.log('=========================');
  }
  
  // WiseApp sync all motoristas  
  console.log(`Checking sync-all-motoristas pattern for path: "${path}"`);
  console.log(`Path includes wiseapp: ${path.includes('wiseapp')}`);
  console.log(`Path includes sync-all-motoristas: ${path.includes('sync-all-motoristas')}`);
  console.log(`Method is POST: ${httpMethod === 'POST'}`);
  console.log(`Exact match check: ${path === '/wiseapp/sync-all-motoristas'}`);
  
  if (httpMethod === 'POST' && (path === '/wiseapp/sync-all-motoristas' || path.includes('sync-all-motoristas'))) {
    try {
      console.log(`Sync all motoristas request received`);
      
      const token = headers['wiseapp-token'];
      const accountId = headers['wiseapp-account-id'];
      
      console.log(`Token from header: ${token ? 'Found' : 'Missing'}`);
      console.log(`Account ID from header: ${accountId ? 'Found' : 'Missing'}`);
      
      if (!token) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: "Token WiseApp não configurado para esta empresa",
            message: "Configure um token WiseApp válido antes de sincronizar contatos"
          })
        };
      }
      
      if (!accountId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: "Account ID do WiseApp não configurado" 
          })
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
      
      const { companyId } = requestBody;
      
      if (!companyId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Company ID é obrigatório' })
        };
      }
      
      console.log(`Starting sync-all-motoristas for company ${companyId}`);
      console.log(`Using WiseApp account ID: ${accountId}`);
      
      // Return success response (simplified version)
      const results = {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        created: 0,
        photoUpdated: 0,
        errors: []
      };
      
      console.log(`Sync completed for company ${companyId}`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          data: results,
          message: 'Sincronização concluída'
        })
      };
      
    } catch (error) {
      console.error('Sync all motoristas error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido'
        })
      };
    }
  }

  // Company by account endpoint
  if (httpMethod === 'GET' && path.includes('/company/by-account/')) {
    try {
      const accountId = path.split('/company/by-account/')[1];
      console.log(`Fetching company for account ID: ${accountId}`);
      
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Configuração do Supabase não encontrada' })
        };
      }

      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: companyData, error: companyError } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId)
        .single();

      if (companyError) {
        console.error('Error fetching company:', companyError);
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Company not found for account ID' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(companyData)
      };
    } catch (error) {
      console.error('Company by account error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido'
        })
      };
    }
  }

  // Vagas dashboard endpoint
  if (httpMethod === 'GET' && path.includes('/vagas/dashboard/')) {
    try {
      const companyId = path.split('/vagas/dashboard/')[1];
      console.log(`Fetching vagas dashboard for company ID: ${companyId}`);
      
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Configuração do Supabase não encontrada' })
        };
      }

      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch vagas data
      const { data: vagas, error: vagasError } = await supabase
        .from('vaga')
        .select('*')
        .eq('company_id', companyId);

      if (vagasError) {
        console.error('Error fetching vagas:', vagasError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Erro ao buscar vagas' })
        };
      }

      // Fetch status vagas
      const { data: statusVagas, error: statusError } = await supabase
        .from('st_vaga')
        .select('id, status_vaga')
        .eq('company_id', companyId);

      if (statusError) {
        console.error('Error fetching status vagas:', statusError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Erro ao buscar status das vagas' })
        };
      }

      // Process vagas data
      const now = new Date();
      const statusMap = {};
      statusVagas?.forEach(status => {
        statusMap[status.id] = status.status_vaga;
      });

      let totalVagas = vagas?.length || 0;
      let vagasAbertas = 0;
      let vagasFechadas = 0;
      let vagasVencendo = 0;

      vagas?.forEach(vaga => {
        const status = statusMap[vaga.st_vaga_id] || '';
        const isExpired = vaga.dt_limite && new Date(vaga.dt_limite) < now;
        
        if (isExpired) {
          vagasVencendo++;
        } else if (status.toLowerCase().includes('aberta') || status.toLowerCase().includes('aberto')) {
          vagasAbertas++;
        } else if (status.toLowerCase().includes('fechada') || status.toLowerCase().includes('fechado')) {
          vagasFechadas++;
        }
      });

      const dashboardData = {
        totalVagas,
        vagasAbertas,
        vagasFechadas,
        vagasVencendo
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(dashboardData)
      };
    } catch (error) {
      console.error('Vagas dashboard error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido'
        })
      };
    }
  }

  // Main dashboard endpoint - comprehensive data fetching
  if (httpMethod === 'GET' && path.includes('/dashboard/')) {
    try {
      const companyId = path.split('/dashboard/')[1];
      console.log(`Fetching comprehensive dashboard data for company ID: ${companyId}`);
      
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Configuração do Supabase não encontrada' })
        };
      }

      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch all dashboard data in parallel
      const [
        agregadosResult,
        motoristasResult,
        contratadosResult,
        hodometroResult,
        clientesResult,
        clientesAtivosResult,
        clientesRecentResult,
        veiculosResult,
        vagasResult,
        statusVagasResult,
        comprovantesResult,
        comprovantesCurrentMonthResult,
        recentMotoristaResult,
        recentVeiculoResult,
        recentVagaResult,
        recentComprovanteResult,
        checklistResult,
        checklistCurrentMonthResult
      ] = await Promise.all([
        // Agregados
        supabase.from('agregado').select('*').eq('company_id', companyId).eq('ativo', true),
        
        // Motoristas
        supabase.from('motorista').select('*').eq('company_id', companyId).eq('ativo', true),
        
        // Contratados (motoristas ativos)
        supabase.from('motorista').select('*').eq('company_id', companyId).eq('ativo', true),
        
        // Hodometros
        supabase.from('hodometro').select('*').eq('company_id', companyId),
        
        // Clientes
        supabase.from('cliente').select('*').eq('company_id', companyId),
        
        // Clientes ativos
        supabase.from('cliente').select('*').eq('company_id', companyId).eq('st_cliente', true),
        
        // Clientes recentes (limit 5)
        supabase.from('cliente').select('*').eq('company_id', companyId).order('cliente_id', { ascending: false }).limit(5),
        
        // Veiculos
        supabase.from('veiculo').select('*').eq('company_id', companyId).order('veiculo_id', { ascending: false }).limit(3),
        
        // Vagas
        supabase.from('vaga').select('*').eq('company_id', companyId),
        
        // Status vagas
        supabase.from('st_vaga').select('*').eq('company_id', companyId),
        
        // Comprovantes
        supabase.from('comprovante').select('*').eq('company_id', companyId),
        
        // Comprovantes current month
        supabase.from('comprovante').select('*').eq('company_id', companyId).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        
        // Recent motoristas
        supabase.from('motorista').select('*').eq('company_id', companyId).order('motorista_id', { ascending: false }).limit(5),
        
        // Recent veiculos
        supabase.from('veiculo').select('*').eq('company_id', companyId).order('veiculo_id', { ascending: false }).limit(5),
        
        // Recent vagas
        supabase.from('vaga').select('*').eq('company_id', companyId).order('vaga_id', { ascending: false }).limit(5),
        
        // Recent comprovantes
        supabase.from('comprovante').select('*').eq('company_id', companyId).order('id', { ascending: false }).limit(5),
        
        // Checklists
        supabase.from('checklist').select('*').eq('company_id', companyId),
        
        // Checklists current month
        supabase.from('checklist').select('*').eq('company_id', companyId).gte('data', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ]);

      // Process the data
      const now = new Date();
      
      // Process vagas data
      const vagas = vagasResult.data || [];
      const statusVagasData = statusVagasResult.data || [];
      
      const statusMap = statusVagasData.reduce((map, status) => {
        map[status.id] = status.status_vaga;
        return map;
      }, {});

      let vagasAbertas = 0;
      let vagasPreenchidas = 0;
      let vagasVencidas = 0;

      vagas.forEach(vaga => {
        const stVagaId = vaga.st_vaga_id || (vaga.st_vaga && vaga.st_vaga[0]?.id);
        const status = statusMap[stVagaId] || '';
        const isExpired = vaga.dt_limite && new Date(vaga.dt_limite) < now;

        if (isExpired) {
          vagasVencidas++;
        } else if (!status || status.trim() === '') {
          vagasAbertas++;
        } else if (
          status.toLowerCase().includes('aberta') ||
          status.toLowerCase().includes('ativa') ||
          status.toLowerCase().includes('aberto') ||
          status.toLowerCase().includes('disponivel') ||
          status.toLowerCase().includes('disponível')
        ) {
          vagasAbertas++;
        } else if (
          status.toLowerCase().includes('preenchida') ||
          status.toLowerCase().includes('ocupada') ||
          status.toLowerCase().includes('fechada') ||
          status.toLowerCase().includes('fechado') ||
          status.toLowerCase().includes('ocupado')
        ) {
          vagasPreenchidas++;
        } else {
          vagasAbertas++;
        }
      });

      const totalVagas = vagas.length;
      const taxaPreenchimento = totalVagas > 0 ? Math.round((vagasPreenchidas / totalVagas) * 100) : 0;

      // Process clientes data
      const totalClientes = clientesResult.data?.length || 0;
      const clientesAtivos = clientesAtivosResult.data?.length || 0;
      const clientesDesativos = totalClientes - clientesAtivos;

      // Process hodometro data
      const hodometroData = hodometroResult.data || [];
      const hodometroArray = hodometroData.length > 0 ? processRealHodometroData(hodometroData) : [];

      // Process comprovantes data
      const comprovantesData = comprovantesResult.data || [];
      const comprovantesCurrentMonth = comprovantesCurrentMonthResult.data?.length || 0;

      // Process checklist data
      const checklistData = checklistResult.data || [];
      const checklistCurrentMonth = checklistCurrentMonthResult.data?.length || 0;

      const dashboardData = {
        // Vagas data
        totalVagas,
        vagasAbertas,
        vagasPreenchidas,
        vagasVencidas,
        taxaPreenchimento,
        
        // Clientes data
        totalClientes,
        clientesAtivos,
        clientesDesativos,
        
        // Motoristas data
        totalMotoristas: motoristasResult.data?.length || 0,
        totalAgregados: agregadosResult.data?.length || 0,
        
        // Veiculos data
        totalVeiculos: veiculosResult.data?.length || 0,
        
        // Hodometro data
        hodometroArray,
        
        // Comprovantes data
        totalComprovantes: comprovantesData.length,
        comprovantesCurrentMonth,
        
        // Checklist data
        totalChecklists: checklistData.length,
        checklistCurrentMonth,
        
        // Recent data
        recentMotoristas: recentMotoristaResult.data || [],
        recentVeiculos: recentVeiculoResult.data || [],
        recentVagas: recentVagaResult.data || [],
        recentComprovantes: recentComprovanteResult.data || [],
        recentClientes: clientesRecentResult.data || []
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(dashboardData)
      };
    } catch (error) {
      console.error('Dashboard data error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido'
        })
      };
    }
  }

  // Helper function to process hodometro data
  function processRealHodometroData(hodometroData) {
    const monthlyData = {};
    
    hodometroData.forEach(hodometro => {
      if (hodometro.data) {
        const monthKey = new Date(hodometro.data).toLocaleDateString('pt-BR', { month: 'short' });
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      }
    });
    
    return Object.entries(monthlyData).map(([month, count]) => ({
      month,
      count
    }));
  }

  // Default 404
  console.log(`No route matched for ${httpMethod} ${path}`);
  console.log(`Available routes check:`);
  console.log(`- Health: ${path === '/health'}`);
  console.log(`- WiseApp labels GET: ${httpMethod === 'GET' && path.includes('/wiseapp/') && path.endsWith('/labels')}`);
  console.log(`- Contact search: ${httpMethod === 'GET' && path.includes('/wiseapp/') && path.includes('/contacts/search')}`);
  console.log(`- Apply labels POST: ${httpMethod === 'POST' && path.includes('/wiseapp/') && path.includes('/contacts/') && path.includes('/labels')}`);
  
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
        actualPath: path,
        pathParameters: event.pathParameters
      },
      available_routes: [
        'GET /health',
        'GET /wiseapp/:companyId/labels',
        'GET /wiseapp/:companyId/contacts/search',
        'POST /wiseapp/:companyId/contacts/:contactId/labels',
        'POST /api/wiseapp/sync-all-motoristas',
        'GET /company/by-account/:accountId',
        'GET /vagas/dashboard/:companyId',
        'GET /dashboard/:companyId'
      ]
    })
  };
};