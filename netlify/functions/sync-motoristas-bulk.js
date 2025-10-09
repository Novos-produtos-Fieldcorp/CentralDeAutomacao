const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, wiseapp-token, wiseapp-account-id, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, apikey, x-client-info, api_access_token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
  'Access-Control-Allow-Credentials': 'true'
};

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'ok'
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const { company_id } = JSON.parse(event.body);
    
    if (!company_id) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'company_id é obrigatório' })
      };
    }

    console.log(`Iniciando sincronização bulk para company_id: ${company_id}`);

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Configuração do Supabase não encontrada' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar token WiseApp diretamente
    const { data: tokenDataArray, error: tokenError } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', company_id)
      .limit(1);

    const tokenData = tokenDataArray?.[0];
    const token = tokenData?.access_token_wiseapp;

    if (tokenError || !token) {
      console.log('Token WiseApp não encontrado para company_id:', company_id);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Sincronização pulada - Token WiseApp não configurado'
          } 
        })
      };
    }

    console.log('Token WiseApp encontrado, buscando motoristas...');

    // 2. Buscar todos os motoristas e agregados ativos
    const { data: motoristas, error: motoristasError } = await supabase
      .from('motorista')
      .select('*')
      .eq('company_id', company_id)
      .eq('ativo', true);

    if (motoristasError) {
      console.error('Erro ao buscar motoristas:', motoristasError);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Erro ao buscar motoristas: ' + motoristasError.message
          } 
        })
      };
    }

    console.log(`Encontrados ${motoristas?.length || 0} motoristas ativos`);

    if (!motoristas || motoristas.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Nenhum motorista ativo encontrado'
          } 
        })
      };
    }

    const accountId = company_id;
    let successful = 0;
    let failed = 0;
    let tagsImportadas = 0;
    let tagsExportadas = 0;
    const errors = [];

    // 3. Buscar tags locais existentes
    const { data: tagsLocais } = await supabase
      .from('tag')
      .select('*')
      .eq('company_id', company_id);

    const tagsLocaisPorNome = new Map();
    tagsLocais?.forEach(tag => {
      tagsLocaisPorNome.set(tag.nome.toLowerCase(), tag);
    });

    // 4. Buscar associações de tags existentes
    const { data: associacoesExistentes } = await supabase
      .from('associacao_tags')
      .select(`
        motorista_id,
        tag_id,
        tag!inner (
          id,
          nome,
          cor,
          company_id
        )
      `)
      .in('motorista_id', motoristas.map(m => m.motorista_id))
      .eq('tag.company_id', company_id);

    // Organizar tags locais por motorista
    const tagsLocaisPorMotorista = {};
    associacoesExistentes?.forEach((assoc) => {
      if (!tagsLocaisPorMotorista[assoc.motorista_id]) {
        tagsLocaisPorMotorista[assoc.motorista_id] = [];
      }
      if (assoc.tag?.nome) {
        tagsLocaisPorMotorista[assoc.motorista_id].push(assoc.tag.nome);
      }
    });

    console.log(`Iniciando sincronização bidirecional para ${motoristas.length} motoristas`);

    // 5. SINCRONIZAÇÃO BIDIRECIONAL - processar cada motorista
    for (const motorista of motoristas) {
      try {
        if (!motorista.telefone) {
          successful++;
          continue;
        }

        const phone = `55${motorista.telefone}`;
        console.log(`Processando ${motorista.nome_motorista} - ${phone}`);
        
        // Buscar contato no WiseApp
        const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          }
        });

        if (!searchResponse.ok) {
          failed++;
          errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome_motorista,
            error: `Erro ao buscar no WiseApp: ${searchResponse.status}`
          });
          continue;
        }

        const searchData = await searchResponse.json();

        if (searchData.payload?.length > 0) {
          const contact = searchData.payload[0];
          console.log(`Contato encontrado: ${motorista.nome_motorista} (ID: ${contact.id})`);

          // PARTE 1: WiseApp → Banco Local (IMPORTAR)
          const labelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
          const labelsResponse = await fetch(labelsUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });

          if (labelsResponse.ok) {
            const labelsData = await labelsResponse.json();
            const wiseAppLabels = labelsData.payload || [];
            
            console.log(`Tags no WiseApp para ${motorista.nome_motorista}: ${wiseAppLabels.map(l => l.title).join(', ')}`);
            
            // Importar tags do WiseApp
            for (const wiseLabel of wiseAppLabels) {
              let tagLocal = tagsLocaisPorNome.get(wiseLabel.title.toLowerCase());
              
              // Criar tag local se não existir
              if (!tagLocal) {
                const { data: novaTag } = await supabase
                  .from('tag')
                  .insert({
                    nome: wiseLabel.title,
                    cor: wiseLabel.color || '#3B82F6',
                    company_id: company_id
                  })
                  .select()
                  .single();
                
                if (novaTag) {
                  tagLocal = novaTag;
                  tagsLocaisPorNome.set(wiseLabel.title.toLowerCase(), novaTag);
                  console.log(`Nova tag criada: ${wiseLabel.title}`);
                }
              }

              // Criar associação se não existir
              if (tagLocal) {
                const associacaoExiste = associacoesExistentes?.some((a) => 
                  a.motorista_id === motorista.motorista_id && a.tag_id === tagLocal.id
                );

                if (!associacaoExiste) {
                  await supabase
                    .from('associacao_tags')
                    .insert({
                      motorista_id: motorista.motorista_id,
                      tag_id: tagLocal.id
                    });
                  tagsImportadas++;
                  console.log(`Tag importada: ${wiseLabel.title} → ${motorista.nome_motorista}`);
                }
              }
            }
          }

          // PARTE 2: Banco Local → WiseApp (EXPORTAR)
          const tagsParaExportar = tagsLocaisPorMotorista[motorista.motorista_id] || [];
          
          if (tagsParaExportar.length > 0) {
            console.log(`Exportando tags para ${motorista.nome_motorista}: ${tagsParaExportar.join(', ')}`);
            
            const applyTagsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
            const applyTagsResponse = await fetch(applyTagsUrl, {
              method: 'POST',
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ labels: tagsParaExportar })
            });

            if (applyTagsResponse.ok) {
              tagsExportadas += tagsParaExportar.length;
              console.log(`Tags exportadas com sucesso para ${motorista.nome_motorista}`);
            } else {
              console.warn(`Erro ao exportar tags para ${motorista.nome_motorista}: ${applyTagsResponse.status}`);
            }
          }

          successful++;
        } else {
          console.log(`Contato não encontrado no WiseApp: ${motorista.nome_motorista}`);
          successful++;
        }
      } catch (error) {
        console.error(`Erro processando ${motorista.nome_motorista}:`, error);
        failed++;
        errors.push({
          motorista_id: motorista.motorista_id,
          nome: motorista.nome_motorista,
          error: error.message
        });
      }
    }

    const result = {
      data: {
        totalProcessed: motoristas.length,
        successful,
        failed,
        tagsImportadas,
        tagsExportadas,
        errors,
        message: `Sincronização bidirecional concluída: ${successful} contatos processados, ${tagsImportadas} tags importadas do WiseApp, ${tagsExportadas} tags exportadas para o WiseApp`
      }
    };

    console.log(`Sincronização bidirecional concluída: ${successful} sucessos, ${failed} falhas, ${tagsImportadas} tags importadas, ${tagsExportadas} tags exportadas`);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Erro na sincronização bulk:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido'
      })
    };
  }
};
