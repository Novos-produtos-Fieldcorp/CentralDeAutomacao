import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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
    const { data: tokenDataArray, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .limit(1);

    const tokenData = tokenDataArray?.[0];
    const token = tokenData?.access_token_wiseapp;

    if (tokenError || !token) {
      console.log('Token WiseApp não encontrado para company_id:', companyId);
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
});
