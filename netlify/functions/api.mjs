import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "public" },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
    },
  },
});

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, api_access_token, company-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const path = event.path.replace('/.netlify/functions/api', '') || '/';
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : null;
    const queryParams = event.queryStringParameters || {};

    console.log('Netlify Function - Path:', path, 'Method:', method, 'QueryParams:', queryParams);

    // Rota GET /tags para buscar tags por company_id - Implementação simplificada
    if (path === '/tags' && method === 'GET') {
      console.log('NETLIFY TAGS: Starting route with params:', queryParams);
      
      const companyId = queryParams.company_id;
      
      if (!companyId) {
        console.log('NETLIFY TAGS: Missing company_id');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "company_id é obrigatório" })
        };
      }
      
      try {
        console.log('NETLIFY TAGS: Querying Supabase for company_id:', companyId);
        
        // Busca simples igual ao storage.getTags()
        const { data: tags, error } = await supabase
          .from('tags')
          .select('*')
          .eq('company_id', parseInt(companyId));
        
        console.log('NETLIFY TAGS: Query result - error:', !!error, 'data length:', tags?.length);
        
        if (error) {
          console.error('NETLIFY TAGS: Supabase error:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: "Erro ao buscar tags",
              details: error.message
            })
          };
        }
        
        console.log('NETLIFY TAGS: Returning', tags?.length || 0, 'tags');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(tags || [])
        };
        
      } catch (error) {
        console.error('NETLIFY TAGS: Exception:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: "Erro interno",
            details: error.message
          })
        };
      }
    }

    // Rota para buscar todas as labels de uma empresa (simulado via contatos)
    if (path.match(/^\/wiseapp\/(\d+)\/labels$/) && method === 'GET') {
      const matches = path.match(/^\/wiseapp\/(\d+)\/labels$/);
      const companyId = matches[1];
      
      console.log(`Netlify: Getting all labels for company ${companyId}`);
      
      // Buscar dados da empresa
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (companyError || !companies || companies.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Empresa não encontrada" })
        };
      }
      
      const accountId = companies[0].id_conta_wiseapp;
      
      // Buscar token WiseApp
      const { data: tokenData, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (tokenError || !tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Token WiseApp não configurado" })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      try {
        // Como ChatWoot não tem endpoint global para labels, 
        // vamos buscar labels das tags locais e retornar no formato ChatWoot
        const { data: localTags } = await supabase
          .from('tags')
          .select('*')
          .eq('company_id', parseInt(companyId))
          .order('nome');
        
        // Converter tags locais para formato ChatWoot
        const labelsResponse = (localTags || []).map(tag => ({
          id: tag.id,
          name: tag.nome,
          color: tag.cor,
          description: tag.nome
        }));
        
        console.log(`Returning ${labelsResponse.length} labels for company ${companyId}`);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(labelsResponse)
        };
        
      } catch (error) {
        console.error('Error getting company labels:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Erro ao buscar labels da empresa',
            details: error.message
          })
        };
      }
    }

    // Rota para buscar labels de um contato específico no ChatWoot
    if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\w+)\/labels$/) && method === 'GET') {
      const matches = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\w+)\/labels$/);
      const companyId = matches[1];
      const contactId = matches[2];
      
      console.log(`Netlify: Getting labels for contact ${contactId} in company ${companyId}`);
      
      // Buscar dados da empresa
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (companyError || !companies || companies.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Empresa não encontrada" })
        };
      }
      
      const accountId = companies[0].id_conta_wiseapp;
      
      // Buscar token WiseApp
      const { data: tokenData, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (tokenError || !tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Token WiseApp não configurado" })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      try {
        // Buscar labels do contato no ChatWoot
        const labelsResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
          method: 'GET',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!labelsResponse.ok) {
          return {
            statusCode: labelsResponse.status,
            headers,
            body: JSON.stringify({
              error: `ChatWoot API error: ${labelsResponse.status}`,
              message: "Erro ao buscar labels do contato"
            })
          };
        }
        
        const data = await labelsResponse.json();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(data)
        };
        
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Erro ao buscar labels do contato',
            details: error.message
          })
        };
      }
    }

    // Rota para aplicar labels a um contato específico no ChatWoot
    if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\w+)\/labels$/) && method === 'POST') {
      const matches = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\w+)\/labels$/);
      const companyId = matches[1];
      const contactId = matches[2];
      
      console.log(`Netlify: Managing labels for contact ${contactId} in company ${companyId}`);
      
      const labelsToApply = body?.labels || [];
      
      // Buscar dados da empresa
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (companyError || !companies || companies.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Empresa não encontrada" })
        };
      }
      
      const accountId = companies[0].id_conta_wiseapp;
      
      // Buscar token WiseApp
      const { data: tokenData, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (tokenError || !tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Token WiseApp não configurado" })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      try {
        // Aplicar labels ao contato no ChatWoot
        const labelsResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
          method: 'POST',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ labels: labelsToApply })
        });
        
        if (!labelsResponse.ok) {
          return {
            statusCode: labelsResponse.status,
            headers,
            body: JSON.stringify({
              error: `ChatWoot API error: ${labelsResponse.status}`,
              message: "Erro ao aplicar labels ao contato"
            })
          };
        }
        
        const data = await labelsResponse.json();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(data)
        };
        
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Erro ao gerenciar labels do contato',
            details: error.message
          })
        };
      }
    }

    // Rota de proxy para outras chamadas WiseApp/ChatWoot
    if (path.includes('/api/v1/')) {
      const apiPath = path.substring(path.indexOf('/api/v1/'));
      const wiseAppUrl = `https://chat.wiseapp360.com${apiPath}`;
      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = queryString ? `${wiseAppUrl}?${queryString}` : wiseAppUrl;
      
      // Buscar token baseado no account_id extraído da URL
      const accountMatch = apiPath.match(/\/accounts\/(\d+)\//);
      let token = null;
      
      if (accountMatch) {
        const accountId = accountMatch[1];
        
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);
        
        if (companies && companies.length > 0) {
          const { data: tokenData } = await supabase
            .from('wiseapp_acesso')
            .select('access_token_wiseapp')
            .eq('company_id', companies[0].company_id)
            .limit(1);
          
          if (tokenData && tokenData.length > 0) {
            token = tokenData[0].access_token_wiseapp;
          }
        }
      }
      
      const wiseAppHeaders = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        wiseAppHeaders['api_access_token'] = token;
      } else {
        const apiKey = event.headers['api_access_token'] || event.headers['authorization'] || process.env.VITE_CHAT_API_KEY;
        if (apiKey) {
          wiseAppHeaders['api_access_token'] = apiKey;
        }
      }
      
      console.log('Token found from DB:', !!token);
      console.log('Token from headers:', !!event.headers['api_access_token']);
      console.log('Final token being used:', !!wiseAppHeaders['api_access_token']);
      
      console.log('Proxying to WiseApp:', fullUrl, 'Has token:', !!wiseAppHeaders['api_access_token']);
      
      const response = await fetch(fullUrl, {
        method: method,
        headers: wiseAppHeaders,
        body: method !== 'GET' ? JSON.stringify(body) : undefined
      });

      const data = await response.json();
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify(data)
      };
    }

    // Fallback - rota não encontrada
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found', path, method })
    };

  } catch (error) {
    console.error('Netlify Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};