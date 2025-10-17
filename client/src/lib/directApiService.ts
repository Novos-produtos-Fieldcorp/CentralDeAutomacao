// Serviço para chamadas diretas sem backend Express
import { supabase } from "./supabase";
import { API_BASE_URL, createApiUrl } from "./api-config-supabase";
import { robustWiseAppFetch, clearCache } from "./robustFetch";

// Serviço para buscar empresa por account_id
export const getCompanyByAccountId = async (accountId: string) => {
  const { data, error } = await supabase
    .from("company")
    .select("*")
    .eq("id_conta_wiseapp", accountId)
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
    .from("tags")
    .insert(tagData)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to create tag");
  }

  return data;
};

// Serviço para atualizar tag
export const updateTag = async (tagId: number, tagData: any) => {
  const { data, error } = await supabase
    .from("tags")
    .update(tagData)
    .eq("id", tagId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to update tag");
  }

  return data;
};

// Serviço para deletar tag
export const deleteTag = async (tagId: number) => {
  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) {
    throw new Error("Failed to delete tag");
  }

  return { success: true };
};

// Serviço para buscar motoristas com tags
export const getMotoristaWithTags = async (motoristaId: number) => {
  const { data, error } = await supabase
    .from("motorista")
    .select("*, tags_ids")
    .eq("motorista_id", motoristaId)
    .single();

  if (error) {
    throw new Error("Failed to fetch motorista");
  }

  return data;
};

// Serviço para atualizar tags do motorista
export const updateMotoristaTags = async (
  motoristaId: number,
  tagIds: number[],
) => {
  const { data, error } = await supabase
    .from("motorista")
    .update({ tags_ids: tagIds })
    .eq("motorista_id", motoristaId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to update motorista tags");
  }

  return data;
};

// Serviço para consultar CEP (chamada externa direta)
export const consultarCepDireto = async (cep: string) => {
  const cepLimpo = cep.replace(/\D/g, "");

  if (cepLimpo.length !== 8) {
    throw new Error("CEP deve conter exatamente 8 dígitos");
  }

  // Usar ViaCEP diretamente
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!response.ok) {
      throw new Error("Falha na consulta CEP");
    }

    const data = await response.json();

    if (data.erro) {
      throw new Error("CEP não encontrado");
    }

    return data;
  } catch (error) {
    // Fallback para outros serviços se ViaCEP falhar
    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cep/v1/${cepLimpo}`,
      );
      if (!response.ok) {
        throw new Error("Falha na consulta CEP");
      }

      const data = await response.json();
      return {
        cep: data.cep,
        logradouro: data.street,
        complemento: "",
        bairro: data.neighborhood,
        localidade: data.city,
        uf: data.state,
        ibge: "",
        gia: "",
        ddd: "",
        siafi: "",
      };
    } catch (fallbackError) {
      throw new Error("CEP não encontrado em nenhum serviço disponível");
    }
  }
};

// Serviço para WiseApp (chamadas diretas)
export const wiseAppService = {
  async syncMotorista(motoristaId: number, companyId: number) {
    // Buscar token WiseApp da empresa
    const { data: tokenData } = await supabase
      .from("wiseapp_acesso")
      .select("access_token_wiseapp")
      .eq("company_id", companyId)
      .single();

    if (!tokenData) {
      throw new Error("Token WiseApp não configurado");
    }

    // Buscar dados do motorista
    const { data: motorista } = await supabase
      .from("motorista")
      .select("nome, telefone, foto_whatsapp")
      .eq("motorista_id", motoristaId)
      .eq("company_id", companyId)
      .single();

    if (!motorista || !motorista.telefone) {
      throw new Error("Motorista não encontrado ou sem telefone");
    }

    // Buscar contato no WiseApp
    const phone = `55${motorista.telefone}`;
    const searchUrl = `${CHAT_API_URL}/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        api_access_token: tokenData.access_token_wiseapp,
        "Content-Type": "application/json",
      },
    });

    if (!searchResponse.ok) {
      throw new Error("Erro ao buscar contato no WiseApp");
    }

    const searchData = await searchResponse.json();

    if (searchData.payload?.length > 0) {
      const contact = searchData.payload[0];

      // Se tem foto e é diferente da atual, atualizar
      if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
        await supabase
          .from("motorista")
          .update({ foto_whatsapp: contact.thumbnail })
          .eq("motorista_id", motoristaId);

        return {
          success: true,
          message: "Foto sincronizada com sucesso",
          photoUpdated: true,
        };
      }

      return {
        success: true,
        message: "Contato encontrado, foto já atualizada",
        photoUpdated: false,
      };
    }

    return {
      success: false,
      message: "Contato não encontrado no WiseApp",
    };
  },

  async syncMotoristasBulkWithTags(companyId: number) {
    try {
      // Usar a rota backend que gerencia tudo
      const response = await fetch(
        createApiUrl("wiseapp/sync-motoristas-bulk"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ company_id: companyId }),
        },
      );

      if (!response.ok) {
        throw new Error(`Erro na sincronização: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Erro na sincronização bidirecional: ${(error as Error).message}`,
      );
    }
  },

  async validateConfig(companyId: number) {
    const { data: tokenData } = await supabase
      .from("wiseapp_acesso")
      .select("access_token_wiseapp")
      .eq("company_id", companyId)
      .single();

    if (!tokenData?.access_token_wiseapp) {
      return {
        valid: false,
        error: "Token WiseApp não configurado para esta empresa",
      };
    }

    const testUrl = `/api/v1/accounts/${companyId}/inboxes`;

    try {
      const testResponse = await fetch(testUrl, {
        headers: {
          api_access_token: tokenData.access_token_wiseapp,
          "Content-Type": "application/json",
        },
      });

      if (testResponse.ok) {
        return {
          valid: true,
          message: "Configuração WiseApp válida e funcionando",
        };
      } else {
        return {
          valid: false,
          error: `Erro de autenticação WiseApp: ${testResponse.status}`,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Erro ao conectar com WiseApp: ${(error as Error).message}`,
      };
    }
  },
};

// Funções para WiseApp API via backend proxy
const CHAT_API_URL = "/api/v1"; // Use backend proxy instead of direct API

// Buscar todas as labels da conta via backend existente com retry robusto
export const getWiseAppLabels = async (
  accountId: string,
  token: string,
  companyId?: number,
) => {
  if (!accountId || !token) {
    throw new Error(
      "AccountId e token são obrigatórios para buscar labels do WiseApp.",
    );
  }

  // Determinar companyId dinamicamente se não fornecido
  let finalCompanyId = accountId;

  const primaryUrl = createApiUrl(`wiseapp/${accountId}/labels`);
  const fallbackUrls = [].filter((url) => url !== primaryUrl);

  try {
    const data = await robustWiseAppFetch(
      primaryUrl,
      {
        method: "GET",
        cacheKey: `wiseapp-labels-${accountId}-${finalCompanyId}`,
        cacheTtl: 5 * 60 * 1000,
        fallbackUrls,
        onRetry: (attempt, error) => {
          console.warn(
            `🔄 [getWiseAppLabels] Tentativa ${attempt} falhou:`,
            error.message,
          );
        },
        onFallback: (url, error) => {
          console.warn(
            `🔀 [getWiseAppLabels] Usando URL alternativa ${url}:`,
            error.message,
          );
        },
      },
      accountId,
      token,
    );

    console.log("✅ [getWiseAppLabels] Resposta do WiseApp recebida:", data);
    return data;
  } catch (error) {
    console.error(
      "Erro na requisição via backend (todas as tentativas falharam):",
      error,
    );

    // Tentar retornar dados em cache como último recurso
    try {
      const { data: cachedTags } = await supabase
        .from("tag")
        .select("*")
        .eq("company_id", finalCompanyId)
        .order("nome");

      if (cachedTags && cachedTags.length > 0) {
        console.warn("WiseApp indisponível, usando tags locais como fallback");
        return cachedTags.map((tag) => ({
          id: tag.id,
          title: tag.nome, // WiseApp usa 'title', não 'name'
          color: tag.cor,
          description: "",
        }));
      }
    } catch (cacheError) {
      console.error("Erro ao buscar tags locais como fallback:", cacheError);
    }

    throw error;
  }
};

// Buscar labels de um contato específico
export const getContactLabels = async (
  accountId: string,
  token: string,
  contactId: number,
) => {
  const response = await fetch(
    `${CHAT_API_URL}/api/v1/accounts/${accountId}/contacts/${contactId}/labels`,
    {
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro na API WiseApp:", response.status, errorText);
    throw new Error(`Erro ao buscar labels do contato: ${response.status}`);
  }

  return response.json();
};

// Buscar contato por telefone via backend existente com retry robusto
export const searchWiseAppContact = async (
  accountId: string,
  token: string,
  phone: string,
  companyId: number = 2,
) => {
  if (!accountId || !token) {
    throw new Error(
      "AccountId e token são obrigatórios para buscar contatos do WiseApp.",
    );
  }

  const primaryUrl = createApiUrl(
    `wiseapp/${companyId}/contacts/search?phone=${phone}`,
  );
  const fallbackUrls = [
    createApiUrl(`wiseapp/2/contacts/search?phone=${phone}`),
    createApiUrl(`wiseapp/1/contacts/search?phone=${phone}`),
  ].filter((url) => url !== primaryUrl);

  console.log(
    `Buscando contato por telefone ${phone} via backend para:`,
    primaryUrl,
  );

  try {
    return await robustWiseAppFetch(
      primaryUrl,
      {
        method: "GET",
        cacheKey: `wiseapp-contact-${accountId}-${phone}`,
        cacheTtl: 2 * 60 * 1000,
        fallbackUrls,
        onRetry: (attempt, error) => {
          console.log(
            `[WiseApp Contact] Tentativa ${attempt} falhou para telefone ${phone}: ${error.message}`,
          );
        },
        onFallback: (url, error) => {
          console.log(
            `[WiseApp Contact] Usando URL alternativa ${url} após erro: ${error.message}`,
          );
        },
      },
      accountId,
      token,
    );
  } catch (error) {
    console.error(
      `Erro na requisição de contato por telefone ${phone} (todas as tentativas falharam):`,
      error,
    );
    throw error;
  }
};

// Buscar detalhes de um contato específico
export const getWiseAppContact = async (
  accountId: string,
  token: string,
  contactId: number,
) => {
  const response = await fetch(
    `${CHAT_API_URL}/api/v1/accounts/${accountId}/contacts/${contactId}`,
    {
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro na API WiseApp:", response.status, errorText);
    throw new Error(`Erro ao buscar detalhes do contato: ${response.status}`);
  }

  return response.json();
};

// Aplicar labels a um contato preservando existentes com retry robusto
export const applyWiseAppContactLabels = async (
  accountId: string,
  token: string,
  contactId: number,
  labelNames: string[],
  companyId: number = 2,
) => {
  if (!accountId || !token || !contactId) {
    throw new Error(
      "AccountId, token e contactId são obrigatórios para aplicar labels.",
    );
  }

  const url = createApiUrl(`wiseapp/${companyId}/contacts/${contactId}/labels`);

  console.log(
    `Aplicando labels [${labelNames.join(", ")}] ao contato ${contactId}`,
  );

  try {
    // 1. Buscar labels existentes primeiro (mesma lógica que funciona individual)
    const existingLabelsData = await robustWiseAppFetch(
      url,
      {
        method: "GET",
        cacheKey: `wiseapp-contact-labels-${accountId}-${contactId}`,
        cacheTtl: 30 * 1000, // 30 segundos de cache para labels de contatos
        onRetry: (attempt, error) => {
          console.log(
            `[WiseApp Labels Get] Tentativa ${attempt} falhou para contato ${contactId}: ${error.message}`,
          );
        },
      },
      accountId,
      token,
    );

    const existingLabels: string[] = existingLabelsData?.payload || [];

    // 2. Adicionar novas labels se não existirem (case insensitive)
    const mergedLabels = [...existingLabels];
    for (const newLabel of labelNames) {
      // Verificar se a label já existe (case insensitive)
      const labelExists = mergedLabels.some(
        (existingLabel) =>
          existingLabel.toLowerCase() === newLabel.toLowerCase(),
      );

      if (!labelExists) {
        mergedLabels.push(newLabel);
        console.log(`Adding new label "${newLabel}" to contact ${contactId}`);
      } else {
        console.log(
          `Label "${newLabel}" already exists for contact ${contactId}`,
        );
      }
    }

    // 3. Enviar lista completa (mesma lógica que funciona individual)
    return await robustWiseAppFetch(
      url,
      {
        method: "POST",
        body: JSON.stringify({ labels: mergedLabels }),
        onRetry: (attempt, error) => {
          console.log(
            `[WiseApp Labels Apply] Tentativa ${attempt} falhou para contato ${contactId}: ${error.message}`,
          );
        },
      },
      accountId,
      token,
    );
  } catch (error) {
    console.error(
      `Erro ao aplicar labels ao contato ${contactId} (todas as tentativas falharam):`,
      error,
    );
    throw error;
  }
};

// Criar uma nova label na conta
export const createWiseAppLabel = async (
  accountId: string,
  token: string,
  labelData: { title: string; color?: string; description?: string },
) => {
  const response = await fetch(
    `${CHAT_API_URL}/api/v1/accounts/${accountId}/labels`,
    {
      method: "POST",
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(labelData),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro na API WiseApp:", response.status, errorText);
    throw new Error(`Erro ao criar label no WiseApp: ${response.status}`);
  }

  return response.json();
};

// Serviço para ChatWoot (chamadas diretas)
export const chatWootService = {
  async getInboxes(companyId: number, accountId: string) {
    // Buscar token WiseApp da empresa
    const { data: tokenData } = await supabase
      .from("wiseapp_acesso")
      .select("access_token_wiseapp")
      .eq("company_id", companyId)
      .single();

    if (!tokenData) {
      throw new Error("Token WiseApp não configurado");
    }

    // Verificar cache primeiro
    const cacheKey = `inboxes_${companyId}_${accountId}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const cachedData = JSON.parse(cached);
      const expiresAt = cachedData._cache_metadata?.expires_at || 0;

      if (Date.now() < expiresAt) {
        console.log("Using cached ChatWoot inboxes");
        return cachedData;
      }
    }

    // Fazer requisição para o ChatWoot
    const targetUrl = `${CHAT_API_URL}/api/v1/accounts/${accountId}/inboxes`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        api_access_token: tokenData.access_token_wiseapp,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Token de autenticação inválido ou expirado");
      } else if (response.status === 403) {
        throw new Error("Acesso negado. Verifique as permissões da conta");
      } else if (response.status === 404) {
        throw new Error("Conta não encontrada no ChatWoot");
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
        expires_at: Date.now() + 60 * 60 * 1000, // 1 hora
      },
    };

    // Salvar no cache
    localStorage.setItem(cacheKey, JSON.stringify(responseData));

    return responseData;
  },
};
