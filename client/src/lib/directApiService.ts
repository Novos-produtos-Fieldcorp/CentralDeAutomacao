// Serviço para chamadas diretas sem backend Express
import { supabase } from './supabase';
import { API_BASE_URL } from './api-config';

// Serviço para buscar empresa por account_id
export const getCompanyByAccountId = async (accountId: string) => {
  const { data, error } = await supabase
    .from('company')
    .select('*')
    .eq('id_conta_wiseapp', accountId)
    .single();

  if (error) {
    throw new Error(`Company not found for account_id: ${accountId}`);
  }

  return data;
};

// REMOVIDO: getTagsByCompany - agora usamos getWiseAppLabels

// Serviço para criar tag
export const createTag = async (tagData: any) => {
  const { data, error } = await supabase
    .from('tags')
    .insert(tagData)
    .select()
    .single();

  if (error) {
    throw new Error('Failed to create tag');
  }

  return data;
};

// Serviço para atualizar tag
export const updateTag = async (tagId: number, tagData: any) => {
  const { data, error } = await supabase
    .from('tags')
    .update(tagData)
    .eq('id', tagId)
    .select()
    .single();

  if (error) {
    throw new Error('Failed to update tag');
  }

  return data;
};

// Serviço para deletar tag
export const deleteTag = async (tagId: number) => {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId);

  if (error) {
    throw new Error('Failed to delete tag');
  }

  return { success: true };
};

// Serviço para buscar motoristas com tags
export const getMotoristaWithTags = async (motoristaId: number) => {
  const { data, error } = await supabase
    .from('motorista')
    .select('*, tags_ids')
    .eq('motorista_id', motoristaId)
    .single();

  if (error) {
    throw new Error('Failed to fetch motorista');
  }

  return data;
};

// Serviço para atualizar tags do motorista
export const updateMotoristaTags = async (motoristaId: number, tagIds: number[]) => {
  const { data, error } = await supabase
    .from('motorista')
    .update({ tags_ids: tagIds })
    .eq('motorista_id', motoristaId)
    .select()
    .single();

  if (error) {
    throw new Error('Failed to update motorista tags');
  }

  return data;
};

// Serviço para consultar CEP (chamada externa direta)
export const consultarCepDireto = async (cep: string) => {
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos');
  }

  // Usar ViaCEP diretamente
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!response.ok) {
      throw new Error('Falha na consulta CEP');
    }
    
    const data = await response.json();
    
    if (data.erro) {
      throw new Error('CEP não encontrado');
    }
    
    return data;
  } catch (error) {
    // Fallback para outros serviços se ViaCEP falhar
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
      if (!response.ok) {
        throw new Error('Falha na consulta CEP');
      }
      
      const data = await response.json();
      return {
        cep: data.cep,
        logradouro: data.street,
        complemento: '',
        bairro: data.neighborhood,
        localidade: data.city,
        uf: data.state,
        ibge: '',
        gia: '',
        ddd: '',
        siafi: ''
      };
    } catch (fallbackError) {
      throw new Error('CEP não encontrado em nenhum serviço disponível');
    }
  }
};

// Serviço para WiseApp (chamadas diretas)
export const wiseAppService = {
  async syncMotorista(motoristaId: number, companyId: number) {
    // Buscar token WiseApp da empresa
    const { data: tokenData } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .single();

    if (!tokenData) {
      throw new Error('Token WiseApp não configurado');
    }

    // Buscar dados do motorista
    const { data: motorista } = await supabase
      .from('motorista')
      .select('nome, telefone, foto_whatsapp')
      .eq('motorista_id', motoristaId)
      .eq('company_id', companyId)
      .single();

    if (!motorista || !motorista.telefone) {
      throw new Error('Motorista não encontrado ou sem telefone');
    }

    // Buscar contato no WiseApp
    const phone = `55${motorista.telefone}`;
    const searchUrl = `${CHAT_API_URL}/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'api_access_token': tokenData.access_token_wiseapp,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      throw new Error('Erro ao buscar contato no WiseApp');
    }

    const searchData = await searchResponse.json();

    if (searchData.payload?.length > 0) {
      const contact = searchData.payload[0];

      // Se tem foto e é diferente da atual, atualizar
      if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
        await supabase
          .from('motorista')
          .update({ foto_whatsapp: contact.thumbnail })
          .eq('motorista_id', motoristaId);

        return {
          success: true,
          message: 'Foto sincronizada com sucesso',
          photoUpdated: true
        };
      }

      return {
        success: true,
        message: 'Contato encontrado, foto já atualizada',
        photoUpdated: false
      };
    }

    return {
      success: false,
      message: 'Contato não encontrado no WiseApp'
    };
  },

  async syncMotoristasBulkWithTags(companyId: number) {
    try {
      // 1. Buscar token WiseApp
      const { data: tokenData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', companyId)
        .single();

      if (!tokenData) {
        throw new Error('Token WiseApp não configurado');
      }

      // 2. Buscar todos os motoristas e agregados
      const { data: motoristas } = await supabase
        .from('view_motoristas_completo')
        .select('*')
        .eq('company_id', companyId)
        .eq('ativo', true);

      if (!motoristas || motoristas.length === 0) {
        return { data: { totalProcessed: 0, successful: 0, failed: 0, errors: [] } };
      }

      // 3. Buscar tags locais
      const { data: tagsLocais } = await supabase
        .from('tag')
        .select('*')
        .eq('company_id', companyId);

      // 4. Buscar associações existentes
      const { data: associacoesExistentes } = await supabase
        .from('associacao_tags')
        .select('motorista_id, tag_id, tag(nome, cor)');

      let successful = 0;
      let failed = 0;
      const errors: Array<{ motorista_id: number; nome: string; error: string }> = [];

      // 5. Processar cada motorista
      for (const motorista of motoristas) {
        try {
          if (!motorista.telefone) continue;

          const phone = `55${motorista.telefone}`;
          
          // Buscar contato no WiseApp
          const searchUrl = `${CHAT_API_URL}/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': tokenData.access_token_wiseapp,
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

            // Atualizar foto se necessário
            if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
              await supabase
                .from('motorista')
                .update({ foto_whatsapp: contact.thumbnail })
                .eq('motorista_id', motorista.motorista_id);
            }

            // Buscar labels do contato no WiseApp
            const labelsResponse = await fetch(`${CHAT_API_URL}/api/v1/accounts/${companyId}/contacts/${contact.id}/labels`, {
              headers: {
                'api_access_token': tokenData.access_token_wiseapp,
                'Content-Type': 'application/json'
              }
            });

            if (labelsResponse.ok) {
              const labelsData = await labelsResponse.json();
              const wiseAppLabels = labelsData.payload || [];

              // Importar tags do WiseApp para associacao_tags
              for (const wiseAppLabel of wiseAppLabels) {
                // Verificar se já existe uma tag local com esse nome
                let tagLocal = tagsLocais?.find(t => t.nome.toLowerCase() === wiseAppLabel.title.toLowerCase());
                
                if (!tagLocal) {
                  // Criar tag local se não existir
                  const { data: novaTag } = await supabase
                    .from('tag')
                    .insert({
                      nome: wiseAppLabel.title,
                      cor: wiseAppLabel.color || '#3B82F6',
                      company_id: companyId
                    })
                    .select()
                    .single();
                  
                  if (novaTag) {
                    tagLocal = novaTag;
                    tagsLocais?.push(novaTag);
                  }
                }

                if (tagLocal) {
                  // Verificar se associação já existe
                  const associacaoExiste = associacoesExistentes?.some(a => 
                    a.motorista_id === motorista.motorista_id && a.tag_id === tagLocal.id
                  );

                  if (!associacaoExiste) {
                    // Criar associação
                    await supabase
                      .from('associacao_tags')
                      .insert({
                        motorista_id: motorista.motorista_id,
                        tag_id: tagLocal.id
                      });
                  }
                }
              }

              // Enviar tags locais para o WiseApp
              const tagsParaEnviar = associacoesExistentes
                ?.filter(a => a.motorista_id === motorista.motorista_id)
                .map(a => a.tag ? (a.tag as any).nome : null)
                .filter(Boolean) || [];

              if (tagsParaEnviar.length > 0) {
                const applyLabelsResponse = await fetch(`${CHAT_API_URL}/api/v1/accounts/${companyId}/contacts/${contact.id}/labels`, {
                  method: 'POST',
                  headers: {
                    'api_access_token': tokenData.access_token_wiseapp,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ labels: tagsParaEnviar })
                });

                if (!applyLabelsResponse.ok) {
                  console.warn(`Erro ao aplicar tags no WiseApp para ${motorista.nome_motorista}:`, applyLabelsResponse.status);
                }
              }
            }

            successful++;
          } else {
            // Contato não encontrado no WiseApp - apenas contar como processado
            successful++;
          }
        } catch (error) {
          failed++;
          errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome_motorista,
            error: (error as Error).message
          });
        }
      }

      return {
        data: {
          totalProcessed: motoristas.length,
          successful,
          failed,
          errors
        }
      };

    } catch (error) {
      throw new Error(`Erro na sincronização bidirecional: ${(error as Error).message}`);
    }
  },

  async validateConfig(companyId: number) {
    const { data: tokenData } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .single();

    if (!tokenData) {
      return {
        valid: false,
        error: 'Token WiseApp não configurado para esta empresa'
      };
    }

    // Testar acesso ao WiseApp
    const testUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/inboxes`;

    try {
      const testResponse = await fetch(testUrl, {
        headers: {
          'api_access_token': tokenData.access_token_wiseapp,
          'Content-Type': 'application/json'
        }
      });

      if (testResponse.ok) {
        return {
          valid: true,
          message: 'Configuração WiseApp válida e funcionando'
        };
      } else {
        return {
          valid: false,
          error: `Erro de autenticação WiseApp: ${testResponse.status}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Erro ao conectar com WiseApp: ${(error as Error).message}`
      };
    }
  }
};

// Funções para WiseApp API direto
const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || 'https://chat.wiseapp360.com';

// Buscar todas as labels da conta via backend existente
export const getWiseAppLabels = async (accountId: string, token: string) => {
  // Usar a rota existente no backend com URL configurável
  const url = `${API_BASE_URL}/wiseapp/2/labels`; // Usando companyId 2
  console.log('Fazendo requisição via backend para:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'wiseapp-token': token,
        'wiseapp-account-id': accountId
      }
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API WiseApp via backend:', response.status, errorText);
      throw new Error(`Erro ao buscar labels do WiseApp: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Response data:', data);
    return data;
  } catch (error) {
    console.error('Erro na requisição via backend:', error);
    throw error;
  }
};

// Buscar labels de um contato específico
export const getContactLabels = async (accountId: string, token: string, contactId: number) => {
  const response = await fetch(`${CHAT_API_URL}/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
    headers: {
      'api_access_token': token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro na API WiseApp:', response.status, errorText);
    throw new Error(`Erro ao buscar labels do contato: ${response.status}`);
  }

  return response.json();
};

// Buscar contato por telefone via backend existente
export const searchWiseAppContact = async (accountId: string, token: string, phone: string) => {
  const url = `${API_BASE_URL}/wiseapp/2/contacts/search?phone=${phone}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'wiseapp-token': token,
      'wiseapp-account-id': accountId
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro na API WiseApp via backend:', response.status, errorText);
    throw new Error(`Erro ao buscar contato no WiseApp: ${response.status}`);
  }

  return response.json();
};

// Buscar detalhes de um contato específico
export const getWiseAppContact = async (accountId: string, token: string, contactId: number) => {
  const response = await fetch(`${CHAT_API_URL}/api/v1/accounts/${accountId}/contacts/${contactId}`, {
    headers: {
      'api_access_token': token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro na API WiseApp:', response.status, errorText);
    throw new Error(`Erro ao buscar detalhes do contato: ${response.status}`);
  }

  return response.json();
};

// Aplicar labels a um contato via backend existente
export const applyWiseAppContactLabels = async (accountId: string, token: string, contactId: number, labelNames: string[]) => {
  const url = `${API_BASE_URL}/wiseapp/2/contacts/${contactId}/labels`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'wiseapp-token': token,
      'wiseapp-account-id': accountId
    },
    body: JSON.stringify({ labels: labelNames })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro na API WiseApp via backend:', response.status, errorText);
    throw new Error(`Erro ao aplicar labels no WiseApp: ${response.status}`);
  }

  return response.json();
};

// Criar uma nova label na conta
export const createWiseAppLabel = async (accountId: string, token: string, labelData: { title: string; color?: string; description?: string }) => {
  const response = await fetch(`${CHAT_API_URL}/api/v1/accounts/${accountId}/labels`, {
    method: 'POST',
    headers: {
      'api_access_token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(labelData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erro na API WiseApp:', response.status, errorText);
    throw new Error(`Erro ao criar label no WiseApp: ${response.status}`);
  }

  return response.json();
};

// Serviço para ChatWoot (chamadas diretas)
export const chatWootService = {
  async getInboxes(companyId: number, accountId: string) {
    // Buscar token WiseApp da empresa
    const { data: tokenData } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .single();

    if (!tokenData) {
      throw new Error('Token WiseApp não configurado');
    }

    // Verificar cache primeiro
    const cacheKey = `chatwoot_inboxes_${companyId}_${accountId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const cachedData = JSON.parse(cached);
      const expiresAt = cachedData._cache_metadata?.expires_at || 0;
      
      if (Date.now() < expiresAt) {
        console.log('Using cached ChatWoot inboxes');
        return cachedData;
      }
    }

    // Fazer requisição para o ChatWoot
    const targetUrl = `${CHAT_API_URL}/api/v1/accounts/${accountId}/inboxes`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'api_access_token': tokenData.access_token_wiseapp,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token de autenticação inválido ou expirado');
      } else if (response.status === 403) {
        throw new Error('Acesso negado. Verifique as permissões da conta');
      } else if (response.status === 404) {
        throw new Error('Conta não encontrada no ChatWoot');
      }
      throw new Error(`ChatWoot API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Adicionar metadados para cache
    const responseData = {
      ...data,
      _cache_metadata: {
        company_id: companyId,
        account_id: accountId,
        timestamp: Date.now(),
        expires_at: Date.now() + (60 * 60 * 1000) // 1 hora
      }
    };

    // Salvar no cache
    localStorage.setItem(cacheKey, JSON.stringify(responseData));

    return responseData;
  }
};