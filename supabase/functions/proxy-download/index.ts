import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validar que é um POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Ler URL do corpo da requisição
    const body = await req.json()
    const { url } = body

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL é obrigatória' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validar que a URL é do WiseApp (segurança)
    if (!url.includes('chat.wiseapp360.com')) {
      return new Response(
        JSON.stringify({ error: 'URL inválida - apenas arquivos do WiseApp são permitidos' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[proxy-download] Fazendo proxy de: ${url}`)

    // Fazer fetch do arquivo do WiseApp
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      console.error(`[proxy-download] Erro ao baixar: ${response.status} ${response.statusText}`)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao baixar arquivo: ${response.status} ${response.statusText}` 
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Pegar o blob do arquivo
    const fileBlob = await response.blob()
    
    // Determinar o tipo de conteúdo
    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    console.log(`[proxy-download] Arquivo baixado com sucesso: ${contentType}`)

    // Retornar o arquivo com headers apropriados
    return new Response(fileBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': fileBlob.size.toString(),
      }
    })

  } catch (error) {
    console.error('[proxy-download] Erro:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao fazer proxy do arquivo',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
