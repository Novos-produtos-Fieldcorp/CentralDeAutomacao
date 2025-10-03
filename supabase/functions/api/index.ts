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
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (path.match(/^\/wiseapp\/(\d+)\/token$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/token$/)
    const companyId = match![1]
    
    console.log('Debug: Tentando acessar wiseapp_acesso para company_id:', companyId);
    
    const { data, error } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .not('access_token_wiseapp', 'is', null)
      .limit(1)
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
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .not('access_token_wiseapp', 'is', null)
      .limit(1)
      .single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta empresa'
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

  // Search contacts
  if (path.match(/^\/wiseapp\/(\d+)\/contacts\/search$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/contacts\/search$/)
    const companyId = match![1]
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .not('access_token_wiseapp', 'is', null)
      .limit(1)
      .single()

    if (tokenError || !tokenData || !phone) {
      return new Response(JSON.stringify({
        error: 'Token, Account ID e phone são obrigatórios'
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
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .not('access_token_wiseapp', 'is', null)
      .limit(1)
      .single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({
        error: 'Token e Account ID obrigatórios'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { access_token_wiseapp: token, id_conta_wiseapp: accountId } = tokenData
    const requestBody = await req.json()
    
    let labelsToApply: string[] = []
    
    if (requestBody.labels && Array.isArray(requestBody.labels)) {
      labelsToApply = requestBody.labels
    } else if (requestBody.tagName) {
      labelsToApply = [requestBody.tagName]
    } else {
      return new Response(JSON.stringify({
        error: 'Formato inválido. Use {labels: [...]} ou {tagName: "..."}'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`

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
