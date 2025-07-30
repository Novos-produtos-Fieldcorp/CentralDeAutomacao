import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase para produção
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { 
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
});

// Função principal para lidar com requests da API
export const handler = async (event, context) => {
  // Configurar CORS e headers para iframe
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
    'Content-Security-Policy': 'frame-ancestors *;'
  };

  // Lidar com preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    let path = event.path.replace('/.netlify/functions/api', '');
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : null;
    const queryParams = event.queryStringParameters || {};

    console.log('Netlify Function - Raw path:', event.path);
    console.log('Netlify Function - Processed path:', path);
    console.log('Netlify Function - Method:', method);
    
    // Se o path vier como /api/v1/... (do redirect), usar como está
    // Se vier vazio ou como /, significa que o redirect está enviando o splat
    if (!path || path === '/') {
      // Tentar pegar do pathParameters ou do event.rawPath se disponível
      if (event.pathParameters && event.pathParameters.splat) {
        path = '/' + event.pathParameters.splat;
      } else if (event.rawPath) {
        path = event.rawPath.replace('/.netlify/functions/api', '');
      }
    }
    
    console.log('Netlify Function - Final path to use:', path);
    
    // Proxy para WiseApp API - aceitar qualquer path que contenha api/v1
    if (path.includes('/api/v1/')) {
      // Extrair apenas a parte /api/v1/... do path
      const apiPath = path.substring(path.indexOf('/api/v1/'));
      const wiseAppUrl = `https://chat.wiseapp360.com${apiPath}`;
      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = queryString ? `${wiseAppUrl}?${queryString}` : wiseAppUrl;
      
      console.log('Netlify Proxy - API Path extracted:', apiPath);
      console.log('Netlify Proxy - Full URL:', fullUrl);
      console.log('Netlify Proxy - Headers received:', Object.keys(event.headers));
      
      const apiToken = event.headers['api_access_token'] || 
                      event.headers['api-access-token'] || 
                      event.headers['authorization'];
      
      console.log('Netlify Proxy - API Token found:', apiToken ? 'YES' : 'NO');
      
      const fetchOptions = {
        method,
        headers: {
          'api_access_token': apiToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      
      if (method !== 'GET' && body) {
        fetchOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(fullUrl, fetchOptions);
      
      const data = await response.text();
      
      return {
        statusCode: response.status,
        headers: {
          ...headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: data
      };
    }

    // Roteamento para health check
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }

    // Rota para buscar empresa por account_id
    if (path.match(/^\/company\/by-account\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/company\/by-account\/(.+)$/)[1];
      console.log('Netlify: Fetching company for account_id:', accountId);
      
      try {
        const { data: companies, error } = await supabase
          .from('company')
          .select('*')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (error) {
          console.error('Netlify: Error fetching company:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro ao buscar empresa' })
          };
        }

        if (!companies || companies.length === 0) {
          console.log('Netlify: No company found for account_id:', accountId);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Empresa não encontrada' })
          };
        }

        const company = companies[0];
        console.log('Netlify: Found company:', company);

        // Retornar dados no formato esperado pelo frontend
        const response = {
          company_id: company.company_id || company.id,
          razao_social: company.nome_company || company.nome,
          id_conta_wiseapp: company.id_conta_wiseapp
        };

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(response)
        };
      } catch (error) {
        console.error('Netlify: Error in company lookup:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Erro interno do servidor' })
        };
      }
    }

    // Rotas para o sistema de vagas
    if (path.match(/^\/vagas\/dashboard\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/vagas\/dashboard\/(.+)$/)[1];
      console.log('Netlify: Fetching vagas dashboard for account:', accountId);
      
      try {
        // Mapear account_id para company_id
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (!companies || companies.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Company not found' }) };
        }

        const companyId = companies[0].company_id;

        // Buscar estatísticas das vagas
        const { data: vagas } = await supabase
          .from('vaga')
          .select('*')
          .eq('company_id', companyId);

        const totalVagas = vagas ? vagas.length : 0;
        const vagasAbertas = vagas ? vagas.filter(v => !v.st_vaga_id || v.st_vaga_id === 2).length : 0;
        const vagasFechadas = vagas ? vagas.filter(v => v.st_vaga_id === 1).length : 0;
        const vagasVencendo = vagas ? vagas.filter(v => {
          if (!v.dt_limite) return false;
          const hoje = new Date();
          const limite = new Date(v.dt_limite);
          const diffTime = limite.getTime() - hoje.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7 && diffDays >= 0;
        }).length : 0;

        const dashboardData = { totalVagas, vagasAbertas, vagasFechadas, vagasVencendo };
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(dashboardData)
        };
      } catch (error) {
        console.error('Netlify: Error fetching vagas dashboard:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    // Rota para listar vagas
    if (path.match(/^\/vagas\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/vagas\/(.+)$/)[1];
      
      try {
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (!companies || companies.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Company not found' }) };
        }

        const companyId = companies[0].company_id;

        const { data: vagas } = await supabase
          .from('vaga')
          .select(`
            *,
            cliente:cliente_id(nome),
            unidade:unidade_id(unidade),
            operacao:operacao_id(operacao),
            status:st_vaga_id(status_vaga)
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(vagas || [])
        };
      } catch (error) {
        console.error('Netlify: Error fetching vagas:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    // Rota para criar vaga
    if (path === '/vagas' && method === 'POST') {
      try {
        const { data: vaga, error } = await supabase
          .from('vaga')
          .insert([body])
          .select()
          .single();

        if (error) {
          console.error('Netlify: Error creating vaga:', error);
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao criar vaga' }) };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: 'Vaga criada com sucesso', vaga })
        };
      } catch (error) {
        console.error('Netlify: Error in create vaga:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    // Rota para atualizar vaga
    if (path.match(/^\/vagas\/(\d+)$/) && method === 'PUT') {
      const vagaId = path.match(/^\/vagas\/(\d+)$/)[1];
      
      try {
        const { data: vaga, error } = await supabase
          .from('vaga')
          .update(body)
          .eq('id', vagaId)
          .select()
          .single();

        if (error) {
          console.error('Netlify: Error updating vaga:', error);
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao atualizar vaga' }) };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Vaga atualizada com sucesso', vaga })
        };
      } catch (error) {
        console.error('Netlify: Error in update vaga:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    // Rotas para clientes, unidades, operações e status
    if (path.match(/^\/clientes\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/clientes\/(.+)$/)[1];
      
      try {
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (!companies || companies.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify([]) };
        }

        const companyId = companies[0].company_id;

        const { data: clientes } = await supabase
          .from('cliente')
          .select('*')
          .eq('company_id', companyId)
          .order('nome');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(clientes || [])
        };
      } catch (error) {
        console.error('Netlify: Error fetching clientes:', error);
        return { statusCode: 500, headers, body: JSON.stringify([]) };
      }
    }

    if (path.match(/^\/unidades\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/unidades\/(.+)$/)[1];
      
      try {
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (!companies || companies.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify([]) };
        }

        const companyId = companies[0].company_id;

        const { data: unidades } = await supabase
          .from('unidade')
          .select('*')
          .eq('company_id', companyId)
          .order('unidade');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(unidades || [])
        };
      } catch (error) {
        console.error('Netlify: Error fetching unidades:', error);
        return { statusCode: 500, headers, body: JSON.stringify([]) };
      }
    }

    if (path.match(/^\/operacoes\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/operacoes\/(.+)$/)[1];
      
      try {
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (!companies || companies.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify([]) };
        }

        const companyId = companies[0].company_id;

        const { data: operacoes } = await supabase
          .from('operacao')
          .select('*')
          .eq('company_id', companyId)
          .order('operacao');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(operacoes || [])
        };
      } catch (error) {
        console.error('Netlify: Error fetching operacoes:', error);
        return { statusCode: 500, headers, body: JSON.stringify([]) };
      }
    }

    if (path.match(/^\/status-vagas\/(.+)$/) && method === 'GET') {
      const accountId = path.match(/^\/status-vagas\/(.+)$/)[1];
      
      try {
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);

        if (!companies || companies.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify([]) };
        }

        const companyId = companies[0].company_id;

        const { data: statusVagas } = await supabase
          .from('st_vaga')
          .select('*')
          .eq('company_id', companyId)
          .order('status_vaga');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(statusVagas || [])
        };
      } catch (error) {
        console.error('Netlify: Error fetching status vagas:', error);
        return { statusCode: 500, headers, body: JSON.stringify([]) };
      }
    }

    // Rotas POST para criar unidades, operações e status inline
    if (path === '/unidades' && method === 'POST') {
      try {
        const { data: unidade, error } = await supabase
          .from('unidade')
          .insert([body])
          .select()
          .single();

        if (error) {
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao criar unidade' }) };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: 'Unidade criada com sucesso', unidade })
        };
      } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    if (path === '/operacoes' && method === 'POST') {
      try {
        const { data: operacao, error } = await supabase
          .from('operacao')
          .insert([body])
          .select()
          .single();

        if (error) {
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao criar operação' }) };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: 'Operação criada com sucesso', operacao })
        };
      } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    if (path === '/status-vagas' && method === 'POST') {
      try {
        const { data: status, error } = await supabase
          .from('st_vaga')
          .insert([body])
          .select()
          .single();

        if (error) {
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao criar status' }) };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: 'Status criado com sucesso', status })
        };
      } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
      }
    }

    // Rota não encontrada
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found', path, method })
    };

  } catch (error) {
    console.error('Error in API function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};