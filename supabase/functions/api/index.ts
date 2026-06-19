import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, company-id, wiseapp-token, wiseapp-account-id, api_access_token, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
  'Access-Control-Allow-Credentials': 'true',
}

// Helper function to fetch fresh token from database
async function fetchFreshToken(supabase: any, accountId: string): Promise<{ token: string; email: string } | null> {
  console.log(`[TokenFallback] Fetching fresh token from database for account ${accountId}`);
  
  const { data: tokenRows, error } = await supabase
    .from('wiseapp_acesso')
    .select('access_token_wiseapp, email')
    .eq('id_conta_wiseapp', accountId)
    .not('access_token_wiseapp', 'is', null)
    .neq('access_token_wiseapp', '')
    .order('wiseapp_acesso_id', { ascending: false })
    .limit(1);

  if (error || !tokenRows || tokenRows.length === 0) {
    console.log(`[TokenFallback] No token found for account ${accountId}:`, error?.message);
    return null;
  }

  const tokenData = tokenRows[0];
  console.log(`[TokenFallback] Token fetched for account ${accountId} (email: ${tokenData.email})`);
  return { token: tokenData.access_token_wiseapp, email: tokenData.email };
}

// Helper function to make WiseApp API call with retry on 401
async function wiseAppFetchWithRetry(
  supabase: any,
  accountId: string,
  url: string,
  options: RequestInit,
  initialToken: string
): Promise<Response> {
  console.log(`[WiseApp] Making request to ${url} with initial token`);
  
  // First attempt with initial token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers as Record<string, string>,
      'api_access_token': initialToken,
    }
  });

  // If 401, try to fetch fresh token from database and retry
  if (response.status === 401) {
    console.log(`[WiseApp] Got 401, attempting to fetch fresh token from database...`);
    
    const freshToken = await fetchFreshToken(supabase, accountId);
    
    if (freshToken && freshToken.token !== initialToken) {
      console.log(`[WiseApp] Retrying with fresh token from database`);
      
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 500));
      
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers as Record<string, string>,
          'api_access_token': freshToken.token,
        }
      });
      
      if (response.ok) {
        console.log(`[WiseApp] Success with fresh token from database`);
      } else {
        console.log(`[WiseApp] Still failed with fresh token, status: ${response.status}`);
      }
    } else {
      console.log(`[WiseApp] No different fresh token available`);
    }
  }

  return response;
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

    // Company routes
    if (path.startsWith('/company')) {
      return await handleCompanyRoutes(req, path, method, supabase)
    }

    // Vagas routes
    if (path.startsWith('/vagas')) {
      return await handleVagasRoutes(req, path, method, supabase)
    }

    // Unidades routes
    if (path.startsWith('/unidades')) {
      return await handleUnidadesRoutes(req, path, method, supabase)
    }

    // Status-vagas routes
    if (path.startsWith('/status-vagas')) {
      return await handleStatusVagasRoutes(req, path, method, supabase)
    }

    // Operacoes routes
    if (path.startsWith('/operacoes')) {
      return await handleOperacoesRoutes(req, path, method, supabase)
    }

    // Inboxes routes (WiseApp)
    if (path.startsWith('/v1/accounts')) {
      return await handleWiseAppProxyRoutes(req, path, method, supabase)
    }

    // ── AI Group Summary ──────────────────────────────────────────────────────
    if (path === '/ai/group-summary' && method === 'POST') {
      try {
        const body = await req.json()
        const { nome_do_grupo, company_id, group_id, account_id, api_key, inbox_id } = body

        if (!account_id || !api_key || !inbox_id) {
          return new Response(JSON.stringify({ success: false, error: 'account_id, api_key e inbox_id sao obrigatorios' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const groqApiKey = Deno.env.get('GROQ_API_KEY')
        if (!groqApiKey) {
          return new Response(JSON.stringify({ success: false, error: 'GROQ_API_KEY nao configurada no servidor' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const WISEAPP_API = 'https://chat.wiseapp360.com/api'
        const wiseHeaders = { 'api_access_token': api_key, 'Content-Type': 'application/json' }

        // Brasilia date helpers
        const now = new Date()
        const brasiliaMs = now.getTime() + (now.getTimezoneOffset() + (-3 * 60)) * 60000
        const brasiliaDate = new Date(brasiliaMs)
        const todayStr = brasiliaDate.toISOString().split('T')[0]
        const todayFormatted = `${todayStr.split('-')[2]}/${todayStr.split('-')[1]}/${todayStr.split('-')[0]}`

        // Find conversation in WiseApp
        let convId: number | null = null
        let convName = nome_do_grupo

        const convListResp = await fetch(`${WISEAPP_API}/v1/accounts/${account_id}/conversations?inbox_id=${inbox_id}&page=1`, {
          headers: wiseHeaders
        })
        if (convListResp.ok) {
          const convData = await convListResp.json()
          const convs: any[] = convData?.data?.payload || []
          const match = convs.find((c: any) => {
            const name: string = c?.meta?.sender?.name || ''
            return nome_do_grupo && name.toLowerCase().includes(nome_do_grupo.toLowerCase().split('/')[0].trim().toLowerCase())
          })
          const chosen = match || convs[0]
          if (chosen) {
            convId = chosen.id
            convName = chosen?.meta?.sender?.name || nome_do_grupo
          }
        }

        // Fallback: search all conversations by name
        if (!convId) {
          for (let page = 1; page <= 5; page++) {
            const fallbackResp = await fetch(`${WISEAPP_API}/v1/accounts/${account_id}/conversations?page=${page}`, {
              headers: wiseHeaders
            })
            if (!fallbackResp.ok) break
            const fallbackData = await fallbackResp.json()
            const allConvs: any[] = fallbackData?.data?.payload || []
            if (!allConvs.length) break
            const nameParts = nome_do_grupo.split('/')
            const found = allConvs.find((c: any) => {
              const name: string = c?.meta?.sender?.name || ''
              return nameParts.some((part: string) => name.toLowerCase().includes(part.trim().toLowerCase()))
            })
            if (found) { convId = found.id; convName = found?.meta?.sender?.name || nome_do_grupo; break }
            if (page * 25 >= (fallbackData?.data?.meta?.all_count || 0)) break
          }
        }

        if (!convId) {
          await supabase.from('envio_resumo').insert({
            grupo_id: group_id, company_id, data_envio: todayStr,
            status: false, mensagem: 'Conversa nao encontrada no WiseApp'
          })
          return new Response(JSON.stringify({ success: false, error: `Conversa para '${nome_do_grupo}' nao encontrada` }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Fetch today's messages (paginated — WiseApp returns 20 per page)
        let todayMessages: { time: string; sender: string; content: string }[] = []
        let beforeId: number | null = null
        for (let _page = 0; _page < 50; _page++) {
          const msgsUrl = `${WISEAPP_API}/v1/accounts/${account_id}/conversations/${convId}/messages` +
            (beforeId ? `?before=${beforeId}` : '')
          const msgsResp = await fetch(msgsUrl, { headers: wiseHeaders })
          if (!msgsResp.ok) break
          const msgsData = await msgsResp.json()
          const batch: any[] = msgsData?.payload || []
          if (!batch.length) break

          let hitYesterday = false
          let oldestId: number | null = null
          for (const msg of batch) {
            const createdAt = msg.created_at
            if (!createdAt) continue
            let msgDate: Date
            if (typeof createdAt === 'number') {
              msgDate = new Date(createdAt * 1000)
            } else {
              msgDate = new Date(createdAt)
            }
            const msgBrasiliaMs = msgDate.getTime() + (msgDate.getTimezoneOffset() + (-3 * 60)) * 60000
            const msgBrasiliaDate = new Date(msgBrasiliaMs).toISOString().split('T')[0]

            if (oldestId === null || (msg.id as number) < oldestId) oldestId = msg.id as number

            if (msgBrasiliaDate !== todayStr) { hitYesterday = true; continue }

            const senderInfo = msg.sender
            let senderName = senderInfo?.name || 'Desconhecido'
            if (msg.message_type === 1) senderName = 'Atendente'

            let content = msg.content || ''
            const contentType = msg.content_type || 'text'
            if (contentType === 'image') content = '[Imagem enviada]'
            else if (contentType === 'audio') content = '[Audio enviado]'
            else if (contentType === 'video') content = '[Video enviado]'
            else if (contentType === 'file') content = '[Arquivo enviado]'
            else if (!content) content = '[Mensagem sem texto]'

            const msgBrasiliaTime = new Date(msgBrasiliaMs)
            const timeStr = `${String(msgBrasiliaTime.getUTCHours()).padStart(2,'0')}:${String(msgBrasiliaTime.getUTCMinutes()).padStart(2,'0')}`
            todayMessages.push({ time: timeStr, sender: senderName, content })
          }

          if (hitYesterday || batch.length < 20) break
          beforeId = oldestId
        }
        todayMessages.reverse()

        // Build messages context for Groq
        let messagesContext: string
        if (todayMessages.length === 0) {
          messagesContext = `Nenhuma mensagem encontrada hoje (${todayFormatted}) no grupo.`
        } else {
          messagesContext = `MENSAGENS DO DIA - ${convName}\nData: ${todayFormatted}\nTotal de mensagens hoje: ${todayMessages.length}\n${'─'.repeat(40)}\n`
          messagesContext += todayMessages.slice(-80).map(m => `[${m.time}] ${m.sender}: ${m.content}`).join('\n')
        }

        // Call Groq API to generate summary
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: `Voce e um assistente especializado em suporte ao cliente e logistica que gera resumos concisos de grupos. Regras absolutas: (1) Cite palavras EXATAS das mensagens - nunca generalize. Se a mensagem diz "entrega atrasada", escreva "entrega atrasada". Se diz "motorista nao apareceu", escreva "motorista nao apareceu". (2) Para grupos com poucas mensagens ou informacoes incompletas, liste o que ainda precisa ser verificado. (3) Seja especifico e direto.`
              },
              {
                role: 'user',
                content: `Analise as mensagens do grupo "${nome_do_grupo}" abaixo e gere um resumo no formato EXATO:\n\nResumo do Grupo "${nome_do_grupo}"\n• Quantidade de mensagens: [numero]\n• Principais assuntos: [liste os topicos ESPECIFICOS usando as proprias palavras das mensagens]\n• Problemas/Pendencias: [descreva problemas CONCRETOS citados com as palavras usadas, ou "Nenhum problema identificado"]\n• Tom geral: [Urgente/Tranquilo/Insatisfeito/Satisfeito/Neutro - com breve justificativa]\n• Informacoes sugeridas: [liste o que o grupo ainda precisa definir ou verificar para resolver pendencias abertas - se tudo estiver resolvido, escreva "Nenhuma"]\n\nEste resumo foi gerado automaticamente pela IAzinha\n\n${messagesContext}\n\nSe nao houver mensagens hoje, retorne:\nResumo do Grupo "${nome_do_grupo}"\nNenhuma mensagem encontrada hoje neste grupo.\nEste resumo foi gerado automaticamente pela IAzinha\n\nIMPORTANTE: Use o formato de bullet points acima. Cite palavras EXATAS das mensagens nos assuntos e problemas.`
              }
            ],
            temperature: 0.2,
            max_tokens: 1024,
          })
        })

        let summaryText: string
        if (!groqResp.ok) {
          const errText = await groqResp.text()
          console.error('[AI Group Summary] Groq error:', groqResp.status, errText)
          summaryText = `Resumo do Grupo "${nome_do_grupo}"\n\nErro ao gerar resumo com IA. Tente novamente mais tarde.\n\nEste resumo foi gerado automaticamente pela IAzinha`
        } else {
          const groqData = await groqResp.json()
          summaryText = groqData?.choices?.[0]?.message?.content || `Resumo do Grupo "${nome_do_grupo}"\n\nNao foi possivel gerar o resumo.\n\nEste resumo foi gerado automaticamente pela IAzinha`
        }

        // Send summary to WiseApp group
        let messageSent = false
        let sendError: string | null = null
        const sendResp = await fetch(`${WISEAPP_API}/v1/accounts/${account_id}/conversations/${convId}/messages`, {
          method: 'POST',
          headers: wiseHeaders,
          body: JSON.stringify({ content: summaryText, message_type: 'outgoing', private: false })
        })
        if (sendResp.ok) {
          messageSent = true
        } else {
          sendError = await sendResp.text()
          console.error('[AI Group Summary] Failed to send to WiseApp:', sendError)
        }

        // Log to envio_resumo
        await supabase.from('envio_resumo').insert({
          grupo_id: group_id,
          company_id,
          data_envio: todayStr,
          status: messageSent,
          mensagem: messageSent ? 'Resumo gerado e enviado com sucesso' : `Resumo gerado mas falha no envio: ${sendError}`,
          resumo_grupo: summaryText.substring(0, 5000)
        })

        return new Response(JSON.stringify({
          success: true,
          summary: summaryText,
          group_id,
          group_name: nome_do_grupo,
          message_sent: messageSent,
          send_error: sendError
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      } catch (error: any) {
        console.error('[AI Group Summary] Error:', error.message)
        return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── AI Conversation Summary (Conversas & E-mails) ────────────────────────
    if (path === '/ai/conversation-summary' && method === 'POST') {
      try {
        const body = await req.json()
        const { account_id, api_key, conv_id, conv_name, tipo, group_id, company_id } = body

        if (!account_id || !api_key || !conv_id) {
          return new Response(JSON.stringify({ success: false, error: 'account_id, api_key e conv_id sao obrigatorios' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const groqApiKey = Deno.env.get('GROQ_API_KEY')
        if (!groqApiKey) {
          return new Response(JSON.stringify({ success: false, error: 'GROQ_API_KEY nao configurada no servidor' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const WISEAPP_API = 'https://chat.wiseapp360.com/api'
        const wiseHeaders = { 'api_access_token': api_key, 'Content-Type': 'application/json' }

        const now = new Date()
        const brasiliaMs = now.getTime() + (now.getTimezoneOffset() + (-3 * 60)) * 60000
        const brasiliaDate = new Date(brasiliaMs)
        const todayStr = brasiliaDate.toISOString().split('T')[0]
        const todayFormatted = `${todayStr.split('-')[2]}/${todayStr.split('-')[1]}/${todayStr.split('-')[0]}`

        let todayMessages: { time: string; sender: string; content: string }[] = []
        let beforeId: number | null = null
        for (let _page = 0; _page < 50; _page++) {
          const msgsUrl = `${WISEAPP_API}/v1/accounts/${account_id}/conversations/${conv_id}/messages` +
            (beforeId ? `?before=${beforeId}` : '')
          const msgsResp = await fetch(msgsUrl, { headers: wiseHeaders })
          if (!msgsResp.ok) break
          const msgsData = await msgsResp.json()
          const batch: any[] = msgsData?.payload || []
          if (!batch.length) break

          let hitYesterday = false
          let oldestId: number | null = null
          for (const msg of batch) {
            const createdAt = msg.created_at
            if (!createdAt) continue
            let msgDate: Date
            if (typeof createdAt === 'number') {
              msgDate = new Date(createdAt * 1000)
            } else {
              msgDate = new Date(createdAt)
            }
            const msgBrasiliaMs = msgDate.getTime() + (msgDate.getTimezoneOffset() + (-3 * 60)) * 60000
            const msgBrasiliaDate = new Date(msgBrasiliaMs).toISOString().split('T')[0]

            if (oldestId === null || (msg.id as number) < oldestId) oldestId = msg.id as number

            if (msgBrasiliaDate !== todayStr) { hitYesterday = true; continue }

            const senderInfo = msg.sender
            let senderName = senderInfo?.name || 'Desconhecido'
            if (msg.message_type === 1) senderName = 'Atendente'

            let content = msg.content || ''
            const contentType = msg.content_type || 'text'
            if (contentType === 'image') content = '[Imagem enviada]'
            else if (contentType === 'audio') content = '[Audio enviado]'
            else if (contentType === 'video') content = '[Video enviado]'
            else if (contentType === 'file') content = '[Arquivo enviado]'
            else if (!content) content = '[Mensagem sem texto]'

            const msgBrasiliaTime = new Date(msgBrasiliaMs)
            const timeStr = `${String(msgBrasiliaTime.getUTCHours()).padStart(2,'0')}:${String(msgBrasiliaTime.getUTCMinutes()).padStart(2,'0')}`
            todayMessages.push({ time: timeStr, sender: senderName, content })
          }

          if (hitYesterday || batch.length < 20) break
          beforeId = oldestId
        }
        todayMessages.reverse()

        const tipoLabel = tipo === 'email' ? 'E-mail' : 'Conversa'
        const displayName = conv_name || 'Desconhecido'

        let messagesContext: string
        if (todayMessages.length === 0) {
          messagesContext = `Nenhuma mensagem encontrada hoje (${todayFormatted}) na ${tipoLabel.toLowerCase()}.`
        } else {
          messagesContext = `MENSAGENS DO DIA - ${tipoLabel}: ${displayName}\nData: ${todayFormatted}\nTotal de mensagens hoje: ${todayMessages.length}\n${'─'.repeat(40)}\n`
          messagesContext += todayMessages.slice(-80).map(m => `[${m.time}] ${m.sender}: ${m.content}`).join('\n')
        }

        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: `Voce e um assistente especializado em suporte ao cliente que gera resumos concisos e uteis de conversas. Regras absolutas: (1) Cite palavras EXATAS das mensagens - nunca generalize. Se o cliente disse "tela travou", escreva "tela travou". (2) Para conversas curtas ou com pouca informacao, liste SEMPRE o que ainda precisa ser descoberto para resolver o problema. (3) Tom: baseie-se no conteudo real das mensagens para classificar.`
              },
              {
                role: 'user',
                content: `Analise as mensagens da ${tipoLabel.toLowerCase()} "${displayName}" abaixo e gere um resumo no formato EXATO:\n\nResumo da ${tipoLabel} "${displayName}"\n• Quantidade de mensagens: [numero]\n• Principais assuntos: [cite os topicos ESPECIFICOS usando as palavras exatas das mensagens]\n• Problemas/Pendencias: [descreva o problema CONCRETO relatado com as palavras do cliente, ou "Nenhum problema identificado"]\n• Tom geral: [Urgente/Insatisfeito/Satisfeito/Neutro/Tranquilo - com breve justificativa]\n• Informacoes sugeridas: [liste as perguntas que o atendente AINDA deve fazer para entender e resolver melhor o problema, ex: "Qual tela travou?", "Qual dispositivo?", "Quando ocorreu?", "Ja tentou reiniciar?" - se o problema ja esta completamente resolvido e nao falta informacao, escreva "Nenhuma"]\n\nEste resumo foi gerado automaticamente pela IAzinha\n\n${messagesContext}\n\nSe nao houver mensagens hoje, retorne:\nResumo da ${tipoLabel} "${displayName}"\nNenhuma mensagem encontrada hoje.\nEste resumo foi gerado automaticamente pela IAzinha\n\nIMPORTANTE: Mesmo que a conversa tenha poucas mensagens, extraia tudo que puder e sugira informacoes relevantes.`
              }
            ],
            temperature: 0.2,
            max_tokens: 1024,
          })
        })

        let summaryText: string
        if (!groqResp.ok) {
          const errText = await groqResp.text()
          console.error('[AI Conversation Summary] Groq error:', groqResp.status, errText)
          summaryText = `Resumo da ${tipoLabel} "${displayName}"\n\nErro ao gerar resumo com IA. Tente novamente mais tarde.\n\nEste resumo foi gerado automaticamente pela IAzinha`
        } else {
          const groqData = await groqResp.json()
          summaryText = groqData?.choices?.[0]?.message?.content || `Resumo da ${tipoLabel} "${displayName}"\n\nNao foi possivel gerar o resumo.\n\nEste resumo foi gerado automaticamente pela IAzinha`
        }

        let messageSent = false
        let sendError: string | null = null
        const sendResp = await fetch(`${WISEAPP_API}/v1/accounts/${account_id}/conversations/${conv_id}/messages`, {
          method: 'POST',
          headers: wiseHeaders,
          body: JSON.stringify({ content: summaryText, message_type: 'outgoing', private: true })
        })
        if (sendResp.ok) {
          messageSent = true
        } else {
          sendError = await sendResp.text()
          console.error('[AI Conversation Summary] Failed to send to WiseApp:', sendError)
        }

        await supabase.from('envio_resumo').insert({
          grupo_id: group_id,
          company_id,
          data_envio: todayStr,
          status: messageSent,
          mensagem: messageSent ? 'Resumo gerado e enviado com sucesso' : `Resumo gerado mas falha no envio: ${sendError}`,
          resumo_grupo: summaryText.substring(0, 5000),
          tipo: tipo || 'conversa'
        })

        return new Response(JSON.stringify({
          success: true,
          summary: summaryText,
          group_id,
          conv_name: displayName,
          message_sent: messageSent,
          send_error: sendError
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      } catch (error: any) {
        console.error('[AI Conversation Summary] Error:', error.message)
        return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── WiseApp Contacts Search by Name ─────────────────────────────────────
    if (path.match(/^\/wiseapp\/(\d+)\/contacts-search$/) && method === 'GET') {
      try {
        const match = path.match(/^\/wiseapp\/(\d+)\/contacts-search$/)
        const accountId = match![1]
        const url = new URL(req.url)
        const query = url.searchParams.get('q') || ''
        const page = url.searchParams.get('page') || '1'

        const freshToken = await fetchFreshToken(supabase, accountId)
        if (!freshToken) {
          return new Response(JSON.stringify({ error: 'Token nao encontrado' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const searchUrl = query
          ? `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(query)}&page=${page}`
          : `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=&page=${page}`

        const response = await wiseAppFetchWithRetry(supabase, accountId, searchUrl, {
          method: 'GET', headers: { 'Content-Type': 'application/json' }
        }, freshToken.token)

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar contatos', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── WiseApp Contact Conversations ───────────────────────────────────────
    if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/conversations$/) && method === 'GET') {
      try {
        const match = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/conversations$/)
        const accountId = match![1]
        const contactId = match![2]

        const freshToken = await fetchFreshToken(supabase, accountId)
        if (!freshToken) {
          return new Response(JSON.stringify({ error: 'Token nao encontrado' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const convUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`
        const response = await wiseAppFetchWithRetry(supabase, accountId, convUrl, {
          method: 'GET', headers: { 'Content-Type': 'application/json' }
        }, freshToken.token)

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar conversas do contato', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── WiseApp Conversations by Inbox ──────────────────────────────────────
    if (path.match(/^\/wiseapp\/(\d+)\/conversations$/) && method === 'GET') {
      try {
        const match = path.match(/^\/wiseapp\/(\d+)\/conversations$/)
        const accountId = match![1]
        const url = new URL(req.url)
        const inboxId = url.searchParams.get('inbox_id') || ''
        const page = url.searchParams.get('page') || '1'

        if (!inboxId) {
          return new Response(JSON.stringify({ error: 'inbox_id e obrigatorio' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const freshToken = await fetchFreshToken(supabase, accountId)
        if (!freshToken) {
          return new Response(JSON.stringify({ error: 'Token nao encontrado' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const convUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/conversations?inbox_id=${inboxId}&page=${page}`
        const response = await wiseAppFetchWithRetry(supabase, accountId, convUrl, {
          method: 'GET', headers: { 'Content-Type': 'application/json' }
        }, freshToken.token)

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar conversas', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
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
    
    const { data: tokenRows, error } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp, id_conta_wiseapp, email, nome, wiseapp_acesso_id')
      .eq('id_conta_wiseapp', companyId)
      .not('access_token_wiseapp', 'is', null)
      .order('wiseapp_acesso_id', { ascending: false })
      .limit(1);
    
    const data = tokenRows?.[0] || null;
    
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
    const accountId = match![1]
    
    console.log('Debug: Buscando labels para account_id:', accountId);
    
    // Buscar token do banco de dados
    const freshToken = await fetchFreshToken(supabase, accountId);

    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta empresa',
        details: 'Nenhum token encontrado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch labels from WiseApp API with retry
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`
    
    try {
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        wiseAppUrl,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        freshToken.token
      );

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
    const accountId = match![1]
    
    console.log('Debug: Criando label para account_id:', accountId);
    
    // Buscar token do banco de dados
    const freshToken = await fetchFreshToken(supabase, accountId);

    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta empresa',
        details: 'Nenhum token encontrado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestBody = await req.text()
    
    // Parse and transform request body to handle different field names
    let parsedBody: any = {};
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (e) {
      parsedBody = {};
    }
    
    // Accept title, name, or nome as the label name
    const labelName = parsedBody.title || parsedBody.name || parsedBody.nome;
    const labelColor = parsedBody.color || parsedBody.cor || '#3B82F6';
    
    const wiseAppBody = JSON.stringify({
      title: labelName,
      color: labelColor,
      show_on_sidebar: parsedBody.show_on_sidebar ?? true
    });

    // Create label in WiseApp
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`
    
    try {
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        wiseAppUrl,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: wiseAppBody },
        freshToken.token
      );

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

  // Update (PATCH) WiseApp label
  if (path.match(/^\/wiseapp\/(\d+)\/labels\/(\d+)$/) && method === 'PATCH') {
    const match = path.match(/^\/wiseapp\/(\d+)\/labels\/(\d+)$/)
    const accountId = match![1]
    const labelId = match![2]

    console.log('Debug: Atualizando label', labelId, 'para account_id:', accountId);

    const freshToken = await fetchFreshToken(supabase, accountId);
    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta empresa',
        details: 'Nenhum token encontrado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let parsedBody: any = {};
    try {
      parsedBody = await req.json();
    } catch (_) {}

    const labelName = parsedBody.title || parsedBody.name || parsedBody.nome;
    const labelColor = parsedBody.color || parsedBody.cor;

    const updatePayload: any = {};
    if (labelName !== undefined) updatePayload.title = labelName;
    if (labelColor !== undefined) updatePayload.color = labelColor;
    if (parsedBody.description !== undefined) updatePayload.description = parsedBody.description;
    if (parsedBody.show_on_sidebar !== undefined) updatePayload.show_on_sidebar = parsedBody.show_on_sidebar;

    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`;

    try {
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        wiseAppUrl,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        },
        freshToken.token
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Debug: Update label failed with status ${response.status}: ${errorText}`);
        return new Response(JSON.stringify({
          error: `WiseApp API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json();
      console.log('Debug: Label updated successfully');
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Erro ao atualizar label no WiseApp',
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
    const accountId = match![1]
    const labelId = match![2]
    
    console.log('Debug: Deletando label', labelId, 'para account_id:', accountId);
    
    // Buscar token do banco de dados
    const freshToken = await fetchFreshToken(supabase, accountId);

    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token WiseApp não configurado para esta empresa',
        details: 'Nenhum token encontrado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete label from WiseApp
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`
    
    try {
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        wiseAppUrl,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
        freshToken.token
      );

      if (!response.ok) {
        const errorText = await response.text()
        console.log(`Debug: Delete label failed with status ${response.status}: ${errorText}`);
        return new Response(JSON.stringify({
          error: `WiseApp API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Debug: Label deleted successfully');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
    const accountId = match![1]
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    
    console.log('Debug: Buscando contatos para account_id:', accountId, 'phone:', phone);
    
    if (!phone) {
      return new Response(JSON.stringify({
        error: 'Phone é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar token do banco de dados
    const freshToken = await fetchFreshToken(supabase, accountId);

    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token não encontrado',
        details: 'Nenhum token disponível'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const formattedPhone = `55${phone}`
    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`

    try {
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        wiseappUrl,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        freshToken.token
      );

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

  // GET labels from contact
  if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/) && method === 'GET') {
    const match = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/)
    const accountId = match![1]
    const contactId = match![2]
    
    console.log('Debug: Buscando labels para account_id:', accountId, 'contact_id:', contactId);
    
    // Buscar token do banco de dados
    const freshToken = await fetchFreshToken(supabase, accountId);

    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token não encontrado para buscar labels',
        details: 'Nenhum token disponível'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const urlGet = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`
    
    try {
      console.log('Debug: GET labels URL:', urlGet);
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        urlGet,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        freshToken.token
      );

      const data = await response.json()
      console.log('Debug: GET labels response status:', response.status);
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Debug: Erro ao buscar labels:', error);
      return new Response(JSON.stringify({
        error: 'Erro ao buscar labels',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Apply labels to contact
  if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/) && method === 'POST') {
    const match = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/)
    const accountId = match![1]
    const contactId = match![2]
    
    console.log('Debug: Aplicando labels para account_id:', accountId, 'contact_id:', contactId);
    
    // Buscar token do banco de dados
    const freshToken = await fetchFreshToken(supabase, accountId);

    if (!freshToken) {
      return new Response(JSON.stringify({
        error: 'Token não encontrado',
        details: 'Nenhum token disponível'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestBody = await req.json()
    
    const labelUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`
    
    let labelsToApply: string[] = []
    
    if (requestBody.labels && Array.isArray(requestBody.labels)) {
      labelsToApply = requestBody.labels
    } else if (requestBody.tagName) {
      // Buscar labels existentes primeiro com retry
      try {
        const getResponse = await wiseAppFetchWithRetry(
          supabase,
          accountId,
          labelUrl,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } },
          freshToken.token
        );
        
        if (getResponse.ok) {
          const currentData = await getResponse.json();
          const existingLabels = currentData.payload || [];
          labelsToApply = [...existingLabels, requestBody.tagName];
          console.log(`Debug: Found ${existingLabels.length} existing labels, adding ${requestBody.tagName}`);
        } else {
          console.log(`Debug: GET labels returned ${getResponse.status}, using only new tag`);
          labelsToApply = [requestBody.tagName];
        }
      } catch (getError) {
        console.log('Debug: Error getting existing labels:', getError);
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
      console.log(`Debug: Applying labels ${JSON.stringify(labelsToApply)} to contact ${contactId}`);
      
      const response = await wiseAppFetchWithRetry(
        supabase,
        accountId,
        labelUrl,
        { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labels: labelsToApply })
        },
        freshToken.token
      );

      if (!response.ok) {
        const errorText = await response.text()
        console.log(`Debug: Apply labels failed with status ${response.status}: ${errorText}`);
        return new Response(JSON.stringify({
          error: `WiseApp API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      console.log('Debug: Labels applied successfully:', data);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      console.error('Debug: Error applying labels:', error);
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
        .from('motorista')
        .select('contato_id:motorista_id, nome, telefone, foto_whatsapp')
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

  // GET /company/by-account/:accountId
  const byAccountMatch = path.match(/^\/company\/by-account\/(.+)$/)
  if (byAccountMatch && method === 'GET') {
    try {
      const accountId = byAccountMatch[1]
      const { data: companies, error } = await supabase
        .from('company')
        .select('*')
        .eq('id_conta_wiseapp', accountId)
        .limit(1)
      if (error) {
        console.error('Error fetching company:', error)
        return new Response(JSON.stringify({ error: 'Erro ao buscar empresa', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (!companies || companies.length === 0) {
        return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const company = companies[0]
      return new Response(JSON.stringify({
        company_id: company.company_id || company.id,
        razao_social: company.nome,
        id_conta_wiseapp: company.id_conta_wiseapp,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
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

  // GET /clientes/:companyId — simple dropdown list filtered by company (must be before paginated handler)
  const getByCompanyMatch = path.match(/^\/clientes\/(\d+)$/)
  if (getByCompanyMatch && method === 'GET') {
    try {
      const cId = parseInt(getByCompanyMatch[1])
      const { data, error } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', cId)
        .eq('st_cliente', true)
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar clientes', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

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

  // GET /vagas/dashboard/:companyId
  if (path.match(/^\/vagas\/dashboard\/(\d+)$/) && method === 'GET') {
    const match = path.match(/^\/vagas\/dashboard\/(\d+)$/)
    const cId = parseInt(match![1])
    const [vagasRes, statusRes] = await Promise.all([
      supabase.from('vaga').select('*').eq('company_id', cId),
      supabase.from('st_vaga').select('id, status_vaga').eq('company_id', cId),
    ])
    if (vagasRes.error) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar vagas', details: vagasRes.error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const vagas = vagasRes.data || []
    if (statusRes.error) {
      console.error('[vagas/dashboard] st_vaga lookup error:', statusRes.error.message)
    }
    const statusMap: Record<number, string> = {}
    ;(statusRes.data || []).forEach((s: any) => { statusMap[s.id] = s.status_vaga })
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const totalVagas = vagas.length
    const vagasAbertas = vagas.filter((v: any) => {
      const st = statusMap[v.st_vaga_id]
      return st === 'Em Andamento' || st === 'Ativa' || st === 'Aberta'
    }).length
    const vagasFechadas = vagas.filter((v: any) => {
      const st = statusMap[v.st_vaga_id]
      return st === 'Fechada' || st === 'Finalizada' || st === 'Concluída'
    }).length
    const vagasVencendo = vagas.filter((v: any) => {
      if (!v.dt_limite) return false
      const d = new Date(v.dt_limite)
      return d >= now && d <= sevenDaysFromNow
    }).length
    return new Response(JSON.stringify({ totalVagas, vagasAbertas, vagasFechadas, vagasVencendo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // GET /vagas/company/:companyId — enriched list with joined names
  const companyMatch = path.match(/^\/vagas\/company\/(\d+)$/)
  if (companyMatch && method === 'GET') {
    try {
      const companyId = parseInt(companyMatch[1])
      const { data: vagas, error: vagasError } = await supabase
        .from('vaga')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (vagasError) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar vagas', details: vagasError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (!vagas || vagas.length === 0) {
        return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const [clientesRes, unidadesRes, operacoesRes, statusRes] = await Promise.all([
        supabase.from('cliente').select('cliente_id, nome').eq('company_id', companyId),
        supabase.from('unidade').select('id, unidade').eq('company_id', companyId),
        supabase.from('operacao').select('id, operacao').eq('company_id', companyId),
        supabase.from('st_vaga').select('id, status_vaga').eq('company_id', companyId),
      ])
      if (clientesRes.error) console.error('[vagas/company] clientes lookup error:', clientesRes.error.message)
      if (unidadesRes.error) console.error('[vagas/company] unidades lookup error:', unidadesRes.error.message)
      if (operacoesRes.error) console.error('[vagas/company] operacoes lookup error:', operacoesRes.error.message)
      if (statusRes.error) console.error('[vagas/company] st_vaga lookup error:', statusRes.error.message)
      const clientesMap: Record<number, string> = {}
      ;(clientesRes.data || []).forEach((c: any) => { clientesMap[c.cliente_id] = c.nome })
      const unidadesMap: Record<number, string> = {}
      ;(unidadesRes.data || []).forEach((u: any) => { unidadesMap[u.id] = u.unidade })
      const operacoesMap: Record<number, string> = {}
      ;(operacoesRes.data || []).forEach((o: any) => { operacoesMap[o.id] = o.operacao })
      const statusMap: Record<number, string> = {}
      ;(statusRes.data || []).forEach((s: any) => { statusMap[s.id] = s.status_vaga })
      const enriched = vagas.map((vaga: any) => ({
        ...vaga,
        cliente_nome: clientesMap[vaga.cliente_id] || null,
        unidade_nome: unidadesMap[vaga.unidade_id] || null,
        operacao_nome: operacoesMap[vaga.operacao_id] || null,
        status_nome: statusMap[vaga.st_vaga_id] || null,
      }))
      return new Response(JSON.stringify(enriched), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // PATCH /vagas/:vagaId/status
  const patchStatusMatch = path.match(/^\/vagas\/(\d+)\/status$/)
  if (patchStatusMatch && method === 'PATCH') {
    try {
      const vagaId = parseInt(patchStatusMatch[1])
      const body = await req.json()
      const { data, error } = await supabase
        .from('vaga')
        .update({ st_vaga_id: Number(body.st_vaga_id), updated_at: new Date().toISOString() })
        .eq('id', vagaId)
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao atualizar status da vaga', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // PATCH /vagas/:vagaId/ativo
  const patchAtivoMatch = path.match(/^\/vagas\/(\d+)\/ativo$/)
  if (patchAtivoMatch && method === 'PATCH') {
    try {
      const vagaId = parseInt(patchAtivoMatch[1])
      const body = await req.json()
      if (!body.company_id) {
        return new Response(JSON.stringify({ error: 'company_id é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const { data, error } = await supabase
        .from('vaga')
        .update({ ativo: Boolean(body.ativo), updated_at: new Date().toISOString() })
        .eq('id', vagaId)
        .eq('company_id', Number(body.company_id))
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao atualizar vaga', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // PUT /vagas/:vagaId
  const putVagaMatch = path.match(/^\/vagas\/(\d+)$/)
  if (putVagaMatch && method === 'PUT') {
    try {
      const vagaId = parseInt(putVagaMatch[1])
      const vagaData = await req.json()
      if (typeof vagaData.dias_trabalho === 'string') {
        vagaData.dias_trabalho = vagaData.dias_trabalho.split(',').map((d: string) => d.trim())
      }
      if ('dt_limite' in vagaData) {
        vagaData.dt_limite = vagaData.dt_limite ? new Date(vagaData.dt_limite).toISOString() : null
      }
      const updatePayload: any = {
        nome: vagaData.nome,
        descricao: vagaData.descricao,
        quantidade: Number(vagaData.quantidade),
        dias_trabalho: vagaData.dias_trabalho,
        horario: vagaData.horario,
        dt_limite: vagaData.dt_limite,
        company_id: Number(vagaData.company_id),
        unidade_id: vagaData.unidade_id ? Number(vagaData.unidade_id) : null,
        operacao_id: vagaData.operacao_id ? Number(vagaData.operacao_id) : null,
        st_vaga_id: vagaData.st_vaga_id ? Number(vagaData.st_vaga_id) : null,
        cliente_id: vagaData.cliente_id ? Number(vagaData.cliente_id) : null,
        gr_id: vagaData.gr_id ? Number(vagaData.gr_id) : null,
        updated_at: new Date().toISOString(),
      }
      if (vagaData.distancia !== undefined) updatePayload.distancia = vagaData.distancia || null
      if (vagaData.tipo_contrato !== undefined) updatePayload.tipo_contrato = vagaData.tipo_contrato || null
      if (vagaData.ativo !== undefined) updatePayload.ativo = vagaData.ativo
      const { data, error } = await supabase
        .from('vaga')
        .update(updatePayload)
        .eq('id', vagaId)
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao atualizar vaga', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ success: true, vaga: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // DELETE /vagas/:vagaId
  if (putVagaMatch && method === 'DELETE') {
    try {
      const vagaId = parseInt(putVagaMatch[1])
      const { error } = await supabase.from('vaga').delete().eq('id', vagaId)
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao deletar vaga', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // GET /vagas/:companyId — simple list
  const getVagasMatch = path.match(/^\/vagas\/(\d+)$/)
  if (getVagasMatch && method === 'GET') {
    try {
      const companyId = parseInt(getVagasMatch[1])
      const { data, error } = await supabase.from('vaga').select('*').eq('company_id', companyId)
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar vagas', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /vagas — create
  if (path === '/vagas' && method === 'POST') {
    try {
      const vagaData = await req.json()
      if (typeof vagaData.dias_trabalho === 'string') {
        vagaData.dias_trabalho = vagaData.dias_trabalho.split(',').map((d: string) => d.trim())
      }
      vagaData.dt_limite = vagaData.dt_limite ? new Date(vagaData.dt_limite).toISOString() : null
      const { data, error } = await supabase
        .from('vaga')
        .insert({
          nome: vagaData.nome,
          descricao: vagaData.descricao,
          quantidade: Number(vagaData.quantidade),
          dias_trabalho: vagaData.dias_trabalho,
          horario: vagaData.horario,
          dt_limite: vagaData.dt_limite,
          distancia: vagaData.distancia || null,
          tipo_contrato: vagaData.tipo_contrato || null,
          ativo: vagaData.ativo !== undefined ? vagaData.ativo : true,
          company_id: Number(vagaData.company_id),
          unidade_id: vagaData.unidade_id ? Number(vagaData.unidade_id) : null,
          operacao_id: vagaData.operacao_id ? Number(vagaData.operacao_id) : null,
          st_vaga_id: vagaData.st_vaga_id ? Number(vagaData.st_vaga_id) : null,
          cliente_id: vagaData.cliente_id ? Number(vagaData.cliente_id) : null,
          gr_id: vagaData.gr_id ? Number(vagaData.gr_id) : null,
        })
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao criar vaga', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
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

// Unidades routes handler
async function handleUnidadesRoutes(req: Request, path: string, method: string, supabase: any) {
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET /unidades/:companyId
  const getMatch = path.match(/^\/unidades\/(\d+)$/)
  if (getMatch && method === 'GET') {
    try {
      const companyId = parseInt(getMatch[1])
      const { data, error } = await supabase.from('unidade').select('*').eq('company_id', companyId)
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar unidades', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /unidades
  if (path === '/unidades' && method === 'POST') {
    try {
      const body = await req.json()
      const { data, error } = await supabase
        .from('unidade')
        .insert({ unidade: body.unidade, company_id: Number(body.company_id) })
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao criar unidade', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint Unidades não encontrado', path, method }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Status-vagas routes handler
async function handleStatusVagasRoutes(req: Request, path: string, method: string, supabase: any) {
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET /status-vagas/:companyId
  const getMatch = path.match(/^\/status-vagas\/(\d+)$/)
  if (getMatch && method === 'GET') {
    try {
      const companyId = parseInt(getMatch[1])
      const { data, error } = await supabase.from('st_vaga').select('*').eq('company_id', companyId)
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar status das vagas', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /status-vagas
  if (path === '/status-vagas' && method === 'POST') {
    try {
      const body = await req.json()
      const { data, error } = await supabase
        .from('st_vaga')
        .insert({ status_vaga: body.status_vaga, company_id: Number(body.company_id) })
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao criar status', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint Status Vagas não encontrado', path, method }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

// Operacoes routes handler
async function handleOperacoesRoutes(req: Request, path: string, method: string, supabase: any) {
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET /operacoes/:companyId — simple lookup list for dropdowns (must be before sub-path matchers)
  const getOperacoesMatch = path.match(/^\/operacoes\/(\d+)$/)
  if (getOperacoesMatch && method === 'GET') {
    try {
      const companyId = parseInt(getOperacoesMatch[1])
      const { data, error } = await supabase.from('operacao').select('*').eq('company_id', companyId)
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar operações', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /operacoes — create a new operacao
  if (path === '/operacoes' && method === 'POST') {
    try {
      const body = await req.json()
      const { data, error } = await supabase
        .from('operacao')
        .insert({ operacao: body.operacao, company_id: Number(body.company_id) })
        .select()
        .single()
      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao criar operação', details: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(data), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // GET /operacoes/faturamento/cesari
  if (path === '/operacoes/faturamento/cesari' && method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('faturamento_cesari')
        .select('*')
        .eq('ativo', true)
        .order('local', { ascending: true })
        .order('sentido', { ascending: true })

      if (error) {
        console.error('Error fetching faturamento cesari:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /operacoes/faturamento/cesari
  if (path === '/operacoes/faturamento/cesari' && method === 'POST') {
    try {
      const body = await req.json()
      console.log('[POST faturamento cesari] Creating new row:', body)

      const { data, error } = await supabase
        .from('faturamento_cesari')
        .insert([{
          local: body.local,
          tipo_carga: body.tipo_carga,
          sentido: body.sentido,
          destino_especial: body.destino_especial || null,
          valor_frete: body.valor_frete,
          valor_pernoite: body.valor_pernoite,
          comissao_motorista: body.comissao_motorista,
          comissao_pernoite_feriado_motorista: body.comissao_pernoite_feriado_motorista,
          observacoes: body.observacoes || null,
        }])
        .select()
        .single()

      if (error) {
        console.error('[POST faturamento cesari] Insert error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // PUT /operacoes/faturamento/cesari/:id
  const putCesariMatch = path.match(/^\/operacoes\/faturamento\/cesari\/(\d+)$/)
  if (putCesariMatch && method === 'PUT') {
    try {
      const id = putCesariMatch[1]
      const body = await req.json()
      console.log(`[PUT faturamento cesari] Updating id=${id}:`, body)

      const updateData: any = { updated_at: new Date().toISOString() }
      if (body.local !== undefined) updateData.local = body.local
      if (body.tipo_carga !== undefined) updateData.tipo_carga = body.tipo_carga
      if (body.sentido !== undefined) updateData.sentido = body.sentido
      if (body.destino_especial !== undefined) updateData.destino_especial = body.destino_especial
      if (body.valor_frete !== undefined) updateData.valor_frete = body.valor_frete
      if (body.valor_pernoite !== undefined) updateData.valor_pernoite = body.valor_pernoite
      if (body.comissao_motorista !== undefined) updateData.comissao_motorista = body.comissao_motorista
      if (body.comissao_pernoite_feriado_motorista !== undefined) updateData.comissao_pernoite_feriado_motorista = body.comissao_pernoite_feriado_motorista
      if (body.observacoes !== undefined) updateData.observacoes = body.observacoes
      if (body.ativo !== undefined) updateData.ativo = body.ativo

      const { data, error } = await supabase
        .from('faturamento_cesari')
        .update(updateData)
        .eq('id', parseInt(id))
        .select()
        .single()

      if (error) {
        console.error(`[PUT faturamento cesari] Update error:`, error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // DELETE /operacoes/faturamento/cesari/:id
  const deleteCesariMatch = path.match(/^\/operacoes\/faturamento\/cesari\/(\d+)$/)
  if (deleteCesariMatch && method === 'DELETE') {
    try {
      const id = deleteCesariMatch[1]
      console.log(`[DELETE faturamento cesari] Soft-deleting id=${id}`)

      const { error } = await supabase
        .from('faturamento_cesari')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', parseInt(id))

      if (error) {
        console.error(`[DELETE faturamento cesari] Error:`, error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // GET /operacoes/financeiro/cesari/:companyId
  const financeiroCesariMatch = path.match(/^\/operacoes\/financeiro\/cesari\/(\d+)$/)
  if (financeiroCesariMatch && method === 'GET') {
    try {
      const companyId = parseInt(financeiroCesariMatch[1])
      if (isNaN(companyId)) {
        return new Response(JSON.stringify({ error: 'Invalid companyId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: opData, error: opError } = await supabase
        .from('operacao_cesari')
        .select('*')

      if (opError) {
        console.error('Error fetching operacao cesari data:', opError)
        return new Response(JSON.stringify({ error: opError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!opData || opData.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const viagemIds = [...new Set(opData.map((op: any) => op.id_viagem).filter(Boolean))]

      const { data: viagensEmpresa, error: viagensError } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial, km_rodado, company_id')
        .in('id', viagemIds)

      if (viagensError) {
        console.error('Error fetching viagens:', viagensError)
        return new Response(JSON.stringify({ error: viagensError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const viagensFiltered = (viagensEmpresa || []).filter((v: any) =>
        v.company_id === companyId || v.company_id === null
      )

      if (viagensFiltered.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const filteredViagemIds = new Set(viagensFiltered.map((v: any) => v.id))
      const filteredOpData = opData.filter((op: any) => filteredViagemIds.has(op.id_viagem))

      if (filteredOpData.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const motoristaIds = [...new Set(viagensFiltered.map((v: any) => v.motorista_id).filter(Boolean))]
      let motoristasMap: Record<number, string> = {}
      if (motoristaIds.length > 0) {
        const { data: motoristasData } = await supabase
          .from('motorista')
          .select('motorista_id, nome')
          .in('motorista_id', motoristaIds)
        ;(motoristasData || []).forEach((m: any) => {
          motoristasMap[m.motorista_id] = m.nome
        })
      }

      const result = filteredOpData.map((op: any) => {
        const viagem = viagensFiltered.find((v: any) => v.id === op.id_viagem)
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || 'Desconhecido' : 'Desconhecido',
        }
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime())

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // GET /operacoes/financeiro/:operacao/:companyId (mitsubishi/autoservice/tegma)
  const financeiroMatch = path.match(/^\/operacoes\/financeiro\/([^/]+)\/(\d+)$/)
  if (financeiroMatch && method === 'GET') {
    try {
      const operacao = financeiroMatch[1]
      const companyId = parseInt(financeiroMatch[2])

      if (isNaN(companyId)) {
        return new Response(JSON.stringify({ error: 'Invalid companyId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const validOperacoes: Record<string, string> = {
        mitsubishi: 'operacao_mitsubishi',
        autoservice: 'operacao_autoservice',
        tegma: 'operacao_tegma',
      }

      const tableName = validOperacoes[operacao.toLowerCase()]
      if (!tableName) {
        return new Response(JSON.stringify({ error: 'Invalid operacao' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: opData, error: opError } = await supabase
        .from(tableName)
        .select('*')

      if (opError) {
        console.error('Error fetching operacao data:', opError)
        return new Response(JSON.stringify({ error: opError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!opData || opData.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const viagemIds = [...new Set(opData.map((op: any) => op.id_viagem).filter(Boolean))]

      const { data: viagensEmpresa, error: viagensError } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial, km_rodado, company_id')
        .in('id', viagemIds)

      if (viagensError) {
        console.error('Error fetching viagens:', viagensError)
        return new Response(JSON.stringify({ error: viagensError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const viagensFiltered = (viagensEmpresa || []).filter((v: any) =>
        v.company_id === companyId || v.company_id === null
      )

      if (viagensFiltered.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const filteredViagemIds = new Set(viagensFiltered.map((v: any) => v.id))
      const filteredOpData = opData.filter((op: any) => filteredViagemIds.has(op.id_viagem))

      if (filteredOpData.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const motoristaIds = [...new Set(viagensFiltered.map((v: any) => v.motorista_id).filter(Boolean))]
      let motoristasMap: Record<number, string> = {}
      if (motoristaIds.length > 0) {
        const { data: motoristasData } = await supabase
          .from('motorista')
          .select('motorista_id, nome')
          .in('motorista_id', motoristaIds)
        ;(motoristasData || []).forEach((m: any) => {
          motoristasMap[m.motorista_id] = m.nome
        })
      }

      const result = filteredOpData.map((op: any) => {
        const viagem = viagensFiltered.find((v: any) => v.id === op.id_viagem)
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || 'Desconhecido' : 'Desconhecido',
        }
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime())

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // GET /operacoes/faturamento/:operacao (mitsubishi/autoservice/tegma)
  const getFaturamentoMatch = path.match(/^\/operacoes\/faturamento\/([^/]+)$/)
  if (getFaturamentoMatch && method === 'GET') {
    try {
      const operacao = getFaturamentoMatch[1]

      const validTables: Record<string, string> = {
        mitsubishi: 'faturamento_mitsubishi',
        autoservice: 'faturamento_autoservice',
        tegma: 'faturamento_tegma',
      }

      const tableName = validTables[operacao.toLowerCase()]
      if (!tableName) {
        return new Response(JSON.stringify({ error: 'Invalid operacao' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify(data?.[0] || null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /operacoes/faturamento/:operacao (mitsubishi/autoservice/tegma)
  const postFaturamentoMatch = path.match(/^\/operacoes\/faturamento\/([^/]+)$/)
  if (postFaturamentoMatch && method === 'POST') {
    try {
      const operacao = postFaturamentoMatch[1]
      const body = await req.json()

      const validTables: Record<string, string> = {
        mitsubishi: 'faturamento_mitsubishi',
        autoservice: 'faturamento_autoservice',
        tegma: 'faturamento_tegma',
      }

      const tableName = validTables[operacao.toLowerCase()]
      if (!tableName) {
        return new Response(JSON.stringify({ error: 'Invalid operacao' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log(`[POST faturamento] Saving to ${tableName}:`, body)

      const { data: existing, error: fetchError } = await supabase
        .from(tableName)
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error(`[POST faturamento] Error checking existing:`, fetchError)
        return new Response(JSON.stringify({ error: fetchError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const existingId = existing?.[0]?.id

      if (existingId) {
        const { data, error } = await supabase
          .from(tableName)
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('id', existingId)
          .select()
          .single()

        if (error) {
          console.error(`[POST faturamento] Update error:`, error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        console.log(`[POST faturamento] Updated ${tableName} id=${existingId}`)
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        const { data, error } = await supabase
          .from(tableName)
          .insert([body])
          .select()
          .single()

        if (error) {
          console.error(`[POST faturamento] Insert error:`, error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        console.log(`[POST faturamento] Inserted new row into ${tableName}`)
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // POST /operacoes/sada/identificar-mitsubishi
  if (path === '/operacoes/sada/identificar-mitsubishi' && method === 'POST') {
    try {
      const { viagens } = await req.json() as { viagens: { id_operacao: number; modelo: string }[] }

      const fallback = (viagens || []).map((v: any) => ({ id_operacao: v.id_operacao, qtd_mitsubishi: 0 }))

      if (!viagens || viagens.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const groqKey = Deno.env.get('GROQ_API_KEY')
      if (!groqKey) {
        console.warn('[SADA IA] GROQ_API_KEY não configurado — retornando zeros')
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const systemPrompt = `Você é um especialista em identificação de modelos de veículos automotores.
Para cada entrada do array JSON fornecido, identifique quantos veículos da marca Mitsubishi estão descritos no campo "modelo".
Modelos Mitsubishi incluem (mas não se limitam a): Eclipse Cross, Outlander, ASX, L200, Pajero, Galant, Colt, Lancer, Carisma, Space Star, Triton, Strada, e qualquer variação que mencione explicitamente "mitsubishi".
Retorne APENAS um array JSON válido, sem nenhum texto adicional, comentários ou markdown. Formato: [{"id_operacao": N, "qtd_mitsubishi": M}]`

      const userPrompt = `Analise as seguintes viagens e retorne quantos veículos Mitsubishi cada uma possui:
${JSON.stringify(viagens)}
Retorne APENAS o array JSON no formato: [{"id_operacao": N, "qtd_mitsubishi": M}]`

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        }),
      })

      if (!groqResponse.ok) {
        console.error(`[SADA IA] Groq API error: ${groqResponse.status}`)
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const groqData = await groqResponse.json()
      const content: string = groqData?.choices?.[0]?.message?.content || '[]'
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('[SADA IA] Resposta do Groq sem JSON válido:', content)
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const parsed = JSON.parse(jsonMatch[0])
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error: any) {
      console.error('[SADA IA] Erro:', error.message)
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify({
    error: 'Endpoint Operacoes não encontrado',
    path,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
