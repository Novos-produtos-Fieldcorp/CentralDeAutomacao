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
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
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
      
      // Extrair account_id da URL para buscar o token correto
      const accountMatch = apiPath.match(/\/accounts\/(\d+)\//);
      let token = null;
      
      if (accountMatch) {
        const accountId = accountMatch[1];
        
        // Buscar company_id baseado no account_id
        const { data: companies } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .limit(1);
        
        if (companies && companies.length > 0) {
          // Buscar token WiseApp para esta empresa
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
      
      // Configurar headers para WiseApp
      const wiseAppHeaders = {
        'Content-Type': 'application/json'
      };
      
      // Usar token do banco de dados ou fallback para headers/env
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

    // Rota para sincronização individual de motorista com WiseApp
    if (path.match(/^\/wiseapp\/sync-motorista\/(\d+)$/) && method === 'POST') {
      const motoristaId = path.match(/^\/wiseapp\/sync-motorista\/(\d+)$/)[1];
      const companyId = event.headers['company-id'] || '1';
      
      console.log(`Netlify: Syncing motorista ${motoristaId} for company ${companyId}`);
      
      // Buscar dados do motorista
      const { data: motorista, error: motoristaError } = await supabase
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('motorista_id', motoristaId)
        .eq('company_id', companyId)
        .single();
      
      if (motoristaError || !motorista) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Motorista não encontrado' })
        };
      }
      
      if (!motorista.telefone) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: false, message: 'Motorista não possui telefone cadastrado' })
        };
      }
      
      // Buscar token WiseApp
      const { data: tokenData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (!tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Token WiseApp não configurado' })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      // Buscar contato no WiseApp
      const phone = `55${motorista.telefone}`;
      const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!searchResponse.ok) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: false, message: 'Erro ao buscar contato no WiseApp' })
        };
      }
      
      const searchData = await searchResponse.json();
      
      if (searchData.payload?.length > 0) {
        const contact = searchData.payload[0];
        
        // Se tem foto e é diferente da atual, atualizar
        if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
          const { error: updateError } = await supabase
            .from('motorista')
            .update({ foto_whatsapp: contact.thumbnail })
            .eq('motorista_id', motoristaId);
          
          if (!updateError) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ 
                success: true, 
                message: 'Foto sincronizada com sucesso',
                contactId: contact.id,
                photoUpdated: true
              })
            };
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            message: 'Contato encontrado, foto já atualizada',
            contactId: contact.id,
            photoUpdated: false
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, message: 'Contato não encontrado no WiseApp' })
      };
    }

    // Rota para sincronização em lote de motoristas
    if (path === '/wiseapp/sync-all-motoristas' && method === 'POST') {
      const companyId = event.headers['company-id'] || '1';
      
      console.log(`Netlify: Bulk sync for company ${companyId}`);
      
      // Buscar token WiseApp
      const { data: tokenData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (!tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Token WiseApp não configurado' })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      // Buscar todos os motoristas ativos com telefone
      const { data: motoristas, error: motoristasError } = await supabase
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .not('telefone', 'is', null);
      
      if (motoristasError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Erro ao buscar motoristas' })
        };
      }
      
      const results = {
        totalProcessed: motoristas?.length || 0,
        successful: 0,
        failed: 0,
        errors: []
      };
      
      if (!motoristas || motoristas.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, data: results })
        };
      }
      
      // Processar cada motorista
      for (const motorista of motoristas) {
        try {
          const phone = `55${motorista.telefone}`;
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;
          
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.payload?.length > 0) {
              const contact = searchData.payload[0];
              
              // Se tem foto e é diferente da atual, atualizar
              if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
                const { error: updateError } = await supabase
                  .from('motorista')
                  .update({ foto_whatsapp: contact.thumbnail })
                  .eq('motorista_id', motorista.motorista_id);
                
                if (!updateError) {
                  results.successful++;
                } else {
                  results.failed++;
                  results.errors.push({
                    motorista_id: motorista.motorista_id,
                    nome: motorista.nome || 'N/A',
                    error: 'Erro ao atualizar foto no banco'
                  });
                }
              } else {
                results.successful++;
              }
            } else {
              results.failed++;
              results.errors.push({
                motorista_id: motorista.motorista_id,
                nome: motorista.nome || 'N/A',
                error: 'Contato não encontrado no WiseApp'
              });
            }
          } else {
            results.failed++;
            results.errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome || 'N/A',
              error: 'Erro ao buscar no WiseApp'
            });
          }
          
          // Delay entre requisições para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome || 'N/A',
            error: error.message || 'Erro desconhecido'
          });
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: results })
      };
    }

    // Rota para atualizar foto WhatsApp de motorista
    if (path.match(/^\/motoristas\/(\d+)\/whatsapp-photo$/) && (method === 'PUT' || method === 'PATCH')) {
      const motoristaId = path.match(/^\/motoristas\/(\d+)\/whatsapp-photo$/)[1];
      const { foto_whatsapp } = body || {};
      
      console.log(`Netlify: Updating WhatsApp photo for motorista ${motoristaId}`);
      
      if (!foto_whatsapp) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "foto_whatsapp is required" })
        };
      }

      const { data, error } = await supabase
        .from('motorista')
        .update({ foto_whatsapp })
        .eq('motorista_id', motoristaId)
        .select();

      if (error) {
        console.error('Netlify: Error updating WhatsApp photo:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to update WhatsApp photo', details: error })
        };
      }

      console.log(`Netlify: WhatsApp photo updated successfully for motorista ${motoristaId}:`, data);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data })
      };
    }

    // Rota para validar configuração WiseApp
    if (path === '/wiseapp/validate-config' && method === 'POST') {
      const companyId = body?.companyId || event.headers['company-id'] || '1';
      
      console.log(`Netlify: Validating WiseApp config for company ${companyId}`);
      
      // Buscar token WiseApp
      const { data: tokenData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (!tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            valid: false,
            error: "Token WiseApp não configurado para esta empresa" 
          })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      // Testar acesso ao WiseApp
      const testUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/inboxes`;
      
      try {
        const testResponse = await fetch(testUrl, {
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (testResponse.ok) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              valid: true, 
              message: "Configuração WiseApp válida e funcionando" 
            })
          };
        } else {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              valid: false, 
              error: `Erro de autenticação WiseApp: ${testResponse.status}` 
            })
          };
        }
      } catch (error) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            valid: false, 
            error: `Erro ao conectar com WiseApp: ${error.message}` 
          })
        };
      }
    }

    // Rota para proxy WiseApp genérico
    if (path === '/wiseapp-proxy') {
      const targetUrl = queryParams.url;
      const accountId = queryParams.account_id;
      
      if (!targetUrl || !accountId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'URL e account_id são obrigatórios' })
        };
      }
      
      console.log(`Netlify: WiseApp proxy to ${targetUrl}`);
      
      // Buscar token WiseApp baseado no account_id
      const { data: companyData } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId)
        .limit(1);
      
      if (!companyData || companyData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Company not found for account_id' })
        };
      }
      
      const { data: tokenData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', companyData[0].company_id)
        .limit(1);
      
      if (!tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Token WiseApp não configurado' })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      // Fazer a requisição proxy
      const proxyHeaders = {
        'api_access_token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      try {
        const proxyResponse = await fetch(targetUrl, {
          method: method,
          headers: proxyHeaders,
          body: method !== 'GET' ? JSON.stringify(body) : undefined
        });
        
        const responseData = await proxyResponse.json();
        
        return {
          statusCode: proxyResponse.status,
          headers,
          body: JSON.stringify(responseData)
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Proxy request failed', details: error.message })
        };
      }
    }

    // Rota para buscar labels do ChatWoot (compatível com frontend)
    if (path.match(/^\/wiseapp\/(\d+)\/labels$/) && method === 'GET') {
      const companyId = path.match(/^\/wiseapp\/(\d+)\/labels$/)[1];
      
      console.log(`Netlify: Fetching ChatWoot labels for company ${companyId}`);
      
      // Buscar dados da empresa e token
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (companyError || !companies || companies.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "Empresa não encontrada" 
          })
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
          body: JSON.stringify({ 
            error: "Token WiseApp não configurado para esta empresa" 
          })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      try {
        // Buscar labels do ChatWoot API
        const labelsResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`, {
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
              message: "Erro ao buscar labels do ChatWoot"
            })
          };
        }
        
        const labels = await labelsResponse.json();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(labels)
        };
        
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Erro ao buscar labels do ChatWoot',
            details: error.message
          })
        };
      }
    }

    // Rota para gerenciar labels de contatos específicos
    if (path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/)) {
      const companyId = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/)[1];
      const contactId = path.match(/^\/wiseapp\/(\d+)\/contacts\/(\d+)\/labels$/)[2];
      
      console.log(`Netlify: Managing contact labels for company ${companyId}, contact ${contactId}`);
      
      // Buscar dados da empresa e token
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (companyError || !companies || companies.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "Empresa não encontrada" 
          })
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
          body: JSON.stringify({ 
            error: "Token WiseApp não configurado para esta empresa" 
          })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      try {
        // Fazer requisição para ChatWoot API
        const targetUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
        
        const requestOptions = {
          method: method,
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        };
        
        if (method === 'POST' && body) {
          requestOptions.body = JSON.stringify(body);
        }
        
        const response = await fetch(targetUrl, requestOptions);
        
        if (!response.ok) {
          return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({
              error: `ChatWoot API error: ${response.status}`,
              message: "Erro ao gerenciar labels do contato"
            })
          };
        }
        
        const responseData = await response.json();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(responseData)
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

    // Rota GET /tags para buscar tags por company_id
    if (path === '/tags' && method === 'GET') {
      const companyId = queryParams.company_id;
      
      if (!companyId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "company_id é obrigatório" })
        };
      }
      
      try {
        const { data: tags, error } = await supabase
          .from('tags')
          .select('*')
          .eq('company_id', parseInt(companyId))
          .order('nome');
        
        if (error) {
          console.error('Error fetching tags:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: "Erro interno do servidor",
              details: error.message 
            })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(tags || [])
        };
        
      } catch (error) {
        console.error('Error in tags route:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: "Erro interno do servidor",
            details: error instanceof Error ? error.message : "Erro desconhecido"
          })
        };
      }
    }

    // Rota para sincronização de tags com WiseApp
    if (path === '/tags/sync-wiseapp' && method === 'POST') {
      const companyId = body?.companyId || event.headers['company-id'] || '1';
      
      console.log(`Netlify: Syncing tags for company ${companyId}`);
      
      // Buscar token WiseApp
      const { data: tokenData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);
      
      if (!tokenData || tokenData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Token WiseApp não configurado' })
        };
      }
      
      const token = tokenData[0].access_token_wiseapp;
      
      try {
        // Buscar labels do WiseApp
        const labelsResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${companyId}/labels`, {
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!labelsResponse.ok) {
          throw new Error(`Failed to fetch labels from WiseApp: ${labelsResponse.status}`);
        }
        
        const labels = await labelsResponse.json();
        let syncedCount = 0;
        const errors = [];
        
        // Sincronizar cada label como tag
        for (const label of labels) {
          try {
            // Verificar se a tag já existe
            const { data: existingTag } = await supabase
              .from('tags')
              .select('id')
              .eq('nome', label.title)
              .eq('company_id', companyId)
              .limit(1);
            
            if (!existingTag || existingTag.length === 0) {
              // Criar nova tag
              const { error: insertError } = await supabase
                .from('tags')
                .insert([{
                  nome: label.title,
                  cor: label.color || '#3B82F6',
                  company_id: parseInt(companyId),
                  wiseapp_label_id: label.id
                }]);
              
              if (insertError) {
                errors.push({ label: label.title, error: insertError.message });
              } else {
                syncedCount++;
              }
            }
          } catch (error) {
            errors.push({ label: label.title, error: error.message });
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `${syncedCount} tags sincronizadas com sucesso`,
            syncedCount,
            totalLabels: labels.length,
            errors
          })
        };
        
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Erro ao sincronizar tags com WiseApp',
            details: error.message
          })
        };
      }
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