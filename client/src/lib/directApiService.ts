// Serviço para chamadas diretas sem backend Express
import { supabase } from './supabase';

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
    const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;

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
export const getWiseAppLabels = async (companyId: number) => {
  const { data: tokenData, error } = await supabase
    .from('wiseapp_acesso')
    .select('access_token_wiseapp, account_id')
    .eq('company_id', companyId)
    .single();
    
  if (error || !tokenData) {
    throw new Error('Token WiseApp não encontrado para esta empresa');
  }
  
  const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${tokenData.account_id}/labels`, {
    headers: {
      'api_access_token': tokenData.access_token_wiseapp,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar labels do WiseApp');
  }

  return response.json();
};

export const searchWiseAppContact = async (companyId: number, phone: string) => {
  const { data: tokenData, error } = await supabase
    .from('wiseapp_acesso')
    .select('access_token_wiseapp, account_id')
    .eq('company_id', companyId)
    .single();
    
  if (error || !tokenData) {
    throw new Error('Token WiseApp não encontrado para esta empresa');
  }
  
  const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${tokenData.account_id}/contacts/search?q=${phone}`, {
    headers: {
      'api_access_token': tokenData.access_token_wiseapp,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar contato no WiseApp');
  }

  return response.json();
};

export const applyWiseAppContactLabels = async (companyId: number, contactId: number, labelIds: number[]) => {
  const { data: tokenData, error } = await supabase
    .from('wiseapp_acesso')
    .select('access_token_wiseapp, account_id')
    .eq('company_id', companyId)
    .single();
    
  if (error || !tokenData) {
    throw new Error('Token WiseApp não encontrado para esta empresa');
  }
  
  const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${tokenData.account_id}/contacts/${contactId}/labels`, {
    method: 'POST',
    headers: {
      'api_access_token': tokenData.access_token_wiseapp,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ labels: labelIds })
  });

  if (!response.ok) {
    throw new Error('Erro ao aplicar labels no WiseApp');
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
    const targetUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/inboxes`;

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