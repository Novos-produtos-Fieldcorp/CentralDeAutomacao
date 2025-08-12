import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    console.log('Netlify Function - Path:', path, 'Method:', method);

    // Rota específica para inboxes com validação de company_id e token
    if (path.match(/^\/chatwoot\/inboxes\/(\d+)$/)) {
      const companyId = path.match(/^\/chatwoot\/inboxes\/(\d+)$/)[1];
      const account_id = queryParams.account_id;

      console.log(`Netlify: Fetching inboxes for company_id: ${companyId}, account_id: ${account_id}`);

      // Buscar token WiseApp para esta empresa
      const { data: tokenData, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);

      if (tokenError || !tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "Token WiseApp não configurado para esta empresa" 
          })
        };
      }

      const token = tokenData[0].access_token_wiseapp;

      // Buscar dados da empresa para validar account_id
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', parseInt(companyId))
        .eq('id_conta_wiseapp', account_id)
        .limit(1);

      if (companyError || !companies || companies.length === 0) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            error: "Account ID não corresponde à empresa especificada" 
          })
        };
      }

      // Fazer requisição para o ChatWoot
      const targetUrl = `https://chat.wiseapp360.com/api/v1/accounts/${account_id}/inboxes`;

      console.log(`Netlify: Making request to ChatWoot: ${targetUrl}`);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ 
              error: "Token de autenticação inválido ou expirado" 
            })
          };
        } else if (response.status === 403) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ 
              error: "Acesso negado. Verifique as permissões da conta" 
            })
          };
        } else if (response.status === 404) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              error: "Conta não encontrada no ChatWoot" 
            })
          };
        }
        
        console.error(`Netlify: ChatWoot API error: ${response.status}`);
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ 
            error: `ChatWoot API error: ${response.status}` 
          })
        };
      }

      const data = await response.json();
      
      // Adicionar metadados para cache
      const responseData = {
        ...data,
        _cache_metadata: {
          company_id: parseInt(companyId),
          account_id: account_id,
          timestamp: Date.now(),
          expires_at: Date.now() + (60 * 60 * 1000) // 1 hora
        }
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseData)
      };
    }

    // Proxy WiseApp API (fallback para outras rotas)
    if (path.includes('/api/v1/')) {
      const apiPath = path.substring(path.indexOf('/api/v1/'));
      const wiseAppUrl = `https://chat.wiseapp360.com${apiPath}`;
      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = queryString ? `${wiseAppUrl}?${queryString}` : wiseAppUrl;
      
      // Configurar headers para WiseApp
      const wiseAppHeaders = {
        'Content-Type': 'application/json'
      };
      
      // Usar API key das variáveis de ambiente ou das headers
      const apiKey = process.env.VITE_CHAT_API_KEY || event.headers['x-api-key'] || event.headers.authorization;
      if (apiKey) {
        wiseAppHeaders['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
      }
      
      console.log('Proxying to WiseApp:', fullUrl, 'Headers:', Object.keys(wiseAppHeaders));
      
      const response = await fetch(fullUrl, {
        method: method,
        headers: wiseAppHeaders,
        body: method !== 'GET' ? JSON.stringify(body) : undefined
      });

      const data = await response.text();
      console.log('WiseApp response status:', response.status);
      
      return {
        statusCode: response.status,
        headers,
        body: data
      };
    }

    // Rota para buscar token WiseApp por company_id
    if (path.match(/^\/wiseapp-token\/(\d+)$/)) {
      const companyId = path.match(/^\/wiseapp-token\/(\d+)$/)[1];
      console.log("Netlify: Fetching WiseApp token for company_id:", companyId);
      
      const { data: tokenData, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (tokenError || !tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "Token WiseApp não encontrado",
            message: "Configure o token WiseApp nas configurações da empresa" 
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ token: tokenData[0].access_token_wiseapp })
      };
    }

    // API Routes
    if (path.startsWith('/company/by-account/')) {
      const accountId = path.split('/').pop();
      console.log('Looking for company with account_id:', accountId);
      
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .eq('id_conta_wiseapp', accountId);
      
      console.log('Supabase query result:', { data, error });
      
      if (error || !data || data.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `Company not found for account_id: ${accountId}` })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data[0])
      };
    }

    if (path.startsWith('/vagas/dashboard/')) {
      const accountId = path.split('/').pop();
      
      // Buscar company_id
      const { data: companies } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId);

      if (!companies || companies.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: `Company not found for account_id: ${accountId}` }) };
      }
      
      const company = companies[0];

      // Contar vagas
      const { data: vagas } = await supabase
        .from('vaga')
        .select('*')
        .eq('company_id', company.company_id);

      const totalVagas = vagas?.length || 0;
      const vagasAbertas = vagas?.filter(v => v.st_vaga_id === 1).length || 0;
      const vagasFechadas = vagas?.filter(v => v.st_vaga_id === 2).length || 0;
      
      // Vagas vencendo (próximos 7 dias)
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const vagasVencendo = vagas?.filter(v => 
        v.dt_limite && new Date(v.dt_limite) <= nextWeek
      ).length || 0;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          totalVagas,
          vagasAbertas,
          vagasFechadas,
          vagasVencendo
        })
      };
    }

    if (path.startsWith('/vagas/') && method === 'GET') {
      const accountId = path.split('/').pop();
      
      const { data: companies } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId);

      if (!companies || companies.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: `Company not found for account_id: ${accountId}` }) };
      }
      
      const company = companies[0];

      const { data: vagas } = await supabase
        .from('vaga')
        .select(`
          *,
          cliente:cliente_id(nome_cliente),
          unidade:unidade_id(nome_unidade),
          operacao:operacao_id(nome_operacao),
          status:st_vaga_id(nome_status)
        `)
        .eq('company_id', company.company_id)
        .order('created_at', { ascending: false });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(vagas || [])
      };
    }

    if (path === '/vagas' && method === 'POST') {
      const { data: vaga } = await supabase
        .from('vaga')
        .insert(body)
        .select()
        .single();

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(vaga)
      };
    }

    if (path.startsWith('/clientes/')) {
      const accountId = path.split('/').pop();
      
      const { data: companies } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId);

      if (!companies || companies.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify([]) };
      }
      
      const company = companies[0];

      const { data: clientes } = await supabase
        .from('cliente')
        .select('*')
        .eq('company_id', company.company_id)
        .order('nome_cliente');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(clientes || [])
      };
    }

    if (path.startsWith('/unidades/')) {
      const accountId = path.split('/').pop();
      
      const { data: companies } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId);

      if (!companies || companies.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify([]) };
      }
      
      const company = companies[0];

      const { data: unidades } = await supabase
        .from('unidade')
        .select('*')
        .eq('company_id', company.company_id)
        .order('nome_unidade');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(unidades || [])
      };
    }

    if (path === '/unidades' && method === 'POST') {
      const { data: unidade } = await supabase
        .from('unidade')
        .insert(body)
        .select()
        .single();

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(unidade)
      };
    }

    if (path.startsWith('/operacoes/')) {
      const accountId = path.split('/').pop();
      
      const { data: companies } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId);

      if (!companies || companies.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify([]) };
      }
      
      const company = companies[0];

      const { data: operacoes } = await supabase
        .from('operacao')
        .select('*')
        .eq('company_id', company.company_id)
        .order('nome_operacao');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(operacoes || [])
      };
    }

    if (path === '/operacoes' && method === 'POST') {
      const { data: operacao } = await supabase
        .from('operacao')
        .insert(body)
        .select()
        .single();

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(operacao)
      };
    }

    if (path.startsWith('/status-vagas/')) {
      const accountId = path.split('/').pop();
      
      const { data: companies } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId);

      if (!companies || companies.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify([]) };
      }
      
      const company = companies[0];

      const { data: status } = await supabase
        .from('st_vaga')
        .select('*')
        .eq('company_id', company.company_id)
        .order('nome_status');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(status || [])
      };
    }

    if (path === '/status-vagas' && method === 'POST') {
      const { data: status } = await supabase
        .from('st_vaga')
        .insert(body)
        .select()
        .single();

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(status)
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Netlify Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};