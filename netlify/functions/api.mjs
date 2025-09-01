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

    // Rota para tags
    if (path === '/tags' && method === 'GET') {
      const companyId = queryParams.company_id;
      
      if (!companyId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'company_id is required' })
        };
      }

      const { data: tags, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', companyId)
        .order('nome');

      if (error) {
        console.error('Error fetching tags:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch tags' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(tags || [])
      };
    }

    if (path === '/tags' && method === 'POST') {
      const { data: tag, error } = await supabase
        .from('tags')
        .insert(body)
        .select()
        .single();

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create tag' })
        };
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(tag)
      };
    }

    if (path.match(/^\/tags\/(\d+)$/) && method === 'PUT') {
      const tagId = path.match(/^\/tags\/(\d+)$/)[1];
      
      const { data: tag, error } = await supabase
        .from('tags')
        .update(body)
        .eq('id', tagId)
        .select()
        .single();

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to update tag' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(tag)
      };
    }

    if (path.match(/^\/tags\/(\d+)$/) && method === 'DELETE') {
      const tagId = path.match(/^\/tags\/(\d+)$/)[1];
      
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to delete tag' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
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