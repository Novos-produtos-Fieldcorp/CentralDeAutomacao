import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, company-id, wiseapp-token, wiseapp-account-id, api_access_token, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
  'Access-Control-Allow-Credentials': 'true',
}

serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname.replace('/api', '')
  const method = req.method

  console.log(`[${method}] ${path}`)
  console.log(`Full URL: ${req.url}`)
  console.log(`Pathname: ${url.pathname}`)
  console.log(`Looking for sync-all-motoristas: ${path === '/wiseapp/sync-all-motoristas'}`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (path === '/health' && method === 'GET') {
    return new Response(JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: 'supabase-edge',
      version: '2.0.0'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Initialize Supabase clien    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)


    // WiseApp routes
    if (path.startsWith('/wiseapp/')) {
      return await handleWiseAppRoutes(req, path, method, supabase)
    }

    // Companies routes
    if (path.startsWith('/companies')) {
      return await handleCompanyRoutes(req, path, method, supabase)
    }

    // Motoristas routes
    if (path.startsWith('/motoristas')) {
      return await handleMotoristaRoutes(req, path, method, supabase)
    }

    // Veiculos routes
    if (path.startsWith('/veiculos')) {
      return await handleVeiculoRoutes(req, path, method, supabase)
    }

    // Clientes routes
    if (path.startsWith('/clientes')) {
      return await handleClienteRoutes(req, path, method, supabase)
    }

    // Vagas routes
    if (path.startsWith('/vagas')) {
      return await handleVagasRoutes(req, path, method, supabase)
    }

    // Inboxes routes (WiseApp)
    if (path.startsWith('/v1/accounts')) {
      return await handleWiseAppProxyRoutes(req, path, method, supabase)
    }

    // Default 404
    return new Response(JSON.stringify({
      error: 'Endpoint não encontrado',
      path,
      method,
      timestamp: new Date().toISOString()
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in API function:', error)
    return new Response(JSON.stringify({
      error: 'Erro interno do servidor',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// WiseApp routes handler
async function handleWiseAppRoutes(req: Request, path: string, method: string, supabase: any) {
  console.log(`🔍 handleWiseAppRoutes called with path: ${path}, method: ${method}`)
  
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate WiseApp token
  if (path === '/wiseapp/validate-token' && method === 'POST') {
    try {
      const body = await req.json()
      const { token, accountId } = body

      if (!token || !accountId) {
        return new Response(JSON.stringify({
          valid: false,
          error: 'Token e ID da conta são obrigatórios'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Try to fetch profile from WiseApp API to validate token
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/profile`
      
      console.log(`🔍 Validando token...`)
      
      const response = await fetch(wiseAppUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.log(`❌ Token inválido - API retornou ${response.status}`)
        return new Response(JSON.stringify({
          valid: false,
          error: 'Token de acesso inválido ou expirado'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const profileData = await response.json()
      
      console.log(`✅ Token validado com sucesso!`)
      
      return new Response(JSON.stringify({
        valid: true,
        profile: profileData
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      console.error('❌ Erro ao validar token:', error)
      return new Response(JSON.stringify({
        valid: false,
        error: 'Erro ao conectar com o servidor de autenticação'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  if (path.match(/^\/wiseapp\/(\d+)\/token$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/token$/)
    const companyId = match![1]
    
    console.log('Debug: Tentando acessar wiseapp_acesso para company_id:', companyId);
    
    const { data, error } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .eq('id_conta_wiseapp', companyId)
      .not('access_token_wiseapp', 'is', null)
      .single();
    
    if (error || !data) {
      return new Response(JSON.stringify({
        error: "Token WiseApp não encontrado para esta empresa",
        message: "Configure o token WiseApp nas configurações da empresa",
        details: error?.message || "Nenhum registro encontrado"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (!data.access_token_wiseapp) {
      return new Response(JSON.stringify({
        error: "Token WiseApp não configurado para esta empresa",
        message: "O token está vazio ou null"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ token: data.access_token_wiseapp }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get WiseApp labels
  if (path.match(/^\/wiseapp\/(\d+)\/labels$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/labels$/)
    const companyId = match![1]
    
    console.log('Debug: Buscando labels para company_id:', companyId);
    
    // Primeiro tentar buscar token específico da empresa
    let { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .eq('id_conta_wiseapp', companyId)
      .not('access_token_wiseapp', 'is', null)
      .single()

    // IMPORTANTE: Não usar fallback - exigir correspondência exata do accountId para isolamento de dados
    if (tokenError || !tokenData) {
      console.log('Debug: Token não encontrado para accountId:', companyId, 'Erro:', tokenError);
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta conta',
        details: `Nenhum token encontrado para accountId ${companyId}. Verifique se a conta WiseApp está configurada corretamente.`
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { access_token_wiseapp: token, id_conta_wiseapp: accountId } = tokenData

    // Fetch labels from WiseApp API
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`
    
    try {
      const response = await fetch(wiseAppUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`WiseApp API responded with ${response.status}`)
      }

      const data = await response.json()
      
      // Transform labels format
      const labels = data.payload?.map((label: any) => ({
        id: label.id,
        name: label.title,
        color: label.color,
        description: label.description
      })) || []

      return new Response(JSON.stringify(labels), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao buscar labels do WiseApp',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Create WiseApp label
  if (path.match(/^\/wiseapp\/(\d+)\/labels$/) && method === 'POST') {
    const match = path.match(/^\/wiseapp\/(\d+)\/labels$/)
    const companyId = match![1]
    
    console.log('Debug: Criando label para company_id:', companyId);
    
    // Primeiro tentar buscar token específico da empresa
    let { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .eq('id_conta_wiseapp', companyId)
      .not('access_token_wiseapp', 'is', null)
      .single()

    // IMPORTANTE: Não usar fallback - exigir correspondência exata do accountId para isolamento de dados
    if (tokenError || !tokenData) {
      console.log('Debug: Token não encontrado para accountId:', companyId, 'Erro:', tokenError);
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta conta',
        details: `Nenhum token encontrado para accountId ${companyId}. Verifique se a conta WiseApp está configurada corretamente.`
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { access_token_wiseapp: token, id_conta_wiseapp: accountId } = tokenData
    const requestBody = await req.text()

    // Create label in WiseApp
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`
    
    try {
      const response = await fetch(wiseAppUrl, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        },
        body: requestBody
      })

      const responseData = await response.text()

      return new Response(responseData, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao criar label no WiseApp',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Delete WiseApp label
  if (path.match(/^\/wiseapp\/(\d+)\/labels\/(\d+)$/) && method === 'DELETE') {
    const match = path.match(/^\/wiseapp\/(\d+)\/labels\/(\d+)$/)
    const companyId = match![1]
    const labelId = match![2]
    
    console.log('Debug: Deletando label', labelId, 'para company_id:', companyId);
    
    // Get token from headers or database
    const headerToken = req.headers.get('wiseapp-token') || req.headers.get('api_access_token')
    const headerAccountId = req.headers.get('wiseapp-account-id')
    
    let token = headerToken
    let accountId = headerAccountId
    
    // If no token in headers, try to get from database
    if (!token || !accountId) {
      let { data: tokenData, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
        .eq('id_conta_wiseapp', companyId)
        .not('access_token_wiseapp', 'is', null)
        .single()

      // IMPORTANTE: Não usar fallback - exigir correspondência exata do accountId para isolamento de dados
      if (tokenError || !tokenData) {
        console.log('Debug: Token não encontrado para accountId:', companyId, 'Erro:', tokenError);
        return new Response(JSON.stringify({
          error: 'Token WiseApp não configurado para esta conta',
          details: `Nenhum token encontrado para accountId ${companyId}. Verifique se a conta WiseApp está configurada corretamente.`
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      token = tokenData.access_token_wiseapp
      accountId = tokenData.id_conta_wiseapp
    }

    // Verify we have valid token and accountId
    if (!token || !accountId) {
      return new Response(JSON.stringify({
        error: 'Token ou Account ID inválido',
        details: 'Não foi possível obter credenciais válidas'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete label in WiseApp
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`
    
    try {
      const response = await fetch(wiseAppUrl, {
        method: 'DELETE',
        headers: {
          'api_access_token': token!,
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.text()

      return new Response(responseData || JSON.stringify({ success: true }), {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao deletar label no WiseApp',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Search contacts
  if (path.match(/^\/wiseapp\/(\d+)\/contacts\/search$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/contacts\/search$/)
    const companyId = match![1]
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    
    console.log('Debug: Buscando contatos para company_id:', companyId, 'phone:', phone);
    
    // Primeiro tentar buscar token específico da empresa
    let { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .eq('id_conta_wiseapp', companyId)
      .not('access_token_wiseapp', 'is', null)
      .single()

    // IMPORTANTE: Não usar fallback - exigir correspondência exata do accountId para isolamento de dados
    if (tokenError || !tokenData) {
      console.log('Debug: Token não encontrado para accountId:', companyId, 'Erro:', tokenError);
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta conta',
        details: `Nenhum token encontrado para accountId ${companyId}. Verifique se a conta WiseApp está configurada corretamente.`
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!phone) {
      return new Response(JSON.stringify({
        error: 'Phone é obrigatório',
        details: 'O parâmetro phone não foi fornecido'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { access_token_wiseapp: token, id_conta_wiseapp: accountId } = tokenData
    const formattedPhone = `55${phone}`
    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`

    try {
      const response = await fetch(wiseappUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`WiseApp API responded with ${response.status}`)
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Erro na busca de contatos',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Apply labels to contact
  if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/) && method === 'POST') {
    const match = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/)
    const companyId = match![1]
    const contactId = match![2]
    
    console.log('Debug: Aplicando labels para company_id:', companyId, 'contact_id:', contactId);
    
    // Primeiro tentar buscar token específico da empresa
    let { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .eq('id_conta_wiseapp', companyId)
      .not('access_token_wiseapp', 'is', null)
      .single()

    // IMPORTANTE: Não usar fallback - exigir correspondência exata do accountId para isolamento de dados
    if (tokenError || !tokenData) {
      console.log('Debug: Token não encontrado para accountId:', companyId, 'Erro:', tokenError);
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta conta',
        details: `Nenhum token encontrado para accountId ${companyId}. Verifique se a conta WiseApp está configurada corretamente.`
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { access_token_wiseapp: token, id_conta_wiseapp: accountId } = tokenData
    const requestBody = await req.json()
    
    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`
    
    let labelsToApply: string[] = []
    
    if (requestBody.labels && Array.isArray(requestBody.labels)) {
      labelsToApply = requestBody.labels
    } else if (requestBody.tagName) {
      // Buscar labels existentes primeiro
      try {
        const getResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (getResponse.ok) {
          const currentData = await getResponse.json();
          const existingLabels = currentData.payload || [];
          labelsToApply = [...existingLabels, requestBody.tagName];
        } else {
          labelsToApply = [requestBody.tagName];
        }
      } catch (getError) {
        labelsToApply = [requestBody.tagName];
      }
    } else {
      return new Response(JSON.stringify({
        error: 'Formato inválido. Use {labels: [...]} ou {tagName: "..."}'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ labels: labelsToApply })
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `WiseApp API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Erro interno',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Sync all motoristas endpoint
  if (path === '/wiseapp/sync-all-motoristas' && method === 'POST') {
    console.log('🎯 Sync all motoristas route matched!')
    try {
      const { companyId } = await req.json();
      
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: 'Company ID é obrigatório' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Starting sync-all-motoristas for company ${companyId}`);

      // 1. Buscar token WiseApp diretamente
      console.log(`🔍 [sync-all-motoristas] Buscando token para company_id: ${companyId}`);
      
      // Primeiro, vamos verificar se a tabela existe e quais colunas ela tem
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'wiseapp_acesso')
        .eq('table_schema', 'public');
      
      console.log(`📊 [sync-all-motoristas] Estrutura da tabela wiseapp_acesso:`, {
        tableError,
        columns: tableInfo
      });
      
      const { data: tokenDataArray, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp, email, nome')
        .eq('id_conta_wiseapp', companyId)
        .limit(1);

      console.log(`📊 [sync-all-motoristas] Resultado da busca:`, {
        error: tokenError,
        data: tokenDataArray,
        found: tokenDataArray?.length || 0
      });

      const tokenData = tokenDataArray?.[0];
      const token = tokenData?.access_token_wiseapp;

      if (tokenError) {
        console.error(`❌ [sync-all-motoristas] Erro na query:`, tokenError);
        return new Response(
          JSON.stringify({ 
            error: "Erro ao buscar token WiseApp",
            message: tokenError.message
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!token) {
        console.log(`❌ [sync-all-motoristas] Token WiseApp não encontrado para company_id: ${companyId}`);
        console.log(`📋 [sync-all-motoristas] Dados encontrados:`, tokenData);
        return new Response(
          JSON.stringify({ 
            error: "Token WiseApp não configurado para esta empresa",
            message: "Configure um token WiseApp válido antes de sincronizar contatos"
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`✅ [sync-all-motoristas] Token encontrado:`, {
        email: tokenData.email,
        nome: tokenData.nome,
        token_length: token.length
      });

      // 2. Buscar dados da empresa para obter account ID do WiseApp
      const { data: companies, error: companyError } = await supabase
        .from("company")
        .select("id_conta_wiseapp")
        .eq("company_id", parseInt(companyId))
        .limit(1);

      if (companyError || !companies || companies.length === 0) {
        console.log(`Empresa não encontrada para company_id: ${companyId}`);
        return new Response(
          JSON.stringify({ 
            error: "Empresa não encontrada ou account ID não configurado" 
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const accountId = companies[0].id_conta_wiseapp;

      if (!accountId) {
        return new Response(
          JSON.stringify({ 
            error: "Account ID do WiseApp não configurado para esta empresa" 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Using WiseApp account ID: ${accountId}`);

      // 3. Buscar todos os motoristas ativos com telefone
      const { data: motoristas, error: motoristasError } = await supabase
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .not('telefone', 'is', null);
      
      if (motoristasError) {
        console.error('Erro ao buscar motoristas:', motoristasError);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao buscar motoristas',
            details: motoristasError.message
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const results = {
        totalProcessed: motoristas?.length || 0,
        successful: 0,
        failed: 0,
        created: 0,
        photoUpdated: 0,
        errors: [] as Array<{ motorista_id: number; nome: string; error: string }>
      };
      
      if (!motoristas || motoristas.length === 0) {
        console.log('Nenhum motorista ativo encontrado');
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: results 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.log(`Processando ${motoristas.length} motoristas`);

      // 4. Processar cada motorista
      for (const motorista of motoristas) {
        try {
          if (!motorista.telefone) {
            results.successful++;
            continue;
          }

          const phone = `55${motorista.telefone}`;
          console.log(`Processando ${motorista.nome} - ${phone}`);
          
          // Buscar contato no WiseApp
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });

          if (!searchResponse.ok) {
            results.failed++;
            results.errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome,
              error: `Erro ao buscar no WiseApp: ${searchResponse.status}`
            });
            continue;
          }

          const searchData = await searchResponse.json();

          if (searchData.payload?.length > 0) {
            const contact = searchData.payload[0];
            console.log(`Contato encontrado: ${motorista.nome} (ID: ${contact.id})`);

            // Se contato já existe, apenas atualizar foto se necessário
            if (contact.avatar !== motorista.foto_whatsapp && motorista.foto_whatsapp) {
              const updateUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}`;
              const updateResponse = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                  'api_access_token': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ avatar: motorista.foto_whatsapp })
              });

              if (updateResponse.ok) {
                results.photoUpdated++;
                console.log(`Foto atualizada para ${motorista.nome}`);
              }
            }

            results.successful++;
          } else {
            // Contato não existe, criar novo
            const contactData = {
              name: motorista.nome,
              phone: phone,
              avatar: motorista.foto_whatsapp || null
            };

            const createUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts`;
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(contactData)
            });

            if (createResponse.ok) {
              results.created++;
              results.successful++;
              console.log(`Contato criado: ${motorista.nome}`);
            } else {
              results.failed++;
              results.errors.push({
                motorista_id: motorista.motorista_id,
                nome: motorista.nome,
                error: `Erro ao criar contato: ${createResponse.status}`
              });
            }
          }
        } catch (error) {
          console.error(`Erro processando ${motorista.nome}:`, error);
          results.failed++;
          results.errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome,
            error: (error as Error).message
          });
        }
      }

      const result = {
        success: true,
        data: {
          ...results,
          message: `Sincronização concluída: ${results.successful} sucessos, ${results.failed} falhas, ${results.created} criados, ${results.photoUpdated} fotos atualizadas`
        }
      };

      console.log(`Sincronização concluída: ${results.successful} sucessos, ${results.failed} falhas, ${results.created} criados, ${results.photoUpdated} fotos atualizadas`);

      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Erro na sincronização sync-all-motoristas:', error);
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error instanceof Error ? error.message : 'Erro desconhecido'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Sync all contacts endpoint
  if (path === '/wiseapp/sync-all-contacts' && method === 'POST') {
    console.log('🎯 Sync all contacts route matched!')
    try {
      const { companyId } = await req.json();
      
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: 'Company ID é obrigatório' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Starting sync-all-contacts for company ${companyId}`);

      // 1. Buscar token WiseApp diretamente
      console.log(`🔍 [sync-all-contacts] Buscando token para company_id: ${companyId}`);
      
      // Primeiro, vamos verificar se a tabela existe e quais colunas ela tem
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'wiseapp_acesso')
        .eq('table_schema', 'public');
      
      console.log(`📊 [sync-all-contacts] Estrutura da tabela wiseapp_acesso:`, {
        tableError,
        columns: tableInfo
      });
      
      const { data: tokenDataArray, error: tokenError } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp, email, nome')
        .eq('id_conta_wiseapp', companyId)
        .limit(1);

      console.log(`📊 [sync-all-contacts] Resultado da busca:`, {
        error: tokenError,
        data: tokenDataArray,
        found: tokenDataArray?.length || 0
      });

      const tokenData = tokenDataArray?.[0];
      const token = tokenData?.access_token_wiseapp;

      if (tokenError) {
        console.error(`❌ [sync-all-contacts] Erro na query:`, tokenError);
        return new Response(
          JSON.stringify({ 
            error: "Erro ao buscar token WiseApp",
            message: tokenError.message
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!token) {
        console.log(`❌ [sync-all-contacts] Token WiseApp não encontrado para company_id: ${companyId}`);
        console.log(`📋 [sync-all-contacts] Dados encontrados:`, tokenData);
        return new Response(
          JSON.stringify({ 
            error: "Token WiseApp não configurado para esta empresa",
            message: "Configure um token WiseApp válido antes de sincronizar contatos"
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`✅ [sync-all-contacts] Token encontrado:`, {
        email: tokenData.email,
        nome: tokenData.nome,
        token_length: token.length
      });

      // 2. Buscar dados da empresa para obter account ID do WiseApp
      const { data: companies, error: companyError } = await supabase
        .from("company")
        .select("id_conta_wiseapp")
        .eq("company_id", parseInt(companyId))
        .limit(1);

      if (companyError || !companies || companies.length === 0) {
        console.log(`Empresa não encontrada para company_id: ${companyId}`);
        return new Response(
          JSON.stringify({ 
            error: "Empresa não encontrada ou account ID não configurado" 
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const accountId = companies[0].id_conta_wiseapp;

      if (!accountId) {
        return new Response(
          JSON.stringify({ 
            error: "Account ID do WiseApp não configurado para esta empresa" 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Using WiseApp account ID: ${accountId}`);

      // 3. Buscar todos os contatos ativos com telefone
      const { data: contatos, error: contatosError } = await supabase
        .from('contato')
        .select('contato_id, nome, telefone, foto_whatsapp')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .not('telefone', 'is', null);
      
      if (contatosError) {
        console.error('Erro ao buscar contatos:', contatosError);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao buscar contatos',
            details: contatosError.message
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const results = {
        totalProcessed: contatos?.length || 0,
        successful: 0,
        failed: 0,
        created: 0,
        photoUpdated: 0,
        errors: [] as Array<{ contato_id: number; nome: string; error: string }>
      };
      
      if (!contatos || contatos.length === 0) {
        console.log('Nenhum contato ativo encontrado');
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: results 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.log(`Processando ${contatos.length} contatos`);

      // 4. Processar cada contato
      for (const contato of contatos) {
        try {
          if (!contato.telefone) {
            results.successful++;
            continue;
          }

          const phone = `55${contato.telefone}`;
          console.log(`Processando ${contato.nome} - ${phone}`);
          
          // Buscar contato no WiseApp
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });

          if (!searchResponse.ok) {
            results.failed++;
            results.errors.push({
              contato_id: contato.contato_id,
              nome: contato.nome,
              error: `Erro ao buscar no WiseApp: ${searchResponse.status}`
            });
            continue;
          }

          const searchData = await searchResponse.json();

          if (searchData.payload?.length > 0) {
            const contact = searchData.payload[0];
            console.log(`Contato encontrado: ${contato.nome} (ID: ${contact.id})`);

            // Se contato já existe, apenas atualizar foto se necessário
            if (contact.avatar !== contato.foto_whatsapp && contato.foto_whatsapp) {
              const updateUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}`;
              const updateResponse = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                  'api_access_token': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ avatar: contato.foto_whatsapp })
              });

              if (updateResponse.ok) {
                results.photoUpdated++;
                console.log(`Foto atualizada para ${contato.nome}`);
              }
            }

            results.successful++;
          } else {
            // Contato não existe, criar novo
            const contactData = {
              name: contato.nome,
              phone: phone,
              avatar: contato.foto_whatsapp || null
            };

            const createUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts`;
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(contactData)
            });

            if (createResponse.ok) {
              results.created++;
              results.successful++;
              console.log(`Contato criado: ${contato.nome}`);
            } else {
              results.failed++;
              results.errors.push({
                contato_id: contato.contato_id,
                nome: contato.nome,
                error: `Erro ao criar contato: ${createResponse.status}`
              });
            }
          }
        } catch (error) {
          console.error(`Erro processando ${contato.nome}:`, error);
          results.failed++;
          results.errors.push({
            contato_id: contato.contato_id,
            nome: contato.nome,
            error: (error as Error).message
          });
        }
      }

      const result = {
        success: true,
        data: {
          ...results,
          message: `Sincronização concluída: ${results.successful} sucessos, ${results.failed} falhas, ${results.created} criados, ${results.photoUpdated} fotos atualizadas`
        }
      };

      console.log(`Sincronização concluída: ${results.successful} sucessos, ${results.failed} falhas, ${results.created} criados, ${results.photoUpdated} fotos atualizadas`);

      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Erro na sincronização sync-all-contacts:', error);
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: error instanceof Error ? error.message : 'Erro desconhecido'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  console.log(`❌ Endpoint WiseApp não encontrado: ${path} ${method}`)
  return new Response(JSON.stringify({
    error: 'Endpoint WiseApp não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Company routes handler
async function handleCompanyRoutes(req: Request, path: string, method: string, supabase: any) {
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Get all companies
  if (path === '/companies' && method === 'GET') {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao buscar empresas',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get company by ID
  if (path.match(/^\/companies\/(\d+)$/) && method === 'GET') {
    const match = path.match(/^\/companies\/(\d+)$/)
    const id = match![1]
    
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return new Response(JSON.stringify({
        error: 'Empresa não encontrada',
        details: error.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    error: 'Endpoint Company não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Motorista routes handler
async function handleMotoristaRoutes(req: Request, path: string, method: string, supabase: any) {
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const companyId = parseInt(req.headers.get('company-id') || '1')

  // Get all motoristas
  if (path === '/motoristas' && method === 'GET') {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    const { data, error, count } = await supabase
      .from('motorista')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao buscar motoristas',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    error: 'Endpoint Motorista não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Veiculo routes handler
async function handleVeiculoRoutes(req: Request, path: string, method: string, supabase: any) {
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const companyId = parseInt(req.headers.get('company-id') || '1')

  // Get all veiculos
  if (path === '/veiculos' && method === 'GET') {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    const { data, error, count } = await supabase
      .from('veiculo')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao buscar veículos',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    error: 'Endpoint Veículo não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Cliente routes handler
async function handleClienteRoutes(req: Request, path: string, method: string, supabase: any) {
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const companyId = parseInt(req.headers.get('company-id') || '1')

  // Get all clientes
  if (path === '/clientes' && method === 'GET') {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    const { data, error, count } = await supabase
      .from('cliente')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao buscar clientes',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    error: 'Endpoint Cliente não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Vagas routes handler
async function handleVagasRoutes(req: Request, path: string, method: string, supabase: any) {
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const companyId = parseInt(req.headers.get('company-id') || '1')

  // Dashboard routes
  if (path.match(/^\/vagas\/dashboard\/(\d+)$/) && method === 'GET') {
    const match = path.match(/^\/vagas\/dashboard\/(\d+)$/)
    const companyId = parseInt(match![1])
    
    // Retornar dados básicos do dashboard de vagas
    const { data, error } = await supabase
      .from('vaga')
      .select('*')
      .eq('company_id', companyId)
      .limit(100)

    if (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao buscar vagas',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      data: data || [],
      total: data?.length || 0,
      company_id: companyId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    error: 'Endpoint Vagas não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// WiseApp Proxy routes handler
async function handleWiseAppProxyRoutes(req: Request, path: string, method: string, supabase: any) {
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Extract account ID from path like /v1/accounts/1/inboxes
  const accountMatch = path.match(/^\/v1\/accounts\/(\d+)\/(.+)$/)
  
  if (!accountMatch) {
    return new Response(JSON.stringify({
      error: 'Formato de URL inválido',
      expected: '/v1/accounts/{accountId}/{endpoint}',
      received: path
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const accountId = accountMatch[1]
  const endpoint = accountMatch[2]
  
  console.log(`WiseApp Proxy: ${method} /v1/accounts/${accountId}/${endpoint}`)

  // Get token from headers or find by account ID
  const token = req.headers.get('api_access_token') || req.headers.get('wiseapp-token')
  
  if (!token) {
    return new Response(JSON.stringify({
      error: 'Token de acesso não fornecido',
      message: 'Forneça um token válido no header api_access_token ou wiseapp-token'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Special handling for POST /v1/accounts/{accountId}/contacts
  if (method === 'POST' && endpoint === 'contacts') {
    try {
      const requestBody = await req.text()
      const contactData = JSON.parse(requestBody)
      
      // Check if contact already exists by phone number
      const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${contactData.phone_number}`
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        
        // If contact already exists, return it instead of creating a new one
        if (searchData.payload && searchData.payload.length > 0) {
          console.log(`Contact with phone ${contactData.phone_number} already exists, returning existing contact`)
          return new Response(JSON.stringify(searchData.payload[0]), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          })
        }
      }
      
      // If contact doesn't exist, create it
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/${endpoint}`
      
      const response = await fetch(wiseAppUrl, {
        method: method,
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: requestBody
      })

      const responseData = await response.text()
      
      return new Response(responseData, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
      })
      
    } catch (error) {
      console.error('Error in contact creation with duplicate check:', error)
      return new Response(JSON.stringify({
        error: 'Erro ao processar criação de contato',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Proxy to WiseApp API for all other endpoints
  const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/${endpoint}`
  
  try {
    const requestBody = method !== 'GET' ? await req.text() : undefined
    
    const response = await fetch(wiseAppUrl, {
      method: method,
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: requestBody
    })

    const responseData = await response.text()
    
    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Erro ao acessar WiseApp API',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
