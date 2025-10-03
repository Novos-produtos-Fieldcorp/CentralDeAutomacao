import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, company-id, wiseapp-token, wiseapp-account-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse URL to get path and method
    const url = new URL(req.url)
    const path = url.pathname.replace('/api', '') // Remove /api prefix
    const method = req.method

    console.log(`[${method}] ${path}`)

    // Health check
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
  // Get WiseApp token by company ID
  if (path.match(/^\/wiseapp\/(\d+)\/token$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/token$/)
    const companyId = match![1]
    
    const { data, error } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .limit(1)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({
        error: "Token WiseApp não encontrado",
        message: "Configure o token WiseApp nas configurações da empresa"
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
      .select('access_token_wiseapp, account_id')
      .eq('company_id', companyId)
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

    const { access_token_wiseapp: token, account_id: accountId } = tokenData

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
      .select('access_token_wiseapp, account_id')
      .eq('company_id', companyId)
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

    const { access_token_wiseapp: token, account_id: accountId } = tokenData
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
      .select('access_token_wiseapp, account_id')
      .eq('company_id', companyId)
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

    const { access_token_wiseapp: token, account_id: accountId } = tokenData
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
